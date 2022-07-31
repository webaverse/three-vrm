/*!
 * @pixiv/three-vrm v0.6.11
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2021 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
import * as THREE from 'three';
import { BufferAttribute } from 'three';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

// See: https://threejs.org/docs/#manual/en/introduction/How-to-dispose-of-objects
function disposeMaterial(material) {
    Object.keys(material).forEach((propertyName) => {
        const value = material[propertyName];
        if (value === null || value === void 0 ? void 0 : value.isTexture) {
            const texture = value;
            texture.dispose();
        }
    });
    material.dispose();
}
function dispose(object3D) {
    const geometry = object3D.geometry;
    if (geometry) {
        geometry.dispose();
    }
    const material = object3D.material;
    if (material) {
        if (Array.isArray(material)) {
            material.forEach((material) => disposeMaterial(material));
        }
        else if (material) {
            disposeMaterial(material);
        }
    }
}
function deepDispose(object3D) {
    object3D.traverse(dispose);
}

var VRMBlendShapeMaterialValueType;
(function (VRMBlendShapeMaterialValueType) {
    VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["NUMBER"] = 0] = "NUMBER";
    VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["VECTOR2"] = 1] = "VECTOR2";
    VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["VECTOR3"] = 2] = "VECTOR3";
    VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["VECTOR4"] = 3] = "VECTOR4";
    VRMBlendShapeMaterialValueType[VRMBlendShapeMaterialValueType["COLOR"] = 4] = "COLOR";
})(VRMBlendShapeMaterialValueType || (VRMBlendShapeMaterialValueType = {}));
const _v2 = new THREE.Vector2();
const _v3$1 = new THREE.Vector3();
const _v4 = new THREE.Vector4();
const _color = new THREE.Color();
// animationMixer の監視対象は、Scene の中に入っている必要がある。
// そのため、表示オブジェクトではないけれど、Object3D を継承して Scene に投入できるようにする。
class VRMBlendShapeGroup extends THREE.Object3D {
    constructor(expressionName) {
        super();
        this.weight = 0.0;
        this.isBinary = false;
        this._binds = [];
        this._materialValues = [];
        this.name = `BlendShapeController_${expressionName}`;
        // traverse 時の救済手段として Object3D ではないことを明示しておく
        this.type = 'BlendShapeController';
        // 表示目的のオブジェクトではないので、負荷軽減のために visible を false にしておく。
        // これにより、このインスタンスに対する毎フレームの matrix 自動計算を省略できる。
        this.visible = false;
    }
    addBind(args) {
        // original weight is 0-100 but we want to deal with this value within 0-1
        const weight = args.weight / 100;
        this._binds.push({
            meshes: args.meshes,
            morphTargetIndex: args.morphTargetIndex,
            weight,
        });
    }
    addMaterialValue(args) {
        const material = args.material;
        const propertyName = args.propertyName;
        let value = material[propertyName];
        if (!value) {
            // property has not been found
            return;
        }
        value = args.defaultValue || value;
        let type;
        let defaultValue;
        let targetValue;
        let deltaValue;
        if (value.isVector2) {
            type = VRMBlendShapeMaterialValueType.VECTOR2;
            defaultValue = value.clone();
            targetValue = new THREE.Vector2().fromArray(args.targetValue);
            deltaValue = targetValue.clone().sub(defaultValue);
        }
        else if (value.isVector3) {
            type = VRMBlendShapeMaterialValueType.VECTOR3;
            defaultValue = value.clone();
            targetValue = new THREE.Vector3().fromArray(args.targetValue);
            deltaValue = targetValue.clone().sub(defaultValue);
        }
        else if (value.isVector4) {
            type = VRMBlendShapeMaterialValueType.VECTOR4;
            defaultValue = value.clone();
            // vectorProperty and targetValue index is different from each other
            // exported vrm by UniVRM file is
            //
            // vectorProperty
            // offset = targetValue[0], targetValue[1]
            // tiling = targetValue[2], targetValue[3]
            //
            // targetValue
            // offset = targetValue[2], targetValue[3]
            // tiling = targetValue[0], targetValue[1]
            targetValue = new THREE.Vector4().fromArray([
                args.targetValue[2],
                args.targetValue[3],
                args.targetValue[0],
                args.targetValue[1],
            ]);
            deltaValue = targetValue.clone().sub(defaultValue);
        }
        else if (value.isColor) {
            type = VRMBlendShapeMaterialValueType.COLOR;
            defaultValue = value.clone();
            targetValue = new THREE.Color().fromArray(args.targetValue);
            deltaValue = targetValue.clone().sub(defaultValue);
        }
        else {
            type = VRMBlendShapeMaterialValueType.NUMBER;
            defaultValue = value;
            targetValue = args.targetValue[0];
            deltaValue = targetValue - defaultValue;
        }
        this._materialValues.push({
            material,
            propertyName,
            defaultValue,
            targetValue,
            deltaValue,
            type,
        });
    }
    /**
     * Apply weight to every assigned blend shapes.
     * Should be called via {@link BlendShapeMaster#update}.
     */
    applyWeight() {
        const w = this.isBinary ? (this.weight < 0.5 ? 0.0 : 1.0) : this.weight;
        this._binds.forEach((bind) => {
            bind.meshes.forEach((mesh) => {
                if (!mesh.morphTargetInfluences) {
                    return;
                } // TODO: we should kick this at `addBind`
                mesh.morphTargetInfluences[bind.morphTargetIndex] += w * bind.weight;
            });
        });
        this._materialValues.forEach((materialValue) => {
            const prop = materialValue.material[materialValue.propertyName];
            if (prop === undefined) {
                return;
            } // TODO: we should kick this at `addMaterialValue`
            if (materialValue.type === VRMBlendShapeMaterialValueType.NUMBER) {
                const deltaValue = materialValue.deltaValue;
                materialValue.material[materialValue.propertyName] += deltaValue * w;
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR2) {
                const deltaValue = materialValue.deltaValue;
                materialValue.material[materialValue.propertyName].add(_v2.copy(deltaValue).multiplyScalar(w));
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR3) {
                const deltaValue = materialValue.deltaValue;
                materialValue.material[materialValue.propertyName].add(_v3$1.copy(deltaValue).multiplyScalar(w));
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR4) {
                const deltaValue = materialValue.deltaValue;
                materialValue.material[materialValue.propertyName].add(_v4.copy(deltaValue).multiplyScalar(w));
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.COLOR) {
                const deltaValue = materialValue.deltaValue;
                materialValue.material[materialValue.propertyName].add(_color.copy(deltaValue).multiplyScalar(w));
            }
            if (typeof materialValue.material.shouldApplyUniforms === 'boolean') {
                materialValue.material.shouldApplyUniforms = true;
            }
        });
    }
    /**
     * Clear previously assigned blend shapes.
     */
    clearAppliedWeight() {
        this._binds.forEach((bind) => {
            bind.meshes.forEach((mesh) => {
                if (!mesh.morphTargetInfluences) {
                    return;
                } // TODO: we should kick this at `addBind`
                mesh.morphTargetInfluences[bind.morphTargetIndex] = 0.0;
            });
        });
        this._materialValues.forEach((materialValue) => {
            const prop = materialValue.material[materialValue.propertyName];
            if (prop === undefined) {
                return;
            } // TODO: we should kick this at `addMaterialValue`
            if (materialValue.type === VRMBlendShapeMaterialValueType.NUMBER) {
                const defaultValue = materialValue.defaultValue;
                materialValue.material[materialValue.propertyName] = defaultValue;
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR2) {
                const defaultValue = materialValue.defaultValue;
                materialValue.material[materialValue.propertyName].copy(defaultValue);
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR3) {
                const defaultValue = materialValue.defaultValue;
                materialValue.material[materialValue.propertyName].copy(defaultValue);
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.VECTOR4) {
                const defaultValue = materialValue.defaultValue;
                materialValue.material[materialValue.propertyName].copy(defaultValue);
            }
            else if (materialValue.type === VRMBlendShapeMaterialValueType.COLOR) {
                const defaultValue = materialValue.defaultValue;
                materialValue.material[materialValue.propertyName].copy(defaultValue);
            }
            if (typeof materialValue.material.shouldApplyUniforms === 'boolean') {
                materialValue.material.shouldApplyUniforms = true;
            }
        });
    }
}

// Typedoc does not support export declarations yet
// then we have to use `namespace` instead of export declarations for now.
// See: https://github.com/TypeStrong/typedoc/pull/801
// eslint-disable-next-line @typescript-eslint/no-namespace
var VRMSchema;
(function (VRMSchema) {
    (function (BlendShapePresetName) {
        BlendShapePresetName["A"] = "a";
        BlendShapePresetName["Angry"] = "angry";
        BlendShapePresetName["Blink"] = "blink";
        BlendShapePresetName["BlinkL"] = "blink_l";
        BlendShapePresetName["BlinkR"] = "blink_r";
        BlendShapePresetName["E"] = "e";
        BlendShapePresetName["Fun"] = "fun";
        BlendShapePresetName["I"] = "i";
        BlendShapePresetName["Joy"] = "joy";
        BlendShapePresetName["Lookdown"] = "lookdown";
        BlendShapePresetName["Lookleft"] = "lookleft";
        BlendShapePresetName["Lookright"] = "lookright";
        BlendShapePresetName["Lookup"] = "lookup";
        BlendShapePresetName["Neutral"] = "neutral";
        BlendShapePresetName["O"] = "o";
        BlendShapePresetName["Sorrow"] = "sorrow";
        BlendShapePresetName["U"] = "u";
        BlendShapePresetName["Unknown"] = "unknown";
    })(VRMSchema.BlendShapePresetName || (VRMSchema.BlendShapePresetName = {}));
    (function (FirstPersonLookAtTypeName) {
        FirstPersonLookAtTypeName["BlendShape"] = "BlendShape";
        FirstPersonLookAtTypeName["Bone"] = "Bone";
    })(VRMSchema.FirstPersonLookAtTypeName || (VRMSchema.FirstPersonLookAtTypeName = {}));
    (function (HumanoidBoneName) {
        HumanoidBoneName["Chest"] = "chest";
        HumanoidBoneName["Head"] = "head";
        HumanoidBoneName["Hips"] = "hips";
        HumanoidBoneName["Jaw"] = "jaw";
        HumanoidBoneName["LeftEye"] = "leftEye";
        HumanoidBoneName["LeftFoot"] = "leftFoot";
        HumanoidBoneName["LeftHand"] = "leftHand";
        HumanoidBoneName["LeftIndexDistal"] = "leftIndexDistal";
        HumanoidBoneName["LeftIndexIntermediate"] = "leftIndexIntermediate";
        HumanoidBoneName["LeftIndexProximal"] = "leftIndexProximal";
        HumanoidBoneName["LeftLittleDistal"] = "leftLittleDistal";
        HumanoidBoneName["LeftLittleIntermediate"] = "leftLittleIntermediate";
        HumanoidBoneName["LeftLittleProximal"] = "leftLittleProximal";
        HumanoidBoneName["LeftLowerArm"] = "leftLowerArm";
        HumanoidBoneName["LeftLowerLeg"] = "leftLowerLeg";
        HumanoidBoneName["LeftMiddleDistal"] = "leftMiddleDistal";
        HumanoidBoneName["LeftMiddleIntermediate"] = "leftMiddleIntermediate";
        HumanoidBoneName["LeftMiddleProximal"] = "leftMiddleProximal";
        HumanoidBoneName["LeftRingDistal"] = "leftRingDistal";
        HumanoidBoneName["LeftRingIntermediate"] = "leftRingIntermediate";
        HumanoidBoneName["LeftRingProximal"] = "leftRingProximal";
        HumanoidBoneName["LeftShoulder"] = "leftShoulder";
        HumanoidBoneName["LeftThumbDistal"] = "leftThumbDistal";
        HumanoidBoneName["LeftThumbIntermediate"] = "leftThumbIntermediate";
        HumanoidBoneName["LeftThumbProximal"] = "leftThumbProximal";
        HumanoidBoneName["LeftToes"] = "leftToes";
        HumanoidBoneName["LeftUpperArm"] = "leftUpperArm";
        HumanoidBoneName["LeftUpperLeg"] = "leftUpperLeg";
        HumanoidBoneName["Neck"] = "neck";
        HumanoidBoneName["RightEye"] = "rightEye";
        HumanoidBoneName["RightFoot"] = "rightFoot";
        HumanoidBoneName["RightHand"] = "rightHand";
        HumanoidBoneName["RightIndexDistal"] = "rightIndexDistal";
        HumanoidBoneName["RightIndexIntermediate"] = "rightIndexIntermediate";
        HumanoidBoneName["RightIndexProximal"] = "rightIndexProximal";
        HumanoidBoneName["RightLittleDistal"] = "rightLittleDistal";
        HumanoidBoneName["RightLittleIntermediate"] = "rightLittleIntermediate";
        HumanoidBoneName["RightLittleProximal"] = "rightLittleProximal";
        HumanoidBoneName["RightLowerArm"] = "rightLowerArm";
        HumanoidBoneName["RightLowerLeg"] = "rightLowerLeg";
        HumanoidBoneName["RightMiddleDistal"] = "rightMiddleDistal";
        HumanoidBoneName["RightMiddleIntermediate"] = "rightMiddleIntermediate";
        HumanoidBoneName["RightMiddleProximal"] = "rightMiddleProximal";
        HumanoidBoneName["RightRingDistal"] = "rightRingDistal";
        HumanoidBoneName["RightRingIntermediate"] = "rightRingIntermediate";
        HumanoidBoneName["RightRingProximal"] = "rightRingProximal";
        HumanoidBoneName["RightShoulder"] = "rightShoulder";
        HumanoidBoneName["RightThumbDistal"] = "rightThumbDistal";
        HumanoidBoneName["RightThumbIntermediate"] = "rightThumbIntermediate";
        HumanoidBoneName["RightThumbProximal"] = "rightThumbProximal";
        HumanoidBoneName["RightToes"] = "rightToes";
        HumanoidBoneName["RightUpperArm"] = "rightUpperArm";
        HumanoidBoneName["RightUpperLeg"] = "rightUpperLeg";
        HumanoidBoneName["Spine"] = "spine";
        HumanoidBoneName["UpperChest"] = "upperChest";
    })(VRMSchema.HumanoidBoneName || (VRMSchema.HumanoidBoneName = {}));
    (function (MetaAllowedUserName) {
        MetaAllowedUserName["Everyone"] = "Everyone";
        MetaAllowedUserName["ExplicitlyLicensedPerson"] = "ExplicitlyLicensedPerson";
        MetaAllowedUserName["OnlyAuthor"] = "OnlyAuthor";
    })(VRMSchema.MetaAllowedUserName || (VRMSchema.MetaAllowedUserName = {}));
    (function (MetaUssageName) {
        MetaUssageName["Allow"] = "Allow";
        MetaUssageName["Disallow"] = "Disallow";
    })(VRMSchema.MetaUssageName || (VRMSchema.MetaUssageName = {}));
    (function (MetaLicenseName) {
        MetaLicenseName["Cc0"] = "CC0";
        MetaLicenseName["CcBy"] = "CC_BY";
        MetaLicenseName["CcByNc"] = "CC_BY_NC";
        MetaLicenseName["CcByNcNd"] = "CC_BY_NC_ND";
        MetaLicenseName["CcByNcSa"] = "CC_BY_NC_SA";
        MetaLicenseName["CcByNd"] = "CC_BY_ND";
        MetaLicenseName["CcBySa"] = "CC_BY_SA";
        MetaLicenseName["Other"] = "Other";
        MetaLicenseName["RedistributionProhibited"] = "Redistribution_Prohibited";
    })(VRMSchema.MetaLicenseName || (VRMSchema.MetaLicenseName = {}));
})(VRMSchema || (VRMSchema = {}));

function extractPrimitivesInternal(gltf, nodeIndex, node) {
    /**
     * Let's list up every possible patterns that parsed gltf nodes with a mesh can have,,,
     *
     * "*" indicates that those meshes should be listed up using this function
     *
     * ### A node with a (mesh, a signle primitive)
     *
     * - `THREE.Mesh`: The only primitive of the mesh *
     *
     * ### A node with a (mesh, multiple primitives)
     *
     * - `THREE.Group`: The root of the mesh
     *   - `THREE.Mesh`: A primitive of the mesh *
     *   - `THREE.Mesh`: A primitive of the mesh (2) *
     *
     * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, a single primitive)
     *
     * - `THREE.Group`: The root of the mesh
     *   - `THREE.Mesh`: A primitive of the mesh *
     *   - `THREE.Mesh`: A primitive of the mesh (2) *
     *   - `THREE.Mesh`: A primitive of a MESH OF THE CHILD
     *
     * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, multiple primitives)
     *
     * - `THREE.Group`: The root of the mesh
     *   - `THREE.Mesh`: A primitive of the mesh *
     *   - `THREE.Mesh`: A primitive of the mesh (2) *
     *   - `THREE.Group`: The root of a MESH OF THE CHILD
     *     - `THREE.Mesh`: A primitive of the mesh of the child
     *     - `THREE.Mesh`: A primitive of the mesh of the child (2)
     *
     * ### A node with a (mesh, multiple primitives) BUT the node is a bone
     *
     * - `THREE.Bone`: The root of the node, as a bone
     *   - `THREE.Group`: The root of the mesh
     *     - `THREE.Mesh`: A primitive of the mesh *
     *     - `THREE.Mesh`: A primitive of the mesh (2) *
     *
     * ### A node with a (mesh, multiple primitives) AND (a child with a mesh, multiple primitives) BUT the node is a bone
     *
     * - `THREE.Bone`: The root of the node, as a bone
     *   - `THREE.Group`: The root of the mesh
     *     - `THREE.Mesh`: A primitive of the mesh *
     *     - `THREE.Mesh`: A primitive of the mesh (2) *
     *   - `THREE.Group`: The root of a MESH OF THE CHILD
     *     - `THREE.Mesh`: A primitive of the mesh of the child
     *     - `THREE.Mesh`: A primitive of the mesh of the child (2)
     *
     * ...I will take a strategy that traverses the root of the node and take first (primitiveCount) meshes.
     */
    // Make sure that the node has a mesh
    const schemaNode = gltf.parser.json.nodes[nodeIndex];
    const meshIndex = schemaNode.mesh;
    if (meshIndex == null) {
        return null;
    }
    // How many primitives the mesh has?
    const schemaMesh = gltf.parser.json.meshes[meshIndex];
    const primitiveCount = schemaMesh.primitives.length;
    // Traverse the node and take first (primitiveCount) meshes
    const primitives = [];
    node.traverse((object) => {
        if (primitives.length < primitiveCount) {
            if (object.isMesh) {
                primitives.push(object);
            }
        }
    });
    return primitives;
}
/**
 * Extract primitives ( `THREE.Mesh[]` ) of a node from a loaded GLTF.
 * The main purpose of this function is to distinguish primitives and children from a node that has both meshes and children.
 *
 * It utilizes the behavior that GLTFLoader adds mesh primitives to the node object ( `THREE.Group` ) first then adds its children.
 *
 * @param gltf A GLTF object taken from GLTFLoader
 * @param nodeIndex The index of the node
 */
function gltfExtractPrimitivesFromNode(gltf, nodeIndex) {
    return __awaiter(this, void 0, void 0, function* () {
        const node = yield gltf.parser.getDependency('node', nodeIndex);
        return extractPrimitivesInternal(gltf, nodeIndex, node);
    });
}
/**
 * Extract primitives ( `THREE.Mesh[]` ) of nodes from a loaded GLTF.
 * See {@link gltfExtractPrimitivesFromNode} for more details.
 *
 * It returns a map from node index to extraction result.
 * If a node does not have a mesh, the entry for the node will not be put in the returning map.
 *
 * @param gltf A GLTF object taken from GLTFLoader
 */
function gltfExtractPrimitivesFromNodes(gltf) {
    return __awaiter(this, void 0, void 0, function* () {
        const nodes = yield gltf.parser.getDependencies('node');
        const map = new Map();
        nodes.forEach((node, index) => {
            const result = extractPrimitivesInternal(gltf, index, node);
            if (result != null) {
                map.set(index, result);
            }
        });
        return map;
    });
}

function renameMaterialProperty(name) {
    if (name[0] !== '_') {
        console.warn(`renameMaterialProperty: Given property name "${name}" might be invalid`);
        return name;
    }
    name = name.substring(1);
    if (!/[A-Z]/.test(name[0])) {
        console.warn(`renameMaterialProperty: Given property name "${name}" might be invalid`);
        return name;
    }
    return name[0].toLowerCase() + name.substring(1);
}

/**
 * Clamp an input number within [ `0.0` - `1.0` ].
 *
 * @param value The input value
 */
function saturate(value) {
    return Math.max(Math.min(value, 1.0), 0.0);
}
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
new THREE.Quaternion();
/**
 * Extract world rotation of an object from its world space matrix, in cheaper way.
 *
 * @param object The object
 * @param out Target vector
 */
function getWorldQuaternionLite(object, out) {
    object.matrixWorld.decompose(_position, out, _scale);
    return out;
}

class VRMBlendShapeProxy {
    /**
     * Create a new VRMBlendShape.
     */
    constructor() {
        /**
         * List of registered blend shape.
         */
        this._blendShapeGroups = {};
        /**
         * A map from [[VRMSchema.BlendShapePresetName]] to its actual blend shape name.
         */
        this._blendShapePresetMap = {};
        /**
         * A list of name of unknown blend shapes.
         */
        this._unknownGroupNames = [];
        // do nothing
    }
    /**
     * List of name of registered blend shape group.
     */
    get expressions() {
        return Object.keys(this._blendShapeGroups);
    }
    /**
     * A map from [[VRMSchema.BlendShapePresetName]] to its actual blend shape name.
     */
    get blendShapePresetMap() {
        return this._blendShapePresetMap;
    }
    /**
     * A list of name of unknown blend shapes.
     */
    get unknownGroupNames() {
        return this._unknownGroupNames;
    }
    /**
     * Return registered blend shape group.
     *
     * @param name Name of the blend shape group
     */
    getBlendShapeGroup(name) {
        const presetName = this._blendShapePresetMap[name];
        const controller = presetName ? this._blendShapeGroups[presetName] : this._blendShapeGroups[name];
        if (!controller) {
            console.warn(`no blend shape found by ${name}`);
            return undefined;
        }
        return controller;
    }
    /**
     * Register a blend shape group.
     *
     * @param name Name of the blend shape gorup
     * @param controller VRMBlendShapeController that describes the blend shape group
     */
    registerBlendShapeGroup(name, presetName, controller) {
        this._blendShapeGroups[name] = controller;
        if (presetName) {
            this._blendShapePresetMap[presetName] = name;
        }
        else {
            this._unknownGroupNames.push(name);
        }
    }
    /**
     * Get current weight of specified blend shape group.
     *
     * @param name Name of the blend shape group
     */
    getValue(name) {
        var _a;
        const controller = this.getBlendShapeGroup(name);
        return (_a = controller === null || controller === void 0 ? void 0 : controller.weight) !== null && _a !== void 0 ? _a : null;
    }
    /**
     * Set a weight to specified blend shape group.
     *
     * @param name Name of the blend shape group
     * @param weight Weight
     */
    setValue(name, weight) {
        const controller = this.getBlendShapeGroup(name);
        if (controller) {
            controller.weight = saturate(weight);
        }
    }
    /**
     * Get a track name of specified blend shape group.
     * This track name is needed to manipulate its blend shape group via keyframe animations.
     *
     * @example Manipulate a blend shape group using keyframe animation
     * ```js
     * const trackName = vrm.blendShapeProxy.getBlendShapeTrackName( THREE.VRMSchema.BlendShapePresetName.Blink );
     * const track = new THREE.NumberKeyframeTrack(
     *   name,
     *   [ 0.0, 0.5, 1.0 ], // times
     *   [ 0.0, 1.0, 0.0 ] // values
     * );
     *
     * const clip = new THREE.AnimationClip(
     *   'blink', // name
     *   1.0, // duration
     *   [ track ] // tracks
     * );
     *
     * const mixer = new THREE.AnimationMixer( vrm.scene );
     * const action = mixer.clipAction( clip );
     * action.play();
     * ```
     *
     * @param name Name of the blend shape group
     */
    getBlendShapeTrackName(name) {
        const controller = this.getBlendShapeGroup(name);
        return controller ? `${controller.name}.weight` : null;
    }
    /**
     * Update every blend shape groups.
     */
    update() {
        Object.keys(this._blendShapeGroups).forEach((name) => {
            const controller = this._blendShapeGroups[name];
            controller.clearAppliedWeight();
        });
        Object.keys(this._blendShapeGroups).forEach((name) => {
            const controller = this._blendShapeGroups[name];
            controller.applyWeight();
        });
    }
}

/**
 * An importer that imports a [[VRMBlendShape]] from a VRM extension of a GLTF.
 */
class VRMBlendShapeImporter {
    /**
     * Import a [[VRMBlendShape]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaBlendShape = vrmExt.blendShapeMaster;
            if (!schemaBlendShape) {
                return null;
            }
            const blendShape = new VRMBlendShapeProxy();
            const blendShapeGroups = schemaBlendShape.blendShapeGroups;
            if (!blendShapeGroups) {
                return blendShape;
            }
            const blendShapePresetMap = {};
            yield Promise.all(blendShapeGroups.map((schemaGroup) => __awaiter(this, void 0, void 0, function* () {
                const name = schemaGroup.name;
                if (name === undefined) {
                    console.warn('VRMBlendShapeImporter: One of blendShapeGroups has no name');
                    return;
                }
                let presetName;
                if (schemaGroup.presetName &&
                    schemaGroup.presetName !== VRMSchema.BlendShapePresetName.Unknown &&
                    !blendShapePresetMap[schemaGroup.presetName]) {
                    presetName = schemaGroup.presetName;
                    blendShapePresetMap[schemaGroup.presetName] = name;
                }
                const group = new VRMBlendShapeGroup(name);
                gltf.scene.add(group);
                group.isBinary = schemaGroup.isBinary || false;
                if (schemaGroup.binds) {
                    schemaGroup.binds.forEach((bind) => __awaiter(this, void 0, void 0, function* () {
                        if (bind.mesh === undefined || bind.index === undefined) {
                            return;
                        }
                        const nodesUsingMesh = [];
                        gltf.parser.json.nodes.forEach((node, i) => {
                            if (node.mesh === bind.mesh) {
                                nodesUsingMesh.push(i);
                            }
                        });
                        const morphTargetIndex = bind.index;
                        yield Promise.all(nodesUsingMesh.map((nodeIndex) => __awaiter(this, void 0, void 0, function* () {
                            var _b;
                            const primitives = (yield gltfExtractPrimitivesFromNode(gltf, nodeIndex));
                            // check if the mesh has the target morph target
                            if (!primitives.every((primitive) => Array.isArray(primitive.morphTargetInfluences) &&
                                morphTargetIndex < primitive.morphTargetInfluences.length)) {
                                console.warn(`VRMBlendShapeImporter: ${schemaGroup.name} attempts to index ${morphTargetIndex}th morph but not found.`);
                                return;
                            }
                            group.addBind({
                                meshes: primitives,
                                morphTargetIndex,
                                weight: (_b = bind.weight) !== null && _b !== void 0 ? _b : 100,
                            });
                        })));
                    }));
                }
                const materialValues = schemaGroup.materialValues;
                if (materialValues) {
                    materialValues.forEach((materialValue) => {
                        if (materialValue.materialName === undefined ||
                            materialValue.propertyName === undefined ||
                            materialValue.targetValue === undefined) {
                            return;
                        }
                        const materials = [];
                        gltf.scene.traverse((object) => {
                            if (object.material) {
                                const material = object.material;
                                if (Array.isArray(material)) {
                                    materials.push(...material.filter((mtl) => mtl.name === materialValue.materialName && materials.indexOf(mtl) === -1));
                                }
                                else if (material.name === materialValue.materialName && materials.indexOf(material) === -1) {
                                    materials.push(material);
                                }
                            }
                        });
                        materials.forEach((material) => {
                            group.addMaterialValue({
                                material,
                                propertyName: renameMaterialProperty(materialValue.propertyName),
                                targetValue: materialValue.targetValue,
                            });
                        });
                    });
                }
                blendShape.registerBlendShapeGroup(name, presetName, group);
            })));
            return blendShape;
        });
    }
}

const VECTOR3_FRONT$1 = Object.freeze(new THREE.Vector3(0.0, 0.0, -1.0));
const _quat$1 = new THREE.Quaternion();
var FirstPersonFlag;
(function (FirstPersonFlag) {
    FirstPersonFlag[FirstPersonFlag["Auto"] = 0] = "Auto";
    FirstPersonFlag[FirstPersonFlag["Both"] = 1] = "Both";
    FirstPersonFlag[FirstPersonFlag["ThirdPersonOnly"] = 2] = "ThirdPersonOnly";
    FirstPersonFlag[FirstPersonFlag["FirstPersonOnly"] = 3] = "FirstPersonOnly";
})(FirstPersonFlag || (FirstPersonFlag = {}));
/**
 * This class represents a single [`meshAnnotation`](https://github.com/vrm-c/UniVRM/blob/master/specification/0.0/schema/vrm.firstperson.meshannotation.schema.json) entry.
 * Each mesh will be assigned to specified layer when you call [[VRMFirstPerson.setup]].
 */
class VRMRendererFirstPersonFlags {
    /**
     * Create a new mesh annotation.
     *
     * @param firstPersonFlag A [[FirstPersonFlag]] of the annotation entry
     * @param node A node of the annotation entry.
     */
    constructor(firstPersonFlag, primitives) {
        this.firstPersonFlag = VRMRendererFirstPersonFlags._parseFirstPersonFlag(firstPersonFlag);
        this.primitives = primitives;
    }
    static _parseFirstPersonFlag(firstPersonFlag) {
        switch (firstPersonFlag) {
            case 'Both':
                return FirstPersonFlag.Both;
            case 'ThirdPersonOnly':
                return FirstPersonFlag.ThirdPersonOnly;
            case 'FirstPersonOnly':
                return FirstPersonFlag.FirstPersonOnly;
            default:
                return FirstPersonFlag.Auto;
        }
    }
}
class VRMFirstPerson {
    /**
     * Create a new VRMFirstPerson object.
     *
     * @param firstPersonBone A first person bone
     * @param firstPersonBoneOffset An offset from the specified first person bone
     * @param meshAnnotations A renderer settings. See the description of [[RendererFirstPersonFlags]] for more info
     */
    constructor(firstPersonBone, firstPersonBoneOffset, meshAnnotations) {
        this._meshAnnotations = [];
        this._firstPersonOnlyLayer = VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER;
        this._thirdPersonOnlyLayer = VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER;
        this._initialized = false;
        this._firstPersonBone = firstPersonBone;
        this._firstPersonBoneOffset = firstPersonBoneOffset;
        this._meshAnnotations = meshAnnotations;
    }
    get firstPersonBone() {
        return this._firstPersonBone;
    }
    get meshAnnotations() {
        return this._meshAnnotations;
    }
    getFirstPersonWorldDirection(target) {
        return target.copy(VECTOR3_FRONT$1).applyQuaternion(getWorldQuaternionLite(this._firstPersonBone, _quat$1));
    }
    /**
     * A camera layer represents `FirstPersonOnly` layer.
     * Note that **you must call [[setup]] first before you use the layer feature** or it does not work properly.
     *
     * The value is [[DEFAULT_FIRSTPERSON_ONLY_LAYER]] by default but you can change the layer by specifying via [[setup]] if you prefer.
     *
     * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
     * @see https://threejs.org/docs/#api/en/core/Layers
     */
    get firstPersonOnlyLayer() {
        return this._firstPersonOnlyLayer;
    }
    /**
     * A camera layer represents `ThirdPersonOnly` layer.
     * Note that **you must call [[setup]] first before you use the layer feature** or it does not work properly.
     *
     * The value is [[DEFAULT_THIRDPERSON_ONLY_LAYER]] by default but you can change the layer by specifying via [[setup]] if you prefer.
     *
     * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
     * @see https://threejs.org/docs/#api/en/core/Layers
     */
    get thirdPersonOnlyLayer() {
        return this._thirdPersonOnlyLayer;
    }
    getFirstPersonBoneOffset(target) {
        return target.copy(this._firstPersonBoneOffset);
    }
    /**
     * Get current world position of the first person.
     * The position takes [[FirstPersonBone]] and [[FirstPersonOffset]] into account.
     *
     * @param v3 target
     * @returns Current world position of the first person
     */
    getFirstPersonWorldPosition(v3) {
        // UniVRM#VRMFirstPersonEditor
        // var worldOffset = head.localToWorldMatrix.MultiplyPoint(component.FirstPersonOffset);
        const offset = this._firstPersonBoneOffset;
        const v4 = new THREE.Vector4(offset.x, offset.y, offset.z, 1.0);
        v4.applyMatrix4(this._firstPersonBone.matrixWorld);
        return v3.set(v4.x, v4.y, v4.z);
    }
    /**
     * In this method, it assigns layers for every meshes based on mesh annotations.
     * You must call this method first before you use the layer feature.
     *
     * This is an equivalent of [VRMFirstPerson.Setup](https://github.com/vrm-c/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/FirstPerson/VRMFirstPerson.cs) of the UniVRM.
     *
     * The `cameraLayer` parameter specifies which layer will be assigned for `FirstPersonOnly` / `ThirdPersonOnly`.
     * In UniVRM, we specified those by naming each desired layer as `FIRSTPERSON_ONLY_LAYER` / `THIRDPERSON_ONLY_LAYER`
     * but we are going to specify these layers at here since we are unable to name layers in Three.js.
     *
     * @param cameraLayer Specify which layer will be for `FirstPersonOnly` / `ThirdPersonOnly`.
     */
    setup({ firstPersonOnlyLayer = VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER, thirdPersonOnlyLayer = VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER, } = {}) {
        if (this._initialized) {
            return;
        }
        this._initialized = true;
        this._firstPersonOnlyLayer = firstPersonOnlyLayer;
        this._thirdPersonOnlyLayer = thirdPersonOnlyLayer;
        this._meshAnnotations.forEach((item) => {
            if (item.firstPersonFlag === FirstPersonFlag.FirstPersonOnly) {
                item.primitives.forEach((primitive) => {
                    primitive.layers.set(this._firstPersonOnlyLayer);
                });
            }
            else if (item.firstPersonFlag === FirstPersonFlag.ThirdPersonOnly) {
                item.primitives.forEach((primitive) => {
                    primitive.layers.set(this._thirdPersonOnlyLayer);
                });
            }
            else if (item.firstPersonFlag === FirstPersonFlag.Auto) {
                this._createHeadlessModel(item.primitives);
            }
        });
    }
    _excludeTriangles(triangles, bws, skinIndex, exclude) {
        let count = 0;
        if (bws != null && bws.length > 0) {
            for (let i = 0; i < triangles.length; i += 3) {
                const a = triangles[i];
                const b = triangles[i + 1];
                const c = triangles[i + 2];
                const bw0 = bws[a];
                const skin0 = skinIndex[a];
                if (bw0[0] > 0 && exclude.includes(skin0[0]))
                    continue;
                if (bw0[1] > 0 && exclude.includes(skin0[1]))
                    continue;
                if (bw0[2] > 0 && exclude.includes(skin0[2]))
                    continue;
                if (bw0[3] > 0 && exclude.includes(skin0[3]))
                    continue;
                const bw1 = bws[b];
                const skin1 = skinIndex[b];
                if (bw1[0] > 0 && exclude.includes(skin1[0]))
                    continue;
                if (bw1[1] > 0 && exclude.includes(skin1[1]))
                    continue;
                if (bw1[2] > 0 && exclude.includes(skin1[2]))
                    continue;
                if (bw1[3] > 0 && exclude.includes(skin1[3]))
                    continue;
                const bw2 = bws[c];
                const skin2 = skinIndex[c];
                if (bw2[0] > 0 && exclude.includes(skin2[0]))
                    continue;
                if (bw2[1] > 0 && exclude.includes(skin2[1]))
                    continue;
                if (bw2[2] > 0 && exclude.includes(skin2[2]))
                    continue;
                if (bw2[3] > 0 && exclude.includes(skin2[3]))
                    continue;
                triangles[count++] = a;
                triangles[count++] = b;
                triangles[count++] = c;
            }
        }
        return count;
    }
    _createErasedMesh(src, erasingBonesIndex) {
        const dst = new THREE.SkinnedMesh(src.geometry.clone(), src.material);
        dst.name = `${src.name}(erase)`;
        dst.frustumCulled = src.frustumCulled;
        dst.layers.set(this._firstPersonOnlyLayer);
        const geometry = dst.geometry;
        const skinIndexAttr = geometry.getAttribute('skinIndex').array;
        const skinIndex = [];
        for (let i = 0; i < skinIndexAttr.length; i += 4) {
            skinIndex.push([skinIndexAttr[i], skinIndexAttr[i + 1], skinIndexAttr[i + 2], skinIndexAttr[i + 3]]);
        }
        const skinWeightAttr = geometry.getAttribute('skinWeight').array;
        const skinWeight = [];
        for (let i = 0; i < skinWeightAttr.length; i += 4) {
            skinWeight.push([skinWeightAttr[i], skinWeightAttr[i + 1], skinWeightAttr[i + 2], skinWeightAttr[i + 3]]);
        }
        const index = geometry.getIndex();
        if (!index) {
            throw new Error("The geometry doesn't have an index buffer");
        }
        const oldTriangles = Array.from(index.array);
        const count = this._excludeTriangles(oldTriangles, skinWeight, skinIndex, erasingBonesIndex);
        const newTriangle = [];
        for (let i = 0; i < count; i++) {
            newTriangle[i] = oldTriangles[i];
        }
        geometry.setIndex(newTriangle);
        // mtoon material includes onBeforeRender. this is unsupported at SkinnedMesh#clone
        if (src.onBeforeRender) {
            dst.onBeforeRender = src.onBeforeRender;
        }
        dst.bind(new THREE.Skeleton(src.skeleton.bones, src.skeleton.boneInverses), new THREE.Matrix4());
        return dst;
    }
    _createHeadlessModelForSkinnedMesh(parent, mesh) {
        const eraseBoneIndexes = [];
        mesh.skeleton.bones.forEach((bone, index) => {
            if (this._isEraseTarget(bone))
                eraseBoneIndexes.push(index);
        });
        // Unlike UniVRM we don't copy mesh if no invisible bone was found
        if (!eraseBoneIndexes.length) {
            mesh.layers.enable(this._thirdPersonOnlyLayer);
            mesh.layers.enable(this._firstPersonOnlyLayer);
            return;
        }
        mesh.layers.set(this._thirdPersonOnlyLayer);
        const newMesh = this._createErasedMesh(mesh, eraseBoneIndexes);
        parent.add(newMesh);
    }
    _createHeadlessModel(primitives) {
        primitives.forEach((primitive) => {
            if (primitive.type === 'SkinnedMesh') {
                const skinnedMesh = primitive;
                this._createHeadlessModelForSkinnedMesh(skinnedMesh.parent, skinnedMesh);
            }
            else {
                if (this._isEraseTarget(primitive)) {
                    primitive.layers.set(this._thirdPersonOnlyLayer);
                }
            }
        });
    }
    /**
     * It just checks whether the node or its parent is the first person bone or not.
     * @param bone The target bone
     */
    _isEraseTarget(bone) {
        if (bone === this._firstPersonBone) {
            return true;
        }
        else if (!bone.parent) {
            return false;
        }
        else {
            return this._isEraseTarget(bone.parent);
        }
    }
}
/**
 * A default camera layer for `FirstPersonOnly` layer.
 *
 * @see [[getFirstPersonOnlyLayer]]
 */
VRMFirstPerson._DEFAULT_FIRSTPERSON_ONLY_LAYER = 9;
/**
 * A default camera layer for `ThirdPersonOnly` layer.
 *
 * @see [[getThirdPersonOnlyLayer]]
 */
VRMFirstPerson._DEFAULT_THIRDPERSON_ONLY_LAYER = 10;

/**
 * An importer that imports a [[VRMFirstPerson]] from a VRM extension of a GLTF.
 */
class VRMFirstPersonImporter {
    /**
     * Import a [[VRMFirstPerson]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param humanoid A [[VRMHumanoid]] instance that represents the VRM
     */
    import(gltf, humanoid) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaFirstPerson = vrmExt.firstPerson;
            if (!schemaFirstPerson) {
                return null;
            }
            const firstPersonBoneIndex = schemaFirstPerson.firstPersonBone;
            let firstPersonBone;
            if (firstPersonBoneIndex === undefined || firstPersonBoneIndex === -1) {
                firstPersonBone = humanoid.getBoneNode(VRMSchema.HumanoidBoneName.Head);
            }
            else {
                firstPersonBone = yield gltf.parser.getDependency('node', firstPersonBoneIndex);
            }
            if (!firstPersonBone) {
                console.warn('VRMFirstPersonImporter: Could not find firstPersonBone of the VRM');
                return null;
            }
            const firstPersonBoneOffset = schemaFirstPerson.firstPersonBoneOffset
                ? new THREE.Vector3(schemaFirstPerson.firstPersonBoneOffset.x, schemaFirstPerson.firstPersonBoneOffset.y, -schemaFirstPerson.firstPersonBoneOffset.z)
                : new THREE.Vector3(0.0, 0.06, 0.0); // fallback, taken from UniVRM implementation
            const meshAnnotations = [];
            const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
            Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
                const schemaNode = gltf.parser.json.nodes[nodeIndex];
                const flag = schemaFirstPerson.meshAnnotations
                    ? schemaFirstPerson.meshAnnotations.find((a) => a.mesh === schemaNode.mesh)
                    : undefined;
                meshAnnotations.push(new VRMRendererFirstPersonFlags(flag === null || flag === void 0 ? void 0 : flag.firstPersonFlag, primitives));
            });
            return new VRMFirstPerson(firstPersonBone, firstPersonBoneOffset, meshAnnotations);
        });
    }
}

/**
 * A class represents a single `humanBone` of a VRM.
 */
class VRMHumanBone {
    /**
     * Create a new VRMHumanBone.
     *
     * @param node A [[GLTFNode]] that represents the new bone
     * @param humanLimit A [[VRMHumanLimit]] object that represents properties of the new bone
     */
    constructor(node, humanLimit) {
        this.node = node;
        this.humanLimit = humanLimit;
    }
}

/**
 * A compat function for `Quaternion.invert()` / `Quaternion.inverse()`.
 * `Quaternion.invert()` is introduced in r123 and `Quaternion.inverse()` emits a warning.
 * We are going to use this compat for a while.
 * @param target A target quaternion
 */
function quatInvertCompat(target) {
    if (target.invert) {
        target.invert();
    }
    else {
        target.inverse();
    }
    return target;
}

const _v3A$4 = new THREE.Vector3();
const _quatA$1 = new THREE.Quaternion();
/**
 * A class represents humanoid of a VRM.
 */
class VRMHumanoid {
    /**
     * Create a new [[VRMHumanoid]].
     * @param boneArray A [[VRMHumanBoneArray]] contains all the bones of the new humanoid
     * @param humanDescription A [[VRMHumanDescription]] that represents properties of the new humanoid
     */
    constructor(boneArray, humanDescription) {
        /**
         * A [[VRMPose]] that is its default state.
         * Note that it's not compatible with `setPose` and `getPose`, since it contains non-relative values of each local transforms.
         */
        this.restPose = {};
        this.humanBones = this._createHumanBones(boneArray);
        this.humanDescription = humanDescription;
        this.restPose = this.getPose();
    }
    /**
     * Return the current pose of this humanoid as a [[VRMPose]].
     *
     * Each transform is a local transform relative from rest pose (T-pose).
     */
    getPose() {
        const pose = {};
        Object.keys(this.humanBones).forEach((vrmBoneName) => {
            const node = this.getBoneNode(vrmBoneName);
            // Ignore when there are no bone on the VRMHumanoid
            if (!node) {
                return;
            }
            // When there are two or more bones in a same name, we are not going to overwrite existing one
            if (pose[vrmBoneName]) {
                return;
            }
            // Take a diff from restPose
            // note that restPose also will use getPose to initialize itself
            _v3A$4.set(0, 0, 0);
            _quatA$1.identity();
            const restState = this.restPose[vrmBoneName];
            if (restState === null || restState === void 0 ? void 0 : restState.position) {
                _v3A$4.fromArray(restState.position).negate();
            }
            if (restState === null || restState === void 0 ? void 0 : restState.rotation) {
                quatInvertCompat(_quatA$1.fromArray(restState.rotation));
            }
            // Get the position / rotation from the node
            _v3A$4.add(node.position);
            _quatA$1.premultiply(node.quaternion);
            pose[vrmBoneName] = {
                position: _v3A$4.toArray(),
                rotation: _quatA$1.toArray(),
            };
        }, {});
        return pose;
    }
    /**
     * Let the humanoid do a specified pose.
     *
     * Each transform have to be a local transform relative from rest pose (T-pose).
     * You can pass what you got from {@link getPose}.
     *
     * @param poseObject A [[VRMPose]] that represents a single pose
     */
    setPose(poseObject) {
        Object.keys(poseObject).forEach((boneName) => {
            const state = poseObject[boneName];
            const node = this.getBoneNode(boneName);
            // Ignore when there are no bone that is defined in the pose on the VRMHumanoid
            if (!node) {
                return;
            }
            const restState = this.restPose[boneName];
            if (!restState) {
                return;
            }
            if (state.position) {
                node.position.fromArray(state.position);
                if (restState.position) {
                    node.position.add(_v3A$4.fromArray(restState.position));
                }
            }
            if (state.rotation) {
                node.quaternion.fromArray(state.rotation);
                if (restState.rotation) {
                    node.quaternion.multiply(_quatA$1.fromArray(restState.rotation));
                }
            }
        });
    }
    /**
     * Reset the humanoid to its rest pose.
     */
    resetPose() {
        Object.entries(this.restPose).forEach(([boneName, rest]) => {
            const node = this.getBoneNode(boneName);
            if (!node) {
                return;
            }
            if (rest === null || rest === void 0 ? void 0 : rest.position) {
                node.position.fromArray(rest.position);
            }
            if (rest === null || rest === void 0 ? void 0 : rest.rotation) {
                node.quaternion.fromArray(rest.rotation);
            }
        });
    }
    /**
     * Return a bone bound to a specified [[HumanBone]], as a [[VRMHumanBone]].
     *
     * See also: [[VRMHumanoid.getBones]]
     *
     * @param name Name of the bone you want
     */
    getBone(name) {
        var _a;
        return (_a = this.humanBones[name][0]) !== null && _a !== void 0 ? _a : undefined;
    }
    /**
     * Return bones bound to a specified [[HumanBone]], as an array of [[VRMHumanBone]].
     * If there are no bones bound to the specified HumanBone, it will return an empty array.
     *
     * See also: [[VRMHumanoid.getBone]]
     *
     * @param name Name of the bone you want
     */
    getBones(name) {
        var _a;
        return (_a = this.humanBones[name]) !== null && _a !== void 0 ? _a : [];
    }
    /**
     * Return a bone bound to a specified [[HumanBone]], as a THREE.Object3D.
     *
     * See also: [[VRMHumanoid.getBoneNodes]]
     *
     * @param name Name of the bone you want
     */
    getBoneNode(name) {
        var _a, _b;
        return (_b = (_a = this.humanBones[name][0]) === null || _a === void 0 ? void 0 : _a.node) !== null && _b !== void 0 ? _b : null;
    }
    /**
     * Return bones bound to a specified [[HumanBone]], as an array of THREE.Object3D.
     * If there are no bones bound to the specified HumanBone, it will return an empty array.
     *
     * See also: [[VRMHumanoid.getBoneNode]]
     *
     * @param name Name of the bone you want
     */
    getBoneNodes(name) {
        var _a, _b;
        return (_b = (_a = this.humanBones[name]) === null || _a === void 0 ? void 0 : _a.map((bone) => bone.node)) !== null && _b !== void 0 ? _b : [];
    }
    /**
     * Prepare a [[VRMHumanBones]] from a [[VRMHumanBoneArray]].
     */
    _createHumanBones(boneArray) {
        const bones = Object.values(VRMSchema.HumanoidBoneName).reduce((accum, name) => {
            accum[name] = [];
            return accum;
        }, {});
        boneArray.forEach((bone) => {
            bones[bone.name].push(bone.bone);
        });
        return bones;
    }
}

/**
 * An importer that imports a [[VRMHumanoid]] from a VRM extension of a GLTF.
 */
class VRMHumanoidImporter {
    /**
     * Import a [[VRMHumanoid]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaHumanoid = vrmExt.humanoid;
            if (!schemaHumanoid) {
                return null;
            }
            const humanBoneArray = [];
            if (schemaHumanoid.humanBones) {
                yield Promise.all(schemaHumanoid.humanBones.map((bone) => __awaiter(this, void 0, void 0, function* () {
                    if (!bone.bone || bone.node == null) {
                        return;
                    }
                    const node = yield gltf.parser.getDependency('node', bone.node);
                    humanBoneArray.push({
                        name: bone.bone,
                        bone: new VRMHumanBone(node, {
                            axisLength: bone.axisLength,
                            center: bone.center && new THREE.Vector3(bone.center.x, bone.center.y, bone.center.z),
                            max: bone.max && new THREE.Vector3(bone.max.x, bone.max.y, bone.max.z),
                            min: bone.min && new THREE.Vector3(bone.min.x, bone.min.y, bone.min.z),
                            useDefaultValues: bone.useDefaultValues,
                        }),
                    });
                })));
            }
            const humanDescription = {
                armStretch: schemaHumanoid.armStretch,
                legStretch: schemaHumanoid.legStretch,
                upperArmTwist: schemaHumanoid.upperArmTwist,
                lowerArmTwist: schemaHumanoid.lowerArmTwist,
                upperLegTwist: schemaHumanoid.upperLegTwist,
                lowerLegTwist: schemaHumanoid.lowerLegTwist,
                feetSpacing: schemaHumanoid.feetSpacing,
                hasTranslationDoF: schemaHumanoid.hasTranslationDoF,
            };
            return new VRMHumanoid(humanBoneArray, humanDescription);
        });
    }
}

/**
 * Evaluate a hermite spline.
 *
 * @param y0 y on start
 * @param y1 y on end
 * @param t0 delta y on start
 * @param t1 delta y on end
 * @param x input value
 */
const hermiteSpline = (y0, y1, t0, t1, x) => {
    const xc = x * x * x;
    const xs = x * x;
    const dy = y1 - y0;
    const h01 = -2.0 * xc + 3.0 * xs;
    const h10 = xc - 2.0 * xs + x;
    const h11 = xc - xs;
    return y0 + dy * h01 + t0 * h10 + t1 * h11;
};
/**
 * Evaluate an AnimationCurve array. See AnimationCurve class of Unity for its details.
 *
 * See: https://docs.unity3d.com/ja/current/ScriptReference/AnimationCurve.html
 *
 * @param arr An array represents a curve
 * @param x An input value
 */
const evaluateCurve = (arr, x) => {
    // -- sanity check -----------------------------------------------------------
    if (arr.length < 8) {
        throw new Error('evaluateCurve: Invalid curve detected! (Array length must be 8 at least)');
    }
    if (arr.length % 4 !== 0) {
        throw new Error('evaluateCurve: Invalid curve detected! (Array length must be multiples of 4');
    }
    // -- check range ------------------------------------------------------------
    let outNode;
    for (outNode = 0;; outNode++) {
        if (arr.length <= 4 * outNode) {
            return arr[4 * outNode - 3]; // too further!! assume as "Clamp"
        }
        else if (x <= arr[4 * outNode]) {
            break;
        }
    }
    const inNode = outNode - 1;
    if (inNode < 0) {
        return arr[4 * inNode + 5]; // too behind!! assume as "Clamp"
    }
    // -- calculate local x ------------------------------------------------------
    const x0 = arr[4 * inNode];
    const x1 = arr[4 * outNode];
    const xHermite = (x - x0) / (x1 - x0);
    // -- finally do the hermite spline ------------------------------------------
    const y0 = arr[4 * inNode + 1];
    const y1 = arr[4 * outNode + 1];
    const t0 = arr[4 * inNode + 3];
    const t1 = arr[4 * outNode + 2];
    return hermiteSpline(y0, y1, t0, t1, xHermite);
};
/**
 * This is an equivalent of CurveMapper class defined in UniVRM.
 * Will be used for [[VRMLookAtApplyer]]s, to define behavior of LookAt.
 *
 * See: https://github.com/vrm-c/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/LookAt/CurveMapper.cs
 */
class VRMCurveMapper {
    /**
     * Create a new [[VRMCurveMapper]].
     *
     * @param xRange The maximum input range
     * @param yRange The maximum output value
     * @param curve An array represents the curve
     */
    constructor(xRange, yRange, curve) {
        /**
         * An array represents the curve. See AnimationCurve class of Unity for its details.
         *
         * See: https://docs.unity3d.com/ja/current/ScriptReference/AnimationCurve.html
         */
        this.curve = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.0];
        /**
         * The maximum input range of the [[VRMCurveMapper]].
         */
        this.curveXRangeDegree = 90.0;
        /**
         * The maximum output value of the [[VRMCurveMapper]].
         */
        this.curveYRangeDegree = 10.0;
        if (xRange !== undefined) {
            this.curveXRangeDegree = xRange;
        }
        if (yRange !== undefined) {
            this.curveYRangeDegree = yRange;
        }
        if (curve !== undefined) {
            this.curve = curve;
        }
    }
    /**
     * Evaluate an input value and output a mapped value.
     *
     * @param src The input value
     */
    map(src) {
        const clampedSrc = Math.min(Math.max(src, 0.0), this.curveXRangeDegree);
        const x = clampedSrc / this.curveXRangeDegree;
        return this.curveYRangeDegree * evaluateCurve(this.curve, x);
    }
}

/**
 * This class is used by [[VRMLookAtHead]], applies look at direction.
 * There are currently two variant of applier: [[VRMLookAtBoneApplyer]] and [[VRMLookAtBlendShapeApplyer]].
 */
class VRMLookAtApplyer {
}

/**
 * This class is used by [[VRMLookAtHead]], applies look at direction to eye blend shapes of a VRM.
 */
class VRMLookAtBlendShapeApplyer extends VRMLookAtApplyer {
    /**
     * Create a new VRMLookAtBlendShapeApplyer.
     *
     * @param blendShapeProxy A [[VRMBlendShapeProxy]] used by this applier
     * @param curveHorizontal A [[VRMCurveMapper]] used for transverse direction
     * @param curveVerticalDown A [[VRMCurveMapper]] used for down direction
     * @param curveVerticalUp A [[VRMCurveMapper]] used for up direction
     */
    constructor(blendShapeProxy, curveHorizontal, curveVerticalDown, curveVerticalUp) {
        super();
        this.type = VRMSchema.FirstPersonLookAtTypeName.BlendShape;
        this._curveHorizontal = curveHorizontal;
        this._curveVerticalDown = curveVerticalDown;
        this._curveVerticalUp = curveVerticalUp;
        this._blendShapeProxy = blendShapeProxy;
    }
    name() {
        return VRMSchema.FirstPersonLookAtTypeName.BlendShape;
    }
    lookAt(euler) {
        const srcX = euler.x;
        const srcY = euler.y;
        if (srcX < 0.0) {
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookup, 0.0);
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookdown, this._curveVerticalDown.map(-srcX));
        }
        else {
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookdown, 0.0);
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookup, this._curveVerticalUp.map(srcX));
        }
        if (srcY < 0.0) {
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookleft, 0.0);
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookright, this._curveHorizontal.map(-srcY));
        }
        else {
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookright, 0.0);
            this._blendShapeProxy.setValue(VRMSchema.BlendShapePresetName.Lookleft, this._curveHorizontal.map(srcY));
        }
    }
}

const VECTOR3_FRONT = Object.freeze(new THREE.Vector3(0.0, 0.0, -1.0));
const _v3A$3 = new THREE.Vector3();
const _v3B$1 = new THREE.Vector3();
const _v3C$1 = new THREE.Vector3();
const _quat = new THREE.Quaternion();
/**
 * A class represents look at of a VRM.
 */
class VRMLookAtHead {
    /**
     * Create a new VRMLookAtHead.
     *
     * @param firstPerson A [[VRMFirstPerson]] that will be associated with this new VRMLookAtHead
     * @param applyer A [[VRMLookAtApplyer]] that will be associated with this new VRMLookAtHead
     */
    constructor(firstPerson, applyer) {
        /**
         * If this is true, its look at direction will be updated automatically by calling [[VRMLookAtHead.update]] (which is called from [[VRM.update]]).
         *
         * See also: [[VRMLookAtHead.target]]
         */
        this.autoUpdate = true;
        this._euler = new THREE.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
        this.firstPerson = firstPerson;
        this.applyer = applyer;
    }
    /**
     * Get its look at direction in world coordinate.
     *
     * @param target A target `THREE.Vector3`
     */
    getLookAtWorldDirection(target) {
        const rot = getWorldQuaternionLite(this.firstPerson.firstPersonBone, _quat);
        return target.copy(VECTOR3_FRONT).applyEuler(this._euler).applyQuaternion(rot);
    }
    /**
     * Set its look at position.
     * Note that its result will be instantly overwritten if [[VRMLookAtHead.autoUpdate]] is enabled.
     *
     * @param position A target position
     */
    lookAt(position) {
        this._calcEuler(this._euler, position);
        if (this.applyer) {
            this.applyer.lookAt(this._euler);
        }
    }
    /**
     * Update the VRMLookAtHead.
     * If [[VRMLookAtHead.autoUpdate]] is disabled, it will do nothing.
     *
     * @param delta deltaTime
     */
    update(delta) {
        if (this.target && this.autoUpdate) {
            this.lookAt(this.target.getWorldPosition(_v3A$3));
            if (this.applyer) {
                this.applyer.lookAt(this._euler);
            }
        }
    }
    _calcEuler(target, position) {
        const headPosition = this.firstPerson.getFirstPersonWorldPosition(_v3B$1);
        // Look at direction in world coordinate
        const lookAtDir = _v3C$1.copy(position).sub(headPosition).normalize();
        // Transform the direction into local coordinate from the first person bone
        lookAtDir.applyQuaternion(quatInvertCompat(getWorldQuaternionLite(this.firstPerson.firstPersonBone, _quat)));
        // convert the direction into euler
        target.x = Math.atan2(lookAtDir.y, Math.sqrt(lookAtDir.x * lookAtDir.x + lookAtDir.z * lookAtDir.z));
        target.y = Math.atan2(-lookAtDir.x, -lookAtDir.z);
        return target;
    }
}
VRMLookAtHead.EULER_ORDER = 'YXZ'; // yaw-pitch-roll

const _euler = new THREE.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
/**
 * This class is used by [[VRMLookAtHead]], applies look at direction to eye bones of a VRM.
 */
class VRMLookAtBoneApplyer extends VRMLookAtApplyer {
    /**
     * Create a new VRMLookAtBoneApplyer.
     *
     * @param humanoid A [[VRMHumanoid]] used by this applier
     * @param curveHorizontalInner A [[VRMCurveMapper]] used for inner transverse direction
     * @param curveHorizontalOuter A [[VRMCurveMapper]] used for outer transverse direction
     * @param curveVerticalDown A [[VRMCurveMapper]] used for down direction
     * @param curveVerticalUp A [[VRMCurveMapper]] used for up direction
     */
    constructor(humanoid, curveHorizontalInner, curveHorizontalOuter, curveVerticalDown, curveVerticalUp) {
        super();
        this.type = VRMSchema.FirstPersonLookAtTypeName.Bone;
        this._curveHorizontalInner = curveHorizontalInner;
        this._curveHorizontalOuter = curveHorizontalOuter;
        this._curveVerticalDown = curveVerticalDown;
        this._curveVerticalUp = curveVerticalUp;
        this._leftEye = humanoid.getBoneNode(VRMSchema.HumanoidBoneName.LeftEye);
        this._rightEye = humanoid.getBoneNode(VRMSchema.HumanoidBoneName.RightEye);
    }
    lookAt(euler) {
        const srcX = euler.x;
        const srcY = euler.y;
        // left
        if (this._leftEye) {
            if (srcX < 0.0) {
                _euler.x = -this._curveVerticalDown.map(-srcX);
            }
            else {
                _euler.x = this._curveVerticalUp.map(srcX);
            }
            if (srcY < 0.0) {
                _euler.y = -this._curveHorizontalInner.map(-srcY);
            }
            else {
                _euler.y = this._curveHorizontalOuter.map(srcY);
            }
            this._leftEye.quaternion.setFromEuler(_euler);
        }
        // right
        if (this._rightEye) {
            if (srcX < 0.0) {
                _euler.x = -this._curveVerticalDown.map(-srcX);
            }
            else {
                _euler.x = this._curveVerticalUp.map(srcX);
            }
            if (srcY < 0.0) {
                _euler.y = -this._curveHorizontalOuter.map(-srcY);
            }
            else {
                _euler.y = this._curveHorizontalInner.map(srcY);
            }
            this._rightEye.quaternion.setFromEuler(_euler);
        }
    }
}

// THREE.Math has been renamed to THREE.MathUtils since r113.
// We are going to define the DEG2RAD by ourselves for a while
// https://github.com/mrdoob/three.js/pull/18270
const DEG2RAD = Math.PI / 180; // THREE.MathUtils.DEG2RAD;
/**
 * An importer that imports a [[VRMLookAtHead]] from a VRM extension of a GLTF.
 */
class VRMLookAtImporter {
    /**
     * Import a [[VRMLookAtHead]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param blendShapeProxy A [[VRMBlendShapeProxy]] instance that represents the VRM
     * @param humanoid A [[VRMHumanoid]] instance that represents the VRM
     */
    import(gltf, firstPerson, blendShapeProxy, humanoid) {
        var _a;
        const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
        if (!vrmExt) {
            return null;
        }
        const schemaFirstPerson = vrmExt.firstPerson;
        if (!schemaFirstPerson) {
            return null;
        }
        const applyer = this._importApplyer(schemaFirstPerson, blendShapeProxy, humanoid);
        return new VRMLookAtHead(firstPerson, applyer || undefined);
    }
    _importApplyer(schemaFirstPerson, blendShapeProxy, humanoid) {
        const lookAtHorizontalInner = schemaFirstPerson.lookAtHorizontalInner;
        const lookAtHorizontalOuter = schemaFirstPerson.lookAtHorizontalOuter;
        const lookAtVerticalDown = schemaFirstPerson.lookAtVerticalDown;
        const lookAtVerticalUp = schemaFirstPerson.lookAtVerticalUp;
        switch (schemaFirstPerson.lookAtTypeName) {
            case VRMSchema.FirstPersonLookAtTypeName.Bone: {
                if (lookAtHorizontalInner === undefined ||
                    lookAtHorizontalOuter === undefined ||
                    lookAtVerticalDown === undefined ||
                    lookAtVerticalUp === undefined) {
                    return null;
                }
                else {
                    return new VRMLookAtBoneApplyer(humanoid, this._importCurveMapperBone(lookAtHorizontalInner), this._importCurveMapperBone(lookAtHorizontalOuter), this._importCurveMapperBone(lookAtVerticalDown), this._importCurveMapperBone(lookAtVerticalUp));
                }
            }
            case VRMSchema.FirstPersonLookAtTypeName.BlendShape: {
                if (lookAtHorizontalOuter === undefined || lookAtVerticalDown === undefined || lookAtVerticalUp === undefined) {
                    return null;
                }
                else {
                    return new VRMLookAtBlendShapeApplyer(blendShapeProxy, this._importCurveMapperBlendShape(lookAtHorizontalOuter), this._importCurveMapperBlendShape(lookAtVerticalDown), this._importCurveMapperBlendShape(lookAtVerticalUp));
                }
            }
            default: {
                return null;
            }
        }
    }
    _importCurveMapperBone(map) {
        return new VRMCurveMapper(typeof map.xRange === 'number' ? DEG2RAD * map.xRange : undefined, typeof map.yRange === 'number' ? DEG2RAD * map.yRange : undefined, map.curve);
    }
    _importCurveMapperBlendShape(map) {
        return new VRMCurveMapper(typeof map.xRange === 'number' ? DEG2RAD * map.xRange : undefined, map.yRange, map.curve);
    }
}

var vertexShader$1 = "// #define PHONG\n\nvarying vec3 vViewPosition;\n\n#ifndef FLAT_SHADED\n  varying vec3 vNormal;\n#endif\n\n#include <common>\n\n// #include <uv_pars_vertex>\n#ifdef MTOON_USE_UV\n  #ifdef MTOON_UVS_VERTEX_ONLY\n    vec2 vUv;\n  #else\n    varying vec2 vUv;\n  #endif\n\n  uniform vec4 mainTex_ST;\n#endif\n\n#include <uv2_pars_vertex>\n// #include <displacementmap_pars_vertex>\n// #include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <shadowmap_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\n#ifdef USE_OUTLINEWIDTHTEXTURE\n  uniform sampler2D outlineWidthTexture;\n#endif\n\nuniform float outlineWidth;\nuniform float outlineScaledMaxDistance;\n\nvoid main() {\n\n  // #include <uv_vertex>\n  #ifdef MTOON_USE_UV\n    vUv = uv;\n    vUv.y = 1.0 - vUv.y; // uv.y is opposite from UniVRM's\n    vUv = mainTex_ST.st + mainTex_ST.pq * vUv;\n    vUv.y = 1.0 - vUv.y; // reverting the previous flip\n  #endif\n\n  #include <uv2_vertex>\n  #include <color_vertex>\n\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinbase_vertex>\n  #include <skinnormal_vertex>\n\n  // we need this to compute the outline properly\n  objectNormal = normalize( objectNormal );\n\n  #include <defaultnormal_vertex>\n\n  #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED\n    vNormal = normalize( transformedNormal );\n  #endif\n\n  #include <begin_vertex>\n\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  // #include <displacementmap_vertex>\n  #include <project_vertex>\n  #include <logdepthbuf_vertex>\n  #include <clipping_planes_vertex>\n\n  vViewPosition = - mvPosition.xyz;\n\n  float outlineTex = 1.0;\n\n  #ifdef OUTLINE\n    #ifdef USE_OUTLINEWIDTHTEXTURE\n      outlineTex = texture2D( outlineWidthTexture, vUv ).r;\n    #endif\n\n    #ifdef OUTLINE_WIDTH_WORLD\n      float worldNormalLength = length( transformedNormal );\n      vec3 outlineOffset = 0.01 * outlineWidth * outlineTex * worldNormalLength * objectNormal;\n      gl_Position = projectionMatrix * modelViewMatrix * vec4( outlineOffset + transformed, 1.0 );\n    #endif\n\n    #ifdef OUTLINE_WIDTH_SCREEN\n      vec3 clipNormal = ( projectionMatrix * modelViewMatrix * vec4( objectNormal, 0.0 ) ).xyz;\n      vec2 projectedNormal = normalize( clipNormal.xy );\n      projectedNormal *= min( gl_Position.w, outlineScaledMaxDistance );\n      projectedNormal.x *= projectionMatrix[ 0 ].x / projectionMatrix[ 1 ].y;\n      gl_Position.xy += 0.01 * outlineWidth * outlineTex * projectedNormal.xy;\n    #endif\n\n    gl_Position.z += 1E-6 * gl_Position.w; // anti-artifact magic\n  #endif\n\n  #include <worldpos_vertex>\n  // #include <envmap_vertex>\n  #include <shadowmap_vertex>\n  #include <fog_vertex>\n\n}";

var fragmentShader$1 = "// #define PHONG\n\n#ifdef BLENDMODE_CUTOUT\n  uniform float cutoff;\n#endif\n\nuniform vec3 color;\nuniform float colorAlpha;\nuniform vec3 shadeColor;\n#ifdef USE_SHADETEXTURE\n  uniform sampler2D shadeTexture;\n#endif\n\nuniform float receiveShadowRate;\n#ifdef USE_RECEIVESHADOWTEXTURE\n  uniform sampler2D receiveShadowTexture;\n#endif\n\nuniform float shadingGradeRate;\n#ifdef USE_SHADINGGRADETEXTURE\n  uniform sampler2D shadingGradeTexture;\n#endif\n\nuniform float shadeShift;\nuniform float shadeToony;\nuniform float lightColorAttenuation;\nuniform float indirectLightIntensity;\n\n#ifdef USE_RIMTEXTURE\n  uniform sampler2D rimTexture;\n#endif\nuniform vec3 rimColor;\nuniform float rimLightingMix;\nuniform float rimFresnelPower;\nuniform float rimLift;\n\n#ifdef USE_SPHEREADD\n  uniform sampler2D sphereAdd;\n#endif\n\nuniform vec3 emissionColor;\n\nuniform vec3 outlineColor;\nuniform float outlineLightingMix;\n\n#ifdef USE_UVANIMMASKTEXTURE\n  uniform sampler2D uvAnimMaskTexture;\n#endif\n\nuniform float uvAnimOffsetX;\nuniform float uvAnimOffsetY;\nuniform float uvAnimTheta;\n\n#include <common>\n#include <packing>\n#include <dithering_pars_fragment>\n#include <color_pars_fragment>\n\n// #include <uv_pars_fragment>\n#if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n  varying vec2 vUv;\n#endif\n\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n// #include <alphamap_pars_fragment>\n#include <aomap_pars_fragment>\n// #include <lightmap_pars_fragment>\n#include <emissivemap_pars_fragment>\n// #include <envmap_common_pars_fragment>\n// #include <envmap_pars_fragment>\n// #include <cube_uv_reflection_fragment>\n#include <fog_pars_fragment>\n\n// #include <bsdfs>\nvec3 BRDF_Lambert( const in vec3 diffuseColor ) {\n    return RECIPROCAL_PI * diffuseColor;\n}\n\n#include <lights_pars_begin>\n\n// #include <lights_phong_pars_fragment>\nvarying vec3 vViewPosition;\n\n#ifndef FLAT_SHADED\n  varying vec3 vNormal;\n#endif\n\nstruct MToonMaterial {\n  vec3 diffuseColor;\n  vec3 shadeColor;\n  float shadingGrade;\n  float receiveShadow;\n};\n\n#define Material_LightProbeLOD( material ) (0)\n\n#include <shadowmap_pars_fragment>\n// #include <bumpmap_pars_fragment>\n\n// #include <normalmap_pars_fragment>\n#ifdef USE_NORMALMAP\n\n  uniform sampler2D normalMap;\n  uniform vec2 normalScale;\n\n#endif\n\n#ifdef OBJECTSPACE_NORMALMAP\n\n  uniform mat3 normalMatrix;\n\n#endif\n\n#if ! defined ( USE_TANGENT ) && defined ( TANGENTSPACE_NORMALMAP )\n\n  // Per-Pixel Tangent Space Normal Mapping\n  // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html\n\n  // three-vrm specific change: it requires `uv` as an input in order to support uv scrolls\n\n  // Temporary compat against shader change @ Three.js r126\n  // See: #21205, #21307, #21299\n  #if THREE_VRM_THREE_REVISION >= 126\n\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {\n\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      vec3 N = normalize( surf_norm );\n\n      vec3 q1perp = cross( q1, N );\n      vec3 q0perp = cross( N, q0 );\n\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\n\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\n      // TODO: Is this still required? Or shall I make a PR about it?\n      if ( length( T ) == 0.0 || length( B ) == 0.0 ) {\n        return surf_norm;\n      }\n\n      float det = max( dot( T, T ), dot( B, B ) );\n      float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );\n\n      return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );\n\n    }\n\n  #else\n\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN ) {\n\n      // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988\n\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\n      vec2 st0 = dFdx( uv.st );\n      vec2 st1 = dFdy( uv.st );\n\n      float scale = sign( st1.t * st0.s - st0.t * st1.s ); // we do not care about the magnitude\n\n      vec3 S = ( q0 * st1.t - q1 * st0.t ) * scale;\n      vec3 T = ( - q0 * st1.s + q1 * st0.s ) * scale;\n\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\n      // TODO: Is this still required? Or shall I make a PR about it?\n\n      if ( length( S ) == 0.0 || length( T ) == 0.0 ) {\n        return surf_norm;\n      }\n\n      S = normalize( S );\n      T = normalize( T );\n      vec3 N = normalize( surf_norm );\n\n      #ifdef DOUBLE_SIDED\n\n        // Workaround for Adreno GPUs gl_FrontFacing bug. See #15850 and #10331\n\n        bool frontFacing = dot( cross( S, T ), N ) > 0.0;\n\n        mapN.xy *= ( float( frontFacing ) * 2.0 - 1.0 );\n\n      #else\n\n        mapN.xy *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );\n\n      #endif\n\n      mat3 tsn = mat3( S, T, N );\n      return normalize( tsn * mapN );\n\n    }\n\n  #endif\n\n#endif\n\n// #include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\n// == lighting stuff ===========================================================\nfloat getLightIntensity(\n  const in IncidentLight directLight,\n  const in GeometricContext geometry,\n  const in float shadow,\n  const in float shadingGrade\n) {\n  float lightIntensity = dot( geometry.normal, directLight.direction );\n  lightIntensity = 0.5 + 0.5 * lightIntensity;\n  lightIntensity = lightIntensity * shadow;\n  lightIntensity = lightIntensity * shadingGrade;\n  lightIntensity = lightIntensity * 2.0 - 1.0;\n  return shadeToony == 1.0\n    ? step( shadeShift, lightIntensity )\n    : smoothstep( shadeShift, shadeShift + ( 1.0 - shadeToony ), lightIntensity );\n}\n\nvec3 getLighting( const in vec3 lightColor ) {\n  vec3 lighting = lightColor;\n  lighting = mix(\n    lighting,\n    vec3( max( 0.001, max( lighting.x, max( lighting.y, lighting.z ) ) ) ),\n    lightColorAttenuation\n  );\n\n  #if THREE_VRM_THREE_REVISION < 132\n    #ifndef PHYSICALLY_CORRECT_LIGHTS\n      lighting *= PI;\n    #endif\n  #endif\n\n  return lighting;\n}\n\nvec3 getDiffuse(\n  const in MToonMaterial material,\n  const in float lightIntensity,\n  const in vec3 lighting\n) {\n  #ifdef DEBUG_LITSHADERATE\n    return vec3( BRDF_Lambert( lightIntensity * lighting ) );\n  #endif\n\n  return lighting * BRDF_Lambert( mix( material.shadeColor, material.diffuseColor, lightIntensity ) );\n}\n\n// == post correction ==========================================================\nvoid postCorrection() {\n  #include <tonemapping_fragment>\n  #include <encodings_fragment>\n  #include <fog_fragment>\n  #include <premultiplied_alpha_fragment>\n  #include <dithering_fragment>\n}\n\n// == main procedure ===========================================================\nvoid main() {\n  #include <clipping_planes_fragment>\n\n  vec2 uv = vec2(0.5, 0.5);\n\n  #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n    uv = vUv;\n\n    float uvAnimMask = 1.0;\n    #ifdef USE_UVANIMMASKTEXTURE\n      uvAnimMask = texture2D( uvAnimMaskTexture, uv ).x;\n    #endif\n\n    uv = uv + vec2( uvAnimOffsetX, uvAnimOffsetY ) * uvAnimMask;\n    float uvRotCos = cos( uvAnimTheta * uvAnimMask );\n    float uvRotSin = sin( uvAnimTheta * uvAnimMask );\n    uv = mat2( uvRotCos, uvRotSin, -uvRotSin, uvRotCos ) * ( uv - 0.5 ) + 0.5;\n  #endif\n\n  #ifdef DEBUG_UV\n    gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\n    #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\n      gl_FragColor = vec4( uv, 0.0, 1.0 );\n    #endif\n    return;\n  #endif\n\n  vec4 diffuseColor = vec4( color, colorAlpha );\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n  vec3 totalEmissiveRadiance = emissionColor;\n\n  #include <logdepthbuf_fragment>\n\n  // #include <map_fragment>\n  #ifdef USE_MAP\n    #if THREE_VRM_THREE_REVISION >= 137\n      vec4 sampledDiffuseColor = texture2D( map, uv );\n      #ifdef DECODE_VIDEO_TEXTURE\n        sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );\n      #endif\n      diffuseColor *= sampledDiffuseColor;\n    #else\n      // COMPAT: pre-r137\n      diffuseColor *= mapTexelToLinear( texture2D( map, uv ) );\n    #endif\n  #endif\n\n  #include <color_fragment>\n  // #include <alphamap_fragment>\n\n  // -- MToon: alpha -----------------------------------------------------------\n  // #include <alphatest_fragment>\n  #ifdef BLENDMODE_CUTOUT\n    if ( diffuseColor.a <= cutoff ) { discard; }\n    diffuseColor.a = 1.0;\n  #endif\n\n  #ifdef BLENDMODE_OPAQUE\n    diffuseColor.a = 1.0;\n  #endif\n\n  #if defined( OUTLINE ) && defined( OUTLINE_COLOR_FIXED ) // omitting DebugMode\n    gl_FragColor = vec4( outlineColor, diffuseColor.a );\n    postCorrection();\n    return;\n  #endif\n\n  // #include <specularmap_fragment>\n  #include <normal_fragment_begin>\n\n  #ifdef OUTLINE\n    normal *= -1.0;\n  #endif\n\n  // #include <normal_fragment_maps>\n\n  #ifdef OBJECTSPACE_NORMALMAP\n\n    normal = texture2D( normalMap, uv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals\n\n    #ifdef FLIP_SIDED\n\n      normal = - normal;\n\n    #endif\n\n    #ifdef DOUBLE_SIDED\n\n      // Temporary compat against shader change @ Three.js r126\n      // See: #21205, #21307, #21299\n      #if THREE_VRM_THREE_REVISION >= 126\n\n        normal = normal * faceDirection;\n\n      #else\n\n        normal = normal * ( float( gl_FrontFacing ) * 2.0 - 1.0 );\n\n      #endif\n\n    #endif\n\n    normal = normalize( normalMatrix * normal );\n\n  #elif defined( TANGENTSPACE_NORMALMAP )\n\n    vec3 mapN = texture2D( normalMap, uv ).xyz * 2.0 - 1.0;\n    mapN.xy *= normalScale;\n\n    #ifdef USE_TANGENT\n\n      normal = normalize( vTBN * mapN );\n\n    #else\n\n      // Temporary compat against shader change @ Three.js r126\n      // See: #21205, #21307, #21299\n      #if THREE_VRM_THREE_REVISION >= 126\n\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN, faceDirection );\n\n      #else\n\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN );\n\n      #endif\n\n    #endif\n\n  #endif\n\n  // #include <emissivemap_fragment>\n  #ifdef USE_EMISSIVEMAP\n    #if THREE_VRM_THREE_REVISION >= 137\n      totalEmissiveRadiance *= texture2D( emissiveMap, uv ).rgb;\n    #else\n      // COMPAT: pre-r137\n      totalEmissiveRadiance *= emissiveMapTexelToLinear( texture2D( emissiveMap, uv ) ).rgb;\n    #endif\n  #endif\n\n  #ifdef DEBUG_NORMAL\n    gl_FragColor = vec4( 0.5 + 0.5 * normal, 1.0 );\n    return;\n  #endif\n\n  // -- MToon: lighting --------------------------------------------------------\n  // accumulation\n  // #include <lights_phong_fragment>\n  MToonMaterial material;\n\n  material.diffuseColor = diffuseColor.rgb;\n\n  material.shadeColor = shadeColor;\n  #ifdef USE_SHADETEXTURE\n    #if THREE_VRM_THREE_REVISION >= 137\n      material.shadeColor *= texture2D( shadeTexture, uv ).rgb;\n    #else\n      // COMPAT: pre-r137\n      material.shadeColor *= shadeTextureTexelToLinear( texture2D( shadeTexture, uv ) ).rgb;\n    #endif\n  #endif\n\n  material.shadingGrade = 1.0;\n  #ifdef USE_SHADINGGRADETEXTURE\n    material.shadingGrade = 1.0 - shadingGradeRate * ( 1.0 - texture2D( shadingGradeTexture, uv ).r );\n  #endif\n\n  material.receiveShadow = receiveShadowRate;\n  #ifdef USE_RECEIVESHADOWTEXTURE\n    material.receiveShadow *= texture2D( receiveShadowTexture, uv ).a;\n  #endif\n\n  // #include <lights_fragment_begin>\n  GeometricContext geometry;\n\n  geometry.position = - vViewPosition;\n  geometry.normal = normal;\n  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n\n  IncidentLight directLight;\n  vec3 lightingSum = vec3( 0.0 );\n\n  // since these variables will be used in unrolled loop, we have to define in prior\n  float atten, shadow, lightIntensity;\n  vec3 lighting;\n\n  #if ( NUM_POINT_LIGHTS > 0 )\n    PointLight pointLight;\n\n    #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n    PointLightShadow pointLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n      pointLight = pointLights[ i ];\n\n      #if THREE_VRM_THREE_REVISION >= 132\n        getPointLightInfo( pointLight, geometry, directLight );\n      #else\n        getPointDirectLightIrradiance( pointLight, geometry, directLight );\n      #endif\n\n      atten = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n      pointLightShadow = pointLightShadows[ i ];\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n      #endif\n\n      shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\n      lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\n      lighting = getLighting( directLight.color );\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\n      lightingSum += lighting;\n    }\n    #pragma unroll_loop_end\n  #endif\n\n  #if ( NUM_SPOT_LIGHTS > 0 )\n    SpotLight spotLight;\n\n    #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n    SpotLightShadow spotLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n      spotLight = spotLights[ i ];\n\n      #if THREE_VRM_THREE_REVISION >= 132\n        getSpotLightInfo( spotLight, geometry, directLight );\n      #else\n        getSpotDirectLightIrradiance( spotLight, geometry, directLight );\n      #endif\n\n      atten = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n      spotLightShadow = spotLightShadows[ i ];\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n      #endif\n\n      shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\n      lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\n      lighting = getLighting( directLight.color );\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\n      lightingSum += lighting;\n    }\n    #pragma unroll_loop_end\n  #endif\n\n  #if ( NUM_DIR_LIGHTS > 0 )\n    DirectionalLight directionalLight;\n\n    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n    DirectionalLightShadow directionalLightShadow;\n    #endif\n\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n      directionalLight = directionalLights[ i ];\n\n      #if THREE_VRM_THREE_REVISION >= 132\n        getDirectionalLightInfo( directionalLight, geometry, directLight );\n      #else\n        getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n      #endif\n\n      atten = 1.0;\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n      directionalLightShadow = directionalLightShadows[ i ];\n      atten = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n      #endif\n\n      shadow = 1.0 - material.receiveShadow * ( 1.0 - ( 0.5 + 0.5 * atten ) );\n      lightIntensity = getLightIntensity( directLight, geometry, shadow, material.shadingGrade );\n      lighting = getLighting( directLight.color );\n      reflectedLight.directDiffuse += getDiffuse( material, lightIntensity, lighting );\n      lightingSum += lighting;\n    }\n    #pragma unroll_loop_end\n  #endif\n\n  // #if defined( RE_IndirectDiffuse )\n  vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n  #if THREE_VRM_THREE_REVISION >= 133\n    irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );\n  #else\n    irradiance += getLightProbeIrradiance( lightProbe, geometry );\n  #endif\n  #if ( NUM_HEMI_LIGHTS > 0 )\n    #pragma unroll_loop_start\n    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n      #if THREE_VRM_THREE_REVISION >= 133\n        irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );\n      #else\n        irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\n      #endif\n    }\n    #pragma unroll_loop_end\n  #endif\n  // #endif\n\n  // #include <lights_fragment_maps>\n  #ifdef USE_LIGHTMAP\n    vec4 lightMapTexel = texture2D( lightMap, vUv2 );\n    #if THREE_VRM_THREE_REVISION >= 137\n      vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;\n    #else\n      // COMPAT: pre-r137\n      vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;\n    #endif\n    #ifndef PHYSICALLY_CORRECT_LIGHTS\n      lightMapIrradiance *= PI;\n    #endif\n    irradiance += lightMapIrradiance;\n  #endif\n\n  // #include <lights_fragment_end>\n  // RE_IndirectDiffuse here\n  reflectedLight.indirectDiffuse += indirectLightIntensity * irradiance * BRDF_Lambert( material.diffuseColor );\n\n  // modulation\n  #include <aomap_fragment>\n\n  vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\n\n  // The \"comment out if you want to PBR absolutely\" line\n  #ifndef DEBUG_LITSHADERATE\n    col = min(col, material.diffuseColor);\n  #endif\n\n  #if defined( OUTLINE ) && defined( OUTLINE_COLOR_MIXED )\n    gl_FragColor = vec4(\n      outlineColor.rgb * mix( vec3( 1.0 ), col, outlineLightingMix ),\n      diffuseColor.a\n    );\n    postCorrection();\n    return;\n  #endif\n\n  #ifdef DEBUG_LITSHADERATE\n    gl_FragColor = vec4( col, diffuseColor.a );\n    postCorrection();\n    return;\n  #endif\n\n  // -- MToon: parametric rim lighting -----------------------------------------\n  vec3 viewDir = normalize( vViewPosition );\n  vec3 rimMix = mix( vec3( 1.0 ), lightingSum + indirectLightIntensity * irradiance, rimLightingMix );\n  vec3 rim = rimColor * pow( saturate( 1.0 - dot( viewDir, normal ) + rimLift ), rimFresnelPower );\n  #ifdef USE_RIMTEXTURE\n    #if THREE_VRM_THREE_REVISION >= 137\n      rim *= texture2D( rimTexture, uv ).rgb;\n    #else\n      // COMPAT: pre-r137\n      rim *= rimTextureTexelToLinear( texture2D( rimTexture, uv ) ).rgb;\n    #endif\n  #endif\n  col += rim;\n\n  // -- MToon: additive matcap -------------------------------------------------\n  #ifdef USE_SPHEREADD\n    {\n      vec3 x = normalize( vec3( viewDir.z, 0.0, -viewDir.x ) );\n      vec3 y = cross( viewDir, x ); // guaranteed to be normalized\n      vec2 sphereUv = 0.5 + 0.5 * vec2( dot( x, normal ), -dot( y, normal ) );\n      #if THREE_VRM_THREE_REVISION >= 137\n        vec3 matcap = texture2D( sphereAdd, sphereUv ).xyz;\n      #else\n        // COMPAT: pre-r137\n        vec3 matcap = sphereAddTexelToLinear( texture2D( sphereAdd, sphereUv ) ).xyz;\n      #endif\n      col += matcap;\n    }\n  #endif\n\n  // -- MToon: Emission --------------------------------------------------------\n  col += totalEmissiveRadiance;\n\n  // #include <envmap_fragment>\n\n  // -- Almost done! -----------------------------------------------------------\n  gl_FragColor = vec4( col, diffuseColor.a );\n  postCorrection();\n}";

// Since these constants are deleted in r136 we have to define by ourselves
/* eslint-disable @typescript-eslint/naming-convention */
const RGBEEncoding = 3002;
const RGBM7Encoding = 3004;
const RGBM16Encoding = 3005;
const RGBDEncoding = 3006;
const GammaEncoding = 3007;
/* eslint-enable @typescript-eslint/naming-convention */
/**
 * COMPAT: pre-r137
 * Ref: https://github.com/mrdoob/three.js/blob/r136/src/renderers/webgl/WebGLProgram.js#L22
 */
const getEncodingComponents = (encoding) => {
    if (parseInt(THREE.REVISION, 10) >= 136) {
        switch (encoding) {
            case THREE.LinearEncoding:
                return ['Linear', '( value )'];
            case THREE.sRGBEncoding:
                return ['sRGB', '( value )'];
            default:
                console.warn('THREE.WebGLProgram: Unsupported encoding:', encoding);
                return ['Linear', '( value )'];
        }
    }
    else {
        // COMPAT: pre-r136
        switch (encoding) {
            case THREE.LinearEncoding:
                return ['Linear', '( value )'];
            case THREE.sRGBEncoding:
                return ['sRGB', '( value )'];
            case RGBEEncoding:
                return ['RGBE', '( value )'];
            case RGBM7Encoding:
                return ['RGBM', '( value, 7.0 )'];
            case RGBM16Encoding:
                return ['RGBM', '( value, 16.0 )'];
            case RGBDEncoding:
                return ['RGBD', '( value, 256.0 )'];
            case GammaEncoding:
                return ['Gamma', '( value, float( GAMMA_FACTOR ) )'];
            default:
                throw new Error('unsupported encoding: ' + encoding);
        }
    }
};
/**
 * COMPAT: pre-r137
 * This function is no longer required beginning from r137
 *
 * https://github.com/mrdoob/three.js/blob/r136/src/renderers/webgl/WebGLProgram.js#L52
 */
const getTexelDecodingFunction = (functionName, encoding) => {
    const components = getEncodingComponents(encoding);
    return 'vec4 ' + functionName + '( vec4 value ) { return ' + components[0] + 'ToLinear' + components[1] + '; }';
};

/* tslint:disable:member-ordering */
const TAU = 2.0 * Math.PI;
var MToonMaterialCullMode;
(function (MToonMaterialCullMode) {
    MToonMaterialCullMode[MToonMaterialCullMode["Off"] = 0] = "Off";
    MToonMaterialCullMode[MToonMaterialCullMode["Front"] = 1] = "Front";
    MToonMaterialCullMode[MToonMaterialCullMode["Back"] = 2] = "Back";
})(MToonMaterialCullMode || (MToonMaterialCullMode = {}));
var MToonMaterialDebugMode;
(function (MToonMaterialDebugMode) {
    MToonMaterialDebugMode[MToonMaterialDebugMode["None"] = 0] = "None";
    MToonMaterialDebugMode[MToonMaterialDebugMode["Normal"] = 1] = "Normal";
    MToonMaterialDebugMode[MToonMaterialDebugMode["LitShadeRate"] = 2] = "LitShadeRate";
    MToonMaterialDebugMode[MToonMaterialDebugMode["UV"] = 3] = "UV";
})(MToonMaterialDebugMode || (MToonMaterialDebugMode = {}));
var MToonMaterialOutlineColorMode;
(function (MToonMaterialOutlineColorMode) {
    MToonMaterialOutlineColorMode[MToonMaterialOutlineColorMode["FixedColor"] = 0] = "FixedColor";
    MToonMaterialOutlineColorMode[MToonMaterialOutlineColorMode["MixedLighting"] = 1] = "MixedLighting";
})(MToonMaterialOutlineColorMode || (MToonMaterialOutlineColorMode = {}));
var MToonMaterialOutlineWidthMode;
(function (MToonMaterialOutlineWidthMode) {
    MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["None"] = 0] = "None";
    MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["WorldCoordinates"] = 1] = "WorldCoordinates";
    MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["ScreenCoordinates"] = 2] = "ScreenCoordinates";
})(MToonMaterialOutlineWidthMode || (MToonMaterialOutlineWidthMode = {}));
var MToonMaterialRenderMode;
(function (MToonMaterialRenderMode) {
    MToonMaterialRenderMode[MToonMaterialRenderMode["Opaque"] = 0] = "Opaque";
    MToonMaterialRenderMode[MToonMaterialRenderMode["Cutout"] = 1] = "Cutout";
    MToonMaterialRenderMode[MToonMaterialRenderMode["Transparent"] = 2] = "Transparent";
    MToonMaterialRenderMode[MToonMaterialRenderMode["TransparentWithZWrite"] = 3] = "TransparentWithZWrite";
})(MToonMaterialRenderMode || (MToonMaterialRenderMode = {}));
/**
 * MToon is a material specification that has various features.
 * The spec and implementation are originally founded for Unity engine and this is a port of the material.
 *
 * See: https://github.com/Santarh/MToon
 */
class MToonMaterial extends THREE.ShaderMaterial {
    constructor(parameters = {}) {
        super();
        /**
         * Readonly boolean that indicates this is a [[MToonMaterial]].
         */
        this.isMToonMaterial = true;
        this.cutoff = 0.5; // _Cutoff
        this.color = new THREE.Vector4(1.0, 1.0, 1.0, 1.0); // _Color
        this.shadeColor = new THREE.Vector4(0.97, 0.81, 0.86, 1.0); // _ShadeColor
        this.map = null; // _MainTex
        // eslint-disable-next-line @typescript-eslint/naming-convention
        this.mainTex_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
        this.shadeTexture = null; // _ShadeTexture
        // public shadeTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ShadeTexture_ST (unused)
        this.normalMap = null; // _BumpMap. again, THIS IS _BumpMap
        this.normalMapType = THREE.TangentSpaceNormalMap; // Three.js requires this
        this.normalScale = new THREE.Vector2(1.0, 1.0); // _BumpScale, in Vector2
        // public bumpMap_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _BumpMap_ST (unused)
        this.receiveShadowRate = 1.0; // _ReceiveShadowRate
        this.receiveShadowTexture = null; // _ReceiveShadowTexture
        // public receiveShadowTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ReceiveShadowTexture_ST (unused)
        this.shadingGradeRate = 1.0; // _ShadingGradeRate
        this.shadingGradeTexture = null; // _ShadingGradeTexture
        // public shadingGradeTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ShadingGradeTexture_ST (unused)
        this.shadeShift = 0.0; // _ShadeShift
        this.shadeToony = 0.9; // _ShadeToony
        this.lightColorAttenuation = 0.0; // _LightColorAttenuation
        this.indirectLightIntensity = 0.1; // _IndirectLightIntensity
        this.rimTexture = null; // _RimTexture
        this.rimColor = new THREE.Vector4(0.0, 0.0, 0.0, 1.0); // _RimColor
        this.rimLightingMix = 0.0; // _RimLightingMix
        this.rimFresnelPower = 1.0; // _RimFresnelPower
        this.rimLift = 0.0; // _RimLift
        this.sphereAdd = null; // _SphereAdd
        // public sphereAdd_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _SphereAdd_ST (unused)
        this.emissionColor = new THREE.Vector4(0.0, 0.0, 0.0, 1.0); // _EmissionColor
        this.emissiveMap = null; // _EmissionMap
        // public emissionMap_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _EmissionMap_ST (unused)
        this.outlineWidthTexture = null; // _OutlineWidthTexture
        // public outlineWidthTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _OutlineWidthTexture_ST (unused)
        this.outlineWidth = 0.5; // _OutlineWidth
        this.outlineScaledMaxDistance = 1.0; // _OutlineScaledMaxDistance
        this.outlineColor = new THREE.Vector4(0.0, 0.0, 0.0, 1.0); // _OutlineColor
        this.outlineLightingMix = 1.0; // _OutlineLightingMix
        this.uvAnimMaskTexture = null; // _UvAnimMaskTexture
        this.uvAnimScrollX = 0.0; // _UvAnimScrollX
        this.uvAnimScrollY = 0.0; // _UvAnimScrollY
        this.uvAnimRotation = 0.0; // _uvAnimRotation
        this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
        this._debugMode = MToonMaterialDebugMode.None; // _DebugMode
        this._blendMode = MToonMaterialRenderMode.Opaque; // _BlendMode
        this._outlineWidthMode = MToonMaterialOutlineWidthMode.None; // _OutlineWidthMode
        this._outlineColorMode = MToonMaterialOutlineColorMode.FixedColor; // _OutlineColorMode
        this._cullMode = MToonMaterialCullMode.Back; // _CullMode
        this._outlineCullMode = MToonMaterialCullMode.Front; // _OutlineCullMode
        // public srcBlend = 1.0; // _SrcBlend (is not supported)
        // public dstBlend = 0.0; // _DstBlend (is not supported)
        // public zWrite = 1.0; // _ZWrite (will be converted to depthWrite)
        this._isOutline = false;
        this._uvAnimOffsetX = 0.0;
        this._uvAnimOffsetY = 0.0;
        this._uvAnimPhase = 0.0;
        this.encoding = parameters.encoding || THREE.LinearEncoding;
        if (this.encoding !== THREE.LinearEncoding && this.encoding !== THREE.sRGBEncoding) {
            console.warn('The specified color encoding does not work properly with MToonMaterial. You might want to use THREE.sRGBEncoding instead.');
        }
        // == these parameter has no compatibility with this implementation ========
        [
            'mToonVersion',
            'shadeTexture_ST',
            'bumpMap_ST',
            'receiveShadowTexture_ST',
            'shadingGradeTexture_ST',
            'rimTexture_ST',
            'sphereAdd_ST',
            'emissionMap_ST',
            'outlineWidthTexture_ST',
            'uvAnimMaskTexture_ST',
            'srcBlend',
            'dstBlend',
        ].forEach((key) => {
            if (parameters[key] !== undefined) {
                // console.warn(`THREE.${this.type}: The parameter "${key}" is not supported.`);
                delete parameters[key];
            }
        });
        // == enabling bunch of stuff ==============================================
        parameters.fog = true;
        parameters.lights = true;
        parameters.clipping = true;
        // COMPAT: pre-r129
        // See: https://github.com/mrdoob/three.js/pull/21788
        if (parseInt(THREE.REVISION, 10) < 129) {
            parameters.skinning = parameters.skinning || false;
        }
        // COMPAT: pre-r131
        // See: https://github.com/mrdoob/three.js/pull/22169
        if (parseInt(THREE.REVISION, 10) < 131) {
            parameters.morphTargets = parameters.morphTargets || false;
            parameters.morphNormals = parameters.morphNormals || false;
        }
        // == uniforms =============================================================
        parameters.uniforms = THREE.UniformsUtils.merge([
            THREE.UniformsLib.common,
            THREE.UniformsLib.normalmap,
            THREE.UniformsLib.emissivemap,
            THREE.UniformsLib.fog,
            THREE.UniformsLib.lights,
            {
                cutoff: { value: 0.5 },
                color: { value: new THREE.Color(1.0, 1.0, 1.0) },
                colorAlpha: { value: 1.0 },
                shadeColor: { value: new THREE.Color(0.97, 0.81, 0.86) },
                // eslint-disable-next-line @typescript-eslint/naming-convention
                mainTex_ST: { value: new THREE.Vector4(0.0, 0.0, 1.0, 1.0) },
                shadeTexture: { value: null },
                receiveShadowRate: { value: 1.0 },
                receiveShadowTexture: { value: null },
                shadingGradeRate: { value: 1.0 },
                shadingGradeTexture: { value: null },
                shadeShift: { value: 0.0 },
                shadeToony: { value: 0.9 },
                lightColorAttenuation: { value: 0.0 },
                indirectLightIntensity: { value: 0.1 },
                rimTexture: { value: null },
                rimColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
                rimLightingMix: { value: 0.0 },
                rimFresnelPower: { value: 1.0 },
                rimLift: { value: 0.0 },
                sphereAdd: { value: null },
                emissionColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
                outlineWidthTexture: { value: null },
                outlineWidth: { value: 0.5 },
                outlineScaledMaxDistance: { value: 1.0 },
                outlineColor: { value: new THREE.Color(0.0, 0.0, 0.0) },
                outlineLightingMix: { value: 1.0 },
                uvAnimMaskTexture: { value: null },
                uvAnimOffsetX: { value: 0.0 },
                uvAnimOffsetY: { value: 0.0 },
                uvAnimTheta: { value: 0.0 },
            },
        ]);
        // == finally compile the shader program ===================================
        this.setValues(parameters);
        // == update shader stuff ==================================================
        this._updateShaderCode();
        this._applyUniforms();
    }
    get mainTex() {
        return this.map;
    }
    set mainTex(t) {
        this.map = t;
    }
    get bumpMap() {
        return this.normalMap;
    }
    set bumpMap(t) {
        this.normalMap = t;
    }
    /**
     * Getting the `bumpScale` reutrns its x component of `normalScale` (assuming x and y component of `normalScale` are same).
     */
    get bumpScale() {
        return this.normalScale.x;
    }
    /**
     * Setting the `bumpScale` will be convert the value into Vector2 `normalScale` .
     */
    set bumpScale(t) {
        this.normalScale.set(t, t);
    }
    get emissionMap() {
        return this.emissiveMap;
    }
    set emissionMap(t) {
        this.emissiveMap = t;
    }
    get blendMode() {
        return this._blendMode;
    }
    set blendMode(m) {
        this._blendMode = m;
        this.depthWrite = this._blendMode !== MToonMaterialRenderMode.Transparent;
        this.transparent =
            this._blendMode === MToonMaterialRenderMode.Transparent ||
                this._blendMode === MToonMaterialRenderMode.TransparentWithZWrite;
        this._updateShaderCode();
    }
    get debugMode() {
        return this._debugMode;
    }
    set debugMode(m) {
        this._debugMode = m;
        this._updateShaderCode();
    }
    get outlineWidthMode() {
        return this._outlineWidthMode;
    }
    set outlineWidthMode(m) {
        this._outlineWidthMode = m;
        this._updateShaderCode();
    }
    get outlineColorMode() {
        return this._outlineColorMode;
    }
    set outlineColorMode(m) {
        this._outlineColorMode = m;
        this._updateShaderCode();
    }
    get cullMode() {
        return this._cullMode;
    }
    set cullMode(m) {
        this._cullMode = m;
        this._updateCullFace();
    }
    get outlineCullMode() {
        return this._outlineCullMode;
    }
    set outlineCullMode(m) {
        this._outlineCullMode = m;
        this._updateCullFace();
    }
    get zWrite() {
        return this.depthWrite ? 1 : 0;
    }
    set zWrite(i) {
        this.depthWrite = 0.5 <= i;
    }
    get isOutline() {
        return this._isOutline;
    }
    set isOutline(b) {
        this._isOutline = b;
        this._updateShaderCode();
        this._updateCullFace();
    }
    /**
     * Update this material.
     * Usually this will be called via [[VRM.update]] so you don't have to call this manually.
     *
     * @param delta deltaTime since last update
     */
    updateVRMMaterials(delta) {
        this._uvAnimOffsetX = this._uvAnimOffsetX + delta * this.uvAnimScrollX;
        this._uvAnimOffsetY = this._uvAnimOffsetY - delta * this.uvAnimScrollY; // Negative since t axis of uvs are opposite from Unity's one
        this._uvAnimPhase = this._uvAnimPhase + delta * this.uvAnimRotation;
        this._applyUniforms();
    }
    copy(source) {
        super.copy(source);
        // == copy members =========================================================
        this.cutoff = source.cutoff;
        this.color.copy(source.color);
        this.shadeColor.copy(source.shadeColor);
        this.map = source.map;
        this.mainTex_ST.copy(source.mainTex_ST);
        this.shadeTexture = source.shadeTexture;
        this.normalMap = source.normalMap;
        this.normalMapType = source.normalMapType;
        this.normalScale.copy(this.normalScale);
        this.receiveShadowRate = source.receiveShadowRate;
        this.receiveShadowTexture = source.receiveShadowTexture;
        this.shadingGradeRate = source.shadingGradeRate;
        this.shadingGradeTexture = source.shadingGradeTexture;
        this.shadeShift = source.shadeShift;
        this.shadeToony = source.shadeToony;
        this.lightColorAttenuation = source.lightColorAttenuation;
        this.indirectLightIntensity = source.indirectLightIntensity;
        this.rimTexture = source.rimTexture;
        this.rimColor.copy(source.rimColor);
        this.rimLightingMix = source.rimLightingMix;
        this.rimFresnelPower = source.rimFresnelPower;
        this.rimLift = source.rimLift;
        this.sphereAdd = source.sphereAdd;
        this.emissionColor.copy(source.emissionColor);
        this.emissiveMap = source.emissiveMap;
        this.outlineWidthTexture = source.outlineWidthTexture;
        this.outlineWidth = source.outlineWidth;
        this.outlineScaledMaxDistance = source.outlineScaledMaxDistance;
        this.outlineColor.copy(source.outlineColor);
        this.outlineLightingMix = source.outlineLightingMix;
        this.uvAnimMaskTexture = source.uvAnimMaskTexture;
        this.uvAnimScrollX = source.uvAnimScrollX;
        this.uvAnimScrollY = source.uvAnimScrollY;
        this.uvAnimRotation = source.uvAnimRotation;
        this.debugMode = source.debugMode;
        this.blendMode = source.blendMode;
        this.outlineWidthMode = source.outlineWidthMode;
        this.outlineColorMode = source.outlineColorMode;
        this.cullMode = source.cullMode;
        this.outlineCullMode = source.outlineCullMode;
        this.isOutline = source.isOutline;
        return this;
    }
    /**
     * Apply updated uniform variables.
     */
    _applyUniforms() {
        this.uniforms.uvAnimOffsetX.value = this._uvAnimOffsetX;
        this.uniforms.uvAnimOffsetY.value = this._uvAnimOffsetY;
        this.uniforms.uvAnimTheta.value = TAU * this._uvAnimPhase;
        if (!this.shouldApplyUniforms) {
            return;
        }
        this.shouldApplyUniforms = false;
        this.uniforms.cutoff.value = this.cutoff;
        this.uniforms.color.value.setRGB(this.color.x, this.color.y, this.color.z);
        this.uniforms.colorAlpha.value = this.color.w;
        this.uniforms.shadeColor.value.setRGB(this.shadeColor.x, this.shadeColor.y, this.shadeColor.z);
        this.uniforms.map.value = this.map;
        this.uniforms.mainTex_ST.value.copy(this.mainTex_ST);
        this.uniforms.shadeTexture.value = this.shadeTexture;
        this.uniforms.normalMap.value = this.normalMap;
        this.uniforms.normalScale.value.copy(this.normalScale);
        this.uniforms.receiveShadowRate.value = this.receiveShadowRate;
        this.uniforms.receiveShadowTexture.value = this.receiveShadowTexture;
        this.uniforms.shadingGradeRate.value = this.shadingGradeRate;
        this.uniforms.shadingGradeTexture.value = this.shadingGradeTexture;
        this.uniforms.shadeShift.value = this.shadeShift;
        this.uniforms.shadeToony.value = this.shadeToony;
        this.uniforms.lightColorAttenuation.value = this.lightColorAttenuation;
        this.uniforms.indirectLightIntensity.value = this.indirectLightIntensity;
        this.uniforms.rimTexture.value = this.rimTexture;
        this.uniforms.rimColor.value.setRGB(this.rimColor.x, this.rimColor.y, this.rimColor.z);
        this.uniforms.rimLightingMix.value = this.rimLightingMix;
        this.uniforms.rimFresnelPower.value = this.rimFresnelPower;
        this.uniforms.rimLift.value = this.rimLift;
        this.uniforms.sphereAdd.value = this.sphereAdd;
        this.uniforms.emissionColor.value.setRGB(this.emissionColor.x, this.emissionColor.y, this.emissionColor.z);
        this.uniforms.emissiveMap.value = this.emissiveMap;
        this.uniforms.outlineWidthTexture.value = this.outlineWidthTexture;
        this.uniforms.outlineWidth.value = this.outlineWidth;
        this.uniforms.outlineScaledMaxDistance.value = this.outlineScaledMaxDistance;
        this.uniforms.outlineColor.value.setRGB(this.outlineColor.x, this.outlineColor.y, this.outlineColor.z);
        this.uniforms.outlineLightingMix.value = this.outlineLightingMix;
        this.uniforms.uvAnimMaskTexture.value = this.uvAnimMaskTexture;
        // apply color space to uniform colors
        if (this.encoding === THREE.sRGBEncoding) {
            this.uniforms.color.value.convertSRGBToLinear();
            this.uniforms.shadeColor.value.convertSRGBToLinear();
            this.uniforms.rimColor.value.convertSRGBToLinear();
            this.uniforms.emissionColor.value.convertSRGBToLinear();
            this.uniforms.outlineColor.value.convertSRGBToLinear();
        }
        this._updateCullFace();
    }
    _updateShaderCode() {
        const useUvInVert = this.outlineWidthTexture !== null;
        const useUvInFrag = this.map !== null ||
            this.shadeTexture !== null ||
            this.receiveShadowTexture !== null ||
            this.shadingGradeTexture !== null ||
            this.rimTexture !== null ||
            this.uvAnimMaskTexture !== null;
        this.defines = {
            // Used for compats
            THREE_VRM_THREE_REVISION: parseInt(THREE.REVISION, 10),
            OUTLINE: this._isOutline,
            BLENDMODE_OPAQUE: this._blendMode === MToonMaterialRenderMode.Opaque,
            BLENDMODE_CUTOUT: this._blendMode === MToonMaterialRenderMode.Cutout,
            BLENDMODE_TRANSPARENT: this._blendMode === MToonMaterialRenderMode.Transparent ||
                this._blendMode === MToonMaterialRenderMode.TransparentWithZWrite,
            MTOON_USE_UV: useUvInVert || useUvInFrag,
            MTOON_UVS_VERTEX_ONLY: useUvInVert && !useUvInFrag,
            USE_SHADETEXTURE: this.shadeTexture !== null,
            USE_RECEIVESHADOWTEXTURE: this.receiveShadowTexture !== null,
            USE_SHADINGGRADETEXTURE: this.shadingGradeTexture !== null,
            USE_RIMTEXTURE: this.rimTexture !== null,
            USE_SPHEREADD: this.sphereAdd !== null,
            USE_OUTLINEWIDTHTEXTURE: this.outlineWidthTexture !== null,
            USE_UVANIMMASKTEXTURE: this.uvAnimMaskTexture !== null,
            DEBUG_NORMAL: this._debugMode === MToonMaterialDebugMode.Normal,
            DEBUG_LITSHADERATE: this._debugMode === MToonMaterialDebugMode.LitShadeRate,
            DEBUG_UV: this._debugMode === MToonMaterialDebugMode.UV,
            OUTLINE_WIDTH_WORLD: this._outlineWidthMode === MToonMaterialOutlineWidthMode.WorldCoordinates,
            OUTLINE_WIDTH_SCREEN: this._outlineWidthMode === MToonMaterialOutlineWidthMode.ScreenCoordinates,
            OUTLINE_COLOR_FIXED: this._outlineColorMode === MToonMaterialOutlineColorMode.FixedColor,
            OUTLINE_COLOR_MIXED: this._outlineColorMode === MToonMaterialOutlineColorMode.MixedLighting,
        };
        // == generate shader code =================================================
        this.vertexShader = vertexShader$1;
        this.fragmentShader = fragmentShader$1;
        // == texture encodings ====================================================
        // COMPAT: pre-r137
        if (parseInt(THREE.REVISION, 10) < 137) {
            const encodings = (this.shadeTexture !== null
                ? getTexelDecodingFunction('shadeTextureTexelToLinear', this.shadeTexture.encoding) + '\n'
                : '') +
                (this.sphereAdd !== null
                    ? getTexelDecodingFunction('sphereAddTexelToLinear', this.sphereAdd.encoding) + '\n'
                    : '') +
                (this.rimTexture !== null
                    ? getTexelDecodingFunction('rimTextureTexelToLinear', this.rimTexture.encoding) + '\n'
                    : '');
            this.fragmentShader = encodings + fragmentShader$1;
        }
        // == set needsUpdate flag =================================================
        this.needsUpdate = true;
    }
    _updateCullFace() {
        if (!this.isOutline) {
            if (this.cullMode === MToonMaterialCullMode.Off) {
                this.side = THREE.DoubleSide;
            }
            else if (this.cullMode === MToonMaterialCullMode.Front) {
                this.side = THREE.BackSide;
            }
            else if (this.cullMode === MToonMaterialCullMode.Back) {
                this.side = THREE.FrontSide;
            }
        }
        else {
            if (this.outlineCullMode === MToonMaterialCullMode.Off) {
                this.side = THREE.DoubleSide;
            }
            else if (this.outlineCullMode === MToonMaterialCullMode.Front) {
                this.side = THREE.BackSide;
            }
            else if (this.outlineCullMode === MToonMaterialCullMode.Back) {
                this.side = THREE.FrontSide;
            }
        }
    }
}

var vertexShader = "#include <common>\n\n// #include <uv_pars_vertex>\n#ifdef USE_MAP\n  varying vec2 vUv;\n  uniform vec4 mainTex_ST;\n#endif\n\n#include <uv2_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\nvoid main() {\n\n  // #include <uv_vertex>\n  #ifdef USE_MAP\n    vUv = vec2( mainTex_ST.p * uv.x + mainTex_ST.s, mainTex_ST.q * uv.y + mainTex_ST.t );\n  #endif\n\n  #include <uv2_vertex>\n  #include <color_vertex>\n  #include <skinbase_vertex>\n\n  #ifdef USE_ENVMAP\n\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinnormal_vertex>\n  #include <defaultnormal_vertex>\n\n  #endif\n\n  #include <begin_vertex>\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  #include <project_vertex>\n  #include <logdepthbuf_vertex>\n\n  #include <worldpos_vertex>\n  #include <clipping_planes_vertex>\n  #include <envmap_vertex>\n  #include <fog_vertex>\n\n}";

var fragmentShader = "#ifdef RENDERTYPE_CUTOUT\n  uniform float cutoff;\n#endif\n\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n// #include <alphamap_pars_fragment>\n// #include <aomap_pars_fragment>\n// #include <lightmap_pars_fragment>\n// #include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n// #include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\n// == main procedure ===========================================================\nvoid main() {\n  #include <clipping_planes_fragment>\n\n  vec4 diffuseColor = vec4( 1.0 );\n\n  #include <logdepthbuf_fragment>\n\n  #include <map_fragment>\n  #include <color_fragment>\n  // #include <alphamap_fragment>\n\n  // MToon: alpha\n  // #include <alphatest_fragment>\n  #ifdef RENDERTYPE_CUTOUT\n    if ( diffuseColor.a <= cutoff ) { discard; }\n    diffuseColor.a = 1.0;\n  #endif\n\n  #ifdef RENDERTYPE_OPAQUE\n    diffuseColor.a = 1.0;\n  #endif\n\n  // #include <specularmap_fragment>\n\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\n  // accumulation (baked indirect lighting only)\n  #ifdef USE_LIGHTMAP\n    reflectedLight.indirectDiffuse += texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;\n  #else\n    reflectedLight.indirectDiffuse += vec3( 1.0 );\n  #endif\n\n  // modulation\n  // #include <aomap_fragment>\n\n  reflectedLight.indirectDiffuse *= diffuseColor.rgb;\n  vec3 outgoingLight = reflectedLight.indirectDiffuse;\n\n  // #include <envmap_fragment>\n\n  gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\n  #include <premultiplied_alpha_fragment>\n  #include <tonemapping_fragment>\n  #include <encodings_fragment>\n  #include <fog_fragment>\n}";

/* tslint:disable:member-ordering */
var VRMUnlitMaterialRenderType;
(function (VRMUnlitMaterialRenderType) {
    VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Opaque"] = 0] = "Opaque";
    VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Cutout"] = 1] = "Cutout";
    VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Transparent"] = 2] = "Transparent";
    VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["TransparentWithZWrite"] = 3] = "TransparentWithZWrite";
})(VRMUnlitMaterialRenderType || (VRMUnlitMaterialRenderType = {}));
/**
 * This is a material that is an equivalent of "VRM/Unlit***" on VRM spec, those materials are already kinda deprecated though...
 */
class VRMUnlitMaterial extends THREE.ShaderMaterial {
    constructor(parameters) {
        super();
        /**
         * Readonly boolean that indicates this is a [[VRMUnlitMaterial]].
         */
        this.isVRMUnlitMaterial = true;
        this.cutoff = 0.5;
        this.map = null; // _MainTex
        // eslint-disable-next-line @typescript-eslint/naming-convention
        this.mainTex_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
        this._renderType = VRMUnlitMaterialRenderType.Opaque;
        this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
        if (parameters === undefined) {
            parameters = {};
        }
        // == enabling bunch of stuff ==============================================
        parameters.fog = true;
        parameters.clipping = true;
        // COMPAT: pre-r129
        // See: https://github.com/mrdoob/three.js/pull/21788
        if (parseInt(THREE.REVISION, 10) < 129) {
            parameters.skinning = parameters.skinning || false;
        }
        // COMPAT: pre-r131
        // See: https://github.com/mrdoob/three.js/pull/22169
        if (parseInt(THREE.REVISION, 10) < 131) {
            parameters.morphTargets = parameters.morphTargets || false;
            parameters.morphNormals = parameters.morphNormals || false;
        }
        // == uniforms =============================================================
        parameters.uniforms = THREE.UniformsUtils.merge([
            THREE.UniformsLib.common,
            THREE.UniformsLib.fog,
            {
                cutoff: { value: 0.5 },
                // eslint-disable-next-line @typescript-eslint/naming-convention
                mainTex_ST: { value: new THREE.Vector4(0.0, 0.0, 1.0, 1.0) },
            },
        ]);
        // == finally compile the shader program ===================================
        this.setValues(parameters);
        // == update shader stuff ==================================================
        this._updateShaderCode();
        this._applyUniforms();
    }
    get mainTex() {
        return this.map;
    }
    set mainTex(t) {
        this.map = t;
    }
    get renderType() {
        return this._renderType;
    }
    set renderType(t) {
        this._renderType = t;
        this.depthWrite = this._renderType !== VRMUnlitMaterialRenderType.Transparent;
        this.transparent =
            this._renderType === VRMUnlitMaterialRenderType.Transparent ||
                this._renderType === VRMUnlitMaterialRenderType.TransparentWithZWrite;
        this._updateShaderCode();
    }
    /**
     * Update this material.
     * Usually this will be called via [[VRM.update]] so you don't have to call this manually.
     *
     * @param delta deltaTime since last update
     */
    updateVRMMaterials(delta) {
        this._applyUniforms();
    }
    copy(source) {
        super.copy(source);
        // == copy members =========================================================
        this.cutoff = source.cutoff;
        this.map = source.map;
        this.mainTex_ST.copy(source.mainTex_ST);
        this.renderType = source.renderType;
        return this;
    }
    /**
     * Apply updated uniform variables.
     */
    _applyUniforms() {
        if (!this.shouldApplyUniforms) {
            return;
        }
        this.shouldApplyUniforms = false;
        this.uniforms.cutoff.value = this.cutoff;
        this.uniforms.map.value = this.map;
        this.uniforms.mainTex_ST.value.copy(this.mainTex_ST);
    }
    _updateShaderCode() {
        this.defines = {
            RENDERTYPE_OPAQUE: this._renderType === VRMUnlitMaterialRenderType.Opaque,
            RENDERTYPE_CUTOUT: this._renderType === VRMUnlitMaterialRenderType.Cutout,
            RENDERTYPE_TRANSPARENT: this._renderType === VRMUnlitMaterialRenderType.Transparent ||
                this._renderType === VRMUnlitMaterialRenderType.TransparentWithZWrite,
        };
        this.vertexShader = vertexShader;
        this.fragmentShader = fragmentShader;
        // == set needsUpdate flag =================================================
        this.needsUpdate = true;
    }
}

/**
 * An importer that imports VRM materials from a VRM extension of a GLTF.
 */
class VRMMaterialImporter {
    /**
     * Create a new VRMMaterialImporter.
     *
     * @param options Options of the VRMMaterialImporter
     */
    constructor(options = {}) {
        this._encoding = options.encoding || THREE.LinearEncoding;
        if (this._encoding !== THREE.LinearEncoding && this._encoding !== THREE.sRGBEncoding) {
            console.warn('The specified color encoding might not work properly with VRMMaterialImporter. You might want to use THREE.sRGBEncoding instead.');
        }
        this._requestEnvMap = options.requestEnvMap;
    }
    /**
     * Convert all the materials of given GLTF based on VRM extension field `materialProperties`.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    convertGLTFMaterials(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const materialProperties = vrmExt.materialProperties;
            if (!materialProperties) {
                return null;
            }
            const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
            const materialList = {};
            const materials = []; // result
            yield Promise.all(Array.from(nodePrimitivesMap.entries()).map(([nodeIndex, primitives]) => __awaiter(this, void 0, void 0, function* () {
                const schemaNode = gltf.parser.json.nodes[nodeIndex];
                const schemaMesh = gltf.parser.json.meshes[schemaNode.mesh];
                yield Promise.all(primitives.map((primitive, primitiveIndex) => __awaiter(this, void 0, void 0, function* () {
                    const schemaPrimitive = schemaMesh.primitives[primitiveIndex];
                    // some glTF might have both `node.mesh` and `node.children` at once
                    // and GLTFLoader handles both mesh primitives and "children" in glTF as "children" in THREE
                    // It seems GLTFLoader handles primitives first then handles "children" in glTF (it's lucky!)
                    // so we should ignore (primitives.length)th and following children of `mesh.children`
                    // TODO: sanitize this after GLTFLoader plugin system gets introduced : https://github.com/mrdoob/three.js/pull/18421
                    if (!schemaPrimitive) {
                        return;
                    }
                    const primitiveGeometry = primitive.geometry;
                    const primitiveVertices = primitiveGeometry.index
                        ? primitiveGeometry.index.count
                        : primitiveGeometry.attributes.position.count / 3;
                    // if primitives material is not an array, make it an array
                    if (!Array.isArray(primitive.material)) {
                        primitive.material = [primitive.material];
                        primitiveGeometry.addGroup(0, primitiveVertices, 0);
                    }
                    // create / push to cache (or pop from cache) vrm materials
                    const vrmMaterialIndex = schemaPrimitive.material;
                    let props = materialProperties[vrmMaterialIndex];
                    if (!props) {
                        console.warn(`VRMMaterialImporter: There are no material definition for material #${vrmMaterialIndex} on VRM extension.`);
                        props = { shader: 'VRM_USE_GLTFSHADER' }; // fallback
                    }
                    let vrmMaterials;
                    if (materialList[vrmMaterialIndex]) {
                        vrmMaterials = materialList[vrmMaterialIndex];
                    }
                    else {
                        vrmMaterials = yield this.createVRMMaterials(primitive.material[0], props, gltf);
                        materialList[vrmMaterialIndex] = vrmMaterials;
                        materials.push(vrmMaterials.surface);
                        if (vrmMaterials.outline) {
                            materials.push(vrmMaterials.outline);
                        }
                    }
                    // surface
                    primitive.material[0] = vrmMaterials.surface;
                    // envmap
                    if (this._requestEnvMap && vrmMaterials.surface.isMeshStandardMaterial) {
                        this._requestEnvMap().then((envMap) => {
                            vrmMaterials.surface.envMap = envMap;
                            vrmMaterials.surface.needsUpdate = true;
                        });
                    }
                    // render order
                    primitive.renderOrder = props.renderQueue || 2000;
                    // outline ("2 pass shading using groups" trick here)
                    if (vrmMaterials.outline) {
                        primitive.material[1] = vrmMaterials.outline;
                        primitiveGeometry.addGroup(0, primitiveVertices, 1);
                    }
                })));
            })));
            return materials;
        });
    }
    createVRMMaterials(originalMaterial, vrmProps, gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            let newSurface;
            let newOutline;
            if (vrmProps.shader === 'VRM/MToon') {
                const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                // we need to get rid of these properties
                ['srcBlend', 'dstBlend', 'isFirstSetup'].forEach((name) => {
                    if (params[name] !== undefined) {
                        delete params[name];
                    }
                });
                // these textures must be sRGB Encoding, depends on current colorspace
                ['mainTex', 'shadeTexture', 'emissionMap', 'sphereAdd', 'rimTexture'].forEach((name) => {
                    if (params[name] !== undefined) {
                        params[name].encoding = this._encoding;
                    }
                });
                // specify uniform color encodings
                params.encoding = this._encoding;
                // done
                newSurface = new MToonMaterial(params);
                // outline
                if (params.outlineWidthMode !== MToonMaterialOutlineWidthMode.None) {
                    params.isOutline = true;
                    newOutline = new MToonMaterial(params);
                }
            }
            else if (vrmProps.shader === 'VRM/UnlitTexture') {
                // this is very legacy
                const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                params.renderType = VRMUnlitMaterialRenderType.Opaque;
                newSurface = new VRMUnlitMaterial(params);
            }
            else if (vrmProps.shader === 'VRM/UnlitCutout') {
                // this is very legacy
                const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                params.renderType = VRMUnlitMaterialRenderType.Cutout;
                newSurface = new VRMUnlitMaterial(params);
            }
            else if (vrmProps.shader === 'VRM/UnlitTransparent') {
                // this is very legacy
                const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                params.renderType = VRMUnlitMaterialRenderType.Transparent;
                newSurface = new VRMUnlitMaterial(params);
            }
            else if (vrmProps.shader === 'VRM/UnlitTransparentZWrite') {
                // this is very legacy
                const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                params.renderType = VRMUnlitMaterialRenderType.TransparentWithZWrite;
                newSurface = new VRMUnlitMaterial(params);
            }
            else {
                if (vrmProps.shader !== 'VRM_USE_GLTFSHADER') {
                    console.warn(`Unknown shader detected: "${vrmProps.shader}"`);
                    // then presume as VRM_USE_GLTFSHADER
                }
                newSurface = this._convertGLTFMaterial(originalMaterial.clone());
            }
            newSurface.name = originalMaterial.name;
            newSurface.userData = JSON.parse(JSON.stringify(originalMaterial.userData));
            newSurface.userData.vrmMaterialProperties = vrmProps;
            if (newOutline) {
                newOutline.name = originalMaterial.name + ' (Outline)';
                newOutline.userData = JSON.parse(JSON.stringify(originalMaterial.userData));
                newOutline.userData.vrmMaterialProperties = vrmProps;
            }
            return {
                surface: newSurface,
                outline: newOutline,
            };
        });
    }
    _renameMaterialProperty(name) {
        if (name[0] !== '_') {
            console.warn(`VRMMaterials: Given property name "${name}" might be invalid`);
            return name;
        }
        name = name.substring(1);
        if (!/[A-Z]/.test(name[0])) {
            console.warn(`VRMMaterials: Given property name "${name}" might be invalid`);
            return name;
        }
        return name[0].toLowerCase() + name.substring(1);
    }
    _convertGLTFMaterial(material) {
        if (material.isMeshStandardMaterial) {
            const mtl = material;
            if (mtl.map) {
                mtl.map.encoding = this._encoding;
            }
            if (mtl.emissiveMap) {
                mtl.emissiveMap.encoding = this._encoding;
            }
            if (this._encoding === THREE.LinearEncoding) {
                mtl.color.convertLinearToSRGB();
                mtl.emissive.convertLinearToSRGB();
            }
        }
        if (material.isMeshBasicMaterial) {
            const mtl = material;
            if (mtl.map) {
                mtl.map.encoding = this._encoding;
            }
            if (this._encoding === THREE.LinearEncoding) {
                mtl.color.convertLinearToSRGB();
            }
        }
        return material;
    }
    _extractMaterialProperties(originalMaterial, vrmProps, gltf) {
        const taskList = [];
        const params = {};
        // extract texture properties
        if (vrmProps.textureProperties) {
            for (const name of Object.keys(vrmProps.textureProperties)) {
                const newName = this._renameMaterialProperty(name);
                const textureIndex = vrmProps.textureProperties[name];
                taskList.push(gltf.parser.getDependency('texture', textureIndex).then((texture) => {
                    params[newName] = texture;
                }));
            }
        }
        // extract float properties
        if (vrmProps.floatProperties) {
            for (const name of Object.keys(vrmProps.floatProperties)) {
                const newName = this._renameMaterialProperty(name);
                params[newName] = vrmProps.floatProperties[name];
            }
        }
        // extract vector (color tbh) properties
        if (vrmProps.vectorProperties) {
            for (const name of Object.keys(vrmProps.vectorProperties)) {
                let newName = this._renameMaterialProperty(name);
                // if this is textureST (same name as texture name itself), add '_ST'
                const isTextureST = [
                    '_MainTex',
                    '_ShadeTexture',
                    '_BumpMap',
                    '_ReceiveShadowTexture',
                    '_ShadingGradeTexture',
                    '_RimTexture',
                    '_SphereAdd',
                    '_EmissionMap',
                    '_OutlineWidthTexture',
                    '_UvAnimMaskTexture',
                ].some((textureName) => name === textureName);
                if (isTextureST) {
                    newName += '_ST';
                }
                params[newName] = new THREE.Vector4(...vrmProps.vectorProperties[name]);
            }
        }
        // COMPAT: pre-r129
        // See: https://github.com/mrdoob/three.js/pull/21788
        if (parseInt(THREE.REVISION, 10) < 129) {
            params.skinning = originalMaterial.skinning || false;
        }
        // COMPAT: pre-r131
        // See: https://github.com/mrdoob/three.js/pull/22169
        if (parseInt(THREE.REVISION, 10) < 131) {
            params.morphTargets = originalMaterial.morphTargets || false;
            params.morphNormals = originalMaterial.morphNormals || false;
        }
        return Promise.all(taskList).then(() => params);
    }
}

/**
 * An importer that imports a {@link VRMMeta} from a VRM extension of a GLTF.
 */
class VRMMetaImporter {
    constructor(options) {
        var _a;
        this.ignoreTexture = (_a = options === null || options === void 0 ? void 0 : options.ignoreTexture) !== null && _a !== void 0 ? _a : false;
    }
    import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaMeta = vrmExt.meta;
            if (!schemaMeta) {
                return null;
            }
            let texture;
            if (!this.ignoreTexture && schemaMeta.texture != null && schemaMeta.texture !== -1) {
                texture = yield gltf.parser.getDependency('texture', schemaMeta.texture);
            }
            return {
                allowedUserName: schemaMeta.allowedUserName,
                author: schemaMeta.author,
                commercialUssageName: schemaMeta.commercialUssageName,
                contactInformation: schemaMeta.contactInformation,
                licenseName: schemaMeta.licenseName,
                otherLicenseUrl: schemaMeta.otherLicenseUrl,
                otherPermissionUrl: schemaMeta.otherPermissionUrl,
                reference: schemaMeta.reference,
                sexualUssageName: schemaMeta.sexualUssageName,
                texture: texture !== null && texture !== void 0 ? texture : undefined,
                title: schemaMeta.title,
                version: schemaMeta.version,
                violentUssageName: schemaMeta.violentUssageName,
            };
        });
    }
}

const _matA$1 = new THREE.Matrix4();
/**
 * A compat function for `Matrix4.invert()` / `Matrix4.getInverse()`.
 * `Matrix4.invert()` is introduced in r123 and `Matrix4.getInverse()` emits a warning.
 * We are going to use this compat for a while.
 * @param target A target matrix
 */
function mat4InvertCompat(target) {
    if (target.invert) {
        target.invert();
    }
    else {
        target.getInverse(_matA$1.copy(target));
    }
    return target;
}

class Matrix4InverseCache {
    constructor(matrix) {
        /**
         * A cache of inverse of current matrix.
         */
        this._inverseCache = new THREE.Matrix4();
        /**
         * A flag that makes it want to recalculate its {@link _inverseCache}.
         * Will be set `true` when `elements` are mutated and be used in `getInverse`.
         */
        this._shouldUpdateInverse = true;
        this.matrix = matrix;
        const handler = {
            set: (obj, prop, newVal) => {
                this._shouldUpdateInverse = true;
                obj[prop] = newVal;
                return true;
            },
        };
        this._originalElements = matrix.elements;
        matrix.elements = new Proxy(matrix.elements, handler);
    }
    /**
     * Inverse of given matrix.
     * Note that it will return its internal private instance.
     * Make sure copying this before mutate this.
     */
    get inverse() {
        if (this._shouldUpdateInverse) {
            mat4InvertCompat(this._inverseCache.copy(this.matrix));
            this._shouldUpdateInverse = false;
        }
        return this._inverseCache;
    }
    revert() {
        this.matrix.elements = this._originalElements;
    }
}

// based on
// http://rocketjump.skr.jp/unity3d/109/
// https://github.com/dwango/UniVRM/blob/master/Scripts/SpringBone/VRMSpringBone.cs
const IDENTITY_MATRIX4 = Object.freeze(new THREE.Matrix4());
const IDENTITY_QUATERNION = Object.freeze(new THREE.Quaternion());
// 計算中の一時保存用変数（一度インスタンスを作ったらあとは使い回す）
const _v3A$2 = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3C = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _matA = new THREE.Matrix4();
const _matB = new THREE.Matrix4();
/**
 * A class represents a single spring bone of a VRM.
 * It should be managed by a [[VRMSpringBoneManager]].
 */
class VRMSpringBone {
    /**
     * Create a new VRMSpringBone.
     *
     * @param bone An Object3D that will be attached to this bone
     * @param params Several parameters related to behavior of the spring bone
     */
    constructor(bone, params = {}) {
        var _a, _b, _c, _d, _e, _f;
        /**
         * Current position of child tail, in world unit. Will be used for verlet integration.
         */
        this._currentTail = new THREE.Vector3();
        /**
         * Previous position of child tail, in world unit. Will be used for verlet integration.
         */
        this._prevTail = new THREE.Vector3();
        /**
         * Next position of child tail, in world unit. Will be used for verlet integration.
         * Actually used only in [[update]] and it's kind of temporary variable.
         */
        this._nextTail = new THREE.Vector3();
        /**
         * Initial axis of the bone, in local unit.
         */
        this._boneAxis = new THREE.Vector3();
        /**
         * Position of this bone in relative space, kind of a temporary variable.
         */
        this._centerSpacePosition = new THREE.Vector3();
        /**
         * This springbone will be calculated based on the space relative from this object.
         * If this is `null`, springbone will be calculated in world space.
         */
        this._center = null;
        /**
         * Rotation of parent bone, in world unit.
         * We should update this constantly in [[update]].
         */
        this._parentWorldRotation = new THREE.Quaternion();
        /**
         * Initial state of the local matrix of the bone.
         */
        this._initialLocalMatrix = new THREE.Matrix4();
        /**
         * Initial state of the rotation of the bone.
         */
        this._initialLocalRotation = new THREE.Quaternion();
        /**
         * Initial state of the position of its child.
         */
        this._initialLocalChildPosition = new THREE.Vector3();
        this.bone = bone; // uniVRMでの parent
        this.bone.matrixAutoUpdate = false; // updateにより計算されるのでthree.js内での自動処理は不要
        this.radius = (_a = params.radius) !== null && _a !== void 0 ? _a : 0.02;
        this.stiffnessForce = (_b = params.stiffnessForce) !== null && _b !== void 0 ? _b : 1.0;
        this.gravityDir = params.gravityDir
            ? new THREE.Vector3().copy(params.gravityDir)
            : new THREE.Vector3().set(0.0, -1.0, 0.0);
        this.gravityPower = (_c = params.gravityPower) !== null && _c !== void 0 ? _c : 0.0;
        this.dragForce = (_d = params.dragForce) !== null && _d !== void 0 ? _d : 0.4;
        this.colliders = (_e = params.colliders) !== null && _e !== void 0 ? _e : [];
        this._centerSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
        this._initialLocalMatrix.copy(this.bone.matrix);
        this._initialLocalRotation.copy(this.bone.quaternion);
        if (this.bone.children.length === 0) {
            // 末端のボーン。子ボーンがいないため「自分の少し先」が子ボーンということにする
            // https://github.com/dwango/UniVRM/blob/master/Assets/VRM/UniVRM/Scripts/SpringBone/VRMSpringBone.cs#L246
            this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(0.07); // vrm0 requires a 7cm fixed bone length for the final node in a chain - see https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_springBone-1.0-beta#about-spring-configuration
        }
        else {
            const firstChild = this.bone.children[0];
            this._initialLocalChildPosition.copy(firstChild.position);
        }
        // Apply updated position to tail states
        this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition));
        this._prevTail.copy(this._currentTail);
        this._nextTail.copy(this._currentTail);
        this._boneAxis.copy(this._initialLocalChildPosition).normalize();
        this._centerSpaceBoneLength = _v3A$2
            .copy(this._initialLocalChildPosition)
            .applyMatrix4(this.bone.matrixWorld)
            .sub(this._centerSpacePosition)
            .length();
        this.center = (_f = params.center) !== null && _f !== void 0 ? _f : null;
    }
    get center() {
        return this._center;
    }
    set center(center) {
        var _a;
        // convert tails to world space
        this._getMatrixCenterToWorld(_matA);
        this._currentTail.applyMatrix4(_matA);
        this._prevTail.applyMatrix4(_matA);
        this._nextTail.applyMatrix4(_matA);
        // uninstall inverse cache
        if ((_a = this._center) === null || _a === void 0 ? void 0 : _a.userData.inverseCacheProxy) {
            this._center.userData.inverseCacheProxy.revert();
            delete this._center.userData.inverseCacheProxy;
        }
        // change the center
        this._center = center;
        // install inverse cache
        if (this._center) {
            if (!this._center.userData.inverseCacheProxy) {
                this._center.userData.inverseCacheProxy = new Matrix4InverseCache(this._center.matrixWorld);
            }
        }
        // convert tails to center space
        this._getMatrixWorldToCenter(_matA);
        this._currentTail.applyMatrix4(_matA);
        this._prevTail.applyMatrix4(_matA);
        this._nextTail.applyMatrix4(_matA);
        // convert center space dependant state
        _matA.multiply(this.bone.matrixWorld); // 🔥 ??
        this._centerSpacePosition.setFromMatrixPosition(_matA);
        this._centerSpaceBoneLength = _v3A$2
            .copy(this._initialLocalChildPosition)
            .applyMatrix4(_matA)
            .sub(this._centerSpacePosition)
            .length();
    }
    /**
     * Reset the state of this bone.
     * You might want to call [[VRMSpringBoneManager.reset]] instead.
     */
    reset() {
        this.bone.quaternion.copy(this._initialLocalRotation);
        // We need to update its matrixWorld manually, since we tweaked the bone by our hand
        this.bone.updateMatrix();
        this.bone.matrixWorld.multiplyMatrices(this._getParentMatrixWorld(), this.bone.matrix);
        this._centerSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
        // Apply updated position to tail states
        this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition));
        this._prevTail.copy(this._currentTail);
        this._nextTail.copy(this._currentTail);
    }
    /**
     * Update the state of this bone.
     * You might want to call [[VRMSpringBoneManager.update]] instead.
     *
     * @param delta deltaTime
     */
    update(delta) {
        if (delta <= 0)
            return;
        if (this.bone.parent) {
            // SpringBoneは親から順に処理されていくため、
            // 親のmatrixWorldは最新状態の前提でworldMatrixからquaternionを取り出す。
            // 制限はあるけれど、計算は少ないのでgetWorldQuaternionではなくこの方法を取る。
            getWorldQuaternionLite(this.bone.parent, this._parentWorldRotation);
        }
        else {
            this._parentWorldRotation.copy(IDENTITY_QUATERNION);
        }
        // Get bone position in center space
        this._getMatrixWorldToCenter(_matA);
        _matA.multiply(this.bone.matrixWorld); // 🔥 ??
        this._centerSpacePosition.setFromMatrixPosition(_matA);
        // Get parent position in center space
        this._getMatrixWorldToCenter(_matB);
        _matB.multiply(this._getParentMatrixWorld());
        // several parameters
        const stiffness = this.stiffnessForce * delta;
        const external = _v3B.copy(this.gravityDir).multiplyScalar(this.gravityPower * delta);
        // verlet積分で次の位置を計算
        this._nextTail
            .copy(this._currentTail)
            .add(_v3A$2
            .copy(this._currentTail)
            .sub(this._prevTail)
            .multiplyScalar(1 - this.dragForce)) // 前フレームの移動を継続する(減衰もあるよ)
            .add(_v3A$2
            .copy(this._boneAxis)
            .applyMatrix4(this._initialLocalMatrix)
            .applyMatrix4(_matB)
            .sub(this._centerSpacePosition)
            .normalize()
            .multiplyScalar(stiffness)) // 親の回転による子ボーンの移動目標
            .add(external); // 外力による移動量
        // normalize bone length
        this._nextTail
            .sub(this._centerSpacePosition)
            .normalize()
            .multiplyScalar(this._centerSpaceBoneLength)
            .add(this._centerSpacePosition);
        // Collisionで移動
        this._collision(this._nextTail);
        this._prevTail.copy(this._currentTail);
        this._currentTail.copy(this._nextTail);
        // Apply rotation, convert vector3 thing into actual quaternion
        // Original UniVRM is doing world unit calculus at here but we're gonna do this on local unit
        // since Three.js is not good at world coordination stuff
        const initialCenterSpaceMatrixInv = mat4InvertCompat(_matA.copy(_matB.multiply(this._initialLocalMatrix)));
        const applyRotation = _quatA.setFromUnitVectors(this._boneAxis, _v3A$2.copy(this._nextTail).applyMatrix4(initialCenterSpaceMatrixInv).normalize());
        this.bone.quaternion.copy(this._initialLocalRotation).multiply(applyRotation);
        // We need to update its matrixWorld manually, since we tweaked the bone by our hand
        this.bone.updateMatrix();
        this.bone.matrixWorld.multiplyMatrices(this._getParentMatrixWorld(), this.bone.matrix);
    }
    /**
     * Do collision math against every colliders attached to this bone.
     *
     * @param tail The tail you want to process
     */
    _collision(tail) {
        this.colliders.forEach((collider) => {
            this._getMatrixWorldToCenter(_matA);
            _matA.multiply(collider.matrixWorld);
            const colliderCenterSpacePosition = _v3A$2.setFromMatrixPosition(_matA);
            const colliderRadius = collider.geometry.boundingSphere.radius; // the bounding sphere is guaranteed to be exist by VRMSpringBoneImporter._createColliderMesh
            const r = this.radius + colliderRadius;
            if (tail.distanceToSquared(colliderCenterSpacePosition) <= r * r) {
                // ヒット。Colliderの半径方向に押し出す
                const normal = _v3B.subVectors(tail, colliderCenterSpacePosition).normalize();
                const posFromCollider = _v3C.addVectors(colliderCenterSpacePosition, normal.multiplyScalar(r));
                // normalize bone length
                tail.copy(posFromCollider
                    .sub(this._centerSpacePosition)
                    .normalize()
                    .multiplyScalar(this._centerSpaceBoneLength)
                    .add(this._centerSpacePosition));
            }
        });
    }
    /**
     * Create a matrix that converts center space into world space.
     * @param target Target matrix
     */
    _getMatrixCenterToWorld(target) {
        if (this._center) {
            target.copy(this._center.matrixWorld);
        }
        else {
            target.identity();
        }
        return target;
    }
    /**
     * Create a matrix that converts world space into center space.
     * @param target Target matrix
     */
    _getMatrixWorldToCenter(target) {
        if (this._center) {
            target.copy(this._center.userData.inverseCacheProxy.inverse);
        }
        else {
            target.identity();
        }
        return target;
    }
    /**
     * Returns the world matrix of its parent object.
     */
    _getParentMatrixWorld() {
        return this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY_MATRIX4;
    }
}

/**
 * A class manages every spring bones on a VRM.
 */
class VRMSpringBoneManager {
    /**
     * Create a new [[VRMSpringBoneManager]]
     *
     * @param springBoneGroupList An array of [[VRMSpringBoneGroup]]
     */
    constructor(colliderGroups, springBoneGroupList) {
        this.colliderGroups = [];
        this.springBoneGroupList = [];
        this.colliderGroups = colliderGroups;
        this.springBoneGroupList = springBoneGroupList;
    }
    /**
     * Set all bones be calculated based on the space relative from this object.
     * If `null` is given, springbone will be calculated in world space.
     * @param root Root object, or `null`
     */
    setCenter(root) {
        this.springBoneGroupList.forEach((springBoneGroup) => {
            springBoneGroup.forEach((springBone) => {
                springBone.center = root;
            });
        });
    }
    /**
     * Update every spring bone attached to this manager.
     *
     * @param delta deltaTime
     */
    lateUpdate(delta) {
        const updatedObjectSet = new Set();
        this.springBoneGroupList.forEach((springBoneGroup) => {
            springBoneGroup.forEach((springBone) => {
                this._updateWorldMatrix(updatedObjectSet, springBone.bone);
                springBone.update(delta);
            });
        });
    }
    /**
     * Reset every spring bone attached to this manager.
     */
    reset() {
        const updatedObjectSet = new Set();
        this.springBoneGroupList.forEach((springBoneGroup) => {
            springBoneGroup.forEach((springBone) => {
                this._updateWorldMatrix(updatedObjectSet, springBone.bone);
                springBone.reset();
            });
        });
    }
    /**
     * Update worldMatrix of given object, respecting its ancestors.
     * called before update springbone.
     * @param updatedObjectSet Set of node which worldMatrix is updated.
     * @param node target bone node.
     */
    _updateWorldMatrix(updatedObjectSet, node) {
        if (updatedObjectSet.has(node))
            return;
        if (node.parent)
            this._updateWorldMatrix(updatedObjectSet, node.parent);
        node.updateWorldMatrix(false, false);
        updatedObjectSet.add(node);
    }
}

const _v3A$1 = new THREE.Vector3();
const _colliderMaterial = new THREE.MeshBasicMaterial({ visible: false });
/**
 * An importer that imports a [[VRMSpringBoneManager]] from a VRM extension of a GLTF.
 */
class VRMSpringBoneImporter {
    /**
     * Import a [[VRMLookAtHead]] from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt)
                return null;
            const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
            if (!schemaSecondaryAnimation)
                return null;
            // 衝突判定球体メッシュ。
            const colliderGroups = yield this._importColliderMeshGroups(gltf, schemaSecondaryAnimation);
            // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
            // 一列だけではないことに注意。
            const springBoneGroupList = yield this._importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups);
            return new VRMSpringBoneManager(colliderGroups, springBoneGroupList);
        });
    }
    _createSpringBone(bone, params = {}) {
        return new VRMSpringBone(bone, params);
    }
    _importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups) {
        return __awaiter(this, void 0, void 0, function* () {
            const springBoneGroups = schemaSecondaryAnimation.boneGroups || [];
            const springBoneGroupList = [];
            yield Promise.all(springBoneGroups.map((vrmBoneGroup) => __awaiter(this, void 0, void 0, function* () {
                if (vrmBoneGroup.stiffiness === undefined ||
                    vrmBoneGroup.gravityDir === undefined ||
                    vrmBoneGroup.gravityDir.x === undefined ||
                    vrmBoneGroup.gravityDir.y === undefined ||
                    vrmBoneGroup.gravityDir.z === undefined ||
                    vrmBoneGroup.gravityPower === undefined ||
                    vrmBoneGroup.dragForce === undefined ||
                    vrmBoneGroup.hitRadius === undefined ||
                    vrmBoneGroup.colliderGroups === undefined ||
                    vrmBoneGroup.bones === undefined ||
                    vrmBoneGroup.center === undefined) {
                    return;
                }
                const stiffnessForce = vrmBoneGroup.stiffiness;
                const gravityDir = new THREE.Vector3(vrmBoneGroup.gravityDir.x, vrmBoneGroup.gravityDir.y, -vrmBoneGroup.gravityDir.z);
                const gravityPower = vrmBoneGroup.gravityPower;
                const dragForce = vrmBoneGroup.dragForce;
                const radius = vrmBoneGroup.hitRadius;
                const colliders = [];
                vrmBoneGroup.colliderGroups.forEach((colliderIndex) => {
                    colliders.push(...colliderGroups[colliderIndex].colliders);
                });
                const springBoneGroup = [];
                yield Promise.all(vrmBoneGroup.bones.map((nodeIndex) => __awaiter(this, void 0, void 0, function* () {
                    // VRMの情報から「揺れモノ」ボーンのルートが取れる
                    const springRootBone = yield gltf.parser.getDependency('node', nodeIndex);
                    const center = vrmBoneGroup.center !== -1 ? yield gltf.parser.getDependency('node', vrmBoneGroup.center) : null;
                    // it's weird but there might be cases we can't find the root bone
                    if (!springRootBone) {
                        return;
                    }
                    springRootBone.traverse((bone) => {
                        const springBone = this._createSpringBone(bone, {
                            radius,
                            stiffnessForce,
                            gravityDir,
                            gravityPower,
                            dragForce,
                            colliders,
                            center,
                        });
                        springBoneGroup.push(springBone);
                    });
                })));
                springBoneGroupList.push(springBoneGroup);
            })));
            return springBoneGroupList;
        });
    }
    /**
     * Create an array of [[VRMSpringBoneColliderGroup]].
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param schemaSecondaryAnimation A `secondaryAnimation` field of VRM
     */
    _importColliderMeshGroups(gltf, schemaSecondaryAnimation) {
        return __awaiter(this, void 0, void 0, function* () {
            const vrmColliderGroups = schemaSecondaryAnimation.colliderGroups;
            if (vrmColliderGroups === undefined)
                return [];
            const colliderGroups = [];
            vrmColliderGroups.forEach((colliderGroup) => __awaiter(this, void 0, void 0, function* () {
                if (colliderGroup.node === undefined || colliderGroup.colliders === undefined) {
                    return;
                }
                const bone = yield gltf.parser.getDependency('node', colliderGroup.node);
                const colliders = [];
                colliderGroup.colliders.forEach((collider) => {
                    if (collider.offset === undefined ||
                        collider.offset.x === undefined ||
                        collider.offset.y === undefined ||
                        collider.offset.z === undefined ||
                        collider.radius === undefined) {
                        return;
                    }
                    const offset = _v3A$1.set(collider.offset.x, collider.offset.y, -collider.offset.z);
                    const colliderMesh = this._createColliderMesh(collider.radius, offset);
                    bone.add(colliderMesh);
                    colliders.push(colliderMesh);
                });
                const colliderMeshGroup = {
                    node: colliderGroup.node,
                    colliders,
                };
                colliderGroups.push(colliderMeshGroup);
            }));
            return colliderGroups;
        });
    }
    /**
     * Create a collider mesh.
     *
     * @param radius Radius of the new collider mesh
     * @param offset Offest of the new collider mesh
     */
    _createColliderMesh(radius, offset) {
        const colliderMesh = new THREE.Mesh(new THREE.SphereBufferGeometry(radius, 8, 4), _colliderMaterial);
        colliderMesh.position.copy(offset);
        // the name have to be this in order to exclude colliders from bounding box
        // (See Viewer.ts, search for child.name === 'vrmColliderSphere')
        colliderMesh.name = 'vrmColliderSphere';
        // We will use the radius of the sphere for collision vs bones.
        // `boundingSphere` must be created to compute the radius.
        colliderMesh.geometry.computeBoundingSphere();
        return colliderMesh;
    }
}

/**
 * An importer that imports a [[VRM]] from a VRM extension of a GLTF.
 */
class VRMImporter {
    /**
     * Create a new VRMImporter.
     *
     * @param options [[VRMImporterOptions]], optionally contains importers for each component
     */
    constructor(options = {}) {
        this._metaImporter = options.metaImporter || new VRMMetaImporter();
        this._blendShapeImporter = options.blendShapeImporter || new VRMBlendShapeImporter();
        this._lookAtImporter = options.lookAtImporter || new VRMLookAtImporter();
        this._humanoidImporter = options.humanoidImporter || new VRMHumanoidImporter();
        this._firstPersonImporter = options.firstPersonImporter || new VRMFirstPersonImporter();
        this._materialImporter = options.materialImporter || new VRMMaterialImporter();
        this._springBoneImporter = options.springBoneImporter || new VRMSpringBoneImporter();
    }
    /**
     * Receive a GLTF object retrieved from `THREE.GLTFLoader` and create a new [[VRM]] instance.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    import(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            if (gltf.parser.json.extensions === undefined || gltf.parser.json.extensions.VRM === undefined) {
                throw new Error('Could not find VRM extension on the GLTF');
            }
            const scene = gltf.scene;
            scene.updateMatrixWorld(false);
            // Skinned object should not be frustumCulled
            // Since pre-skinned position might be outside of view
            scene.traverse((object3d) => {
                if (object3d.isMesh) {
                    object3d.frustumCulled = false;
                }
            });
            const meta = (yield this._metaImporter.import(gltf)) || undefined;
            const materials = (yield this._materialImporter.convertGLTFMaterials(gltf)) || undefined;
            const humanoid = (yield this._humanoidImporter.import(gltf)) || undefined;
            const firstPerson = humanoid ? (yield this._firstPersonImporter.import(gltf, humanoid)) || undefined : undefined;
            const blendShapeProxy = (yield this._blendShapeImporter.import(gltf)) || undefined;
            const lookAt = firstPerson && blendShapeProxy && humanoid
                ? (yield this._lookAtImporter.import(gltf, firstPerson, blendShapeProxy, humanoid)) || undefined
                : undefined;
            const springBoneManager = (yield this._springBoneImporter.import(gltf)) || undefined;
            return new VRM({
                scene: gltf.scene,
                meta,
                materials,
                humanoid,
                firstPerson,
                blendShapeProxy,
                lookAt,
                springBoneManager,
            });
        });
    }
}

/**
 * A class that represents a single VRM model.
 * See the documentation of [[VRM.from]] for the most basic use of VRM.
 */
class VRM {
    /**
     * Create a new VRM instance.
     *
     * @param params [[VRMParameters]] that represents components of the VRM
     */
    constructor(params) {
        this.scene = params.scene;
        this.humanoid = params.humanoid;
        this.blendShapeProxy = params.blendShapeProxy;
        this.firstPerson = params.firstPerson;
        this.lookAt = params.lookAt;
        this.materials = params.materials;
        this.springBoneManager = params.springBoneManager;
        this.meta = params.meta;
    }
    /**
     * Create a new VRM from a parsed result of GLTF taken from GLTFLoader.
     * It's probably a thing what you want to get started with VRMs.
     *
     * @example Most basic use of VRM
     * ```
     * const scene = new THREE.Scene();
     *
     * new THREE.GLTFLoader().load( 'models/three-vrm-girl.vrm', ( gltf ) => {
     *
     *   THREE.VRM.from( gltf ).then( ( vrm ) => {
     *
     *     scene.add( vrm.scene );
     *
     *   } );
     *
     * } );
     * ```
     *
     * @param gltf A parsed GLTF object taken from GLTFLoader
     * @param options Options that will be used in importer
     */
    static from(gltf, options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const importer = new VRMImporter(options);
            return yield importer.import(gltf);
        });
    }
    /**
     * **You need to call this on your update loop.**
     *
     * This function updates every VRM components.
     *
     * @param delta deltaTime
     */
    update(delta) {
        if (this.lookAt) {
            this.lookAt.update(delta);
        }
        if (this.blendShapeProxy) {
            this.blendShapeProxy.update();
        }
        if (this.springBoneManager) {
            this.springBoneManager.lateUpdate(delta);
        }
        if (this.materials) {
            this.materials.forEach((material) => {
                if (material.updateVRMMaterials) {
                    material.updateVRMMaterials(delta);
                }
            });
        }
    }
    /**
     * Dispose everything about the VRM instance.
     */
    dispose() {
        var _a, _b;
        const scene = this.scene;
        if (scene) {
            deepDispose(scene);
        }
        (_b = (_a = this.meta) === null || _a === void 0 ? void 0 : _a.texture) === null || _b === void 0 ? void 0 : _b.dispose();
    }
}

const _v2A = new THREE.Vector2();
const _camera = new THREE.OrthographicCamera(-1, 1, -1, 1, -1, 1);
const _material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const _plane = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), _material);
const _scene = new THREE.Scene();
_scene.add(_plane);
/**
 * Extract a thumbnail image blob from a {@link VRM}.
 * If the vrm does not have a thumbnail, it will throw an error.
 * @param renderer Renderer
 * @param vrm VRM with a thumbnail
 * @param size width / height of the image
 */
function extractThumbnailBlob(renderer, vrm, size = 512) {
    var _a;
    // get the texture
    const texture = (_a = vrm.meta) === null || _a === void 0 ? void 0 : _a.texture;
    if (!texture) {
        throw new Error('extractThumbnailBlob: This VRM does not have a thumbnail');
    }
    const canvas = renderer.getContext().canvas;
    // store the current resolution
    renderer.getSize(_v2A);
    const prevWidth = _v2A.x;
    const prevHeight = _v2A.y;
    // overwrite the resolution
    renderer.setSize(size, size, false);
    // assign the texture to plane
    _material.map = texture;
    // render
    renderer.render(_scene, _camera);
    // unassign the texture
    _material.map = null;
    // get blob
    if (canvas instanceof OffscreenCanvas) {
        return canvas.convertToBlob().finally(() => {
            // revert to previous resolution
            renderer.setSize(prevWidth, prevHeight, false);
        });
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            // revert to previous resolution
            renderer.setSize(prevWidth, prevHeight, false);
            if (blob == null) {
                reject('extractThumbnailBlob: Failed to create a blob');
            }
            else {
                resolve(blob);
            }
        });
    });
}

/**
 * Traverse given object and remove unnecessarily bound joints from every `THREE.SkinnedMesh`.
 * Some environments like mobile devices have a lower limit of bones and might be unable to perform mesh skinning, this function might resolve such an issue.
 * Also this function might greatly improve the performance of mesh skinning.
 *
 * @param root Root object that will be traversed
 */
function removeUnnecessaryJoints(root) {
    // some meshes might share a same skinIndex attribute and this map prevents to convert the attribute twice
    const skeletonList = new Map();
    // Traverse an entire tree
    root.traverse((obj) => {
        if (obj.type !== 'SkinnedMesh') {
            return;
        }
        const mesh = obj;
        const geometry = mesh.geometry;
        const attribute = geometry.getAttribute('skinIndex');
        // look for existing skeleton
        let skeleton = skeletonList.get(attribute);
        if (!skeleton) {
            // generate reduced bone list
            const bones = []; // new list of bone
            const boneInverses = []; // new list of boneInverse
            const boneIndexMap = {}; // map of old bone index vs. new bone index
            // create a new bone map
            const array = attribute.array;
            for (let i = 0; i < array.length; i++) {
                const index = array[i];
                // new skinIndex buffer
                if (boneIndexMap[index] === undefined) {
                    boneIndexMap[index] = bones.length;
                    bones.push(mesh.skeleton.bones[index]);
                    boneInverses.push(mesh.skeleton.boneInverses[index]);
                }
                array[i] = boneIndexMap[index];
            }
            // replace with new indices
            attribute.copyArray(array);
            attribute.needsUpdate = true;
            // replace with new indices
            skeleton = new THREE.Skeleton(bones, boneInverses);
            skeletonList.set(attribute, skeleton);
        }
        mesh.bind(skeleton, new THREE.Matrix4());
        //                  ^^^^^^^^^^^^^^^^^^^ transform of meshes should be ignored
        // See: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
    });
}

/**
 * Traverse given object and remove unnecessary vertices from every BufferGeometries.
 * This only processes buffer geometries with index buffer.
 *
 * Three.js creates morph textures for each geometries and it sometimes consumes unnecessary amount of VRAM for certain models.
 * This function will optimize geometries to reduce the size of morph texture.
 * See: https://github.com/mrdoob/three.js/issues/23095
 *
 * @param root Root object that will be traversed
 */
function removeUnnecessaryVertices(root) {
    const geometryMap = new Map();
    // Traverse an entire tree
    root.traverse((obj) => {
        var _a, _b, _c, _d;
        if (!obj.isMesh) {
            return;
        }
        const mesh = obj;
        const geometry = mesh.geometry;
        // if the geometry does not have an index buffer it does not need to process
        const origianlIndex = geometry.index;
        if (origianlIndex == null) {
            return;
        }
        // skip already processed geometry
        const newGeometryAlreadyExisted = geometryMap.get(geometry);
        if (newGeometryAlreadyExisted != null) {
            mesh.geometry = newGeometryAlreadyExisted;
            return;
        }
        const newGeometry = new THREE.BufferGeometry();
        // copy various properties
        // Ref: https://github.com/mrdoob/three.js/blob/1a241ef10048770d56e06d6cd6a64c76cc720f95/src/core/BufferGeometry.js#L1011
        newGeometry.name = geometry.name;
        newGeometry.morphTargetsRelative = geometry.morphTargetsRelative;
        geometry.groups.forEach((group) => {
            newGeometry.addGroup(group.start, group.count, group.materialIndex);
        });
        newGeometry.boundingBox = (_b = (_a = geometry.boundingBox) === null || _a === void 0 ? void 0 : _a.clone()) !== null && _b !== void 0 ? _b : null;
        newGeometry.boundingSphere = (_d = (_c = geometry.boundingSphere) === null || _c === void 0 ? void 0 : _c.clone()) !== null && _d !== void 0 ? _d : null;
        newGeometry.setDrawRange(geometry.drawRange.start, geometry.drawRange.count);
        newGeometry.userData = geometry.userData;
        // set to geometryMap
        geometryMap.set(geometry, newGeometry);
        /** from original index to new index */
        const originalIndexNewIndexMap = [];
        /** from new index to original index */
        const newIndexOriginalIndexMap = [];
        // reorganize indices
        {
            const originalIndexArray = origianlIndex.array;
            const newIndexArray = new originalIndexArray.constructor(originalIndexArray.length);
            let indexHead = 0;
            for (let i = 0; i < originalIndexArray.length; i++) {
                const originalIndex = originalIndexArray[i];
                let newIndex = originalIndexNewIndexMap[originalIndex];
                if (newIndex == null) {
                    originalIndexNewIndexMap[originalIndex] = indexHead;
                    newIndexOriginalIndexMap[indexHead] = originalIndex;
                    newIndex = indexHead;
                    indexHead++;
                }
                newIndexArray[i] = newIndex;
            }
            newGeometry.setIndex(new BufferAttribute(newIndexArray, 1, false));
        }
        // reorganize attributes
        Object.keys(geometry.attributes).forEach((attributeName) => {
            const originalAttribute = geometry.attributes[attributeName];
            if (originalAttribute.isInterleavedBufferAttribute) {
                throw new Error('removeUnnecessaryVertices: InterleavedBufferAttribute is not supported');
            }
            const originalAttributeArray = originalAttribute.array;
            const { itemSize, normalized } = originalAttribute;
            const newAttributeArray = new originalAttributeArray.constructor(newIndexOriginalIndexMap.length * itemSize);
            newIndexOriginalIndexMap.forEach((originalIndex, i) => {
                for (let j = 0; j < itemSize; j++) {
                    newAttributeArray[i * itemSize + j] = originalAttributeArray[originalIndex * itemSize + j];
                }
            });
            newGeometry.setAttribute(attributeName, new BufferAttribute(newAttributeArray, itemSize, normalized));
        });
        // reorganize morph attributes
        /** True if all morphs are zero. */
        let isNullMorph = true;
        Object.keys(geometry.morphAttributes).forEach((attributeName) => {
            newGeometry.morphAttributes[attributeName] = [];
            const morphs = geometry.morphAttributes[attributeName];
            for (let iMorph = 0; iMorph < morphs.length; iMorph++) {
                const originalAttribute = morphs[iMorph];
                if (originalAttribute.isInterleavedBufferAttribute) {
                    throw new Error('removeUnnecessaryVertices: InterleavedBufferAttribute is not supported');
                }
                const originalAttributeArray = originalAttribute.array;
                const { itemSize, normalized } = originalAttribute;
                const newAttributeArray = new originalAttributeArray.constructor(newIndexOriginalIndexMap.length * itemSize);
                newIndexOriginalIndexMap.forEach((originalIndex, i) => {
                    for (let j = 0; j < itemSize; j++) {
                        newAttributeArray[i * itemSize + j] = originalAttributeArray[originalIndex * itemSize + j];
                    }
                });
                isNullMorph = isNullMorph && newAttributeArray.every((v) => v === 0);
                newGeometry.morphAttributes[attributeName][iMorph] = new BufferAttribute(newAttributeArray, itemSize, normalized);
            }
        });
        // If all morphs are zero, just discard the morph attributes we've just made
        if (isNullMorph) {
            newGeometry.morphAttributes = {};
        }
        mesh.geometry = newGeometry;
    });
    Array.from(geometryMap.keys()).forEach((originalGeometry) => {
        originalGeometry.dispose();
    });
}

class VRMUtils {
    constructor() {
        // this class is not meant to be instantiated
    }
}
VRMUtils.extractThumbnailBlob = extractThumbnailBlob;
VRMUtils.removeUnnecessaryJoints = removeUnnecessaryJoints;
VRMUtils.removeUnnecessaryVertices = removeUnnecessaryVertices;

const _v3 = new THREE.Vector3();
class VRMLookAtHeadDebug extends VRMLookAtHead {
    setupHelper(scene, debugOption) {
        if (!debugOption.disableFaceDirectionHelper) {
            this._faceDirectionHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), 0.5, 0xff00ff);
            scene.add(this._faceDirectionHelper);
        }
    }
    update(delta) {
        super.update(delta);
        if (this._faceDirectionHelper) {
            this.firstPerson.getFirstPersonWorldPosition(this._faceDirectionHelper.position);
            this._faceDirectionHelper.setDirection(this.getLookAtWorldDirection(_v3));
        }
    }
}

class VRMLookAtImporterDebug extends VRMLookAtImporter {
    import(gltf, firstPerson, blendShapeProxy, humanoid) {
        var _a;
        const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
        if (!vrmExt) {
            return null;
        }
        const schemaFirstPerson = vrmExt.firstPerson;
        if (!schemaFirstPerson) {
            return null;
        }
        const applyer = this._importApplyer(schemaFirstPerson, blendShapeProxy, humanoid);
        return new VRMLookAtHeadDebug(firstPerson, applyer || undefined);
    }
}

const _colliderGizmoMaterial = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    wireframe: true,
    transparent: true,
    depthTest: false,
});
class VRMSpringBoneManagerDebug extends VRMSpringBoneManager {
    setupHelper(scene, debugOption) {
        if (debugOption.disableSpringBoneHelper)
            return;
        this.springBoneGroupList.forEach((springBoneGroup) => {
            springBoneGroup.forEach((springBone) => {
                if (springBone.getGizmo) {
                    const gizmo = springBone.getGizmo();
                    scene.add(gizmo);
                }
            });
        });
        this.colliderGroups.forEach((colliderGroup) => {
            colliderGroup.colliders.forEach((collider) => {
                collider.material = _colliderGizmoMaterial;
                collider.renderOrder = VRM_GIZMO_RENDER_ORDER;
            });
        });
    }
}

const _v3A = new THREE.Vector3();
class VRMSpringBoneDebug extends VRMSpringBone {
    constructor(bone, params) {
        super(bone, params);
    }
    /**
     * Return spring bone gizmo, as `THREE.ArrowHelper`.
     * Useful for debugging spring bones.
     */
    getGizmo() {
        // return if gizmo is already existed
        if (this._gizmo) {
            return this._gizmo;
        }
        const nextTailRelative = _v3A.copy(this._nextTail).sub(this._centerSpacePosition);
        const nextTailRelativeLength = nextTailRelative.length();
        this._gizmo = new THREE.ArrowHelper(nextTailRelative.normalize(), this._centerSpacePosition, nextTailRelativeLength, 0xffff00, this.radius, this.radius);
        // it should be always visible
        this._gizmo.line.renderOrder = VRM_GIZMO_RENDER_ORDER;
        this._gizmo.cone.renderOrder = VRM_GIZMO_RENDER_ORDER;
        this._gizmo.line.material.depthTest = false;
        this._gizmo.line.material.transparent = true;
        this._gizmo.cone.material.depthTest = false;
        this._gizmo.cone.material.transparent = true;
        return this._gizmo;
    }
    update(delta) {
        super.update(delta);
        // lastly we're gonna update gizmo
        this._updateGizmo();
    }
    _updateGizmo() {
        if (!this._gizmo) {
            return;
        }
        const nextTailRelative = _v3A.copy(this._currentTail).sub(this._centerSpacePosition);
        const nextTailRelativeLength = nextTailRelative.length();
        this._gizmo.setDirection(nextTailRelative.normalize());
        this._gizmo.setLength(nextTailRelativeLength, this.radius, this.radius);
        this._gizmo.position.copy(this._centerSpacePosition);
    }
}

class VRMSpringBoneImporterDebug extends VRMSpringBoneImporter {
    import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt)
                return null;
            const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
            if (!schemaSecondaryAnimation)
                return null;
            // 衝突判定球体メッシュ。
            const colliderGroups = yield this._importColliderMeshGroups(gltf, schemaSecondaryAnimation);
            // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
            // 一列だけではないことに注意。
            const springBoneGroupList = yield this._importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups);
            return new VRMSpringBoneManagerDebug(colliderGroups, springBoneGroupList);
        });
    }
    _createSpringBone(bone, params) {
        return new VRMSpringBoneDebug(bone, params);
    }
}

/**
 * An importer that imports a [[VRMDebug]] from a VRM extension of a GLTF.
 */
class VRMImporterDebug extends VRMImporter {
    constructor(options = {}) {
        options.lookAtImporter = options.lookAtImporter || new VRMLookAtImporterDebug();
        options.springBoneImporter = options.springBoneImporter || new VRMSpringBoneImporterDebug();
        super(options);
    }
    import(gltf, debugOptions = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            if (gltf.parser.json.extensions === undefined || gltf.parser.json.extensions.VRM === undefined) {
                throw new Error('Could not find VRM extension on the GLTF');
            }
            const scene = gltf.scene;
            scene.updateMatrixWorld(false);
            // Skinned object should not be frustumCulled
            // Since pre-skinned position might be outside of view
            scene.traverse((object3d) => {
                if (object3d.isMesh) {
                    object3d.frustumCulled = false;
                }
            });
            const meta = (yield this._metaImporter.import(gltf)) || undefined;
            const materials = (yield this._materialImporter.convertGLTFMaterials(gltf)) || undefined;
            const humanoid = (yield this._humanoidImporter.import(gltf)) || undefined;
            const firstPerson = humanoid ? (yield this._firstPersonImporter.import(gltf, humanoid)) || undefined : undefined;
            const blendShapeProxy = (yield this._blendShapeImporter.import(gltf)) || undefined;
            const lookAt = firstPerson && blendShapeProxy && humanoid
                ? (yield this._lookAtImporter.import(gltf, firstPerson, blendShapeProxy, humanoid)) || undefined
                : undefined;
            if (lookAt.setupHelper) {
                lookAt.setupHelper(scene, debugOptions);
            }
            const springBoneManager = (yield this._springBoneImporter.import(gltf)) || undefined;
            if (springBoneManager.setupHelper) {
                springBoneManager.setupHelper(scene, debugOptions);
            }
            return new VRMDebug({
                scene: gltf.scene,
                meta,
                materials,
                humanoid,
                firstPerson,
                blendShapeProxy,
                lookAt,
                springBoneManager,
            }, debugOptions);
        });
    }
}

const VRM_GIZMO_RENDER_ORDER = 10000;
/**
 * [[VRM]] but it has some useful gizmos.
 */
class VRMDebug extends VRM {
    /**
     * Create a new VRMDebug from a parsed result of GLTF taken from GLTFLoader.
     *
     * See [[VRM.from]] for a detailed example.
     *
     * @param gltf A parsed GLTF object taken from GLTFLoader
     * @param options Options that will be used in importer
     * @param debugOption Options for VRMDebug features
     */
    static from(gltf, options = {}, debugOption = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const importer = new VRMImporterDebug(options);
            return yield importer.import(gltf, debugOption);
        });
    }
    /**
     * Create a new VRMDebug instance.
     *
     * @param params [[VRMParameters]] that represents components of the VRM
     * @param debugOption Options for VRMDebug features
     */
    constructor(params, debugOption = {}) {
        super(params);
        // Gizmoを展開
        if (!debugOption.disableBoxHelper) {
            this.scene.add(new THREE.BoxHelper(this.scene));
        }
        if (!debugOption.disableSkeletonHelper) {
            this.scene.add(new THREE.SkeletonHelper(this.scene));
        }
    }
    update(delta) {
        super.update(delta);
    }
}

export { MToonMaterial, MToonMaterialCullMode, MToonMaterialDebugMode, MToonMaterialOutlineColorMode, MToonMaterialOutlineWidthMode, MToonMaterialRenderMode, VRM, VRMBlendShapeGroup, VRMBlendShapeImporter, VRMBlendShapeProxy, VRMCurveMapper, VRMDebug, VRMFirstPerson, VRMFirstPersonImporter, VRMHumanBone, VRMHumanoid, VRMHumanoidImporter, VRMImporter, VRMLookAtApplyer, VRMLookAtBlendShapeApplyer, VRMLookAtBoneApplyer, VRMLookAtHead, VRMLookAtImporter, VRMMaterialImporter, VRMMetaImporter, VRMRendererFirstPersonFlags, VRMSchema, VRMSpringBone, VRMSpringBoneDebug, VRMSpringBoneImporter, VRMSpringBoneImporterDebug, VRMSpringBoneManager, VRMUnlitMaterial, VRMUnlitMaterialRenderType, VRMUtils, VRM_GIZMO_RENDER_ORDER };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLm1vZHVsZS5qcyIsInNvdXJjZXMiOlsiLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uL3NyYy91dGlscy9kaXNwb3Nlci50cyIsIi4uL3NyYy9ibGVuZHNoYXBlL1ZSTUJsZW5kU2hhcGVHcm91cC50cyIsIi4uL3NyYy90eXBlcy9WUk1TY2hlbWEudHMiLCIuLi9zcmMvdXRpbHMvZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUudHMiLCIuLi9zcmMvdXRpbHMvcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eS50cyIsIi4uL3NyYy91dGlscy9tYXRoLnRzIiwiLi4vc3JjL2JsZW5kc2hhcGUvVlJNQmxlbmRTaGFwZVByb3h5LnRzIiwiLi4vc3JjL2JsZW5kc2hhcGUvVlJNQmxlbmRTaGFwZUltcG9ydGVyLnRzIiwiLi4vc3JjL2ZpcnN0cGVyc29uL1ZSTUZpcnN0UGVyc29uLnRzIiwiLi4vc3JjL2ZpcnN0cGVyc29uL1ZSTUZpcnN0UGVyc29uSW1wb3J0ZXIudHMiLCIuLi9zcmMvaHVtYW5vaWQvVlJNSHVtYW5Cb25lLnRzIiwiLi4vc3JjL3V0aWxzL3F1YXRJbnZlcnRDb21wYXQudHMiLCIuLi9zcmMvaHVtYW5vaWQvVlJNSHVtYW5vaWQudHMiLCIuLi9zcmMvaHVtYW5vaWQvVlJNSHVtYW5vaWRJbXBvcnRlci50cyIsIi4uL3NyYy9sb29rYXQvVlJNQ3VydmVNYXBwZXIudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEFwcGx5ZXIudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1Mb29rQXRIZWFkLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1Mb29rQXRCb25lQXBwbHllci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0SW1wb3J0ZXIudHMiLCIuLi9zcmMvbWF0ZXJpYWwvZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uLnRzIiwiLi4vc3JjL21hdGVyaWFsL01Ub29uTWF0ZXJpYWwudHMiLCIuLi9zcmMvbWF0ZXJpYWwvVlJNVW5saXRNYXRlcmlhbC50cyIsIi4uL3NyYy9tYXRlcmlhbC9WUk1NYXRlcmlhbEltcG9ydGVyLnRzIiwiLi4vc3JjL21ldGEvVlJNTWV0YUltcG9ydGVyLnRzIiwiLi4vc3JjL3V0aWxzL21hdDRJbnZlcnRDb21wYXQudHMiLCIuLi9zcmMvdXRpbHMvTWF0cml4NEludmVyc2VDYWNoZS50cyIsIi4uL3NyYy9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmUudHMiLCIuLi9zcmMvc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lTWFuYWdlci50cyIsIi4uL3NyYy9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVJbXBvcnRlci50cyIsIi4uL3NyYy9WUk1JbXBvcnRlci50cyIsIi4uL3NyYy9WUk0udHMiLCIuLi9zcmMvVlJNVXRpbHMvZXh0cmFjdFRodW1ibmFpbEJsb2IudHMiLCIuLi9zcmMvVlJNVXRpbHMvcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMudHMiLCIuLi9zcmMvVlJNVXRpbHMvcmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlcy50cyIsIi4uL3NyYy9WUk1VdGlscy9pbmRleC50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1Mb29rQXRIZWFkRGVidWcudHMiLCIuLi9zcmMvZGVidWcvVlJNTG9va0F0SW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTVNwcmluZ0JvbmVEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1JbXBvcnRlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTURlYnVnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG0sIGspO1xyXG4gICAgaWYgKCFkZXNjIHx8IChcImdldFwiIGluIGRlc2MgPyAhbS5fX2VzTW9kdWxlIDogZGVzYy53cml0YWJsZSB8fCBkZXNjLmNvbmZpZ3VyYWJsZSkpIHtcclxuICAgICAgICBkZXNjID0geyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbVtrXTsgfSB9O1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCBkZXNjKTtcclxufSkgOiAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBvW2syXSA9IG1ba107XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXhwb3J0U3RhcihtLCBvKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmIChwICE9PSBcImRlZmF1bHRcIiAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIHApKSBfX2NyZWF0ZUJpbmRpbmcobywgbSwgcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3ZhbHVlcyhvKSB7XHJcbiAgICB2YXIgcyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IsIG0gPSBzICYmIG9bc10sIGkgPSAwO1xyXG4gICAgaWYgKG0pIHJldHVybiBtLmNhbGwobyk7XHJcbiAgICBpZiAobyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobyAmJiBpID49IG8ubGVuZ3RoKSBvID0gdm9pZCAwO1xyXG4gICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogbyAmJiBvW2krK10sIGRvbmU6ICFvIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IocyA/IFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZS5cIiA6IFwiU3ltYm9sLml0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVhZChvLCBuKSB7XHJcbiAgICB2YXIgbSA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvW1N5bWJvbC5pdGVyYXRvcl07XHJcbiAgICBpZiAoIW0pIHJldHVybiBvO1xyXG4gICAgdmFyIGkgPSBtLmNhbGwobyksIHIsIGFyID0gW10sIGU7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHdoaWxlICgobiA9PT0gdm9pZCAwIHx8IG4tLSA+IDApICYmICEociA9IGkubmV4dCgpKS5kb25lKSBhci5wdXNoKHIudmFsdWUpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycm9yKSB7IGUgPSB7IGVycm9yOiBlcnJvciB9OyB9XHJcbiAgICBmaW5hbGx5IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAociAmJiAhci5kb25lICYmIChtID0gaVtcInJldHVyblwiXSkpIG0uY2FsbChpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7IGlmIChlKSB0aHJvdyBlLmVycm9yOyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheXMoKSB7XHJcbiAgICBmb3IgKHZhciBzID0gMCwgaSA9IDAsIGlsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHMgKz0gYXJndW1lbnRzW2ldLmxlbmd0aDtcclxuICAgIGZvciAodmFyIHIgPSBBcnJheShzKSwgayA9IDAsIGkgPSAwOyBpIDwgaWw7IGkrKylcclxuICAgICAgICBmb3IgKHZhciBhID0gYXJndW1lbnRzW2ldLCBqID0gMCwgamwgPSBhLmxlbmd0aDsgaiA8IGpsOyBqKyssIGsrKylcclxuICAgICAgICAgICAgcltrXSA9IGFbal07XHJcbiAgICByZXR1cm4gcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXkodG8sIGZyb20sIHBhY2spIHtcclxuICAgIGlmIChwYWNrIHx8IGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIGZvciAodmFyIGkgPSAwLCBsID0gZnJvbS5sZW5ndGgsIGFyOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGFyIHx8ICEoaSBpbiBmcm9tKSkge1xyXG4gICAgICAgICAgICBpZiAoIWFyKSBhciA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20sIDAsIGkpO1xyXG4gICAgICAgICAgICBhcltpXSA9IGZyb21baV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRvLmNvbmNhdChhciB8fCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tKSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG4iLCIvLyBTZWU6IGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jbWFudWFsL2VuL2ludHJvZHVjdGlvbi9Ib3ctdG8tZGlzcG9zZS1vZi1vYmplY3RzXG5cbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuZnVuY3Rpb24gZGlzcG9zZU1hdGVyaWFsKG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCk6IHZvaWQge1xuICBPYmplY3Qua2V5cyhtYXRlcmlhbCkuZm9yRWFjaCgocHJvcGVydHlOYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSAobWF0ZXJpYWwgYXMgYW55KVtwcm9wZXJ0eU5hbWVdO1xuICAgIGlmICh2YWx1ZT8uaXNUZXh0dXJlKSB7XG4gICAgICBjb25zdCB0ZXh0dXJlID0gdmFsdWUgYXMgVEhSRUUuVGV4dHVyZTtcbiAgICAgIHRleHR1cmUuZGlzcG9zZSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgbWF0ZXJpYWwuZGlzcG9zZSgpO1xufVxuXG5mdW5jdGlvbiBkaXNwb3NlKG9iamVjdDNEOiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xuICBjb25zdCBnZW9tZXRyeTogVEhSRUUuQnVmZmVyR2VvbWV0cnkgfCB1bmRlZmluZWQgPSAob2JqZWN0M0QgYXMgYW55KS5nZW9tZXRyeTtcbiAgaWYgKGdlb21ldHJ5KSB7XG4gICAgZ2VvbWV0cnkuZGlzcG9zZSgpO1xuICB9XG5cbiAgY29uc3QgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsIHwgVEhSRUUuTWF0ZXJpYWxbXSA9IChvYmplY3QzRCBhcyBhbnkpLm1hdGVyaWFsO1xuICBpZiAobWF0ZXJpYWwpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRlcmlhbCkpIHtcbiAgICAgIG1hdGVyaWFsLmZvckVhY2goKG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCkgPT4gZGlzcG9zZU1hdGVyaWFsKG1hdGVyaWFsKSk7XG4gICAgfSBlbHNlIGlmIChtYXRlcmlhbCkge1xuICAgICAgZGlzcG9zZU1hdGVyaWFsKG1hdGVyaWFsKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZXBEaXNwb3NlKG9iamVjdDNEOiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xuICBvYmplY3QzRC50cmF2ZXJzZShkaXNwb3NlKTtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEZQcmltaXRpdmUgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVlJNQmxlbmRTaGFwZUJpbmQge1xuICBtZXNoZXM6IEdMVEZQcmltaXRpdmVbXTtcbiAgbW9ycGhUYXJnZXRJbmRleDogbnVtYmVyO1xuICB3ZWlnaHQ6IG51bWJlcjtcbn1cblxuZW51bSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUge1xuICBOVU1CRVIsXG4gIFZFQ1RPUjIsXG4gIFZFQ1RPUjMsXG4gIFZFQ1RPUjQsXG4gIENPTE9SLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlIHtcbiAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xuICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgZGVmYXVsdFZhbHVlOiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjtcbiAgdGFyZ2V0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICBkZWx0YVZhbHVlOiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjsgLy8gdGFyZ2V0VmFsdWUgLSBkZWZhdWx0VmFsdWVcbiAgdHlwZTogVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlO1xufVxuXG5jb25zdCBfdjIgPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuY29uc3QgX3YzID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF92NCA9IG5ldyBUSFJFRS5WZWN0b3I0KCk7XG5jb25zdCBfY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IoKTtcblxuLy8gYW5pbWF0aW9uTWl4ZXIg44Gu55uj6KaW5a++6LGh44Gv44CBU2NlbmUg44Gu5Lit44Gr5YWl44Gj44Gm44GE44KL5b+F6KaB44GM44GC44KL44CCXG4vLyDjgZ3jga7jgZ/jgoHjgIHooajnpLrjgqrjg5bjgrjjgqfjgq/jg4jjgafjga/jgarjgYTjgZHjgozjganjgIFPYmplY3QzRCDjgpLntpnmib/jgZfjgaYgU2NlbmUg44Gr5oqV5YWl44Gn44GN44KL44KI44GG44Gr44GZ44KL44CCXG5leHBvcnQgY2xhc3MgVlJNQmxlbmRTaGFwZUdyb3VwIGV4dGVuZHMgVEhSRUUuT2JqZWN0M0Qge1xuICBwdWJsaWMgd2VpZ2h0ID0gMC4wO1xuICBwdWJsaWMgaXNCaW5hcnkgPSBmYWxzZTtcblxuICBwcml2YXRlIF9iaW5kczogVlJNQmxlbmRTaGFwZUJpbmRbXSA9IFtdO1xuICBwcml2YXRlIF9tYXRlcmlhbFZhbHVlczogVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKGV4cHJlc3Npb25OYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubmFtZSA9IGBCbGVuZFNoYXBlQ29udHJvbGxlcl8ke2V4cHJlc3Npb25OYW1lfWA7XG5cbiAgICAvLyB0cmF2ZXJzZSDmmYLjga7mlZHmuIjmiYvmrrXjgajjgZfjgaYgT2JqZWN0M0Qg44Gn44Gv44Gq44GE44GT44Go44KS5piO56S644GX44Gm44GK44GPXG4gICAgdGhpcy50eXBlID0gJ0JsZW5kU2hhcGVDb250cm9sbGVyJztcbiAgICAvLyDooajnpLrnm67nmoTjga7jgqrjg5bjgrjjgqfjgq/jg4jjgafjga/jgarjgYTjga7jgafjgIHosqDojbfou73muJvjga7jgZ/jgoHjgasgdmlzaWJsZSDjgpIgZmFsc2Ug44Gr44GX44Gm44GK44GP44CCXG4gICAgLy8g44GT44KM44Gr44KI44KK44CB44GT44Gu44Kk44Oz44K544K/44Oz44K544Gr5a++44GZ44KL5q+O44OV44Os44O844Og44GuIG1hdHJpeCDoh6rli5XoqIjnrpfjgpLnnIHnlaXjgafjgY3jgovjgIJcbiAgICB0aGlzLnZpc2libGUgPSBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRCaW5kKGFyZ3M6IHsgbWVzaGVzOiBHTFRGUHJpbWl0aXZlW107IG1vcnBoVGFyZ2V0SW5kZXg6IG51bWJlcjsgd2VpZ2h0OiBudW1iZXIgfSk6IHZvaWQge1xuICAgIC8vIG9yaWdpbmFsIHdlaWdodCBpcyAwLTEwMCBidXQgd2Ugd2FudCB0byBkZWFsIHdpdGggdGhpcyB2YWx1ZSB3aXRoaW4gMC0xXG4gICAgY29uc3Qgd2VpZ2h0ID0gYXJncy53ZWlnaHQgLyAxMDA7XG5cbiAgICB0aGlzLl9iaW5kcy5wdXNoKHtcbiAgICAgIG1lc2hlczogYXJncy5tZXNoZXMsXG4gICAgICBtb3JwaFRhcmdldEluZGV4OiBhcmdzLm1vcnBoVGFyZ2V0SW5kZXgsXG4gICAgICB3ZWlnaHQsXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgYWRkTWF0ZXJpYWxWYWx1ZShhcmdzOiB7XG4gICAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xuICAgIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgIHRhcmdldFZhbHVlOiBudW1iZXJbXTtcbiAgICBkZWZhdWx0VmFsdWU/OiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjtcbiAgfSk6IHZvaWQge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gYXJncy5tYXRlcmlhbDtcbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBhcmdzLnByb3BlcnR5TmFtZTtcblxuICAgIGxldCB2YWx1ZSA9IChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV07XG4gICAgaWYgKCF2YWx1ZSkge1xuICAgICAgLy8gcHJvcGVydHkgaGFzIG5vdCBiZWVuIGZvdW5kXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhbHVlID0gYXJncy5kZWZhdWx0VmFsdWUgfHwgdmFsdWU7XG5cbiAgICBsZXQgdHlwZTogVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlO1xuICAgIGxldCBkZWZhdWx0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICAgIGxldCB0YXJnZXRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG4gICAgbGV0IGRlbHRhVmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuXG4gICAgaWYgKHZhbHVlLmlzVmVjdG9yMikge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IyO1xuICAgICAgZGVmYXVsdFZhbHVlID0gKHZhbHVlIGFzIFRIUkVFLlZlY3RvcjIpLmNsb25lKCk7XG4gICAgICB0YXJnZXRWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IyKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5pc1ZlY3RvcjMpIHtcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMztcbiAgICAgIGRlZmF1bHRWYWx1ZSA9ICh2YWx1ZSBhcyBUSFJFRS5WZWN0b3IzKS5jbG9uZSgpO1xuICAgICAgdGFyZ2V0VmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yMygpLmZyb21BcnJheShhcmdzLnRhcmdldFZhbHVlKTtcbiAgICAgIGRlbHRhVmFsdWUgPSB0YXJnZXRWYWx1ZS5jbG9uZSgpLnN1YihkZWZhdWx0VmFsdWUpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuaXNWZWN0b3I0KSB7XG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjQ7XG4gICAgICBkZWZhdWx0VmFsdWUgPSAodmFsdWUgYXMgVEhSRUUuVmVjdG9yNCkuY2xvbmUoKTtcblxuICAgICAgLy8gdmVjdG9yUHJvcGVydHkgYW5kIHRhcmdldFZhbHVlIGluZGV4IGlzIGRpZmZlcmVudCBmcm9tIGVhY2ggb3RoZXJcbiAgICAgIC8vIGV4cG9ydGVkIHZybSBieSBVbmlWUk0gZmlsZSBpc1xuICAgICAgLy9cbiAgICAgIC8vIHZlY3RvclByb3BlcnR5XG4gICAgICAvLyBvZmZzZXQgPSB0YXJnZXRWYWx1ZVswXSwgdGFyZ2V0VmFsdWVbMV1cbiAgICAgIC8vIHRpbGluZyA9IHRhcmdldFZhbHVlWzJdLCB0YXJnZXRWYWx1ZVszXVxuICAgICAgLy9cbiAgICAgIC8vIHRhcmdldFZhbHVlXG4gICAgICAvLyBvZmZzZXQgPSB0YXJnZXRWYWx1ZVsyXSwgdGFyZ2V0VmFsdWVbM11cbiAgICAgIC8vIHRpbGluZyA9IHRhcmdldFZhbHVlWzBdLCB0YXJnZXRWYWx1ZVsxXVxuICAgICAgdGFyZ2V0VmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yNCgpLmZyb21BcnJheShbXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMl0sXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbM10sXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMF0sXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMV0sXG4gICAgICBdKTtcbiAgICAgIGRlbHRhVmFsdWUgPSB0YXJnZXRWYWx1ZS5jbG9uZSgpLnN1YihkZWZhdWx0VmFsdWUpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuaXNDb2xvcikge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5DT0xPUjtcbiAgICAgIGRlZmF1bHRWYWx1ZSA9ICh2YWx1ZSBhcyBUSFJFRS5Db2xvcikuY2xvbmUoKTtcbiAgICAgIHRhcmdldFZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuTlVNQkVSO1xuICAgICAgZGVmYXVsdFZhbHVlID0gdmFsdWUgYXMgbnVtYmVyO1xuICAgICAgdGFyZ2V0VmFsdWUgPSBhcmdzLnRhcmdldFZhbHVlWzBdO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlIC0gZGVmYXVsdFZhbHVlO1xuICAgIH1cblxuICAgIHRoaXMuX21hdGVyaWFsVmFsdWVzLnB1c2goe1xuICAgICAgbWF0ZXJpYWwsXG4gICAgICBwcm9wZXJ0eU5hbWUsXG4gICAgICBkZWZhdWx0VmFsdWUsXG4gICAgICB0YXJnZXRWYWx1ZSxcbiAgICAgIGRlbHRhVmFsdWUsXG4gICAgICB0eXBlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGx5IHdlaWdodCB0byBldmVyeSBhc3NpZ25lZCBibGVuZCBzaGFwZXMuXG4gICAqIFNob3VsZCBiZSBjYWxsZWQgdmlhIHtAbGluayBCbGVuZFNoYXBlTWFzdGVyI3VwZGF0ZX0uXG4gICAqL1xuICBwdWJsaWMgYXBwbHlXZWlnaHQoKTogdm9pZCB7XG4gICAgY29uc3QgdyA9IHRoaXMuaXNCaW5hcnkgPyAodGhpcy53ZWlnaHQgPCAwLjUgPyAwLjAgOiAxLjApIDogdGhpcy53ZWlnaHQ7XG5cbiAgICB0aGlzLl9iaW5kcy5mb3JFYWNoKChiaW5kKSA9PiB7XG4gICAgICBiaW5kLm1lc2hlcy5mb3JFYWNoKChtZXNoKSA9PiB7XG4gICAgICAgIGlmICghbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkQmluZGBcbiAgICAgICAgbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXNbYmluZC5tb3JwaFRhcmdldEluZGV4XSArPSB3ICogYmluZC53ZWlnaHQ7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX21hdGVyaWFsVmFsdWVzLmZvckVhY2goKG1hdGVyaWFsVmFsdWUpID0+IHtcbiAgICAgIGNvbnN0IHByb3AgPSAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXTtcbiAgICAgIGlmIChwcm9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRNYXRlcmlhbFZhbHVlYFxuXG4gICAgICBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuTlVNQkVSKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgbnVtYmVyO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXSArPSBkZWx0YVZhbHVlICogdztcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMikge1xuICAgICAgICBjb25zdCBkZWx0YVZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWx0YVZhbHVlIGFzIFRIUkVFLlZlY3RvcjI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmFkZChfdjIuY29weShkZWx0YVZhbHVlKS5tdWx0aXBseVNjYWxhcih3KSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjMpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5WZWN0b3IzO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX3YzLmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1I0KSB7XG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgVEhSRUUuVmVjdG9yNDtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uYWRkKF92NC5jb3B5KGRlbHRhVmFsdWUpLm11bHRpcGx5U2NhbGFyKHcpKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuQ09MT1IpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5Db2xvcjtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uYWRkKF9jb2xvci5jb3B5KGRlbHRhVmFsdWUpLm11bHRpcGx5U2NhbGFyKHcpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPT09ICdib29sZWFuJykge1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFyIHByZXZpb3VzbHkgYXNzaWduZWQgYmxlbmQgc2hhcGVzLlxuICAgKi9cbiAgcHVibGljIGNsZWFyQXBwbGllZFdlaWdodCgpOiB2b2lkIHtcbiAgICB0aGlzLl9iaW5kcy5mb3JFYWNoKChiaW5kKSA9PiB7XG4gICAgICBiaW5kLm1lc2hlcy5mb3JFYWNoKChtZXNoKSA9PiB7XG4gICAgICAgIGlmICghbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkQmluZGBcbiAgICAgICAgbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXNbYmluZC5tb3JwaFRhcmdldEluZGV4XSA9IDAuMDtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fbWF0ZXJpYWxWYWx1ZXMuZm9yRWFjaCgobWF0ZXJpYWxWYWx1ZSkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdO1xuICAgICAgaWYgKHByb3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXG5cbiAgICAgIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5OVU1CRVIpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgbnVtYmVyO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXSA9IGRlZmF1bHRWYWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMikge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBUSFJFRS5WZWN0b3IyO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5jb3B5KGRlZmF1bHRWYWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjMpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuVmVjdG9yMztcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1I0KSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVmYXVsdFZhbHVlIGFzIFRIUkVFLlZlY3RvcjQ7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmNvcHkoZGVmYXVsdFZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuQ09MT1IpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuQ29sb3I7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmNvcHkoZGVmYXVsdFZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPT09ICdib29sZWFuJykge1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG4iLCIvLyBUeXBlZG9jIGRvZXMgbm90IHN1cHBvcnQgZXhwb3J0IGRlY2xhcmF0aW9ucyB5ZXRcbi8vIHRoZW4gd2UgaGF2ZSB0byB1c2UgYG5hbWVzcGFjZWAgaW5zdGVhZCBvZiBleHBvcnQgZGVjbGFyYXRpb25zIGZvciBub3cuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9UeXBlU3Ryb25nL3R5cGVkb2MvcHVsbC84MDFcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1uYW1lc3BhY2VcbmV4cG9ydCBuYW1lc3BhY2UgVlJNU2NoZW1hIHtcbiAgLyoqXG4gICAqIFZSTSBleHRlbnNpb24gaXMgZm9yIDNkIGh1bWFub2lkIGF2YXRhcnMgKGFuZCBtb2RlbHMpIGluIFZSIGFwcGxpY2F0aW9ucy5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgVlJNIHtcbiAgICBibGVuZFNoYXBlTWFzdGVyPzogQmxlbmRTaGFwZTtcbiAgICAvKipcbiAgICAgKiBWZXJzaW9uIG9mIGV4cG9ydGVyIHRoYXQgdnJtIGNyZWF0ZWQuIFVuaVZSTS0wLjUzLjBcbiAgICAgKi9cbiAgICBleHBvcnRlclZlcnNpb24/OiBzdHJpbmc7XG4gICAgZmlyc3RQZXJzb24/OiBGaXJzdFBlcnNvbjtcbiAgICBodW1hbm9pZD86IEh1bWFub2lkO1xuICAgIG1hdGVyaWFsUHJvcGVydGllcz86IE1hdGVyaWFsW107XG4gICAgbWV0YT86IE1ldGE7XG4gICAgc2Vjb25kYXJ5QW5pbWF0aW9uPzogU2Vjb25kYXJ5QW5pbWF0aW9uO1xuICAgIC8qKlxuICAgICAqIFZlcnNpb24gb2YgVlJNIHNwZWNpZmljYXRpb24uIDAuMFxuICAgICAqL1xuICAgIHNwZWNWZXJzaW9uPzogc3RyaW5nO1xuICB9XG5cbiAgLyoqXG4gICAqIEJsZW5kU2hhcGVBdmF0YXIgb2YgVW5pVlJNXG4gICAqL1xuICBleHBvcnQgaW50ZXJmYWNlIEJsZW5kU2hhcGUge1xuICAgIGJsZW5kU2hhcGVHcm91cHM/OiBCbGVuZFNoYXBlR3JvdXBbXTtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZUdyb3VwIHtcbiAgICAvKipcbiAgICAgKiBMb3cgbGV2ZWwgYmxlbmRzaGFwZSByZWZlcmVuY2VzLlxuICAgICAqL1xuICAgIGJpbmRzPzogQmxlbmRTaGFwZUJpbmRbXTtcbiAgICAvKipcbiAgICAgKiAwIG9yIDEuIERvIG5vdCBhbGxvdyBhbiBpbnRlcm1lZGlhdGUgdmFsdWUuIFZhbHVlIHNob3VsZCByb3VuZGVkXG4gICAgICovXG4gICAgaXNCaW5hcnk/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIE1hdGVyaWFsIGFuaW1hdGlvbiByZWZlcmVuY2VzLlxuICAgICAqL1xuICAgIG1hdGVyaWFsVmFsdWVzPzogQmxlbmRTaGFwZU1hdGVyaWFsYmluZFtdO1xuICAgIC8qKlxuICAgICAqIEV4cHJlc3Npb24gbmFtZVxuICAgICAqL1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUHJlZGVmaW5lZCBFeHByZXNzaW9uIG5hbWVcbiAgICAgKi9cbiAgICBwcmVzZXROYW1lPzogQmxlbmRTaGFwZVByZXNldE5hbWU7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIEJsZW5kU2hhcGVCaW5kIHtcbiAgICBpbmRleD86IG51bWJlcjtcbiAgICBtZXNoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFNraW5uZWRNZXNoUmVuZGVyZXIuU2V0QmxlbmRTaGFwZVdlaWdodFxuICAgICAqL1xuICAgIHdlaWdodD86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZU1hdGVyaWFsYmluZCB7XG4gICAgbWF0ZXJpYWxOYW1lPzogc3RyaW5nO1xuICAgIHByb3BlcnR5TmFtZT86IHN0cmluZztcbiAgICB0YXJnZXRWYWx1ZT86IG51bWJlcltdO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZWRlZmluZWQgRXhwcmVzc2lvbiBuYW1lXG4gICAqL1xuICBleHBvcnQgZW51bSBCbGVuZFNoYXBlUHJlc2V0TmFtZSB7XG4gICAgQSA9ICdhJyxcbiAgICBBbmdyeSA9ICdhbmdyeScsXG4gICAgQmxpbmsgPSAnYmxpbmsnLFxuICAgIEJsaW5rTCA9ICdibGlua19sJyxcbiAgICBCbGlua1IgPSAnYmxpbmtfcicsXG4gICAgRSA9ICdlJyxcbiAgICBGdW4gPSAnZnVuJyxcbiAgICBJID0gJ2knLFxuICAgIEpveSA9ICdqb3knLFxuICAgIExvb2tkb3duID0gJ2xvb2tkb3duJyxcbiAgICBMb29rbGVmdCA9ICdsb29rbGVmdCcsXG4gICAgTG9va3JpZ2h0ID0gJ2xvb2tyaWdodCcsXG4gICAgTG9va3VwID0gJ2xvb2t1cCcsXG4gICAgTmV1dHJhbCA9ICduZXV0cmFsJyxcbiAgICBPID0gJ28nLFxuICAgIFNvcnJvdyA9ICdzb3Jyb3cnLFxuICAgIFUgPSAndScsXG4gICAgVW5rbm93biA9ICd1bmtub3duJyxcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgRmlyc3RQZXJzb24ge1xuICAgIC8qKlxuICAgICAqIFRoZSBib25lIHdob3NlIHJlbmRlcmluZyBzaG91bGQgYmUgdHVybmVkIG9mZiBpbiBmaXJzdC1wZXJzb24gdmlldy4gVXN1YWxseSBIZWFkIGlzXG4gICAgICogc3BlY2lmaWVkLlxuICAgICAqL1xuICAgIGZpcnN0UGVyc29uQm9uZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaGUgdGFyZ2V0IHBvc2l0aW9uIG9mIHRoZSBWUiBoZWFkc2V0IGluIGZpcnN0LXBlcnNvbiB2aWV3LiBJdCBpcyBhc3N1bWVkIHRoYXQgYW4gb2Zmc2V0XG4gICAgICogZnJvbSB0aGUgaGVhZCBib25lIHRvIHRoZSBWUiBoZWFkc2V0IGlzIGFkZGVkLlxuICAgICAqL1xuICAgIGZpcnN0UGVyc29uQm9uZU9mZnNldD86IFZlY3RvcjM7XG4gICAgbG9va0F0SG9yaXpvbnRhbElubmVyPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgbG9va0F0SG9yaXpvbnRhbE91dGVyPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgLyoqXG4gICAgICogRXllIGNvbnRyb2xsZXIgbW9kZS5cbiAgICAgKi9cbiAgICBsb29rQXRUeXBlTmFtZT86IEZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWU7XG4gICAgbG9va0F0VmVydGljYWxEb3duPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgbG9va0F0VmVydGljYWxVcD86IEZpcnN0UGVyc29uRGVncmVlTWFwO1xuICAgIC8qKlxuICAgICAqIFN3aXRjaCBkaXNwbGF5IC8gdW5kaXNwbGF5IGZvciBlYWNoIG1lc2ggaW4gZmlyc3QtcGVyc29uIHZpZXcgb3IgdGhlIG90aGVycy5cbiAgICAgKi9cbiAgICBtZXNoQW5ub3RhdGlvbnM/OiBGaXJzdFBlcnNvbk1lc2hhbm5vdGF0aW9uW107XG4gIH1cblxuICAvKipcbiAgICogRXllIGNvbnRyb2xsZXIgc2V0dGluZy5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgRmlyc3RQZXJzb25EZWdyZWVNYXAge1xuICAgIC8qKlxuICAgICAqIE5vbmUgbGluZWFyIG1hcHBpbmcgcGFyYW1zLiB0aW1lLCB2YWx1ZSwgaW5UYW5nZW50LCBvdXRUYW5nZW50XG4gICAgICovXG4gICAgY3VydmU/OiBudW1iZXJbXTtcbiAgICAvKipcbiAgICAgKiBMb29rIGF0IGlucHV0IGNsYW1wIHJhbmdlIGRlZ3JlZS5cbiAgICAgKi9cbiAgICB4UmFuZ2U/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogTG9vayBhdCBtYXAgcmFuZ2UgZGVncmVlIGZyb20geFJhbmdlLlxuICAgICAqL1xuICAgIHlSYW5nZT86IG51bWJlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeWUgY29udHJvbGxlciBtb2RlLlxuICAgKi9cbiAgZXhwb3J0IGVudW0gRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZSB7XG4gICAgQmxlbmRTaGFwZSA9ICdCbGVuZFNoYXBlJyxcbiAgICBCb25lID0gJ0JvbmUnLFxuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbk1lc2hhbm5vdGF0aW9uIHtcbiAgICBmaXJzdFBlcnNvbkZsYWc/OiBzdHJpbmc7XG4gICAgbWVzaD86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgSHVtYW5vaWQge1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5hcm1TdHJldGNoXG4gICAgICovXG4gICAgYXJtU3RyZXRjaD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24uZmVldFNwYWNpbmdcbiAgICAgKi9cbiAgICBmZWV0U3BhY2luZz86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24uaGFzVHJhbnNsYXRpb25Eb0ZcbiAgICAgKi9cbiAgICBoYXNUcmFuc2xhdGlvbkRvRj86IGJvb2xlYW47XG4gICAgaHVtYW5Cb25lcz86IEh1bWFub2lkQm9uZVtdO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5sZWdTdHJldGNoXG4gICAgICovXG4gICAgbGVnU3RyZXRjaD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24ubG93ZXJBcm1Ud2lzdFxuICAgICAqL1xuICAgIGxvd2VyQXJtVHdpc3Q/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmxvd2VyTGVnVHdpc3RcbiAgICAgKi9cbiAgICBsb3dlckxlZ1R3aXN0PzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi51cHBlckFybVR3aXN0XG4gICAgICovXG4gICAgdXBwZXJBcm1Ud2lzdD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24udXBwZXJMZWdUd2lzdFxuICAgICAqL1xuICAgIHVwcGVyTGVnVHdpc3Q/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIEh1bWFub2lkQm9uZSB7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkxpbWl0LmF4aXNMZW5ndGhcbiAgICAgKi9cbiAgICBheGlzTGVuZ3RoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIEh1bWFuIGJvbmUgbmFtZS5cbiAgICAgKi9cbiAgICBib25lPzogSHVtYW5vaWRCb25lTmFtZTtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQuY2VudGVyXG4gICAgICovXG4gICAgY2VudGVyPzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQubWF4XG4gICAgICovXG4gICAgbWF4PzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQubWluXG4gICAgICovXG4gICAgbWluPzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2Ugbm9kZSBpbmRleFxuICAgICAqL1xuICAgIG5vZGU/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkxpbWl0LnVzZURlZmF1bHRWYWx1ZXNcbiAgICAgKi9cbiAgICB1c2VEZWZhdWx0VmFsdWVzPzogYm9vbGVhbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBIdW1hbiBib25lIG5hbWUuXG4gICAqL1xuICBleHBvcnQgZW51bSBIdW1hbm9pZEJvbmVOYW1lIHtcbiAgICBDaGVzdCA9ICdjaGVzdCcsXG4gICAgSGVhZCA9ICdoZWFkJyxcbiAgICBIaXBzID0gJ2hpcHMnLFxuICAgIEphdyA9ICdqYXcnLFxuICAgIExlZnRFeWUgPSAnbGVmdEV5ZScsXG4gICAgTGVmdEZvb3QgPSAnbGVmdEZvb3QnLFxuICAgIExlZnRIYW5kID0gJ2xlZnRIYW5kJyxcbiAgICBMZWZ0SW5kZXhEaXN0YWwgPSAnbGVmdEluZGV4RGlzdGFsJyxcbiAgICBMZWZ0SW5kZXhJbnRlcm1lZGlhdGUgPSAnbGVmdEluZGV4SW50ZXJtZWRpYXRlJyxcbiAgICBMZWZ0SW5kZXhQcm94aW1hbCA9ICdsZWZ0SW5kZXhQcm94aW1hbCcsXG4gICAgTGVmdExpdHRsZURpc3RhbCA9ICdsZWZ0TGl0dGxlRGlzdGFsJyxcbiAgICBMZWZ0TGl0dGxlSW50ZXJtZWRpYXRlID0gJ2xlZnRMaXR0bGVJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRMaXR0bGVQcm94aW1hbCA9ICdsZWZ0TGl0dGxlUHJveGltYWwnLFxuICAgIExlZnRMb3dlckFybSA9ICdsZWZ0TG93ZXJBcm0nLFxuICAgIExlZnRMb3dlckxlZyA9ICdsZWZ0TG93ZXJMZWcnLFxuICAgIExlZnRNaWRkbGVEaXN0YWwgPSAnbGVmdE1pZGRsZURpc3RhbCcsXG4gICAgTGVmdE1pZGRsZUludGVybWVkaWF0ZSA9ICdsZWZ0TWlkZGxlSW50ZXJtZWRpYXRlJyxcbiAgICBMZWZ0TWlkZGxlUHJveGltYWwgPSAnbGVmdE1pZGRsZVByb3hpbWFsJyxcbiAgICBMZWZ0UmluZ0Rpc3RhbCA9ICdsZWZ0UmluZ0Rpc3RhbCcsXG4gICAgTGVmdFJpbmdJbnRlcm1lZGlhdGUgPSAnbGVmdFJpbmdJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRSaW5nUHJveGltYWwgPSAnbGVmdFJpbmdQcm94aW1hbCcsXG4gICAgTGVmdFNob3VsZGVyID0gJ2xlZnRTaG91bGRlcicsXG4gICAgTGVmdFRodW1iRGlzdGFsID0gJ2xlZnRUaHVtYkRpc3RhbCcsXG4gICAgTGVmdFRodW1iSW50ZXJtZWRpYXRlID0gJ2xlZnRUaHVtYkludGVybWVkaWF0ZScsXG4gICAgTGVmdFRodW1iUHJveGltYWwgPSAnbGVmdFRodW1iUHJveGltYWwnLFxuICAgIExlZnRUb2VzID0gJ2xlZnRUb2VzJyxcbiAgICBMZWZ0VXBwZXJBcm0gPSAnbGVmdFVwcGVyQXJtJyxcbiAgICBMZWZ0VXBwZXJMZWcgPSAnbGVmdFVwcGVyTGVnJyxcbiAgICBOZWNrID0gJ25lY2snLFxuICAgIFJpZ2h0RXllID0gJ3JpZ2h0RXllJyxcbiAgICBSaWdodEZvb3QgPSAncmlnaHRGb290JyxcbiAgICBSaWdodEhhbmQgPSAncmlnaHRIYW5kJyxcbiAgICBSaWdodEluZGV4RGlzdGFsID0gJ3JpZ2h0SW5kZXhEaXN0YWwnLFxuICAgIFJpZ2h0SW5kZXhJbnRlcm1lZGlhdGUgPSAncmlnaHRJbmRleEludGVybWVkaWF0ZScsXG4gICAgUmlnaHRJbmRleFByb3hpbWFsID0gJ3JpZ2h0SW5kZXhQcm94aW1hbCcsXG4gICAgUmlnaHRMaXR0bGVEaXN0YWwgPSAncmlnaHRMaXR0bGVEaXN0YWwnLFxuICAgIFJpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlID0gJ3JpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlJyxcbiAgICBSaWdodExpdHRsZVByb3hpbWFsID0gJ3JpZ2h0TGl0dGxlUHJveGltYWwnLFxuICAgIFJpZ2h0TG93ZXJBcm0gPSAncmlnaHRMb3dlckFybScsXG4gICAgUmlnaHRMb3dlckxlZyA9ICdyaWdodExvd2VyTGVnJyxcbiAgICBSaWdodE1pZGRsZURpc3RhbCA9ICdyaWdodE1pZGRsZURpc3RhbCcsXG4gICAgUmlnaHRNaWRkbGVJbnRlcm1lZGlhdGUgPSAncmlnaHRNaWRkbGVJbnRlcm1lZGlhdGUnLFxuICAgIFJpZ2h0TWlkZGxlUHJveGltYWwgPSAncmlnaHRNaWRkbGVQcm94aW1hbCcsXG4gICAgUmlnaHRSaW5nRGlzdGFsID0gJ3JpZ2h0UmluZ0Rpc3RhbCcsXG4gICAgUmlnaHRSaW5nSW50ZXJtZWRpYXRlID0gJ3JpZ2h0UmluZ0ludGVybWVkaWF0ZScsXG4gICAgUmlnaHRSaW5nUHJveGltYWwgPSAncmlnaHRSaW5nUHJveGltYWwnLFxuICAgIFJpZ2h0U2hvdWxkZXIgPSAncmlnaHRTaG91bGRlcicsXG4gICAgUmlnaHRUaHVtYkRpc3RhbCA9ICdyaWdodFRodW1iRGlzdGFsJyxcbiAgICBSaWdodFRodW1iSW50ZXJtZWRpYXRlID0gJ3JpZ2h0VGh1bWJJbnRlcm1lZGlhdGUnLFxuICAgIFJpZ2h0VGh1bWJQcm94aW1hbCA9ICdyaWdodFRodW1iUHJveGltYWwnLFxuICAgIFJpZ2h0VG9lcyA9ICdyaWdodFRvZXMnLFxuICAgIFJpZ2h0VXBwZXJBcm0gPSAncmlnaHRVcHBlckFybScsXG4gICAgUmlnaHRVcHBlckxlZyA9ICdyaWdodFVwcGVyTGVnJyxcbiAgICBTcGluZSA9ICdzcGluZScsXG4gICAgVXBwZXJDaGVzdCA9ICd1cHBlckNoZXN0JyxcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgTWF0ZXJpYWwge1xuICAgIGZsb2F0UHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gICAga2V5d29yZE1hcD86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gICAgbmFtZT86IHN0cmluZztcbiAgICByZW5kZXJRdWV1ZT86IG51bWJlcjtcbiAgICBzaGFkZXI/OiBzdHJpbmc7XG4gICAgdGFnTWFwPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICB0ZXh0dXJlUHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gICAgdmVjdG9yUHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIE1ldGEge1xuICAgIC8qKlxuICAgICAqIEEgcGVyc29uIHdobyBjYW4gcGVyZm9ybSB3aXRoIHRoaXMgYXZhdGFyXG4gICAgICovXG4gICAgYWxsb3dlZFVzZXJOYW1lPzogTWV0YUFsbG93ZWRVc2VyTmFtZTtcbiAgICAvKipcbiAgICAgKiBBdXRob3Igb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgYXV0aG9yPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEZvciBjb21tZXJjaWFsIHVzZVxuICAgICAqL1xuICAgIGNvbW1lcmNpYWxVc3NhZ2VOYW1lPzogTWV0YVVzc2FnZU5hbWU7XG4gICAgLyoqXG4gICAgICogQ29udGFjdCBJbmZvcm1hdGlvbiBvZiBWUk0gbW9kZWwgYXV0aG9yXG4gICAgICovXG4gICAgY29udGFjdEluZm9ybWF0aW9uPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIExpY2Vuc2UgdHlwZVxuICAgICAqL1xuICAgIGxpY2Vuc2VOYW1lPzogTWV0YUxpY2Vuc2VOYW1lO1xuICAgIC8qKlxuICAgICAqIElmIOKAnE90aGVy4oCdIGlzIHNlbGVjdGVkLCBwdXQgdGhlIFVSTCBsaW5rIG9mIHRoZSBsaWNlbnNlIGRvY3VtZW50IGhlcmUuXG4gICAgICovXG4gICAgb3RoZXJMaWNlbnNlVXJsPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIElmIHRoZXJlIGFyZSBhbnkgY29uZGl0aW9ucyBub3QgbWVudGlvbmVkIGFib3ZlLCBwdXQgdGhlIFVSTCBsaW5rIG9mIHRoZSBsaWNlbnNlIGRvY3VtZW50XG4gICAgICogaGVyZS5cbiAgICAgKi9cbiAgICBvdGhlclBlcm1pc3Npb25Vcmw/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUmVmZXJlbmNlIG9mIFZSTSBtb2RlbFxuICAgICAqL1xuICAgIHJlZmVyZW5jZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQZXJtaXNzaW9uIHRvIHBlcmZvcm0gc2V4dWFsIGFjdHMgd2l0aCB0aGlzIGF2YXRhclxuICAgICAqL1xuICAgIHNleHVhbFVzc2FnZU5hbWU/OiBNZXRhVXNzYWdlTmFtZTtcbiAgICAvKipcbiAgICAgKiBUaHVtYm5haWwgb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgdGV4dHVyZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaXRsZSBvZiBWUk0gbW9kZWxcbiAgICAgKi9cbiAgICB0aXRsZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBWZXJzaW9uIG9mIFZSTSBtb2RlbFxuICAgICAqL1xuICAgIHZlcnNpb24/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHZpb2xlbnQgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAgICovXG4gICAgdmlvbGVudFVzc2FnZU5hbWU/OiBNZXRhVXNzYWdlTmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHBlcnNvbiB3aG8gY2FuIHBlcmZvcm0gd2l0aCB0aGlzIGF2YXRhclxuICAgKi9cbiAgZXhwb3J0IGVudW0gTWV0YUFsbG93ZWRVc2VyTmFtZSB7XG4gICAgRXZlcnlvbmUgPSAnRXZlcnlvbmUnLFxuICAgIEV4cGxpY2l0bHlMaWNlbnNlZFBlcnNvbiA9ICdFeHBsaWNpdGx5TGljZW5zZWRQZXJzb24nLFxuICAgIE9ubHlBdXRob3IgPSAnT25seUF1dGhvcicsXG4gIH1cblxuICAvKipcbiAgICogRm9yIGNvbW1lcmNpYWwgdXNlXG4gICAqXG4gICAqIFBlcm1pc3Npb24gdG8gcGVyZm9ybSBzZXh1YWwgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAqXG4gICAqIFBlcm1pc3Npb24gdG8gcGVyZm9ybSB2aW9sZW50IGFjdHMgd2l0aCB0aGlzIGF2YXRhclxuICAgKi9cbiAgZXhwb3J0IGVudW0gTWV0YVVzc2FnZU5hbWUge1xuICAgIEFsbG93ID0gJ0FsbG93JyxcbiAgICBEaXNhbGxvdyA9ICdEaXNhbGxvdycsXG4gIH1cblxuICAvKipcbiAgICogTGljZW5zZSB0eXBlXG4gICAqL1xuICBleHBvcnQgZW51bSBNZXRhTGljZW5zZU5hbWUge1xuICAgIENjMCA9ICdDQzAnLFxuICAgIENjQnkgPSAnQ0NfQlknLFxuICAgIENjQnlOYyA9ICdDQ19CWV9OQycsXG4gICAgQ2NCeU5jTmQgPSAnQ0NfQllfTkNfTkQnLFxuICAgIENjQnlOY1NhID0gJ0NDX0JZX05DX1NBJyxcbiAgICBDY0J5TmQgPSAnQ0NfQllfTkQnLFxuICAgIENjQnlTYSA9ICdDQ19CWV9TQScsXG4gICAgT3RoZXIgPSAnT3RoZXInLFxuICAgIFJlZGlzdHJpYnV0aW9uUHJvaGliaXRlZCA9ICdSZWRpc3RyaWJ1dGlvbl9Qcm9oaWJpdGVkJyxcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc2V0dGluZyBvZiBhdXRvbWF0aWMgYW5pbWF0aW9uIG9mIHN0cmluZy1saWtlIG9iamVjdHMgc3VjaCBhcyB0YWlscyBhbmQgaGFpcnMuXG4gICAqL1xuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvbiB7XG4gICAgYm9uZUdyb3Vwcz86IFNlY29uZGFyeUFuaW1hdGlvblNwcmluZ1tdO1xuICAgIGNvbGxpZGVyR3JvdXBzPzogU2Vjb25kYXJ5QW5pbWF0aW9uQ29sbGlkZXJncm91cFtdO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb25TcHJpbmcge1xuICAgIC8qKlxuICAgICAqIFNwZWNpZnkgdGhlIG5vZGUgaW5kZXggb2YgdGhlIHJvb3QgYm9uZSBvZiB0aGUgc3dheWluZyBvYmplY3QuXG4gICAgICovXG4gICAgYm9uZXM/OiBudW1iZXJbXTtcbiAgICAvKipcbiAgICAgKiBUaGUgcmVmZXJlbmNlIHBvaW50IG9mIGEgc3dheWluZyBvYmplY3QgY2FuIGJlIHNldCBhdCBhbnkgbG9jYXRpb24gZXhjZXB0IHRoZSBvcmlnaW4uXG4gICAgICogV2hlbiBpbXBsZW1lbnRpbmcgVUkgbW92aW5nIHdpdGggd2FycCwgdGhlIHBhcmVudCBub2RlIHRvIG1vdmUgd2l0aCB3YXJwIGNhbiBiZSBzcGVjaWZpZWRcbiAgICAgKiBpZiB5b3UgZG9uJ3Qgd2FudCB0byBtYWtlIHRoZSBvYmplY3Qgc3dheWluZyB3aXRoIHdhcnAgbW92ZW1lbnQuXG4gICAgICovXG4gICAgY2VudGVyPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFNwZWNpZnkgdGhlIGluZGV4IG9mIHRoZSBjb2xsaWRlciBncm91cCBmb3IgY29sbGlzaW9ucyB3aXRoIHN3YXlpbmcgb2JqZWN0cy5cbiAgICAgKi9cbiAgICBjb2xsaWRlckdyb3Vwcz86IG51bWJlcltdO1xuICAgIC8qKlxuICAgICAqIEFubm90YXRpb24gY29tbWVudFxuICAgICAqL1xuICAgIGNvbW1lbnQ/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIHJlc2lzdGFuY2UgKGRlY2VsZXJhdGlvbikgb2YgYXV0b21hdGljIGFuaW1hdGlvbi5cbiAgICAgKi9cbiAgICBkcmFnRm9yY2U/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVGhlIGRpcmVjdGlvbiBvZiBncmF2aXR5LiBTZXQgKDAsIC0xLCAwKSBmb3Igc2ltdWxhdGluZyB0aGUgZ3Jhdml0eS4gU2V0ICgxLCAwLCAwKSBmb3JcbiAgICAgKiBzaW11bGF0aW5nIHRoZSB3aW5kLlxuICAgICAqL1xuICAgIGdyYXZpdHlEaXI/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFRoZSBzdHJlbmd0aCBvZiBncmF2aXR5LlxuICAgICAqL1xuICAgIGdyYXZpdHlQb3dlcj86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUgdXNlZCBmb3IgdGhlIGNvbGxpc2lvbiBkZXRlY3Rpb24gd2l0aCBjb2xsaWRlcnMuXG4gICAgICovXG4gICAgaGl0UmFkaXVzPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSByZXNpbGllbmNlIG9mIHRoZSBzd2F5aW5nIG9iamVjdCAodGhlIHBvd2VyIG9mIHJldHVybmluZyB0byB0aGUgaW5pdGlhbCBwb3NlKS5cbiAgICAgKi9cbiAgICBzdGlmZmluZXNzPzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlcmdyb3VwIHtcbiAgICBjb2xsaWRlcnM/OiBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlcltdO1xuICAgIC8qKlxuICAgICAqIFRoZSBub2RlIG9mIHRoZSBjb2xsaWRlciBncm91cCBmb3Igc2V0dGluZyB1cCBjb2xsaXNpb24gZGV0ZWN0aW9ucy5cbiAgICAgKi9cbiAgICBub2RlPzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlciB7XG4gICAgLyoqXG4gICAgICogVGhlIGxvY2FsIGNvb3JkaW5hdGUgZnJvbSB0aGUgbm9kZSBvZiB0aGUgY29sbGlkZXIgZ3JvdXAuXG4gICAgICovXG4gICAgb2Zmc2V0PzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBUaGUgcmFkaXVzIG9mIHRoZSBjb2xsaWRlci5cbiAgICAgKi9cbiAgICByYWRpdXM/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFZlY3RvcjMge1xuICAgIHg/OiBudW1iZXI7XG4gICAgeT86IG51bWJlcjtcbiAgICB6PzogbnVtYmVyO1xuICB9XG59XG4iLCJpbXBvcnQgdHlwZSB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB0eXBlIHsgR0xURlByaW1pdGl2ZSwgR0xURlNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcblxuZnVuY3Rpb24gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmOiBHTFRGLCBub2RlSW5kZXg6IG51bWJlciwgbm9kZTogVEhSRUUuT2JqZWN0M0QpOiBHTFRGUHJpbWl0aXZlW10gfCBudWxsIHtcbiAgLyoqXG4gICAqIExldCdzIGxpc3QgdXAgZXZlcnkgcG9zc2libGUgcGF0dGVybnMgdGhhdCBwYXJzZWQgZ2x0ZiBub2RlcyB3aXRoIGEgbWVzaCBjYW4gaGF2ZSwsLFxuICAgKlxuICAgKiBcIipcIiBpbmRpY2F0ZXMgdGhhdCB0aG9zZSBtZXNoZXMgc2hvdWxkIGJlIGxpc3RlZCB1cCB1c2luZyB0aGlzIGZ1bmN0aW9uXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBhIHNpZ25sZSBwcmltaXRpdmUpXG4gICAqXG4gICAqIC0gYFRIUkVFLk1lc2hgOiBUaGUgb25seSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKlxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcylcbiAgICpcbiAgICogLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBBTkQgKGEgY2hpbGQgd2l0aCBhIG1lc2gsIGEgc2luZ2xlIHByaW1pdGl2ZSlcbiAgICpcbiAgICogLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIGEgTUVTSCBPRiBUSEUgQ0hJTERcbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcylcbiAgICpcbiAgICogLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiBhIE1FU0ggT0YgVEhFIENISUxEXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggb2YgdGhlIGNoaWxkXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggb2YgdGhlIGNoaWxkICgyKVxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQlVUIHRoZSBub2RlIGlzIGEgYm9uZVxuICAgKlxuICAgKiAtIGBUSFJFRS5Cb25lYDogVGhlIHJvb3Qgb2YgdGhlIG5vZGUsIGFzIGEgYm9uZVxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQlVUIHRoZSBub2RlIGlzIGEgYm9uZVxuICAgKlxuICAgKiAtIGBUSFJFRS5Cb25lYDogVGhlIHJvb3Qgb2YgdGhlIG5vZGUsIGFzIGEgYm9uZVxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIGEgTUVTSCBPRiBUSEUgQ0hJTERcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGRcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGQgKDIpXG4gICAqXG4gICAqIC4uLkkgd2lsbCB0YWtlIGEgc3RyYXRlZ3kgdGhhdCB0cmF2ZXJzZXMgdGhlIHJvb3Qgb2YgdGhlIG5vZGUgYW5kIHRha2UgZmlyc3QgKHByaW1pdGl2ZUNvdW50KSBtZXNoZXMuXG4gICAqL1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBub2RlIGhhcyBhIG1lc2hcbiAgY29uc3Qgc2NoZW1hTm9kZTogR0xURlNjaGVtYS5Ob2RlID0gZ2x0Zi5wYXJzZXIuanNvbi5ub2Rlc1tub2RlSW5kZXhdO1xuICBjb25zdCBtZXNoSW5kZXggPSBzY2hlbWFOb2RlLm1lc2g7XG4gIGlmIChtZXNoSW5kZXggPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gSG93IG1hbnkgcHJpbWl0aXZlcyB0aGUgbWVzaCBoYXM/XG4gIGNvbnN0IHNjaGVtYU1lc2g6IEdMVEZTY2hlbWEuTWVzaCA9IGdsdGYucGFyc2VyLmpzb24ubWVzaGVzW21lc2hJbmRleF07XG4gIGNvbnN0IHByaW1pdGl2ZUNvdW50ID0gc2NoZW1hTWVzaC5wcmltaXRpdmVzLmxlbmd0aDtcblxuICAvLyBUcmF2ZXJzZSB0aGUgbm9kZSBhbmQgdGFrZSBmaXJzdCAocHJpbWl0aXZlQ291bnQpIG1lc2hlc1xuICBjb25zdCBwcmltaXRpdmVzOiBHTFRGUHJpbWl0aXZlW10gPSBbXTtcbiAgbm9kZS50cmF2ZXJzZSgob2JqZWN0KSA9PiB7XG4gICAgaWYgKHByaW1pdGl2ZXMubGVuZ3RoIDwgcHJpbWl0aXZlQ291bnQpIHtcbiAgICAgIGlmICgob2JqZWN0IGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICAgIHByaW1pdGl2ZXMucHVzaChvYmplY3QgYXMgR0xURlByaW1pdGl2ZSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcHJpbWl0aXZlcztcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHByaW1pdGl2ZXMgKCBgVEhSRUUuTWVzaFtdYCApIG9mIGEgbm9kZSBmcm9tIGEgbG9hZGVkIEdMVEYuXG4gKiBUaGUgbWFpbiBwdXJwb3NlIG9mIHRoaXMgZnVuY3Rpb24gaXMgdG8gZGlzdGluZ3Vpc2ggcHJpbWl0aXZlcyBhbmQgY2hpbGRyZW4gZnJvbSBhIG5vZGUgdGhhdCBoYXMgYm90aCBtZXNoZXMgYW5kIGNoaWxkcmVuLlxuICpcbiAqIEl0IHV0aWxpemVzIHRoZSBiZWhhdmlvciB0aGF0IEdMVEZMb2FkZXIgYWRkcyBtZXNoIHByaW1pdGl2ZXMgdG8gdGhlIG5vZGUgb2JqZWN0ICggYFRIUkVFLkdyb3VwYCApIGZpcnN0IHRoZW4gYWRkcyBpdHMgY2hpbGRyZW4uXG4gKlxuICogQHBhcmFtIGdsdGYgQSBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAqIEBwYXJhbSBub2RlSW5kZXggVGhlIGluZGV4IG9mIHRoZSBub2RlXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZShnbHRmOiBHTFRGLCBub2RlSW5kZXg6IG51bWJlcik6IFByb21pc2U8R0xURlByaW1pdGl2ZVtdIHwgbnVsbD4ge1xuICBjb25zdCBub2RlOiBUSFJFRS5PYmplY3QzRCA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBub2RlSW5kZXgpO1xuICByZXR1cm4gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmLCBub2RlSW5kZXgsIG5vZGUpO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgcHJpbWl0aXZlcyAoIGBUSFJFRS5NZXNoW11gICkgb2Ygbm9kZXMgZnJvbSBhIGxvYWRlZCBHTFRGLlxuICogU2VlIHtAbGluayBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZX0gZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBJdCByZXR1cm5zIGEgbWFwIGZyb20gbm9kZSBpbmRleCB0byBleHRyYWN0aW9uIHJlc3VsdC5cbiAqIElmIGEgbm9kZSBkb2VzIG5vdCBoYXZlIGEgbWVzaCwgdGhlIGVudHJ5IGZvciB0aGUgbm9kZSB3aWxsIG5vdCBiZSBwdXQgaW4gdGhlIHJldHVybmluZyBtYXAuXG4gKlxuICogQHBhcmFtIGdsdGYgQSBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyhnbHRmOiBHTFRGKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBHTFRGUHJpbWl0aXZlW10+PiB7XG4gIGNvbnN0IG5vZGVzOiBUSFJFRS5PYmplY3QzRFtdID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jaWVzKCdub2RlJyk7XG4gIGNvbnN0IG1hcCA9IG5ldyBNYXA8bnVtYmVyLCBHTFRGUHJpbWl0aXZlW10+KCk7XG5cbiAgbm9kZXMuZm9yRWFjaCgobm9kZSwgaW5kZXgpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsKGdsdGYsIGluZGV4LCBub2RlKTtcbiAgICBpZiAocmVzdWx0ICE9IG51bGwpIHtcbiAgICAgIG1hcC5zZXQoaW5kZXgsIHJlc3VsdCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gbWFwO1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHJlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKG5hbWVbMF0gIT09ICdfJykge1xuICAgIGNvbnNvbGUud2FybihgcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eTogR2l2ZW4gcHJvcGVydHkgbmFtZSBcIiR7bmFtZX1cIiBtaWdodCBiZSBpbnZhbGlkYCk7XG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cbiAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuXG4gIGlmICghL1tBLVpdLy50ZXN0KG5hbWVbMF0pKSB7XG4gICAgY29uc29sZS53YXJuKGByZW5hbWVNYXRlcmlhbFByb3BlcnR5OiBHaXZlbiBwcm9wZXJ0eSBuYW1lIFwiJHtuYW1lfVwiIG1pZ2h0IGJlIGludmFsaWRgKTtcbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuICByZXR1cm4gbmFtZVswXS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zdWJzdHJpbmcoMSk7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogQ2xhbXAgYW4gaW5wdXQgbnVtYmVyIHdpdGhpbiBbIGAwLjBgIC0gYDEuMGAgXS5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGlucHV0IHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYXR1cmF0ZSh2YWx1ZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIE1hdGgubWF4KE1hdGgubWluKHZhbHVlLCAxLjApLCAwLjApO1xufVxuXG4vKipcbiAqIE1hcCB0aGUgcmFuZ2Ugb2YgYW4gaW5wdXQgdmFsdWUgZnJvbSBbIGBtaW5gIC0gYG1heGAgXSB0byBbIGAwLjBgIC0gYDEuMGAgXS5cbiAqIElmIGlucHV0IHZhbHVlIGlzIGxlc3MgdGhhbiBgbWluYCAsIGl0IHJldHVybnMgYDAuMGAuXG4gKiBJZiBpbnB1dCB2YWx1ZSBpcyBncmVhdGVyIHRoYW4gYG1heGAgLCBpdCByZXR1cm5zIGAxLjBgLlxuICpcbiAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9tYXRoL01hdGguc21vb3Roc3RlcFxuICpcbiAqIEBwYXJhbSB4IFRoZSB2YWx1ZSB0aGF0IHdpbGwgYmUgbWFwcGVkIGludG8gdGhlIHNwZWNpZmllZCByYW5nZVxuICogQHBhcmFtIG1pbiBNaW5pbXVtIHZhbHVlIG9mIHRoZSByYW5nZVxuICogQHBhcmFtIG1heCBNYXhpbXVtIHZhbHVlIG9mIHRoZSByYW5nZVxuICovXG5leHBvcnQgZnVuY3Rpb24gbGluc3RlcCh4OiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcik6IG51bWJlciB7XG4gIGlmICh4IDw9IG1pbikgcmV0dXJuIDA7XG4gIGlmICh4ID49IG1heCkgcmV0dXJuIDE7XG5cbiAgcmV0dXJuICh4IC0gbWluKSAvIChtYXggLSBtaW4pO1xufVxuXG5jb25zdCBfcG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3NjYWxlID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF9yb3RhdGlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5cbi8qKlxuICogRXh0cmFjdCB3b3JsZCBwb3NpdGlvbiBvZiBhbiBvYmplY3QgZnJvbSBpdHMgd29ybGQgc3BhY2UgbWF0cml4LCBpbiBjaGVhcGVyIHdheS5cbiAqXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcbiAqIEBwYXJhbSBvdXQgVGFyZ2V0IHZlY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRQb3NpdGlvbkxpdGUob2JqZWN0OiBUSFJFRS5PYmplY3QzRCwgb3V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gIG9iamVjdC5tYXRyaXhXb3JsZC5kZWNvbXBvc2Uob3V0LCBfcm90YXRpb24sIF9zY2FsZSk7XG4gIHJldHVybiBvdXQ7XG59XG5cbi8qKlxuICogRXh0cmFjdCB3b3JsZCBzY2FsZSBvZiBhbiBvYmplY3QgZnJvbSBpdHMgd29ybGQgc3BhY2UgbWF0cml4LCBpbiBjaGVhcGVyIHdheS5cbiAqXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcbiAqIEBwYXJhbSBvdXQgVGFyZ2V0IHZlY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRTY2FsZUxpdGUob2JqZWN0OiBUSFJFRS5PYmplY3QzRCwgb3V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gIG9iamVjdC5tYXRyaXhXb3JsZC5kZWNvbXBvc2UoX3Bvc2l0aW9uLCBfcm90YXRpb24sIG91dCk7XG4gIHJldHVybiBvdXQ7XG59XG5cbi8qKlxuICogRXh0cmFjdCB3b3JsZCByb3RhdGlvbiBvZiBhbiBvYmplY3QgZnJvbSBpdHMgd29ybGQgc3BhY2UgbWF0cml4LCBpbiBjaGVhcGVyIHdheS5cbiAqXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcbiAqIEBwYXJhbSBvdXQgVGFyZ2V0IHZlY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlF1YXRlcm5pb24pOiBUSFJFRS5RdWF0ZXJuaW9uIHtcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShfcG9zaXRpb24sIG91dCwgX3NjYWxlKTtcbiAgcmV0dXJuIG91dDtcbn1cbiIsImltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHNhdHVyYXRlIH0gZnJvbSAnLi4vdXRpbHMvbWF0aCc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlR3JvdXAgfSBmcm9tICcuL1ZSTUJsZW5kU2hhcGVHcm91cCc7XG5cbmV4cG9ydCBjbGFzcyBWUk1CbGVuZFNoYXBlUHJveHkge1xuICAvKipcbiAgICogTGlzdCBvZiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZUdyb3VwczogeyBbbmFtZTogc3RyaW5nXTogVlJNQmxlbmRTaGFwZUdyb3VwIH0gPSB7fTtcblxuICAvKipcbiAgICogQSBtYXAgZnJvbSBbW1ZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV1dIHRvIGl0cyBhY3R1YWwgYmxlbmQgc2hhcGUgbmFtZS5cbiAgICovXG4gIHByaXZhdGUgcmVhZG9ubHkgX2JsZW5kU2hhcGVQcmVzZXRNYXA6IHsgW3ByZXNldE5hbWUgaW4gVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXT86IHN0cmluZyB9ID0ge307XG5cbiAgLyoqXG4gICAqIEEgbGlzdCBvZiBuYW1lIG9mIHVua25vd24gYmxlbmQgc2hhcGVzLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfdW5rbm93bkdyb3VwTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1CbGVuZFNoYXBlLlxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIGRvIG5vdGhpbmdcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXN0IG9mIG5hbWUgb2YgcmVnaXN0ZXJlZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICovXG4gIHB1YmxpYyBnZXQgZXhwcmVzc2lvbnMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9ibGVuZFNoYXBlR3JvdXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIG1hcCBmcm9tIFtbVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXV0gdG8gaXRzIGFjdHVhbCBibGVuZCBzaGFwZSBuYW1lLlxuICAgKi9cbiAgcHVibGljIGdldCBibGVuZFNoYXBlUHJlc2V0TWFwKCk6IHsgW3ByZXNldE5hbWUgaW4gVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXT86IHN0cmluZyB9IHtcbiAgICByZXR1cm4gdGhpcy5fYmxlbmRTaGFwZVByZXNldE1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGxpc3Qgb2YgbmFtZSBvZiB1bmtub3duIGJsZW5kIHNoYXBlcy5cbiAgICovXG4gIHB1YmxpYyBnZXQgdW5rbm93bkdyb3VwTmFtZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLl91bmtub3duR3JvdXBOYW1lcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gcmVnaXN0ZXJlZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICovXG4gIHB1YmxpYyBnZXRCbGVuZFNoYXBlR3JvdXAobmFtZTogc3RyaW5nIHwgVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lKTogVlJNQmxlbmRTaGFwZUdyb3VwIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBwcmVzZXROYW1lID0gdGhpcy5fYmxlbmRTaGFwZVByZXNldE1hcFtuYW1lIGFzIFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV07XG4gICAgY29uc3QgY29udHJvbGxlciA9IHByZXNldE5hbWUgPyB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW3ByZXNldE5hbWVdIDogdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXTtcbiAgICBpZiAoIWNvbnRyb2xsZXIpIHtcbiAgICAgIGNvbnNvbGUud2Fybihgbm8gYmxlbmQgc2hhcGUgZm91bmQgYnkgJHtuYW1lfWApO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRyb2xsZXI7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ29ydXBcbiAgICogQHBhcmFtIGNvbnRyb2xsZXIgVlJNQmxlbmRTaGFwZUNvbnRyb2xsZXIgdGhhdCBkZXNjcmliZXMgdGhlIGJsZW5kIHNoYXBlIGdyb3VwXG4gICAqL1xuICBwdWJsaWMgcmVnaXN0ZXJCbGVuZFNoYXBlR3JvdXAoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHByZXNldE5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHVuZGVmaW5lZCxcbiAgICBjb250cm9sbGVyOiBWUk1CbGVuZFNoYXBlR3JvdXAsXG4gICk6IHZvaWQge1xuICAgIHRoaXMuX2JsZW5kU2hhcGVHcm91cHNbbmFtZV0gPSBjb250cm9sbGVyO1xuICAgIGlmIChwcmVzZXROYW1lKSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJlc2V0TWFwW3ByZXNldE5hbWVdID0gbmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdW5rbm93bkdyb3VwTmFtZXMucHVzaChuYW1lKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgd2VpZ2h0IG9mIHNwZWNpZmllZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICovXG4gIHB1YmxpYyBnZXRWYWx1ZShuYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5nZXRCbGVuZFNoYXBlR3JvdXAobmFtZSk7XG4gICAgcmV0dXJuIGNvbnRyb2xsZXI/LndlaWdodCA/PyBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhIHdlaWdodCB0byBzcGVjaWZpZWQgYmxlbmQgc2hhcGUgZ3JvdXAuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJsZW5kIHNoYXBlIGdyb3VwXG4gICAqIEBwYXJhbSB3ZWlnaHQgV2VpZ2h0XG4gICAqL1xuICBwdWJsaWMgc2V0VmFsdWUobmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgc3RyaW5nLCB3ZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmdldEJsZW5kU2hhcGVHcm91cChuYW1lKTtcbiAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgY29udHJvbGxlci53ZWlnaHQgPSBzYXR1cmF0ZSh3ZWlnaHQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSB0cmFjayBuYW1lIG9mIHNwZWNpZmllZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICogVGhpcyB0cmFjayBuYW1lIGlzIG5lZWRlZCB0byBtYW5pcHVsYXRlIGl0cyBibGVuZCBzaGFwZSBncm91cCB2aWEga2V5ZnJhbWUgYW5pbWF0aW9ucy5cbiAgICpcbiAgICogQGV4YW1wbGUgTWFuaXB1bGF0ZSBhIGJsZW5kIHNoYXBlIGdyb3VwIHVzaW5nIGtleWZyYW1lIGFuaW1hdGlvblxuICAgKiBgYGBqc1xuICAgKiBjb25zdCB0cmFja05hbWUgPSB2cm0uYmxlbmRTaGFwZVByb3h5LmdldEJsZW5kU2hhcGVUcmFja05hbWUoIFRIUkVFLlZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5CbGluayApO1xuICAgKiBjb25zdCB0cmFjayA9IG5ldyBUSFJFRS5OdW1iZXJLZXlmcmFtZVRyYWNrKFxuICAgKiAgIG5hbWUsXG4gICAqICAgWyAwLjAsIDAuNSwgMS4wIF0sIC8vIHRpbWVzXG4gICAqICAgWyAwLjAsIDEuMCwgMC4wIF0gLy8gdmFsdWVzXG4gICAqICk7XG4gICAqXG4gICAqIGNvbnN0IGNsaXAgPSBuZXcgVEhSRUUuQW5pbWF0aW9uQ2xpcChcbiAgICogICAnYmxpbmsnLCAvLyBuYW1lXG4gICAqICAgMS4wLCAvLyBkdXJhdGlvblxuICAgKiAgIFsgdHJhY2sgXSAvLyB0cmFja3NcbiAgICogKTtcbiAgICpcbiAgICogY29uc3QgbWl4ZXIgPSBuZXcgVEhSRUUuQW5pbWF0aW9uTWl4ZXIoIHZybS5zY2VuZSApO1xuICAgKiBjb25zdCBhY3Rpb24gPSBtaXhlci5jbGlwQWN0aW9uKCBjbGlwICk7XG4gICAqIGFjdGlvbi5wbGF5KCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxuICAgKi9cbiAgcHVibGljIGdldEJsZW5kU2hhcGVUcmFja05hbWUobmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgY29udHJvbGxlciA9IHRoaXMuZ2V0QmxlbmRTaGFwZUdyb3VwKG5hbWUpO1xuICAgIHJldHVybiBjb250cm9sbGVyID8gYCR7Y29udHJvbGxlci5uYW1lfS53ZWlnaHRgIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgZXZlcnkgYmxlbmQgc2hhcGUgZ3JvdXBzLlxuICAgKi9cbiAgcHVibGljIHVwZGF0ZSgpOiB2b2lkIHtcbiAgICBPYmplY3Qua2V5cyh0aGlzLl9ibGVuZFNoYXBlR3JvdXBzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXTtcbiAgICAgIGNvbnRyb2xsZXIuY2xlYXJBcHBsaWVkV2VpZ2h0KCk7XG4gICAgfSk7XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLl9ibGVuZFNoYXBlR3JvdXBzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXTtcbiAgICAgIGNvbnRyb2xsZXIuYXBwbHlXZWlnaHQoKTtcbiAgICB9KTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgR0xURlNjaGVtYSwgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyByZW5hbWVNYXRlcmlhbFByb3BlcnR5IH0gZnJvbSAnLi4vdXRpbHMvcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eSc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlR3JvdXAgfSBmcm9tICcuL1ZSTUJsZW5kU2hhcGVHcm91cCc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuL1ZSTUJsZW5kU2hhcGVQcm94eSc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1CbGVuZFNoYXBlXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNQmxlbmRTaGFwZUltcG9ydGVyIHtcbiAgLyoqXG4gICAqIEltcG9ydCBhIFtbVlJNQmxlbmRTaGFwZV1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1CbGVuZFNoYXBlUHJveHkgfCBudWxsPiB7XG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XG4gICAgaWYgKCF2cm1FeHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUJsZW5kU2hhcGU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlIHwgdW5kZWZpbmVkID0gdnJtRXh0LmJsZW5kU2hhcGVNYXN0ZXI7XG4gICAgaWYgKCFzY2hlbWFCbGVuZFNoYXBlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBibGVuZFNoYXBlID0gbmV3IFZSTUJsZW5kU2hhcGVQcm94eSgpO1xuXG4gICAgY29uc3QgYmxlbmRTaGFwZUdyb3VwczogVlJNU2NoZW1hLkJsZW5kU2hhcGVHcm91cFtdIHwgdW5kZWZpbmVkID0gc2NoZW1hQmxlbmRTaGFwZS5ibGVuZFNoYXBlR3JvdXBzO1xuICAgIGlmICghYmxlbmRTaGFwZUdyb3Vwcykge1xuICAgICAgcmV0dXJuIGJsZW5kU2hhcGU7XG4gICAgfVxuXG4gICAgY29uc3QgYmxlbmRTaGFwZVByZXNldE1hcDogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0gPSB7fTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYmxlbmRTaGFwZUdyb3Vwcy5tYXAoYXN5bmMgKHNjaGVtYUdyb3VwKSA9PiB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBzY2hlbWFHcm91cC5uYW1lO1xuICAgICAgICBpZiAobmFtZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdWUk1CbGVuZFNoYXBlSW1wb3J0ZXI6IE9uZSBvZiBibGVuZFNoYXBlR3JvdXBzIGhhcyBubyBuYW1lJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByZXNldE5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHNjaGVtYUdyb3VwLnByZXNldE5hbWUgJiZcbiAgICAgICAgICBzY2hlbWFHcm91cC5wcmVzZXROYW1lICE9PSBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuVW5rbm93biAmJlxuICAgICAgICAgICFibGVuZFNoYXBlUHJlc2V0TWFwW3NjaGVtYUdyb3VwLnByZXNldE5hbWVdXG4gICAgICAgICkge1xuICAgICAgICAgIHByZXNldE5hbWUgPSBzY2hlbWFHcm91cC5wcmVzZXROYW1lO1xuICAgICAgICAgIGJsZW5kU2hhcGVQcmVzZXRNYXBbc2NoZW1hR3JvdXAucHJlc2V0TmFtZV0gPSBuYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSBuZXcgVlJNQmxlbmRTaGFwZUdyb3VwKG5hbWUpO1xuICAgICAgICBnbHRmLnNjZW5lLmFkZChncm91cCk7XG5cbiAgICAgICAgZ3JvdXAuaXNCaW5hcnkgPSBzY2hlbWFHcm91cC5pc0JpbmFyeSB8fCBmYWxzZTtcblxuICAgICAgICBpZiAoc2NoZW1hR3JvdXAuYmluZHMpIHtcbiAgICAgICAgICBzY2hlbWFHcm91cC5iaW5kcy5mb3JFYWNoKGFzeW5jIChiaW5kKSA9PiB7XG4gICAgICAgICAgICBpZiAoYmluZC5tZXNoID09PSB1bmRlZmluZWQgfHwgYmluZC5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZXNVc2luZ01lc2g6IG51bWJlcltdID0gW107XG4gICAgICAgICAgICAoZ2x0Zi5wYXJzZXIuanNvbi5ub2RlcyBhcyBHTFRGU2NoZW1hLk5vZGVbXSkuZm9yRWFjaCgobm9kZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAobm9kZS5tZXNoID09PSBiaW5kLm1lc2gpIHtcbiAgICAgICAgICAgICAgICBub2Rlc1VzaW5nTWVzaC5wdXNoKGkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRJbmRleCA9IGJpbmQuaW5kZXg7XG5cbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgICBub2Rlc1VzaW5nTWVzaC5tYXAoYXN5bmMgKG5vZGVJbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZXMgPSAoYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUoZ2x0Ziwgbm9kZUluZGV4KSkhO1xuXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhlIG1lc2ggaGFzIHRoZSB0YXJnZXQgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgIXByaW1pdGl2ZXMuZXZlcnkoXG4gICAgICAgICAgICAgICAgICAgIChwcmltaXRpdmUpID0+XG4gICAgICAgICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheShwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzKSAmJlxuICAgICAgICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0SW5kZXggPCBwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgICAgICAgYFZSTUJsZW5kU2hhcGVJbXBvcnRlcjogJHtzY2hlbWFHcm91cC5uYW1lfSBhdHRlbXB0cyB0byBpbmRleCAke21vcnBoVGFyZ2V0SW5kZXh9dGggbW9ycGggYnV0IG5vdCBmb3VuZC5gLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBncm91cC5hZGRCaW5kKHtcbiAgICAgICAgICAgICAgICAgIG1lc2hlczogcHJpbWl0aXZlcyxcbiAgICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0SW5kZXgsXG4gICAgICAgICAgICAgICAgICB3ZWlnaHQ6IGJpbmQud2VpZ2h0ID8/IDEwMCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWF0ZXJpYWxWYWx1ZXMgPSBzY2hlbWFHcm91cC5tYXRlcmlhbFZhbHVlcztcbiAgICAgICAgaWYgKG1hdGVyaWFsVmFsdWVzKSB7XG4gICAgICAgICAgbWF0ZXJpYWxWYWx1ZXMuZm9yRWFjaCgobWF0ZXJpYWxWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAgIG1hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICAgbWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSA9PT0gdW5kZWZpbmVkXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbHM6IFRIUkVFLk1hdGVyaWFsW10gPSBbXTtcbiAgICAgICAgICAgIGdsdGYuc2NlbmUudHJhdmVyc2UoKG9iamVjdCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsW10gfCBUSFJFRS5NYXRlcmlhbCA9IChvYmplY3QgYXMgYW55KS5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRlcmlhbCkpIHtcbiAgICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICAuLi5tYXRlcmlhbC5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICAgICAgKG10bCkgPT4gbXRsLm5hbWUgPT09IG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lISAmJiBtYXRlcmlhbHMuaW5kZXhPZihtdGwpID09PSAtMSxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbC5uYW1lID09PSBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSAmJiBtYXRlcmlhbHMuaW5kZXhPZihtYXRlcmlhbCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbWF0ZXJpYWxzLmZvckVhY2goKG1hdGVyaWFsKSA9PiB7XG4gICAgICAgICAgICAgIGdyb3VwLmFkZE1hdGVyaWFsVmFsdWUoe1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5TmFtZTogcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShtYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZSEpLFxuICAgICAgICAgICAgICAgIHRhcmdldFZhbHVlOiBtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlISxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJsZW5kU2hhcGUucmVnaXN0ZXJCbGVuZFNoYXBlR3JvdXAobmFtZSwgcHJlc2V0TmFtZSwgZ3JvdXApO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHJldHVybiBibGVuZFNoYXBlO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGTm9kZSwgR0xURlByaW1pdGl2ZSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldFdvcmxkUXVhdGVybmlvbkxpdGUgfSBmcm9tICcuLi91dGlscy9tYXRoJztcblxuY29uc3QgVkVDVE9SM19GUk9OVCA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLlZlY3RvcjMoMC4wLCAwLjAsIC0xLjApKTtcblxuY29uc3QgX3F1YXQgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG5lbnVtIEZpcnN0UGVyc29uRmxhZyB7XG4gIEF1dG8sXG4gIEJvdGgsXG4gIFRoaXJkUGVyc29uT25seSxcbiAgRmlyc3RQZXJzb25Pbmx5LFxufVxuXG4vKipcbiAqIFRoaXMgY2xhc3MgcmVwcmVzZW50cyBhIHNpbmdsZSBbYG1lc2hBbm5vdGF0aW9uYF0oaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iL21hc3Rlci9zcGVjaWZpY2F0aW9uLzAuMC9zY2hlbWEvdnJtLmZpcnN0cGVyc29uLm1lc2hhbm5vdGF0aW9uLnNjaGVtYS5qc29uKSBlbnRyeS5cbiAqIEVhY2ggbWVzaCB3aWxsIGJlIGFzc2lnbmVkIHRvIHNwZWNpZmllZCBsYXllciB3aGVuIHlvdSBjYWxsIFtbVlJNRmlyc3RQZXJzb24uc2V0dXBdXS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFncyB7XG4gIHByaXZhdGUgc3RhdGljIF9wYXJzZUZpcnN0UGVyc29uRmxhZyhmaXJzdFBlcnNvbkZsYWc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IEZpcnN0UGVyc29uRmxhZyB7XG4gICAgc3dpdGNoIChmaXJzdFBlcnNvbkZsYWcpIHtcbiAgICAgIGNhc2UgJ0JvdGgnOlxuICAgICAgICByZXR1cm4gRmlyc3RQZXJzb25GbGFnLkJvdGg7XG4gICAgICBjYXNlICdUaGlyZFBlcnNvbk9ubHknOlxuICAgICAgICByZXR1cm4gRmlyc3RQZXJzb25GbGFnLlRoaXJkUGVyc29uT25seTtcbiAgICAgIGNhc2UgJ0ZpcnN0UGVyc29uT25seSc6XG4gICAgICAgIHJldHVybiBGaXJzdFBlcnNvbkZsYWcuRmlyc3RQZXJzb25Pbmx5O1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIEZpcnN0UGVyc29uRmxhZy5BdXRvO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBIFtbRmlyc3RQZXJzb25GbGFnXV0gb2YgdGhlIGFubm90YXRpb24gZW50cnkuXG4gICAqL1xuICBwdWJsaWMgZmlyc3RQZXJzb25GbGFnOiBGaXJzdFBlcnNvbkZsYWc7XG5cbiAgLyoqXG4gICAqIEEgbWVzaCBwcmltaXRpdmVzIG9mIHRoZSBhbm5vdGF0aW9uIGVudHJ5LlxuICAgKi9cbiAgcHVibGljIHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IG1lc2ggYW5ub3RhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGZpcnN0UGVyc29uRmxhZyBBIFtbRmlyc3RQZXJzb25GbGFnXV0gb2YgdGhlIGFubm90YXRpb24gZW50cnlcbiAgICogQHBhcmFtIG5vZGUgQSBub2RlIG9mIHRoZSBhbm5vdGF0aW9uIGVudHJ5LlxuICAgKi9cbiAgY29uc3RydWN0b3IoZmlyc3RQZXJzb25GbGFnOiBzdHJpbmcgfCB1bmRlZmluZWQsIHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXSkge1xuICAgIHRoaXMuZmlyc3RQZXJzb25GbGFnID0gVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzLl9wYXJzZUZpcnN0UGVyc29uRmxhZyhmaXJzdFBlcnNvbkZsYWcpO1xuICAgIHRoaXMucHJpbWl0aXZlcyA9IHByaW1pdGl2ZXM7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZSTUZpcnN0UGVyc29uIHtcbiAgLyoqXG4gICAqIEEgZGVmYXVsdCBjYW1lcmEgbGF5ZXIgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKlxuICAgKiBAc2VlIFtbZ2V0Rmlyc3RQZXJzb25Pbmx5TGF5ZXJdXVxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUiA9IDk7XG5cbiAgLyoqXG4gICAqIEEgZGVmYXVsdCBjYW1lcmEgbGF5ZXIgZm9yIGBUaGlyZFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKlxuICAgKiBAc2VlIFtbZ2V0VGhpcmRQZXJzb25Pbmx5TGF5ZXJdXVxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0RFRkFVTFRfVEhJUkRQRVJTT05fT05MWV9MQVlFUiA9IDEwO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX2ZpcnN0UGVyc29uQm9uZTogR0xURk5vZGU7XG4gIHByaXZhdGUgcmVhZG9ubHkgX21lc2hBbm5vdGF0aW9uczogVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzW10gPSBbXTtcbiAgcHJpdmF0ZSByZWFkb25seSBfZmlyc3RQZXJzb25Cb25lT2Zmc2V0OiBUSFJFRS5WZWN0b3IzO1xuXG4gIHByaXZhdGUgX2ZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uX0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUjtcbiAgcHJpdmF0ZSBfdGhpcmRQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5fREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSO1xuXG4gIHByaXZhdGUgX2luaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1GaXJzdFBlcnNvbiBvYmplY3QuXG4gICAqXG4gICAqIEBwYXJhbSBmaXJzdFBlcnNvbkJvbmUgQSBmaXJzdCBwZXJzb24gYm9uZVxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb25Cb25lT2Zmc2V0IEFuIG9mZnNldCBmcm9tIHRoZSBzcGVjaWZpZWQgZmlyc3QgcGVyc29uIGJvbmVcbiAgICogQHBhcmFtIG1lc2hBbm5vdGF0aW9ucyBBIHJlbmRlcmVyIHNldHRpbmdzLiBTZWUgdGhlIGRlc2NyaXB0aW9uIG9mIFtbUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzXV0gZm9yIG1vcmUgaW5mb1xuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgZmlyc3RQZXJzb25Cb25lOiBHTFRGTm9kZSxcbiAgICBmaXJzdFBlcnNvbkJvbmVPZmZzZXQ6IFRIUkVFLlZlY3RvcjMsXG4gICAgbWVzaEFubm90YXRpb25zOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSxcbiAgKSB7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25Cb25lID0gZmlyc3RQZXJzb25Cb25lO1xuICAgIHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldCA9IGZpcnN0UGVyc29uQm9uZU9mZnNldDtcbiAgICB0aGlzLl9tZXNoQW5ub3RhdGlvbnMgPSBtZXNoQW5ub3RhdGlvbnM7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGZpcnN0UGVyc29uQm9uZSgpOiBHTFRGTm9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0UGVyc29uQm9uZTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgbWVzaEFubm90YXRpb25zKCk6IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFnc1tdIHtcbiAgICByZXR1cm4gdGhpcy5fbWVzaEFubm90YXRpb25zO1xuICB9XG5cbiAgcHVibGljIGdldEZpcnN0UGVyc29uV29ybGREaXJlY3Rpb24odGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgcmV0dXJuIHRhcmdldC5jb3B5KFZFQ1RPUjNfRlJPTlQpLmFwcGx5UXVhdGVybmlvbihnZXRXb3JsZFF1YXRlcm5pb25MaXRlKHRoaXMuX2ZpcnN0UGVyc29uQm9uZSwgX3F1YXQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGNhbWVyYSBsYXllciByZXByZXNlbnRzIGBGaXJzdFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKiBOb3RlIHRoYXQgKip5b3UgbXVzdCBjYWxsIFtbc2V0dXBdXSBmaXJzdCBiZWZvcmUgeW91IHVzZSB0aGUgbGF5ZXIgZmVhdHVyZSoqIG9yIGl0IGRvZXMgbm90IHdvcmsgcHJvcGVybHkuXG4gICAqXG4gICAqIFRoZSB2YWx1ZSBpcyBbW0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUl1dIGJ5IGRlZmF1bHQgYnV0IHlvdSBjYW4gY2hhbmdlIHRoZSBsYXllciBieSBzcGVjaWZ5aW5nIHZpYSBbW3NldHVwXV0gaWYgeW91IHByZWZlci5cbiAgICpcbiAgICogQHNlZSBodHRwczovL3ZybS5kZXYvZW4vdW5pdnJtL2FwaS91bml2cm1fdXNlX2ZpcnN0cGVyc29uL1xuICAgKiBAc2VlIGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL2NvcmUvTGF5ZXJzXG4gICAqL1xuICBwdWJsaWMgZ2V0IGZpcnN0UGVyc29uT25seUxheWVyKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgY2FtZXJhIGxheWVyIHJlcHJlc2VudHMgYFRoaXJkUGVyc29uT25seWAgbGF5ZXIuXG4gICAqIE5vdGUgdGhhdCAqKnlvdSBtdXN0IGNhbGwgW1tzZXR1cF1dIGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlKiogb3IgaXQgZG9lcyBub3Qgd29yayBwcm9wZXJseS5cbiAgICpcbiAgICogVGhlIHZhbHVlIGlzIFtbREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSXV0gYnkgZGVmYXVsdCBidXQgeW91IGNhbiBjaGFuZ2UgdGhlIGxheWVyIGJ5IHNwZWNpZnlpbmcgdmlhIFtbc2V0dXBdXSBpZiB5b3UgcHJlZmVyLlxuICAgKlxuICAgKiBAc2VlIGh0dHBzOi8vdnJtLmRldi9lbi91bml2cm0vYXBpL3VuaXZybV91c2VfZmlyc3RwZXJzb24vXG4gICAqIEBzZWUgaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vY29yZS9MYXllcnNcbiAgICovXG4gIHB1YmxpYyBnZXQgdGhpcmRQZXJzb25Pbmx5TGF5ZXIoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXI7XG4gIH1cblxuICBwdWJsaWMgZ2V0Rmlyc3RQZXJzb25Cb25lT2Zmc2V0KHRhcmdldDogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xuICAgIHJldHVybiB0YXJnZXQuY29weSh0aGlzLl9maXJzdFBlcnNvbkJvbmVPZmZzZXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjdXJyZW50IHdvcmxkIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBwZXJzb24uXG4gICAqIFRoZSBwb3NpdGlvbiB0YWtlcyBbW0ZpcnN0UGVyc29uQm9uZV1dIGFuZCBbW0ZpcnN0UGVyc29uT2Zmc2V0XV0gaW50byBhY2NvdW50LlxuICAgKlxuICAgKiBAcGFyYW0gdjMgdGFyZ2V0XG4gICAqIEByZXR1cm5zIEN1cnJlbnQgd29ybGQgcG9zaXRpb24gb2YgdGhlIGZpcnN0IHBlcnNvblxuICAgKi9cbiAgcHVibGljIGdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbih2MzogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xuICAgIC8vIFVuaVZSTSNWUk1GaXJzdFBlcnNvbkVkaXRvclxuICAgIC8vIHZhciB3b3JsZE9mZnNldCA9IGhlYWQubG9jYWxUb1dvcmxkTWF0cml4Lk11bHRpcGx5UG9pbnQoY29tcG9uZW50LkZpcnN0UGVyc29uT2Zmc2V0KTtcbiAgICBjb25zdCBvZmZzZXQgPSB0aGlzLl9maXJzdFBlcnNvbkJvbmVPZmZzZXQ7XG4gICAgY29uc3QgdjQgPSBuZXcgVEhSRUUuVmVjdG9yNChvZmZzZXQueCwgb2Zmc2V0LnksIG9mZnNldC56LCAxLjApO1xuICAgIHY0LmFwcGx5TWF0cml4NCh0aGlzLl9maXJzdFBlcnNvbkJvbmUubWF0cml4V29ybGQpO1xuICAgIHJldHVybiB2My5zZXQodjQueCwgdjQueSwgdjQueik7XG4gIH1cblxuICAvKipcbiAgICogSW4gdGhpcyBtZXRob2QsIGl0IGFzc2lnbnMgbGF5ZXJzIGZvciBldmVyeSBtZXNoZXMgYmFzZWQgb24gbWVzaCBhbm5vdGF0aW9ucy5cbiAgICogWW91IG11c3QgY2FsbCB0aGlzIG1ldGhvZCBmaXJzdCBiZWZvcmUgeW91IHVzZSB0aGUgbGF5ZXIgZmVhdHVyZS5cbiAgICpcbiAgICogVGhpcyBpcyBhbiBlcXVpdmFsZW50IG9mIFtWUk1GaXJzdFBlcnNvbi5TZXR1cF0oaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iL21hc3Rlci9Bc3NldHMvVlJNL1VuaVZSTS9TY3JpcHRzL0ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uLmNzKSBvZiB0aGUgVW5pVlJNLlxuICAgKlxuICAgKiBUaGUgYGNhbWVyYUxheWVyYCBwYXJhbWV0ZXIgc3BlY2lmaWVzIHdoaWNoIGxheWVyIHdpbGwgYmUgYXNzaWduZWQgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIC8gYFRoaXJkUGVyc29uT25seWAuXG4gICAqIEluIFVuaVZSTSwgd2Ugc3BlY2lmaWVkIHRob3NlIGJ5IG5hbWluZyBlYWNoIGRlc2lyZWQgbGF5ZXIgYXMgYEZJUlNUUEVSU09OX09OTFlfTEFZRVJgIC8gYFRISVJEUEVSU09OX09OTFlfTEFZRVJgXG4gICAqIGJ1dCB3ZSBhcmUgZ29pbmcgdG8gc3BlY2lmeSB0aGVzZSBsYXllcnMgYXQgaGVyZSBzaW5jZSB3ZSBhcmUgdW5hYmxlIHRvIG5hbWUgbGF5ZXJzIGluIFRocmVlLmpzLlxuICAgKlxuICAgKiBAcGFyYW0gY2FtZXJhTGF5ZXIgU3BlY2lmeSB3aGljaCBsYXllciB3aWxsIGJlIGZvciBgRmlyc3RQZXJzb25Pbmx5YCAvIGBUaGlyZFBlcnNvbk9ubHlgLlxuICAgKi9cbiAgcHVibGljIHNldHVwKHtcbiAgICBmaXJzdFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX0ZJUlNUUEVSU09OX09OTFlfTEFZRVIsXG4gICAgdGhpcmRQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5fREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSLFxuICB9ID0ge30pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5faW5pdGlhbGl6ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyID0gZmlyc3RQZXJzb25Pbmx5TGF5ZXI7XG4gICAgdGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIgPSB0aGlyZFBlcnNvbk9ubHlMYXllcjtcblxuICAgIHRoaXMuX21lc2hBbm5vdGF0aW9ucy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICBpZiAoaXRlbS5maXJzdFBlcnNvbkZsYWcgPT09IEZpcnN0UGVyc29uRmxhZy5GaXJzdFBlcnNvbk9ubHkpIHtcbiAgICAgICAgaXRlbS5wcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xuICAgICAgICAgIHByaW1pdGl2ZS5sYXllcnMuc2V0KHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0uZmlyc3RQZXJzb25GbGFnID09PSBGaXJzdFBlcnNvbkZsYWcuVGhpcmRQZXJzb25Pbmx5KSB7XG4gICAgICAgIGl0ZW0ucHJpbWl0aXZlcy5mb3JFYWNoKChwcmltaXRpdmUpID0+IHtcbiAgICAgICAgICBwcmltaXRpdmUubGF5ZXJzLnNldCh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcik7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpdGVtLmZpcnN0UGVyc29uRmxhZyA9PT0gRmlyc3RQZXJzb25GbGFnLkF1dG8pIHtcbiAgICAgICAgdGhpcy5fY3JlYXRlSGVhZGxlc3NNb2RlbChpdGVtLnByaW1pdGl2ZXMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZXhjbHVkZVRyaWFuZ2xlcyh0cmlhbmdsZXM6IG51bWJlcltdLCBid3M6IG51bWJlcltdW10sIHNraW5JbmRleDogbnVtYmVyW11bXSwgZXhjbHVkZTogbnVtYmVyW10pOiBudW1iZXIge1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgaWYgKGJ3cyAhPSBudWxsICYmIGJ3cy5sZW5ndGggPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaWFuZ2xlcy5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICBjb25zdCBhID0gdHJpYW5nbGVzW2ldO1xuICAgICAgICBjb25zdCBiID0gdHJpYW5nbGVzW2kgKyAxXTtcbiAgICAgICAgY29uc3QgYyA9IHRyaWFuZ2xlc1tpICsgMl07XG4gICAgICAgIGNvbnN0IGJ3MCA9IGJ3c1thXTtcbiAgICAgICAgY29uc3Qgc2tpbjAgPSBza2luSW5kZXhbYV07XG5cbiAgICAgICAgaWYgKGJ3MFswXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFswXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncwWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzFdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzBbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbMl0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MFszXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFszXSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IGJ3MSA9IGJ3c1tiXTtcbiAgICAgICAgY29uc3Qgc2tpbjEgPSBza2luSW5kZXhbYl07XG4gICAgICAgIGlmIChidzFbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbMF0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MVsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVsxXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncxWzJdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzJdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzFbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbM10pKSBjb250aW51ZTtcblxuICAgICAgICBjb25zdCBidzIgPSBid3NbY107XG4gICAgICAgIGNvbnN0IHNraW4yID0gc2tpbkluZGV4W2NdO1xuICAgICAgICBpZiAoYncyWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzBdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzJbMV0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbMV0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MlsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMlsyXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncyWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzNdKSkgY29udGludWU7XG5cbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYTtcbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYjtcbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvdW50O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRXJhc2VkTWVzaChzcmM6IFRIUkVFLlNraW5uZWRNZXNoLCBlcmFzaW5nQm9uZXNJbmRleDogbnVtYmVyW10pOiBUSFJFRS5Ta2lubmVkTWVzaCB7XG4gICAgY29uc3QgZHN0ID0gbmV3IFRIUkVFLlNraW5uZWRNZXNoKHNyYy5nZW9tZXRyeS5jbG9uZSgpLCBzcmMubWF0ZXJpYWwpO1xuICAgIGRzdC5uYW1lID0gYCR7c3JjLm5hbWV9KGVyYXNlKWA7XG4gICAgZHN0LmZydXN0dW1DdWxsZWQgPSBzcmMuZnJ1c3R1bUN1bGxlZDtcbiAgICBkc3QubGF5ZXJzLnNldCh0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcik7XG5cbiAgICBjb25zdCBnZW9tZXRyeSA9IGRzdC5nZW9tZXRyeTtcblxuICAgIGNvbnN0IHNraW5JbmRleEF0dHIgPSBnZW9tZXRyeS5nZXRBdHRyaWJ1dGUoJ3NraW5JbmRleCcpLmFycmF5O1xuICAgIGNvbnN0IHNraW5JbmRleCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2tpbkluZGV4QXR0ci5sZW5ndGg7IGkgKz0gNCkge1xuICAgICAgc2tpbkluZGV4LnB1c2goW3NraW5JbmRleEF0dHJbaV0sIHNraW5JbmRleEF0dHJbaSArIDFdLCBza2luSW5kZXhBdHRyW2kgKyAyXSwgc2tpbkluZGV4QXR0cltpICsgM11dKTtcbiAgICB9XG5cbiAgICBjb25zdCBza2luV2VpZ2h0QXR0ciA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbldlaWdodCcpLmFycmF5O1xuICAgIGNvbnN0IHNraW5XZWlnaHQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNraW5XZWlnaHRBdHRyLmxlbmd0aDsgaSArPSA0KSB7XG4gICAgICBza2luV2VpZ2h0LnB1c2goW3NraW5XZWlnaHRBdHRyW2ldLCBza2luV2VpZ2h0QXR0cltpICsgMV0sIHNraW5XZWlnaHRBdHRyW2kgKyAyXSwgc2tpbldlaWdodEF0dHJbaSArIDNdXSk7XG4gICAgfVxuXG4gICAgY29uc3QgaW5kZXggPSBnZW9tZXRyeS5nZXRJbmRleCgpO1xuICAgIGlmICghaW5kZXgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBnZW9tZXRyeSBkb2Vzbid0IGhhdmUgYW4gaW5kZXggYnVmZmVyXCIpO1xuICAgIH1cbiAgICBjb25zdCBvbGRUcmlhbmdsZXMgPSBBcnJheS5mcm9tKGluZGV4LmFycmF5KTtcblxuICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fZXhjbHVkZVRyaWFuZ2xlcyhvbGRUcmlhbmdsZXMsIHNraW5XZWlnaHQsIHNraW5JbmRleCwgZXJhc2luZ0JvbmVzSW5kZXgpO1xuICAgIGNvbnN0IG5ld1RyaWFuZ2xlOiBudW1iZXJbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgbmV3VHJpYW5nbGVbaV0gPSBvbGRUcmlhbmdsZXNbaV07XG4gICAgfVxuICAgIGdlb21ldHJ5LnNldEluZGV4KG5ld1RyaWFuZ2xlKTtcblxuICAgIC8vIG10b29uIG1hdGVyaWFsIGluY2x1ZGVzIG9uQmVmb3JlUmVuZGVyLiB0aGlzIGlzIHVuc3VwcG9ydGVkIGF0IFNraW5uZWRNZXNoI2Nsb25lXG4gICAgaWYgKHNyYy5vbkJlZm9yZVJlbmRlcikge1xuICAgICAgZHN0Lm9uQmVmb3JlUmVuZGVyID0gc3JjLm9uQmVmb3JlUmVuZGVyO1xuICAgIH1cbiAgICBkc3QuYmluZChuZXcgVEhSRUUuU2tlbGV0b24oc3JjLnNrZWxldG9uLmJvbmVzLCBzcmMuc2tlbGV0b24uYm9uZUludmVyc2VzKSwgbmV3IFRIUkVFLk1hdHJpeDQoKSk7XG4gICAgcmV0dXJuIGRzdDtcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZUhlYWRsZXNzTW9kZWxGb3JTa2lubmVkTWVzaChwYXJlbnQ6IFRIUkVFLk9iamVjdDNELCBtZXNoOiBUSFJFRS5Ta2lubmVkTWVzaCk6IHZvaWQge1xuICAgIGNvbnN0IGVyYXNlQm9uZUluZGV4ZXM6IG51bWJlcltdID0gW107XG4gICAgbWVzaC5za2VsZXRvbi5ib25lcy5mb3JFYWNoKChib25lLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQoYm9uZSkpIGVyYXNlQm9uZUluZGV4ZXMucHVzaChpbmRleCk7XG4gICAgfSk7XG5cbiAgICAvLyBVbmxpa2UgVW5pVlJNIHdlIGRvbid0IGNvcHkgbWVzaCBpZiBubyBpbnZpc2libGUgYm9uZSB3YXMgZm91bmRcbiAgICBpZiAoIWVyYXNlQm9uZUluZGV4ZXMubGVuZ3RoKSB7XG4gICAgICBtZXNoLmxheWVycy5lbmFibGUodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgbWVzaC5sYXllcnMuZW5hYmxlKHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbWVzaC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICBjb25zdCBuZXdNZXNoID0gdGhpcy5fY3JlYXRlRXJhc2VkTWVzaChtZXNoLCBlcmFzZUJvbmVJbmRleGVzKTtcbiAgICBwYXJlbnQuYWRkKG5ld01lc2gpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlSGVhZGxlc3NNb2RlbChwcmltaXRpdmVzOiBHTFRGUHJpbWl0aXZlW10pOiB2b2lkIHtcbiAgICBwcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xuICAgICAgaWYgKHByaW1pdGl2ZS50eXBlID09PSAnU2tpbm5lZE1lc2gnKSB7XG4gICAgICAgIGNvbnN0IHNraW5uZWRNZXNoID0gcHJpbWl0aXZlIGFzIFRIUkVFLlNraW5uZWRNZXNoO1xuICAgICAgICB0aGlzLl9jcmVhdGVIZWFkbGVzc01vZGVsRm9yU2tpbm5lZE1lc2goc2tpbm5lZE1lc2gucGFyZW50ISwgc2tpbm5lZE1lc2gpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQocHJpbWl0aXZlKSkge1xuICAgICAgICAgIHByaW1pdGl2ZS5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEl0IGp1c3QgY2hlY2tzIHdoZXRoZXIgdGhlIG5vZGUgb3IgaXRzIHBhcmVudCBpcyB0aGUgZmlyc3QgcGVyc29uIGJvbmUgb3Igbm90LlxuICAgKiBAcGFyYW0gYm9uZSBUaGUgdGFyZ2V0IGJvbmVcbiAgICovXG4gIHByaXZhdGUgX2lzRXJhc2VUYXJnZXQoYm9uZTogR0xURk5vZGUpOiBib29sZWFuIHtcbiAgICBpZiAoYm9uZSA9PT0gdGhpcy5fZmlyc3RQZXJzb25Cb25lKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKCFib25lLnBhcmVudCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5faXNFcmFzZVRhcmdldChib25lLnBhcmVudCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IEdMVEZOb2RlLCBHTFRGU2NoZW1hLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyBWUk1GaXJzdFBlcnNvbiwgVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzIH0gZnJvbSAnLi9WUk1GaXJzdFBlcnNvbic7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1GaXJzdFBlcnNvbl1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUZpcnN0UGVyc29uSW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1GaXJzdFBlcnNvbl1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKiBAcGFyYW0gaHVtYW5vaWQgQSBbW1ZSTUh1bWFub2lkXV0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cbiAgICovXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURiwgaHVtYW5vaWQ6IFZSTUh1bWFub2lkKTogUHJvbWlzZTxWUk1GaXJzdFBlcnNvbiB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5maXJzdFBlcnNvbjtcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbkJvbmVJbmRleCA9IHNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZTtcblxuICAgIGxldCBmaXJzdFBlcnNvbkJvbmU6IEdMVEZOb2RlIHwgbnVsbDtcbiAgICBpZiAoZmlyc3RQZXJzb25Cb25lSW5kZXggPT09IHVuZGVmaW5lZCB8fCBmaXJzdFBlcnNvbkJvbmVJbmRleCA9PT0gLTEpIHtcbiAgICAgIGZpcnN0UGVyc29uQm9uZSA9IGh1bWFub2lkLmdldEJvbmVOb2RlKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lLkhlYWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaXJzdFBlcnNvbkJvbmUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgZmlyc3RQZXJzb25Cb25lSW5kZXgpO1xuICAgIH1cblxuICAgIGlmICghZmlyc3RQZXJzb25Cb25lKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1ZSTUZpcnN0UGVyc29uSW1wb3J0ZXI6IENvdWxkIG5vdCBmaW5kIGZpcnN0UGVyc29uQm9uZSBvZiB0aGUgVlJNJyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbkJvbmVPZmZzZXQgPSBzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXRcbiAgICAgID8gbmV3IFRIUkVFLlZlY3RvcjMoXG4gICAgICAgICAgc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LngsXG4gICAgICAgICAgc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LnksXG4gICAgICAgICAgLXNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZU9mZnNldC56ISwgLy8gVlJNIDAuMCB1c2VzIGxlZnQtaGFuZGVkIHktdXBcbiAgICAgICAgKVxuICAgICAgOiBuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMDYsIDAuMCk7IC8vIGZhbGxiYWNrLCB0YWtlbiBmcm9tIFVuaVZSTSBpbXBsZW1lbnRhdGlvblxuXG4gICAgY29uc3QgbWVzaEFubm90YXRpb25zOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSA9IFtdO1xuICAgIGNvbnN0IG5vZGVQcmltaXRpdmVzTWFwID0gYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGYpO1xuXG4gICAgQXJyYXkuZnJvbShub2RlUHJpbWl0aXZlc01hcC5lbnRyaWVzKCkpLmZvckVhY2goKFtub2RlSW5kZXgsIHByaW1pdGl2ZXNdKSA9PiB7XG4gICAgICBjb25zdCBzY2hlbWFOb2RlOiBHTFRGU2NoZW1hLk5vZGUgPSBnbHRmLnBhcnNlci5qc29uLm5vZGVzW25vZGVJbmRleF07XG5cbiAgICAgIGNvbnN0IGZsYWcgPSBzY2hlbWFGaXJzdFBlcnNvbi5tZXNoQW5ub3RhdGlvbnNcbiAgICAgICAgPyBzY2hlbWFGaXJzdFBlcnNvbi5tZXNoQW5ub3RhdGlvbnMuZmluZCgoYSkgPT4gYS5tZXNoID09PSBzY2hlbWFOb2RlLm1lc2gpXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgbWVzaEFubm90YXRpb25zLnB1c2gobmV3IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFncyhmbGFnPy5maXJzdFBlcnNvbkZsYWcsIHByaW1pdGl2ZXMpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgVlJNRmlyc3RQZXJzb24oZmlyc3RQZXJzb25Cb25lLCBmaXJzdFBlcnNvbkJvbmVPZmZzZXQsIG1lc2hBbm5vdGF0aW9ucyk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEZOb2RlIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNSHVtYW5MaW1pdCB9IGZyb20gJy4vVlJNSHVtYW5MaW1pdCc7XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRzIGEgc2luZ2xlIGBodW1hbkJvbmVgIG9mIGEgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5Cb25lIHtcbiAgLyoqXG4gICAqIEEgW1tHTFRGTm9kZV1dICh0aGF0IGFjdHVhbGx5IGlzIGEgYFRIUkVFLk9iamVjdDNEYCkgdGhhdCByZXByZXNlbnRzIHRoZSBib25lLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG5vZGU6IEdMVEZOb2RlO1xuXG4gIC8qKlxuICAgKiBBIFtbVlJNSHVtYW5MaW1pdF1dIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgcHJvcGVydGllcyBvZiB0aGUgYm9uZS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbkxpbWl0OiBWUk1IdW1hbkxpbWl0O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNSHVtYW5Cb25lLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZSBBIFtbR0xURk5vZGVdXSB0aGF0IHJlcHJlc2VudHMgdGhlIG5ldyBib25lXG4gICAqIEBwYXJhbSBodW1hbkxpbWl0IEEgW1tWUk1IdW1hbkxpbWl0XV0gb2JqZWN0IHRoYXQgcmVwcmVzZW50cyBwcm9wZXJ0aWVzIG9mIHRoZSBuZXcgYm9uZVxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKG5vZGU6IEdMVEZOb2RlLCBodW1hbkxpbWl0OiBWUk1IdW1hbkxpbWl0KSB7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgICB0aGlzLmh1bWFuTGltaXQgPSBodW1hbkxpbWl0O1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogQSBjb21wYXQgZnVuY3Rpb24gZm9yIGBRdWF0ZXJuaW9uLmludmVydCgpYCAvIGBRdWF0ZXJuaW9uLmludmVyc2UoKWAuXG4gKiBgUXVhdGVybmlvbi5pbnZlcnQoKWAgaXMgaW50cm9kdWNlZCBpbiByMTIzIGFuZCBgUXVhdGVybmlvbi5pbnZlcnNlKClgIGVtaXRzIGEgd2FybmluZy5cbiAqIFdlIGFyZSBnb2luZyB0byB1c2UgdGhpcyBjb21wYXQgZm9yIGEgd2hpbGUuXG4gKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IHF1YXRlcm5pb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1YXRJbnZlcnRDb21wYXQ8VCBleHRlbmRzIFRIUkVFLlF1YXRlcm5pb24+KHRhcmdldDogVCk6IFQge1xuICBpZiAoKHRhcmdldCBhcyBhbnkpLmludmVydCkge1xuICAgIHRhcmdldC5pbnZlcnQoKTtcbiAgfSBlbHNlIHtcbiAgICAodGFyZ2V0IGFzIGFueSkuaW52ZXJzZSgpO1xuICB9XG5cbiAgcmV0dXJuIHRhcmdldDtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEZOb2RlLCBSYXdWZWN0b3IzLCBSYXdWZWN0b3I0LCBWUk1Qb3NlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBxdWF0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvcXVhdEludmVydENvbXBhdCc7XG5pbXBvcnQgeyBWUk1IdW1hbkJvbmUgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZSc7XG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVBcnJheSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lQXJyYXknO1xuaW1wb3J0IHsgVlJNSHVtYW5Cb25lcyB9IGZyb20gJy4vVlJNSHVtYW5Cb25lcyc7XG5pbXBvcnQgeyBWUk1IdW1hbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi9WUk1IdW1hbkRlc2NyaXB0aW9uJztcblxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfcXVhdEEgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50cyBodW1hbm9pZCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUh1bWFub2lkIHtcbiAgLyoqXG4gICAqIEEgW1tWUk1IdW1hbkJvbmVzXV0gdGhhdCBjb250YWlucyBhbGwgdGhlIGh1bWFuIGJvbmVzIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGdldCB0aGVzZSBib25lcyB1c2luZyBbW1ZSTUh1bWFub2lkLmdldEJvbmVdXS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbkJvbmVzOiBWUk1IdW1hbkJvbmVzO1xuXG4gIC8qKlxuICAgKiBBIFtbVlJNSHVtYW5EZXNjcmlwdGlvbl1dIHRoYXQgcmVwcmVzZW50cyBwcm9wZXJ0aWVzIG9mIHRoZSBodW1hbm9pZC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbkRlc2NyaXB0aW9uOiBWUk1IdW1hbkRlc2NyaXB0aW9uO1xuXG4gIC8qKlxuICAgKiBBIFtbVlJNUG9zZV1dIHRoYXQgaXMgaXRzIGRlZmF1bHQgc3RhdGUuXG4gICAqIE5vdGUgdGhhdCBpdCdzIG5vdCBjb21wYXRpYmxlIHdpdGggYHNldFBvc2VgIGFuZCBgZ2V0UG9zZWAsIHNpbmNlIGl0IGNvbnRhaW5zIG5vbi1yZWxhdGl2ZSB2YWx1ZXMgb2YgZWFjaCBsb2NhbCB0cmFuc2Zvcm1zLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHJlc3RQb3NlOiBWUk1Qb3NlID0ge307XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBbW1ZSTUh1bWFub2lkXV0uXG4gICAqIEBwYXJhbSBib25lQXJyYXkgQSBbW1ZSTUh1bWFuQm9uZUFycmF5XV0gY29udGFpbnMgYWxsIHRoZSBib25lcyBvZiB0aGUgbmV3IGh1bWFub2lkXG4gICAqIEBwYXJhbSBodW1hbkRlc2NyaXB0aW9uIEEgW1tWUk1IdW1hbkRlc2NyaXB0aW9uXV0gdGhhdCByZXByZXNlbnRzIHByb3BlcnRpZXMgb2YgdGhlIG5ldyBodW1hbm9pZFxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKGJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXksIGh1bWFuRGVzY3JpcHRpb246IFZSTUh1bWFuRGVzY3JpcHRpb24pIHtcbiAgICB0aGlzLmh1bWFuQm9uZXMgPSB0aGlzLl9jcmVhdGVIdW1hbkJvbmVzKGJvbmVBcnJheSk7XG4gICAgdGhpcy5odW1hbkRlc2NyaXB0aW9uID0gaHVtYW5EZXNjcmlwdGlvbjtcblxuICAgIHRoaXMucmVzdFBvc2UgPSB0aGlzLmdldFBvc2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGN1cnJlbnQgcG9zZSBvZiB0aGlzIGh1bWFub2lkIGFzIGEgW1tWUk1Qb3NlXV0uXG4gICAqXG4gICAqIEVhY2ggdHJhbnNmb3JtIGlzIGEgbG9jYWwgdHJhbnNmb3JtIHJlbGF0aXZlIGZyb20gcmVzdCBwb3NlIChULXBvc2UpLlxuICAgKi9cbiAgcHVibGljIGdldFBvc2UoKTogVlJNUG9zZSB7XG4gICAgY29uc3QgcG9zZTogVlJNUG9zZSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHRoaXMuaHVtYW5Cb25lcykuZm9yRWFjaCgodnJtQm9uZU5hbWUpID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKHZybUJvbmVOYW1lIGFzIFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKSE7XG5cbiAgICAgIC8vIElnbm9yZSB3aGVuIHRoZXJlIGFyZSBubyBib25lIG9uIHRoZSBWUk1IdW1hbm9pZFxuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gV2hlbiB0aGVyZSBhcmUgdHdvIG9yIG1vcmUgYm9uZXMgaW4gYSBzYW1lIG5hbWUsIHdlIGFyZSBub3QgZ29pbmcgdG8gb3ZlcndyaXRlIGV4aXN0aW5nIG9uZVxuICAgICAgaWYgKHBvc2VbdnJtQm9uZU5hbWVdKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVGFrZSBhIGRpZmYgZnJvbSByZXN0UG9zZVxuICAgICAgLy8gbm90ZSB0aGF0IHJlc3RQb3NlIGFsc28gd2lsbCB1c2UgZ2V0UG9zZSB0byBpbml0aWFsaXplIGl0c2VsZlxuICAgICAgX3YzQS5zZXQoMCwgMCwgMCk7XG4gICAgICBfcXVhdEEuaWRlbnRpdHkoKTtcblxuICAgICAgY29uc3QgcmVzdFN0YXRlID0gdGhpcy5yZXN0UG9zZVt2cm1Cb25lTmFtZV07XG4gICAgICBpZiAocmVzdFN0YXRlPy5wb3NpdGlvbikge1xuICAgICAgICBfdjNBLmZyb21BcnJheShyZXN0U3RhdGUucG9zaXRpb24pLm5lZ2F0ZSgpO1xuICAgICAgfVxuICAgICAgaWYgKHJlc3RTdGF0ZT8ucm90YXRpb24pIHtcbiAgICAgICAgcXVhdEludmVydENvbXBhdChfcXVhdEEuZnJvbUFycmF5KHJlc3RTdGF0ZS5yb3RhdGlvbikpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgdGhlIHBvc2l0aW9uIC8gcm90YXRpb24gZnJvbSB0aGUgbm9kZVxuICAgICAgX3YzQS5hZGQobm9kZS5wb3NpdGlvbik7XG4gICAgICBfcXVhdEEucHJlbXVsdGlwbHkobm9kZS5xdWF0ZXJuaW9uKTtcblxuICAgICAgcG9zZVt2cm1Cb25lTmFtZV0gPSB7XG4gICAgICAgIHBvc2l0aW9uOiBfdjNBLnRvQXJyYXkoKSBhcyBSYXdWZWN0b3IzLFxuICAgICAgICByb3RhdGlvbjogX3F1YXRBLnRvQXJyYXkoKSBhcyBSYXdWZWN0b3I0LFxuICAgICAgfTtcbiAgICB9LCB7fSBhcyBWUk1Qb3NlKTtcbiAgICByZXR1cm4gcG9zZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMZXQgdGhlIGh1bWFub2lkIGRvIGEgc3BlY2lmaWVkIHBvc2UuXG4gICAqXG4gICAqIEVhY2ggdHJhbnNmb3JtIGhhdmUgdG8gYmUgYSBsb2NhbCB0cmFuc2Zvcm0gcmVsYXRpdmUgZnJvbSByZXN0IHBvc2UgKFQtcG9zZSkuXG4gICAqIFlvdSBjYW4gcGFzcyB3aGF0IHlvdSBnb3QgZnJvbSB7QGxpbmsgZ2V0UG9zZX0uXG4gICAqXG4gICAqIEBwYXJhbSBwb3NlT2JqZWN0IEEgW1tWUk1Qb3NlXV0gdGhhdCByZXByZXNlbnRzIGEgc2luZ2xlIHBvc2VcbiAgICovXG4gIHB1YmxpYyBzZXRQb3NlKHBvc2VPYmplY3Q6IFZSTVBvc2UpOiB2b2lkIHtcbiAgICBPYmplY3Qua2V5cyhwb3NlT2JqZWN0KS5mb3JFYWNoKChib25lTmFtZSkgPT4ge1xuICAgICAgY29uc3Qgc3RhdGUgPSBwb3NlT2JqZWN0W2JvbmVOYW1lXSE7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXRCb25lTm9kZShib25lTmFtZSBhcyBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk7XG5cbiAgICAgIC8vIElnbm9yZSB3aGVuIHRoZXJlIGFyZSBubyBib25lIHRoYXQgaXMgZGVmaW5lZCBpbiB0aGUgcG9zZSBvbiB0aGUgVlJNSHVtYW5vaWRcbiAgICAgIGlmICghbm9kZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3RTdGF0ZSA9IHRoaXMucmVzdFBvc2VbYm9uZU5hbWVdO1xuICAgICAgaWYgKCFyZXN0U3RhdGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdGUucG9zaXRpb24pIHtcbiAgICAgICAgbm9kZS5wb3NpdGlvbi5mcm9tQXJyYXkoc3RhdGUucG9zaXRpb24pO1xuXG4gICAgICAgIGlmIChyZXN0U3RhdGUucG9zaXRpb24pIHtcbiAgICAgICAgICBub2RlLnBvc2l0aW9uLmFkZChfdjNBLmZyb21BcnJheShyZXN0U3RhdGUucG9zaXRpb24pKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdGUucm90YXRpb24pIHtcbiAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLmZyb21BcnJheShzdGF0ZS5yb3RhdGlvbik7XG5cbiAgICAgICAgaWYgKHJlc3RTdGF0ZS5yb3RhdGlvbikge1xuICAgICAgICAgIG5vZGUucXVhdGVybmlvbi5tdWx0aXBseShfcXVhdEEuZnJvbUFycmF5KHJlc3RTdGF0ZS5yb3RhdGlvbikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgdGhlIGh1bWFub2lkIHRvIGl0cyByZXN0IHBvc2UuXG4gICAqL1xuICBwdWJsaWMgcmVzZXRQb3NlKCk6IHZvaWQge1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMucmVzdFBvc2UpLmZvckVhY2goKFtib25lTmFtZSwgcmVzdF0pID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKGJvbmVOYW1lIGFzIFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTtcblxuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3Q/LnBvc2l0aW9uKSB7XG4gICAgICAgIG5vZGUucG9zaXRpb24uZnJvbUFycmF5KHJlc3QucG9zaXRpb24pO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdD8ucm90YXRpb24pIHtcbiAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLmZyb21BcnJheShyZXN0LnJvdGF0aW9uKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBib25lIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGEgW1tWUk1IdW1hbkJvbmVdXS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZXNdXVxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XG4gICAqL1xuICBwdWJsaWMgZ2V0Qm9uZShuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IFZSTUh1bWFuQm9uZSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXVswXSA/PyB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGJvbmVzIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGFuIGFycmF5IG9mIFtbVlJNSHVtYW5Cb25lXV0uXG4gICAqIElmIHRoZXJlIGFyZSBubyBib25lcyBib3VuZCB0byB0aGUgc3BlY2lmaWVkIEh1bWFuQm9uZSwgaXQgd2lsbCByZXR1cm4gYW4gZW1wdHkgYXJyYXkuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBbW1ZSTUh1bWFub2lkLmdldEJvbmVdXVxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XG4gICAqL1xuICBwdWJsaWMgZ2V0Qm9uZXMobmFtZTogVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpOiBWUk1IdW1hbkJvbmVbXSB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXSA/PyBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBib25lIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGEgVEhSRUUuT2JqZWN0M0QuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBbW1ZSTUh1bWFub2lkLmdldEJvbmVOb2Rlc11dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lTm9kZShuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IEdMVEZOb2RlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXVswXT8ubm9kZSA/PyBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBib25lcyBib3VuZCB0byBhIHNwZWNpZmllZCBbW0h1bWFuQm9uZV1dLCBhcyBhbiBhcnJheSBvZiBUSFJFRS5PYmplY3QzRC5cbiAgICogSWYgdGhlcmUgYXJlIG5vIGJvbmVzIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgSHVtYW5Cb25lLCBpdCB3aWxsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZU5vZGVdXVxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XG4gICAqL1xuICBwdWJsaWMgZ2V0Qm9uZU5vZGVzKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogR0xURk5vZGVbXSB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXT8ubWFwKChib25lKSA9PiBib25lLm5vZGUpID8/IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmUgYSBbW1ZSTUh1bWFuQm9uZXNdXSBmcm9tIGEgW1tWUk1IdW1hbkJvbmVBcnJheV1dLlxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRlSHVtYW5Cb25lcyhib25lQXJyYXk6IFZSTUh1bWFuQm9uZUFycmF5KTogVlJNSHVtYW5Cb25lcyB7XG4gICAgY29uc3QgYm9uZXM6IFZSTUh1bWFuQm9uZXMgPSBPYmplY3QudmFsdWVzKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKS5yZWR1Y2UoKGFjY3VtLCBuYW1lKSA9PiB7XG4gICAgICBhY2N1bVtuYW1lXSA9IFtdO1xuICAgICAgcmV0dXJuIGFjY3VtO1xuICAgIH0sIHt9IGFzIFBhcnRpYWw8VlJNSHVtYW5Cb25lcz4pIGFzIFZSTUh1bWFuQm9uZXM7XG5cbiAgICBib25lQXJyYXkuZm9yRWFjaCgoYm9uZSkgPT4ge1xuICAgICAgYm9uZXNbYm9uZS5uYW1lXS5wdXNoKGJvbmUuYm9uZSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYm9uZXM7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lJztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZUFycmF5IH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVBcnJheSc7XG5pbXBvcnQgeyBWUk1IdW1hbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi9WUk1IdW1hbkRlc2NyaXB0aW9uJztcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi9WUk1IdW1hbm9pZCc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1IdW1hbm9pZF1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUh1bWFub2lkSW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1IdW1hbm9pZF1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1IdW1hbm9pZCB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hSHVtYW5vaWQ6IFZSTVNjaGVtYS5IdW1hbm9pZCB8IHVuZGVmaW5lZCA9IHZybUV4dC5odW1hbm9pZDtcbiAgICBpZiAoIXNjaGVtYUh1bWFub2lkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBodW1hbkJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXkgPSBbXTtcbiAgICBpZiAoc2NoZW1hSHVtYW5vaWQuaHVtYW5Cb25lcykge1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgIHNjaGVtYUh1bWFub2lkLmh1bWFuQm9uZXMubWFwKGFzeW5jIChib25lKSA9PiB7XG4gICAgICAgICAgaWYgKCFib25lLmJvbmUgfHwgYm9uZS5ub2RlID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBub2RlID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIGJvbmUubm9kZSk7XG4gICAgICAgICAgaHVtYW5Cb25lQXJyYXkucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBib25lLmJvbmUsXG4gICAgICAgICAgICBib25lOiBuZXcgVlJNSHVtYW5Cb25lKG5vZGUsIHtcbiAgICAgICAgICAgICAgYXhpc0xlbmd0aDogYm9uZS5heGlzTGVuZ3RoLFxuICAgICAgICAgICAgICBjZW50ZXI6IGJvbmUuY2VudGVyICYmIG5ldyBUSFJFRS5WZWN0b3IzKGJvbmUuY2VudGVyLngsIGJvbmUuY2VudGVyLnksIGJvbmUuY2VudGVyLnopLFxuICAgICAgICAgICAgICBtYXg6IGJvbmUubWF4ICYmIG5ldyBUSFJFRS5WZWN0b3IzKGJvbmUubWF4LngsIGJvbmUubWF4LnksIGJvbmUubWF4LnopLFxuICAgICAgICAgICAgICBtaW46IGJvbmUubWluICYmIG5ldyBUSFJFRS5WZWN0b3IzKGJvbmUubWluLngsIGJvbmUubWluLnksIGJvbmUubWluLnopLFxuICAgICAgICAgICAgICB1c2VEZWZhdWx0VmFsdWVzOiBib25lLnVzZURlZmF1bHRWYWx1ZXMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGh1bWFuRGVzY3JpcHRpb246IFZSTUh1bWFuRGVzY3JpcHRpb24gPSB7XG4gICAgICBhcm1TdHJldGNoOiBzY2hlbWFIdW1hbm9pZC5hcm1TdHJldGNoLFxuICAgICAgbGVnU3RyZXRjaDogc2NoZW1hSHVtYW5vaWQubGVnU3RyZXRjaCxcbiAgICAgIHVwcGVyQXJtVHdpc3Q6IHNjaGVtYUh1bWFub2lkLnVwcGVyQXJtVHdpc3QsXG4gICAgICBsb3dlckFybVR3aXN0OiBzY2hlbWFIdW1hbm9pZC5sb3dlckFybVR3aXN0LFxuICAgICAgdXBwZXJMZWdUd2lzdDogc2NoZW1hSHVtYW5vaWQudXBwZXJMZWdUd2lzdCxcbiAgICAgIGxvd2VyTGVnVHdpc3Q6IHNjaGVtYUh1bWFub2lkLmxvd2VyTGVnVHdpc3QsXG4gICAgICBmZWV0U3BhY2luZzogc2NoZW1hSHVtYW5vaWQuZmVldFNwYWNpbmcsXG4gICAgICBoYXNUcmFuc2xhdGlvbkRvRjogc2NoZW1hSHVtYW5vaWQuaGFzVHJhbnNsYXRpb25Eb0YsXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgVlJNSHVtYW5vaWQoaHVtYW5Cb25lQXJyYXksIGh1bWFuRGVzY3JpcHRpb24pO1xuICB9XG59XG4iLCIvKipcbiAqIEV2YWx1YXRlIGEgaGVybWl0ZSBzcGxpbmUuXG4gKlxuICogQHBhcmFtIHkwIHkgb24gc3RhcnRcbiAqIEBwYXJhbSB5MSB5IG9uIGVuZFxuICogQHBhcmFtIHQwIGRlbHRhIHkgb24gc3RhcnRcbiAqIEBwYXJhbSB0MSBkZWx0YSB5IG9uIGVuZFxuICogQHBhcmFtIHggaW5wdXQgdmFsdWVcbiAqL1xuY29uc3QgaGVybWl0ZVNwbGluZSA9ICh5MDogbnVtYmVyLCB5MTogbnVtYmVyLCB0MDogbnVtYmVyLCB0MTogbnVtYmVyLCB4OiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICBjb25zdCB4YyA9IHggKiB4ICogeDtcbiAgY29uc3QgeHMgPSB4ICogeDtcbiAgY29uc3QgZHkgPSB5MSAtIHkwO1xuICBjb25zdCBoMDEgPSAtMi4wICogeGMgKyAzLjAgKiB4cztcbiAgY29uc3QgaDEwID0geGMgLSAyLjAgKiB4cyArIHg7XG4gIGNvbnN0IGgxMSA9IHhjIC0geHM7XG4gIHJldHVybiB5MCArIGR5ICogaDAxICsgdDAgKiBoMTAgKyB0MSAqIGgxMTtcbn07XG5cbi8qKlxuICogRXZhbHVhdGUgYW4gQW5pbWF0aW9uQ3VydmUgYXJyYXkuIFNlZSBBbmltYXRpb25DdXJ2ZSBjbGFzcyBvZiBVbml0eSBmb3IgaXRzIGRldGFpbHMuXG4gKlxuICogU2VlOiBodHRwczovL2RvY3MudW5pdHkzZC5jb20vamEvY3VycmVudC9TY3JpcHRSZWZlcmVuY2UvQW5pbWF0aW9uQ3VydmUuaHRtbFxuICpcbiAqIEBwYXJhbSBhcnIgQW4gYXJyYXkgcmVwcmVzZW50cyBhIGN1cnZlXG4gKiBAcGFyYW0geCBBbiBpbnB1dCB2YWx1ZVxuICovXG5jb25zdCBldmFsdWF0ZUN1cnZlID0gKGFycjogbnVtYmVyW10sIHg6IG51bWJlcik6IG51bWJlciA9PiB7XG4gIC8vIC0tIHNhbml0eSBjaGVjayAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBpZiAoYXJyLmxlbmd0aCA8IDgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2V2YWx1YXRlQ3VydmU6IEludmFsaWQgY3VydmUgZGV0ZWN0ZWQhIChBcnJheSBsZW5ndGggbXVzdCBiZSA4IGF0IGxlYXN0KScpO1xuICB9XG4gIGlmIChhcnIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZXZhbHVhdGVDdXJ2ZTogSW52YWxpZCBjdXJ2ZSBkZXRlY3RlZCEgKEFycmF5IGxlbmd0aCBtdXN0IGJlIG11bHRpcGxlcyBvZiA0Jyk7XG4gIH1cblxuICAvLyAtLSBjaGVjayByYW5nZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgbGV0IG91dE5vZGU7XG4gIGZvciAob3V0Tm9kZSA9IDA7IDsgb3V0Tm9kZSsrKSB7XG4gICAgaWYgKGFyci5sZW5ndGggPD0gNCAqIG91dE5vZGUpIHtcbiAgICAgIHJldHVybiBhcnJbNCAqIG91dE5vZGUgLSAzXTsgLy8gdG9vIGZ1cnRoZXIhISBhc3N1bWUgYXMgXCJDbGFtcFwiXG4gICAgfSBlbHNlIGlmICh4IDw9IGFycls0ICogb3V0Tm9kZV0pIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGluTm9kZSA9IG91dE5vZGUgLSAxO1xuICBpZiAoaW5Ob2RlIDwgMCkge1xuICAgIHJldHVybiBhcnJbNCAqIGluTm9kZSArIDVdOyAvLyB0b28gYmVoaW5kISEgYXNzdW1lIGFzIFwiQ2xhbXBcIlxuICB9XG5cbiAgLy8gLS0gY2FsY3VsYXRlIGxvY2FsIHggLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGNvbnN0IHgwID0gYXJyWzQgKiBpbk5vZGVdO1xuICBjb25zdCB4MSA9IGFycls0ICogb3V0Tm9kZV07XG4gIGNvbnN0IHhIZXJtaXRlID0gKHggLSB4MCkgLyAoeDEgLSB4MCk7XG5cbiAgLy8gLS0gZmluYWxseSBkbyB0aGUgaGVybWl0ZSBzcGxpbmUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGNvbnN0IHkwID0gYXJyWzQgKiBpbk5vZGUgKyAxXTtcbiAgY29uc3QgeTEgPSBhcnJbNCAqIG91dE5vZGUgKyAxXTtcbiAgY29uc3QgdDAgPSBhcnJbNCAqIGluTm9kZSArIDNdO1xuICBjb25zdCB0MSA9IGFycls0ICogb3V0Tm9kZSArIDJdO1xuICByZXR1cm4gaGVybWl0ZVNwbGluZSh5MCwgeTEsIHQwLCB0MSwgeEhlcm1pdGUpO1xufTtcblxuLyoqXG4gKiBUaGlzIGlzIGFuIGVxdWl2YWxlbnQgb2YgQ3VydmVNYXBwZXIgY2xhc3MgZGVmaW5lZCBpbiBVbmlWUk0uXG4gKiBXaWxsIGJlIHVzZWQgZm9yIFtbVlJNTG9va0F0QXBwbHllcl1dcywgdG8gZGVmaW5lIGJlaGF2aW9yIG9mIExvb2tBdC5cbiAqXG4gKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9Mb29rQXQvQ3VydmVNYXBwZXIuY3NcbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUN1cnZlTWFwcGVyIHtcbiAgLyoqXG4gICAqIEFuIGFycmF5IHJlcHJlc2VudHMgdGhlIGN1cnZlLiBTZWUgQW5pbWF0aW9uQ3VydmUgY2xhc3Mgb2YgVW5pdHkgZm9yIGl0cyBkZXRhaWxzLlxuICAgKlxuICAgKiBTZWU6IGh0dHBzOi8vZG9jcy51bml0eTNkLmNvbS9qYS9jdXJyZW50L1NjcmlwdFJlZmVyZW5jZS9BbmltYXRpb25DdXJ2ZS5odG1sXG4gICAqL1xuICBwdWJsaWMgY3VydmU6IG51bWJlcltdID0gWzAuMCwgMC4wLCAwLjAsIDEuMCwgMS4wLCAxLjAsIDEuMCwgMC4wXTtcblxuICAvKipcbiAgICogVGhlIG1heGltdW0gaW5wdXQgcmFuZ2Ugb2YgdGhlIFtbVlJNQ3VydmVNYXBwZXJdXS5cbiAgICovXG4gIHB1YmxpYyBjdXJ2ZVhSYW5nZURlZ3JlZSA9IDkwLjA7XG5cbiAgLyoqXG4gICAqIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZSBvZiB0aGUgW1tWUk1DdXJ2ZU1hcHBlcl1dLlxuICAgKi9cbiAgcHVibGljIGN1cnZlWVJhbmdlRGVncmVlID0gMTAuMDtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNQ3VydmVNYXBwZXJdXS5cbiAgICpcbiAgICogQHBhcmFtIHhSYW5nZSBUaGUgbWF4aW11bSBpbnB1dCByYW5nZVxuICAgKiBAcGFyYW0geVJhbmdlIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZVxuICAgKiBAcGFyYW0gY3VydmUgQW4gYXJyYXkgcmVwcmVzZW50cyB0aGUgY3VydmVcbiAgICovXG4gIGNvbnN0cnVjdG9yKHhSYW5nZT86IG51bWJlciwgeVJhbmdlPzogbnVtYmVyLCBjdXJ2ZT86IG51bWJlcltdKSB7XG4gICAgaWYgKHhSYW5nZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmN1cnZlWFJhbmdlRGVncmVlID0geFJhbmdlO1xuICAgIH1cblxuICAgIGlmICh5UmFuZ2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jdXJ2ZVlSYW5nZURlZ3JlZSA9IHlSYW5nZTtcbiAgICB9XG5cbiAgICBpZiAoY3VydmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jdXJ2ZSA9IGN1cnZlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFdmFsdWF0ZSBhbiBpbnB1dCB2YWx1ZSBhbmQgb3V0cHV0IGEgbWFwcGVkIHZhbHVlLlxuICAgKlxuICAgKiBAcGFyYW0gc3JjIFRoZSBpbnB1dCB2YWx1ZVxuICAgKi9cbiAgcHVibGljIG1hcChzcmM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgY2xhbXBlZFNyYyA9IE1hdGgubWluKE1hdGgubWF4KHNyYywgMC4wKSwgdGhpcy5jdXJ2ZVhSYW5nZURlZ3JlZSk7XG4gICAgY29uc3QgeCA9IGNsYW1wZWRTcmMgLyB0aGlzLmN1cnZlWFJhbmdlRGVncmVlO1xuICAgIHJldHVybiB0aGlzLmN1cnZlWVJhbmdlRGVncmVlICogZXZhbHVhdGVDdXJ2ZSh0aGlzLmN1cnZlLCB4KTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgdXNlZCBieSBbW1ZSTUxvb2tBdEhlYWRdXSwgYXBwbGllcyBsb29rIGF0IGRpcmVjdGlvbi5cbiAqIFRoZXJlIGFyZSBjdXJyZW50bHkgdHdvIHZhcmlhbnQgb2YgYXBwbGllcjogW1tWUk1Mb29rQXRCb25lQXBwbHllcl1dIGFuZCBbW1ZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyXV0uXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBWUk1Mb29rQXRBcHBseWVyIHtcbiAgLyoqXG4gICAqIEl0IHJlcHJlc2VudHMgaXRzIHR5cGUgb2YgYXBwbGllci5cbiAgICovXG4gIHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSB0eXBlOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZTtcblxuICAvKipcbiAgICogQXBwbHkgbG9vayBhdCBkaXJlY3Rpb24gdG8gaXRzIGFzc29jaWF0ZWQgVlJNIG1vZGVsLlxuICAgKlxuICAgKiBAcGFyYW0gZXVsZXIgYFRIUkVFLkV1bGVyYCBvYmplY3QgdGhhdCByZXByZXNlbnRzIHRoZSBsb29rIGF0IGRpcmVjdGlvblxuICAgKi9cbiAgcHVibGljIGFic3RyYWN0IGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkO1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNQmxlbmRTaGFwZVByb3h5IH0gZnJvbSAnLi4vYmxlbmRzaGFwZSc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpcyB1c2VkIGJ5IFtbVlJNTG9va0F0SGVhZF1dLCBhcHBsaWVzIGxvb2sgYXQgZGlyZWN0aW9uIHRvIGV5ZSBibGVuZCBzaGFwZXMgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllciBleHRlbmRzIFZSTUxvb2tBdEFwcGx5ZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJsZW5kU2hhcGU7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVIb3Jpem9udGFsOiBWUk1DdXJ2ZU1hcHBlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbERvd246IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX2JsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIuXG4gICAqXG4gICAqIEBwYXJhbSBibGVuZFNoYXBlUHJveHkgQSBbW1ZSTUJsZW5kU2hhcGVQcm94eV1dIHVzZWQgYnkgdGhpcyBhcHBsaWVyXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWwgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdHJhbnN2ZXJzZSBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxEb3duIEEgW1tWUk1DdXJ2ZU1hcHBlcl1dIHVzZWQgZm9yIGRvd24gZGlyZWN0aW9uXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsVXAgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdXAgZGlyZWN0aW9uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBjdXJ2ZUhvcml6b250YWw6IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlVmVydGljYWxEb3duOiBWUk1DdXJ2ZU1hcHBlcixcbiAgICBjdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyLFxuICApIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5fY3VydmVIb3Jpem9udGFsID0gY3VydmVIb3Jpem9udGFsO1xuICAgIHRoaXMuX2N1cnZlVmVydGljYWxEb3duID0gY3VydmVWZXJ0aWNhbERvd247XG4gICAgdGhpcy5fY3VydmVWZXJ0aWNhbFVwID0gY3VydmVWZXJ0aWNhbFVwO1xuXG4gICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5ID0gYmxlbmRTaGFwZVByb3h5O1xuICB9XG5cbiAgcHVibGljIG5hbWUoKTogVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUge1xuICAgIHJldHVybiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZS5CbGVuZFNoYXBlO1xuICB9XG5cbiAgcHVibGljIGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkIHtcbiAgICBjb25zdCBzcmNYID0gZXVsZXIueDtcbiAgICBjb25zdCBzcmNZID0gZXVsZXIueTtcblxuICAgIGlmIChzcmNYIDwgMC4wKSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2t1cCwgMC4wKTtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2Rvd24sIHRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tkb3duLCAwLjApO1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rdXAsIHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCkpO1xuICAgIH1cblxuICAgIGlmIChzcmNZIDwgMC4wKSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tsZWZ0LCAwLjApO1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rcmlnaHQsIHRoaXMuX2N1cnZlSG9yaXpvbnRhbC5tYXAoLXNyY1kpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rcmlnaHQsIDAuMCk7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tsZWZ0LCB0aGlzLl9jdXJ2ZUhvcml6b250YWwubWFwKHNyY1kpKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi4vZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb24nO1xuaW1wb3J0IHsgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSB9IGZyb20gJy4uL3V0aWxzL21hdGgnO1xuaW1wb3J0IHsgcXVhdEludmVydENvbXBhdCB9IGZyb20gJy4uL3V0aWxzL3F1YXRJbnZlcnRDb21wYXQnO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5cbmNvbnN0IFZFQ1RPUjNfRlJPTlQgPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAtMS4wKSk7XG5cbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3YzQiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNDID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF9xdWF0ID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgbG9vayBhdCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEhlYWQge1xuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IEVVTEVSX09SREVSID0gJ1lYWic7IC8vIHlhdy1waXRjaC1yb2xsXG5cbiAgLyoqXG4gICAqIEFzc29jaWF0ZWQgW1tWUk1GaXJzdFBlcnNvbl1dLCB3aWxsIGJlIHVzZWQgZm9yIGRpcmVjdGlvbiBjYWxjdWxhdGlvbi5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBmaXJzdFBlcnNvbjogVlJNRmlyc3RQZXJzb247XG5cbiAgLyoqXG4gICAqIEFzc29jaWF0ZWQgW1tWUk1Mb29rQXRBcHBseWVyXV0sIGl0cyBsb29rIGF0IGRpcmVjdGlvbiB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIG1vZGVsIHVzaW5nIHRoaXMgYXBwbGllci5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBhcHBseWVyPzogVlJNTG9va0F0QXBwbHllcjtcblxuICAvKipcbiAgICogSWYgdGhpcyBpcyB0cnVlLCBpdHMgbG9vayBhdCBkaXJlY3Rpb24gd2lsbCBiZSB1cGRhdGVkIGF1dG9tYXRpY2FsbHkgYnkgY2FsbGluZyBbW1ZSTUxvb2tBdEhlYWQudXBkYXRlXV0gKHdoaWNoIGlzIGNhbGxlZCBmcm9tIFtbVlJNLnVwZGF0ZV1dKS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNTG9va0F0SGVhZC50YXJnZXRdXVxuICAgKi9cbiAgcHVibGljIGF1dG9VcGRhdGUgPSB0cnVlO1xuXG4gIC8qKlxuICAgKiBUaGUgdGFyZ2V0IG9iamVjdCBvZiB0aGUgbG9vayBhdC5cbiAgICogTm90ZSB0aGF0IGl0IGRvZXMgbm90IG1ha2UgYW55IHNlbnNlIGlmIFtbVlJNTG9va0F0SGVhZC5hdXRvVXBkYXRlXV0gaXMgZGlzYWJsZWQuXG4gICAqL1xuICBwdWJsaWMgdGFyZ2V0PzogVEhSRUUuT2JqZWN0M0Q7XG5cbiAgcHJvdGVjdGVkIF9ldWxlcjogVEhSRUUuRXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoMC4wLCAwLjAsIDAuMCwgVlJNTG9va0F0SGVhZC5FVUxFUl9PUkRFUik7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRIZWFkLlxuICAgKlxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb24gQSBbW1ZSTUZpcnN0UGVyc29uXV0gdGhhdCB3aWxsIGJlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG5ldyBWUk1Mb29rQXRIZWFkXG4gICAqIEBwYXJhbSBhcHBseWVyIEEgW1tWUk1Mb29rQXRBcHBseWVyXV0gdGhhdCB3aWxsIGJlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG5ldyBWUk1Mb29rQXRIZWFkXG4gICAqL1xuICBjb25zdHJ1Y3RvcihmaXJzdFBlcnNvbjogVlJNRmlyc3RQZXJzb24sIGFwcGx5ZXI/OiBWUk1Mb29rQXRBcHBseWVyKSB7XG4gICAgdGhpcy5maXJzdFBlcnNvbiA9IGZpcnN0UGVyc29uO1xuICAgIHRoaXMuYXBwbHllciA9IGFwcGx5ZXI7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGl0cyBsb29rIGF0IGRpcmVjdGlvbiBpbiB3b3JsZCBjb29yZGluYXRlLlxuICAgKlxuICAgKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IGBUSFJFRS5WZWN0b3IzYFxuICAgKi9cbiAgcHVibGljIGdldExvb2tBdFdvcmxkRGlyZWN0aW9uKHRhcmdldDogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xuICAgIGNvbnN0IHJvdCA9IGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5maXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmUsIF9xdWF0KTtcbiAgICByZXR1cm4gdGFyZ2V0LmNvcHkoVkVDVE9SM19GUk9OVCkuYXBwbHlFdWxlcih0aGlzLl9ldWxlcikuYXBwbHlRdWF0ZXJuaW9uKHJvdCk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IGl0cyBsb29rIGF0IHBvc2l0aW9uLlxuICAgKiBOb3RlIHRoYXQgaXRzIHJlc3VsdCB3aWxsIGJlIGluc3RhbnRseSBvdmVyd3JpdHRlbiBpZiBbW1ZSTUxvb2tBdEhlYWQuYXV0b1VwZGF0ZV1dIGlzIGVuYWJsZWQuXG4gICAqXG4gICAqIEBwYXJhbSBwb3NpdGlvbiBBIHRhcmdldCBwb3NpdGlvblxuICAgKi9cbiAgcHVibGljIGxvb2tBdChwb3NpdGlvbjogVEhSRUUuVmVjdG9yMyk6IHZvaWQge1xuICAgIHRoaXMuX2NhbGNFdWxlcih0aGlzLl9ldWxlciwgcG9zaXRpb24pO1xuXG4gICAgaWYgKHRoaXMuYXBwbHllcikge1xuICAgICAgdGhpcy5hcHBseWVyLmxvb2tBdCh0aGlzLl9ldWxlcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgVlJNTG9va0F0SGVhZC5cbiAgICogSWYgW1tWUk1Mb29rQXRIZWFkLmF1dG9VcGRhdGVdXSBpcyBkaXNhYmxlZCwgaXQgd2lsbCBkbyBub3RoaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAodGhpcy50YXJnZXQgJiYgdGhpcy5hdXRvVXBkYXRlKSB7XG4gICAgICB0aGlzLmxvb2tBdCh0aGlzLnRhcmdldC5nZXRXb3JsZFBvc2l0aW9uKF92M0EpKTtcblxuICAgICAgaWYgKHRoaXMuYXBwbHllcikge1xuICAgICAgICB0aGlzLmFwcGx5ZXIubG9va0F0KHRoaXMuX2V1bGVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NhbGNFdWxlcih0YXJnZXQ6IFRIUkVFLkV1bGVyLCBwb3NpdGlvbjogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLkV1bGVyIHtcbiAgICBjb25zdCBoZWFkUG9zaXRpb24gPSB0aGlzLmZpcnN0UGVyc29uLmdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbihfdjNCKTtcblxuICAgIC8vIExvb2sgYXQgZGlyZWN0aW9uIGluIHdvcmxkIGNvb3JkaW5hdGVcbiAgICBjb25zdCBsb29rQXREaXIgPSBfdjNDLmNvcHkocG9zaXRpb24pLnN1YihoZWFkUG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuXG4gICAgLy8gVHJhbnNmb3JtIHRoZSBkaXJlY3Rpb24gaW50byBsb2NhbCBjb29yZGluYXRlIGZyb20gdGhlIGZpcnN0IHBlcnNvbiBib25lXG4gICAgbG9va0F0RGlyLmFwcGx5UXVhdGVybmlvbihxdWF0SW52ZXJ0Q29tcGF0KGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5maXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmUsIF9xdWF0KSkpO1xuXG4gICAgLy8gY29udmVydCB0aGUgZGlyZWN0aW9uIGludG8gZXVsZXJcbiAgICB0YXJnZXQueCA9IE1hdGguYXRhbjIobG9va0F0RGlyLnksIE1hdGguc3FydChsb29rQXREaXIueCAqIGxvb2tBdERpci54ICsgbG9va0F0RGlyLnogKiBsb29rQXREaXIueikpO1xuICAgIHRhcmdldC55ID0gTWF0aC5hdGFuMigtbG9va0F0RGlyLngsIC1sb29rQXREaXIueik7XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IEdMVEZOb2RlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkJztcblxuY29uc3QgX2V1bGVyID0gbmV3IFRIUkVFLkV1bGVyKDAuMCwgMC4wLCAwLjAsIFZSTUxvb2tBdEhlYWQuRVVMRVJfT1JERVIpO1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgdXNlZCBieSBbW1ZSTUxvb2tBdEhlYWRdXSwgYXBwbGllcyBsb29rIGF0IGRpcmVjdGlvbiB0byBleWUgYm9uZXMgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRCb25lQXBwbHllciBleHRlbmRzIFZSTUxvb2tBdEFwcGx5ZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJvbmU7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVIb3Jpem9udGFsSW5uZXI6IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZUhvcml6b250YWxPdXRlcjogVlJNQ3VydmVNYXBwZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnZlVmVydGljYWxEb3duOiBWUk1DdXJ2ZU1hcHBlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbFVwOiBWUk1DdXJ2ZU1hcHBlcjtcblxuICBwcml2YXRlIHJlYWRvbmx5IF9sZWZ0RXllOiBHTFRGTm9kZSB8IG51bGw7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3JpZ2h0RXllOiBHTFRGTm9kZSB8IG51bGw7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRCb25lQXBwbHllci5cbiAgICpcbiAgICogQHBhcmFtIGh1bWFub2lkIEEgW1tWUk1IdW1hbm9pZF1dIHVzZWQgYnkgdGhpcyBhcHBsaWVyXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWxJbm5lciBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBpbm5lciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxuICAgKiBAcGFyYW0gY3VydmVIb3Jpem9udGFsT3V0ZXIgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3Igb3V0ZXIgdHJhbnN2ZXJzZSBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxEb3duIEEgW1tWUk1DdXJ2ZU1hcHBlcl1dIHVzZWQgZm9yIGRvd24gZGlyZWN0aW9uXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsVXAgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdXAgZGlyZWN0aW9uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICAgY3VydmVIb3Jpem9udGFsSW5uZXI6IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlSG9yaXpvbnRhbE91dGVyOiBWUk1DdXJ2ZU1hcHBlcixcbiAgICBjdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXIsXG4gICAgY3VydmVWZXJ0aWNhbFVwOiBWUk1DdXJ2ZU1hcHBlcixcbiAgKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyID0gY3VydmVIb3Jpem9udGFsSW5uZXI7XG4gICAgdGhpcy5fY3VydmVIb3Jpem9udGFsT3V0ZXIgPSBjdXJ2ZUhvcml6b250YWxPdXRlcjtcbiAgICB0aGlzLl9jdXJ2ZVZlcnRpY2FsRG93biA9IGN1cnZlVmVydGljYWxEb3duO1xuICAgIHRoaXMuX2N1cnZlVmVydGljYWxVcCA9IGN1cnZlVmVydGljYWxVcDtcblxuICAgIHRoaXMuX2xlZnRFeWUgPSBodW1hbm9pZC5nZXRCb25lTm9kZShWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZS5MZWZ0RXllKTtcbiAgICB0aGlzLl9yaWdodEV5ZSA9IGh1bWFub2lkLmdldEJvbmVOb2RlKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lLlJpZ2h0RXllKTtcbiAgfVxuXG4gIHB1YmxpYyBsb29rQXQoZXVsZXI6IFRIUkVFLkV1bGVyKTogdm9pZCB7XG4gICAgY29uc3Qgc3JjWCA9IGV1bGVyLng7XG4gICAgY29uc3Qgc3JjWSA9IGV1bGVyLnk7XG5cbiAgICAvLyBsZWZ0XG4gICAgaWYgKHRoaXMuX2xlZnRFeWUpIHtcbiAgICAgIGlmIChzcmNYIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci54ID0gLXRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueCA9IHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzcmNZIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci55ID0gLXRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyLm1hcCgtc3JjWSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueSA9IHRoaXMuX2N1cnZlSG9yaXpvbnRhbE91dGVyLm1hcChzcmNZKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fbGVmdEV5ZS5xdWF0ZXJuaW9uLnNldEZyb21FdWxlcihfZXVsZXIpO1xuICAgIH1cblxuICAgIC8vIHJpZ2h0XG4gICAgaWYgKHRoaXMuX3JpZ2h0RXllKSB7XG4gICAgICBpZiAoc3JjWCA8IDAuMCkge1xuICAgICAgICBfZXVsZXIueCA9IC10aGlzLl9jdXJ2ZVZlcnRpY2FsRG93bi5tYXAoLXNyY1gpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX2V1bGVyLnggPSB0aGlzLl9jdXJ2ZVZlcnRpY2FsVXAubWFwKHNyY1gpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3JjWSA8IDAuMCkge1xuICAgICAgICBfZXVsZXIueSA9IC10aGlzLl9jdXJ2ZUhvcml6b250YWxPdXRlci5tYXAoLXNyY1kpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX2V1bGVyLnkgPSB0aGlzLl9jdXJ2ZUhvcml6b250YWxJbm5lci5tYXAoc3JjWSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3JpZ2h0RXllLnF1YXRlcm5pb24uc2V0RnJvbUV1bGVyKF9ldWxlcik7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi4vZmlyc3RwZXJzb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZCc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0Qm9uZUFwcGx5ZXIgfSBmcm9tICcuL1ZSTUxvb2tBdEJvbmVBcHBseWVyJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWQnO1xuXG4vLyBUSFJFRS5NYXRoIGhhcyBiZWVuIHJlbmFtZWQgdG8gVEhSRUUuTWF0aFV0aWxzIHNpbmNlIHIxMTMuXG4vLyBXZSBhcmUgZ29pbmcgdG8gZGVmaW5lIHRoZSBERUcyUkFEIGJ5IG91cnNlbHZlcyBmb3IgYSB3aGlsZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzE4MjcwXG5jb25zdCBERUcyUkFEID0gTWF0aC5QSSAvIDE4MDsgLy8gVEhSRUUuTWF0aFV0aWxzLkRFRzJSQUQ7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1Mb29rQXRIZWFkXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1Mb29rQXRIZWFkXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBibGVuZFNoYXBlUHJveHkgQSBbW1ZSTUJsZW5kU2hhcGVQcm94eV1dIGluc3RhbmNlIHRoYXQgcmVwcmVzZW50cyB0aGUgVlJNXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIFtbVlJNSHVtYW5vaWRdXSBpbnN0YW5jZSB0aGF0IHJlcHJlc2VudHMgdGhlIFZSTVxuICAgKi9cbiAgcHVibGljIGltcG9ydChcbiAgICBnbHRmOiBHTFRGLFxuICAgIGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbixcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICk6IFZSTUxvb2tBdEhlYWQgfCBudWxsIHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5maXJzdFBlcnNvbjtcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBhcHBseWVyID0gdGhpcy5faW1wb3J0QXBwbHllcihzY2hlbWFGaXJzdFBlcnNvbiwgYmxlbmRTaGFwZVByb3h5LCBodW1hbm9pZCk7XG4gICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRIZWFkKGZpcnN0UGVyc29uLCBhcHBseWVyIHx8IHVuZGVmaW5lZCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2ltcG9ydEFwcGx5ZXIoXG4gICAgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbixcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICk6IFZSTUxvb2tBdEFwcGx5ZXIgfCBudWxsIHtcbiAgICBjb25zdCBsb29rQXRIb3Jpem9udGFsSW5uZXIgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRIb3Jpem9udGFsSW5uZXI7XG4gICAgY29uc3QgbG9va0F0SG9yaXpvbnRhbE91dGVyID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0SG9yaXpvbnRhbE91dGVyO1xuICAgIGNvbnN0IGxvb2tBdFZlcnRpY2FsRG93biA9IHNjaGVtYUZpcnN0UGVyc29uLmxvb2tBdFZlcnRpY2FsRG93bjtcbiAgICBjb25zdCBsb29rQXRWZXJ0aWNhbFVwID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VmVydGljYWxVcDtcblxuICAgIHN3aXRjaCAoc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VHlwZU5hbWUpIHtcbiAgICAgIGNhc2UgVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQm9uZToge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgbG9va0F0SG9yaXpvbnRhbElubmVyID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBsb29rQXRIb3Jpem9udGFsT3V0ZXIgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGxvb2tBdFZlcnRpY2FsRG93biA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgbG9va0F0VmVydGljYWxVcCA9PT0gdW5kZWZpbmVkXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgVlJNTG9va0F0Qm9uZUFwcGx5ZXIoXG4gICAgICAgICAgICBodW1hbm9pZCxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQm9uZShsb29rQXRIb3Jpem9udGFsSW5uZXIpLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCb25lKGxvb2tBdEhvcml6b250YWxPdXRlciksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobG9va0F0VmVydGljYWxEb3duKSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQm9uZShsb29rQXRWZXJ0aWNhbFVwKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYXNlIFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJsZW5kU2hhcGU6IHtcbiAgICAgICAgaWYgKGxvb2tBdEhvcml6b250YWxPdXRlciA9PT0gdW5kZWZpbmVkIHx8IGxvb2tBdFZlcnRpY2FsRG93biA9PT0gdW5kZWZpbmVkIHx8IGxvb2tBdFZlcnRpY2FsVXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIoXG4gICAgICAgICAgICBibGVuZFNoYXBlUHJveHksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJsZW5kU2hhcGUobG9va0F0SG9yaXpvbnRhbE91dGVyKSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQmxlbmRTaGFwZShsb29rQXRWZXJ0aWNhbERvd24pLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCbGVuZFNoYXBlKGxvb2tBdFZlcnRpY2FsVXApLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfaW1wb3J0Q3VydmVNYXBwZXJCb25lKG1hcDogVlJNU2NoZW1hLkZpcnN0UGVyc29uRGVncmVlTWFwKTogVlJNQ3VydmVNYXBwZXIge1xuICAgIHJldHVybiBuZXcgVlJNQ3VydmVNYXBwZXIoXG4gICAgICB0eXBlb2YgbWFwLnhSYW5nZSA9PT0gJ251bWJlcicgPyBERUcyUkFEICogbWFwLnhSYW5nZSA6IHVuZGVmaW5lZCxcbiAgICAgIHR5cGVvZiBtYXAueVJhbmdlID09PSAnbnVtYmVyJyA/IERFRzJSQUQgKiBtYXAueVJhbmdlIDogdW5kZWZpbmVkLFxuICAgICAgbWFwLmN1cnZlLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF9pbXBvcnRDdXJ2ZU1hcHBlckJsZW5kU2hhcGUobWFwOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25EZWdyZWVNYXApOiBWUk1DdXJ2ZU1hcHBlciB7XG4gICAgcmV0dXJuIG5ldyBWUk1DdXJ2ZU1hcHBlcih0eXBlb2YgbWFwLnhSYW5nZSA9PT0gJ251bWJlcicgPyBERUcyUkFEICogbWFwLnhSYW5nZSA6IHVuZGVmaW5lZCwgbWFwLnlSYW5nZSwgbWFwLmN1cnZlKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG4vLyBTaW5jZSB0aGVzZSBjb25zdGFudHMgYXJlIGRlbGV0ZWQgaW4gcjEzNiB3ZSBoYXZlIHRvIGRlZmluZSBieSBvdXJzZWx2ZXNcbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xuY29uc3QgUkdCRUVuY29kaW5nID0gMzAwMjtcbmNvbnN0IFJHQk03RW5jb2RpbmcgPSAzMDA0O1xuY29uc3QgUkdCTTE2RW5jb2RpbmcgPSAzMDA1O1xuY29uc3QgUkdCREVuY29kaW5nID0gMzAwNjtcbmNvbnN0IEdhbW1hRW5jb2RpbmcgPSAzMDA3O1xuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cblxuLyoqXG4gKiBDT01QQVQ6IHByZS1yMTM3XG4gKiBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9yMTM2L3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtLmpzI0wyMlxuICovXG5leHBvcnQgY29uc3QgZ2V0RW5jb2RpbmdDb21wb25lbnRzID0gKGVuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2RpbmcpOiBbc3RyaW5nLCBzdHJpbmddID0+IHtcbiAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPj0gMTM2KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSBUSFJFRS5MaW5lYXJFbmNvZGluZzpcbiAgICAgICAgcmV0dXJuIFsnTGluZWFyJywgJyggdmFsdWUgKSddO1xuICAgICAgY2FzZSBUSFJFRS5zUkdCRW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ3NSR0InLCAnKCB2YWx1ZSApJ107XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBjb25zb2xlLndhcm4oJ1RIUkVFLldlYkdMUHJvZ3JhbTogVW5zdXBwb3J0ZWQgZW5jb2Rpbmc6JywgZW5jb2RpbmcpO1xuICAgICAgICByZXR1cm4gWydMaW5lYXInLCAnKCB2YWx1ZSApJ107XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIENPTVBBVDogcHJlLXIxMzZcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlIFRIUkVFLkxpbmVhckVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydMaW5lYXInLCAnKCB2YWx1ZSApJ107XG4gICAgICBjYXNlIFRIUkVFLnNSR0JFbmNvZGluZzpcbiAgICAgICAgcmV0dXJuIFsnc1JHQicsICcoIHZhbHVlICknXTtcbiAgICAgIGNhc2UgUkdCRUVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydSR0JFJywgJyggdmFsdWUgKSddO1xuICAgICAgY2FzZSBSR0JNN0VuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydSR0JNJywgJyggdmFsdWUsIDcuMCApJ107XG4gICAgICBjYXNlIFJHQk0xNkVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydSR0JNJywgJyggdmFsdWUsIDE2LjAgKSddO1xuICAgICAgY2FzZSBSR0JERW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ1JHQkQnLCAnKCB2YWx1ZSwgMjU2LjAgKSddO1xuICAgICAgY2FzZSBHYW1tYUVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydHYW1tYScsICcoIHZhbHVlLCBmbG9hdCggR0FNTUFfRkFDVE9SICkgKSddO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogQ09NUEFUOiBwcmUtcjEzN1xuICogVGhpcyBmdW5jdGlvbiBpcyBubyBsb25nZXIgcmVxdWlyZWQgYmVnaW5uaW5nIGZyb20gcjEzN1xuICpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9yMTM2L3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtLmpzI0w1MlxuICovXG5leHBvcnQgY29uc3QgZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uID0gKGZ1bmN0aW9uTmFtZTogc3RyaW5nLCBlbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nKTogc3RyaW5nID0+IHtcbiAgY29uc3QgY29tcG9uZW50cyA9IGdldEVuY29kaW5nQ29tcG9uZW50cyhlbmNvZGluZyk7XG4gIHJldHVybiAndmVjNCAnICsgZnVuY3Rpb25OYW1lICsgJyggdmVjNCB2YWx1ZSApIHsgcmV0dXJuICcgKyBjb21wb25lbnRzWzBdICsgJ1RvTGluZWFyJyArIGNvbXBvbmVudHNbMV0gKyAnOyB9Jztcbn07XG4iLCIvKiB0c2xpbnQ6ZGlzYWJsZTptZW1iZXItb3JkZXJpbmcgKi9cblxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHZlcnRleFNoYWRlciBmcm9tICcuL3NoYWRlcnMvbXRvb24udmVydCc7XG5pbXBvcnQgZnJhZ21lbnRTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL210b29uLmZyYWcnO1xuaW1wb3J0IHsgZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uIH0gZnJvbSAnLi9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24nO1xuXG5jb25zdCBUQVUgPSAyLjAgKiBNYXRoLlBJO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1Ub29uUGFyYW1ldGVycyBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsUGFyYW1ldGVycyB7XG4gIG1Ub29uVmVyc2lvbj86IG51bWJlcjsgLy8gX01Ub29uVmVyc2lvblxuXG4gIGN1dG9mZj86IG51bWJlcjsgLy8gX0N1dG9mZlxuICBjb2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIHJnYiBvZiBfQ29sb3JcbiAgc2hhZGVDb2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9TaGFkZUNvbG9yXG4gIG1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4XG4gIG1haW5UZXg/OiBUSFJFRS5UZXh0dXJlOyAvLyBfTWFpblRleCAod2lsbCBiZSByZW5hbWVkIHRvIG1hcClcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICBtYWluVGV4X1NUPzogVEhSRUUuVmVjdG9yNDsgLy8gX01haW5UZXhfU1RcbiAgc2hhZGVUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1NoYWRlVGV4dHVyZVxuICBidW1wU2NhbGU/OiBudW1iZXI7IC8vIF9CdW1wU2NhbGUgKHdpbGwgYmUgY29udmVydGVkIHRvIG5vcm1hbFNjYWxlKVxuICBub3JtYWxNYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfQnVtcE1hcFxuICBub3JtYWxNYXBUeXBlPzogVEhSRUUuTm9ybWFsTWFwVHlwZXM7IC8vIFRocmVlLmpzIHNwZWNpZmljIHZhbHVlXG4gIG5vcm1hbFNjYWxlPzogVEhSRUUuVmVjdG9yMjsgLy8gX0J1bXBTY2FsZSBpbiBUaHJlZS5qcyBmYXNoaW9uXG4gIGJ1bXBNYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfQnVtcE1hcCAod2lsbCBiZSByZW5hbWVkIHRvIG5vcm1hbE1hcClcbiAgcmVjZWl2ZVNoYWRvd1JhdGU/OiBudW1iZXI7IC8vIF9SZWNlaXZlU2hhZG93UmF0ZVxuICByZWNlaXZlU2hhZG93VGV4dHVyZT86IFRIUkVFLlRleHR1cmU7IC8vIF9SZWNlaXZlU2hhZG93VGV4dHVyZVxuICBzaGFkaW5nR3JhZGVSYXRlPzogbnVtYmVyOyAvLyBfU2hhZGluZ0dyYWRlUmF0ZVxuICBzaGFkaW5nR3JhZGVUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1NoYWRpbmdHcmFkZVRleHR1cmVcbiAgc2hhZGVTaGlmdD86IG51bWJlcjsgLy8gX1NoYWRlU2hpZnRcbiAgc2hhZGVUb29ueT86IG51bWJlcjsgLy8gX1NoYWRlVG9vbnlcbiAgbGlnaHRDb2xvckF0dGVudWF0aW9uPzogbnVtYmVyOyAvLyBfTGlnaHRDb2xvckF0dGVudWF0aW9uXG4gIGluZGlyZWN0TGlnaHRJbnRlbnNpdHk/OiBudW1iZXI7IC8vIF9JbmRpcmVjdExpZ2h0SW50ZW5zaXR5XG4gIHJpbVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfUmltVGV4dHVyZVxuICByaW1Db2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9SaW1Db2xvclxuICByaW1MaWdodGluZ01peD86IG51bWJlcjsgLy8gX1JpbUxpZ2h0aW5nTWl4XG4gIHJpbUZyZXNuZWxQb3dlcj86IG51bWJlcjsgLy8gX1JpbUZyZXNuZWxQb3dlclxuICByaW1MaWZ0PzogbnVtYmVyOyAvLyBfUmltTGlmdFxuICBzcGhlcmVBZGQ/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU3BoZXJlQWRkXG4gIGVtaXNzaW9uQ29sb3I/OiBUSFJFRS5WZWN0b3I0OyAvLyBfRW1pc3Npb25Db2xvclxuICBlbWlzc2l2ZU1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9FbWlzc2lvbk1hcFxuICBlbWlzc2lvbk1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9FbWlzc2lvbk1hcCAod2lsbCBiZSByZW5hbWVkIHRvIGVtaXNzaXZlTWFwKVxuICBvdXRsaW5lV2lkdGhUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVcbiAgb3V0bGluZVdpZHRoPzogbnVtYmVyOyAvLyBfT3V0bGluZVdpZHRoXG4gIG91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZT86IG51bWJlcjsgLy8gX091dGxpbmVTY2FsZWRNYXhEaXN0YW5jZVxuICBvdXRsaW5lQ29sb3I/OiBUSFJFRS5WZWN0b3I0OyAvLyBfT3V0bGluZUNvbG9yXG4gIG91dGxpbmVMaWdodGluZ01peD86IG51bWJlcjsgLy8gX091dGxpbmVMaWdodGluZ01peFxuICB1dkFuaW1NYXNrVGV4dHVyZT86IFRIUkVFLlRleHR1cmU7IC8vIF9VdkFuaW1NYXNrVGV4dHVyZVxuICB1dkFuaW1TY3JvbGxYPzogbnVtYmVyOyAvLyBfVXZBbmltU2Nyb2xsWFxuICB1dkFuaW1TY3JvbGxZPzogbnVtYmVyOyAvLyBfVXZBbmltU2Nyb2xsWVxuICB1dkFuaW1Sb3RhdGlvbj86IG51bWJlcjsgLy8gX3V2QW5pbVJvdGF0aW9uXG5cbiAgZGVidWdNb2RlPzogTVRvb25NYXRlcmlhbERlYnVnTW9kZSB8IG51bWJlcjsgLy8gX0RlYnVnTW9kZVxuICBibGVuZE1vZGU/OiBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZSB8IG51bWJlcjsgLy8gX0JsZW5kTW9kZVxuICBvdXRsaW5lV2lkdGhNb2RlPzogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUgfCBudW1iZXI7IC8vIE91dGxpbmVXaWR0aE1vZGVcbiAgb3V0bGluZUNvbG9yTW9kZT86IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIHwgbnVtYmVyOyAvLyBPdXRsaW5lQ29sb3JNb2RlXG4gIGN1bGxNb2RlPzogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHwgbnVtYmVyOyAvLyBfQ3VsbE1vZGVcbiAgb3V0bGluZUN1bGxNb2RlPzogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHwgbnVtYmVyOyAvLyBfT3V0bGluZUN1bGxNb2RlXG4gIHNyY0JsZW5kPzogbnVtYmVyOyAvLyBfU3JjQmxlbmRcbiAgZHN0QmxlbmQ/OiBudW1iZXI7IC8vIF9Ec3RCbGVuZFxuICB6V3JpdGU/OiBudW1iZXI7IC8vIF9aV3JpdGUgKHdpbGwgYmUgcmVuYW1lZCB0byBkZXB0aFdyaXRlKVxuXG4gIGlzT3V0bGluZT86IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFNwZWNpZnkgdGhlIGVuY29kaW5nIG9mIGlucHV0IHVuaWZvcm0gY29sb3JzLlxuICAgKlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYC5cbiAgICogV2hlbiB5b3VyIGByZW5kZXJlci5vdXRwdXRFbmNvZGluZ2AgaXMgYFRIUkVFLnNSR0JFbmNvZGluZ2AsIHVzZSBgVEhSRUUuc1JHQkVuY29kaW5nYC5cbiAgICpcbiAgICogRW5jb2RpbmdzIG9mIHRleHR1cmVzIHNob3VsZCBiZSBzZXQgaW5kZXBlbmRlbnRseSBvbiB0ZXh0dXJlcy5cbiAgICpcbiAgICogVGhpcyB3aWxsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgIGlmIHRoaXMgb3B0aW9uIGlzbid0IHNwZWNpZmllZC5cbiAgICpcbiAgICogU2VlIGFsc286IGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL3JlbmRlcmVycy9XZWJHTFJlbmRlcmVyLm91dHB1dEVuY29kaW5nXG4gICAqL1xuICBlbmNvZGluZz86IFRIUkVFLlRleHR1cmVFbmNvZGluZztcbn1cblxuZXhwb3J0IGVudW0gTVRvb25NYXRlcmlhbEN1bGxNb2RlIHtcbiAgT2ZmLFxuICBGcm9udCxcbiAgQmFjayxcbn1cblxuZXhwb3J0IGVudW0gTVRvb25NYXRlcmlhbERlYnVnTW9kZSB7XG4gIE5vbmUsXG4gIE5vcm1hbCxcbiAgTGl0U2hhZGVSYXRlLFxuICBVVixcbn1cblxuZXhwb3J0IGVudW0gTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUge1xuICBGaXhlZENvbG9yLFxuICBNaXhlZExpZ2h0aW5nLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSB7XG4gIE5vbmUsXG4gIFdvcmxkQ29vcmRpbmF0ZXMsXG4gIFNjcmVlbkNvb3JkaW5hdGVzLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZSB7XG4gIE9wYXF1ZSxcbiAgQ3V0b3V0LFxuICBUcmFuc3BhcmVudCxcbiAgVHJhbnNwYXJlbnRXaXRoWldyaXRlLFxufVxuXG4vKipcbiAqIE1Ub29uIGlzIGEgbWF0ZXJpYWwgc3BlY2lmaWNhdGlvbiB0aGF0IGhhcyB2YXJpb3VzIGZlYXR1cmVzLlxuICogVGhlIHNwZWMgYW5kIGltcGxlbWVudGF0aW9uIGFyZSBvcmlnaW5hbGx5IGZvdW5kZWQgZm9yIFVuaXR5IGVuZ2luZSBhbmQgdGhpcyBpcyBhIHBvcnQgb2YgdGhlIG1hdGVyaWFsLlxuICpcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1NhbnRhcmgvTVRvb25cbiAqL1xuZXhwb3J0IGNsYXNzIE1Ub29uTWF0ZXJpYWwgZXh0ZW5kcyBUSFJFRS5TaGFkZXJNYXRlcmlhbCB7XG4gIC8qKlxuICAgKiBSZWFkb25seSBib29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoaXMgaXMgYSBbW01Ub29uTWF0ZXJpYWxdXS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBpc01Ub29uTWF0ZXJpYWw6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIHB1YmxpYyBjdXRvZmYgPSAwLjU7IC8vIF9DdXRvZmZcbiAgcHVibGljIGNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMS4wLCAxLjAsIDEuMCwgMS4wKTsgLy8gX0NvbG9yXG4gIHB1YmxpYyBzaGFkZUNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMC45NywgMC44MSwgMC44NiwgMS4wKTsgLy8gX1NoYWRlQ29sb3JcbiAgcHVibGljIG1hcDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfTWFpblRleFxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gIHB1YmxpYyBtYWluVGV4X1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX01haW5UZXhfU1RcbiAgcHVibGljIHNoYWRlVGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfU2hhZGVUZXh0dXJlXG4gIC8vIHB1YmxpYyBzaGFkZVRleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfU2hhZGVUZXh0dXJlX1NUICh1bnVzZWQpXG4gIHB1YmxpYyBub3JtYWxNYXA6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX0J1bXBNYXAuIGFnYWluLCBUSElTIElTIF9CdW1wTWFwXG4gIHB1YmxpYyBub3JtYWxNYXBUeXBlID0gVEhSRUUuVGFuZ2VudFNwYWNlTm9ybWFsTWFwOyAvLyBUaHJlZS5qcyByZXF1aXJlcyB0aGlzXG4gIHB1YmxpYyBub3JtYWxTY2FsZSA9IG5ldyBUSFJFRS5WZWN0b3IyKDEuMCwgMS4wKTsgLy8gX0J1bXBTY2FsZSwgaW4gVmVjdG9yMlxuICAvLyBwdWJsaWMgYnVtcE1hcF9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9CdW1wTWFwX1NUICh1bnVzZWQpXG4gIHB1YmxpYyByZWNlaXZlU2hhZG93UmF0ZSA9IDEuMDsgLy8gX1JlY2VpdmVTaGFkb3dSYXRlXG4gIHB1YmxpYyByZWNlaXZlU2hhZG93VGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfUmVjZWl2ZVNoYWRvd1RleHR1cmVcbiAgLy8gcHVibGljIHJlY2VpdmVTaGFkb3dUZXh0dXJlX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX1JlY2VpdmVTaGFkb3dUZXh0dXJlX1NUICh1bnVzZWQpXG4gIHB1YmxpYyBzaGFkaW5nR3JhZGVSYXRlID0gMS4wOyAvLyBfU2hhZGluZ0dyYWRlUmF0ZVxuICBwdWJsaWMgc2hhZGluZ0dyYWRlVGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfU2hhZGluZ0dyYWRlVGV4dHVyZVxuICAvLyBwdWJsaWMgc2hhZGluZ0dyYWRlVGV4dHVyZV9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9TaGFkaW5nR3JhZGVUZXh0dXJlX1NUICh1bnVzZWQpXG4gIHB1YmxpYyBzaGFkZVNoaWZ0ID0gMC4wOyAvLyBfU2hhZGVTaGlmdFxuICBwdWJsaWMgc2hhZGVUb29ueSA9IDAuOTsgLy8gX1NoYWRlVG9vbnlcbiAgcHVibGljIGxpZ2h0Q29sb3JBdHRlbnVhdGlvbiA9IDAuMDsgLy8gX0xpZ2h0Q29sb3JBdHRlbnVhdGlvblxuICBwdWJsaWMgaW5kaXJlY3RMaWdodEludGVuc2l0eSA9IDAuMTsgLy8gX0luZGlyZWN0TGlnaHRJbnRlbnNpdHlcbiAgcHVibGljIHJpbVRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1JpbVRleHR1cmVcbiAgcHVibGljIHJpbUNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDAuMCwgMS4wKTsgLy8gX1JpbUNvbG9yXG4gIHB1YmxpYyByaW1MaWdodGluZ01peCA9IDAuMDsgLy8gX1JpbUxpZ2h0aW5nTWl4XG4gIHB1YmxpYyByaW1GcmVzbmVsUG93ZXIgPSAxLjA7IC8vIF9SaW1GcmVzbmVsUG93ZXJcbiAgcHVibGljIHJpbUxpZnQgPSAwLjA7IC8vIF9SaW1MaWZ0XG4gIHB1YmxpYyBzcGhlcmVBZGQ6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1NwaGVyZUFkZFxuICAvLyBwdWJsaWMgc3BoZXJlQWRkX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX1NwaGVyZUFkZF9TVCAodW51c2VkKVxuICBwdWJsaWMgZW1pc3Npb25Db2xvciA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAwLjAsIDEuMCk7IC8vIF9FbWlzc2lvbkNvbG9yXG4gIHB1YmxpYyBlbWlzc2l2ZU1hcDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfRW1pc3Npb25NYXBcbiAgLy8gcHVibGljIGVtaXNzaW9uTWFwX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX0VtaXNzaW9uTWFwX1NUICh1bnVzZWQpXG4gIHB1YmxpYyBvdXRsaW5lV2lkdGhUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9PdXRsaW5lV2lkdGhUZXh0dXJlXG4gIC8vIHB1YmxpYyBvdXRsaW5lV2lkdGhUZXh0dXJlX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIG91dGxpbmVXaWR0aCA9IDAuNTsgLy8gX091dGxpbmVXaWR0aFxuICBwdWJsaWMgb3V0bGluZVNjYWxlZE1heERpc3RhbmNlID0gMS4wOyAvLyBfT3V0bGluZVNjYWxlZE1heERpc3RhbmNlXG4gIHB1YmxpYyBvdXRsaW5lQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMC4wLCAxLjApOyAvLyBfT3V0bGluZUNvbG9yXG4gIHB1YmxpYyBvdXRsaW5lTGlnaHRpbmdNaXggPSAxLjA7IC8vIF9PdXRsaW5lTGlnaHRpbmdNaXhcbiAgcHVibGljIHV2QW5pbU1hc2tUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9VdkFuaW1NYXNrVGV4dHVyZVxuICBwdWJsaWMgdXZBbmltU2Nyb2xsWCA9IDAuMDsgLy8gX1V2QW5pbVNjcm9sbFhcbiAgcHVibGljIHV2QW5pbVNjcm9sbFkgPSAwLjA7IC8vIF9VdkFuaW1TY3JvbGxZXG4gIHB1YmxpYyB1dkFuaW1Sb3RhdGlvbiA9IDAuMDsgLy8gX3V2QW5pbVJvdGF0aW9uXG5cbiAgcHVibGljIHNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlOyAvLyB3aGVuIHRoaXMgaXMgdHJ1ZSwgYXBwbHlVbmlmb3JtcyBlZmZlY3RzXG5cbiAgLyoqXG4gICAqIFRoZSBlbmNvZGluZyBvZiBpbnB1dCB1bmlmb3JtIGNvbG9ycy5cbiAgICpcbiAgICogV2hlbiB5b3VyIGByZW5kZXJlci5vdXRwdXRFbmNvZGluZ2AgaXMgYFRIUkVFLkxpbmVhckVuY29kaW5nYCwgdXNlIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AuXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5zUkdCRW5jb2RpbmdgLCB1c2UgYFRIUkVFLnNSR0JFbmNvZGluZ2AuXG4gICAqXG4gICAqIEVuY29kaW5ncyBvZiB0ZXh0dXJlcyBhcmUgc2V0IGluZGVwZW5kZW50bHkgb24gdGV4dHVyZXMuXG4gICAqXG4gICAqIFRoaXMgaXMgYFRIUkVFLkxpbmVhckVuY29kaW5nYCBieSBkZWZhdWx0LlxuICAgKlxuICAgKiBTZWUgYWxzbzogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vcmVuZGVyZXJzL1dlYkdMUmVuZGVyZXIub3V0cHV0RW5jb2RpbmdcbiAgICovXG4gIHB1YmxpYyBlbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xuXG4gIHByaXZhdGUgX2RlYnVnTW9kZSA9IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTm9uZTsgLy8gX0RlYnVnTW9kZVxuICBwcml2YXRlIF9ibGVuZE1vZGUgPSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5PcGFxdWU7IC8vIF9CbGVuZE1vZGVcbiAgcHJpdmF0ZSBfb3V0bGluZVdpZHRoTW9kZSA9IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLk5vbmU7IC8vIF9PdXRsaW5lV2lkdGhNb2RlXG4gIHByaXZhdGUgX291dGxpbmVDb2xvck1vZGUgPSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZS5GaXhlZENvbG9yOyAvLyBfT3V0bGluZUNvbG9yTW9kZVxuICBwcml2YXRlIF9jdWxsTW9kZSA9IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5CYWNrOyAvLyBfQ3VsbE1vZGVcbiAgcHJpdmF0ZSBfb3V0bGluZUN1bGxNb2RlID0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkZyb250OyAvLyBfT3V0bGluZUN1bGxNb2RlXG4gIC8vIHB1YmxpYyBzcmNCbGVuZCA9IDEuMDsgLy8gX1NyY0JsZW5kIChpcyBub3Qgc3VwcG9ydGVkKVxuICAvLyBwdWJsaWMgZHN0QmxlbmQgPSAwLjA7IC8vIF9Ec3RCbGVuZCAoaXMgbm90IHN1cHBvcnRlZClcbiAgLy8gcHVibGljIHpXcml0ZSA9IDEuMDsgLy8gX1pXcml0ZSAod2lsbCBiZSBjb252ZXJ0ZWQgdG8gZGVwdGhXcml0ZSlcblxuICBwcml2YXRlIF9pc091dGxpbmUgPSBmYWxzZTtcblxuICBwcml2YXRlIF91dkFuaW1PZmZzZXRYID0gMC4wO1xuICBwcml2YXRlIF91dkFuaW1PZmZzZXRZID0gMC4wO1xuICBwcml2YXRlIF91dkFuaW1QaGFzZSA9IDAuMDtcblxuICBjb25zdHJ1Y3RvcihwYXJhbWV0ZXJzOiBNVG9vblBhcmFtZXRlcnMgPSB7fSkge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLmVuY29kaW5nID0gcGFyYW1ldGVycy5lbmNvZGluZyB8fCBUSFJFRS5MaW5lYXJFbmNvZGluZztcbiAgICBpZiAodGhpcy5lbmNvZGluZyAhPT0gVEhSRUUuTGluZWFyRW5jb2RpbmcgJiYgdGhpcy5lbmNvZGluZyAhPT0gVEhSRUUuc1JHQkVuY29kaW5nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICdUaGUgc3BlY2lmaWVkIGNvbG9yIGVuY29kaW5nIGRvZXMgbm90IHdvcmsgcHJvcGVybHkgd2l0aCBNVG9vbk1hdGVyaWFsLiBZb3UgbWlnaHQgd2FudCB0byB1c2UgVEhSRUUuc1JHQkVuY29kaW5nIGluc3RlYWQuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gPT0gdGhlc2UgcGFyYW1ldGVyIGhhcyBubyBjb21wYXRpYmlsaXR5IHdpdGggdGhpcyBpbXBsZW1lbnRhdGlvbiA9PT09PT09PVxuICAgIFtcbiAgICAgICdtVG9vblZlcnNpb24nLFxuICAgICAgJ3NoYWRlVGV4dHVyZV9TVCcsXG4gICAgICAnYnVtcE1hcF9TVCcsXG4gICAgICAncmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QnLFxuICAgICAgJ3NoYWRpbmdHcmFkZVRleHR1cmVfU1QnLFxuICAgICAgJ3JpbVRleHR1cmVfU1QnLFxuICAgICAgJ3NwaGVyZUFkZF9TVCcsXG4gICAgICAnZW1pc3Npb25NYXBfU1QnLFxuICAgICAgJ291dGxpbmVXaWR0aFRleHR1cmVfU1QnLFxuICAgICAgJ3V2QW5pbU1hc2tUZXh0dXJlX1NUJyxcbiAgICAgICdzcmNCbGVuZCcsXG4gICAgICAnZHN0QmxlbmQnLFxuICAgIF0uZm9yRWFjaCgoa2V5KSA9PiB7XG4gICAgICBpZiAoKHBhcmFtZXRlcnMgYXMgYW55KVtrZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgLy8gY29uc29sZS53YXJuKGBUSFJFRS4ke3RoaXMudHlwZX06IFRoZSBwYXJhbWV0ZXIgXCIke2tleX1cIiBpcyBub3Qgc3VwcG9ydGVkLmApO1xuICAgICAgICBkZWxldGUgKHBhcmFtZXRlcnMgYXMgYW55KVtrZXldO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gPT0gZW5hYmxpbmcgYnVuY2ggb2Ygc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHBhcmFtZXRlcnMuZm9nID0gdHJ1ZTtcbiAgICBwYXJhbWV0ZXJzLmxpZ2h0cyA9IHRydWU7XG4gICAgcGFyYW1ldGVycy5jbGlwcGluZyA9IHRydWU7XG5cbiAgICAvLyBDT01QQVQ6IHByZS1yMTI5XG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjE3ODhcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEyOSkge1xuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5za2lubmluZyA9IChwYXJhbWV0ZXJzIGFzIGFueSkuc2tpbm5pbmcgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQ09NUEFUOiBwcmUtcjEzMVxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIyMTY5XG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMzEpIHtcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhUYXJnZXRzID0gKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaFRhcmdldHMgfHwgZmFsc2U7XG4gICAgICAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoTm9ybWFscyA9IChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhOb3JtYWxzIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8vID09IHVuaWZvcm1zID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBwYXJhbWV0ZXJzLnVuaWZvcm1zID0gVEhSRUUuVW5pZm9ybXNVdGlscy5tZXJnZShbXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5jb21tb24sIC8vIG1hcFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIubm9ybWFsbWFwLCAvLyBub3JtYWxNYXBcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmVtaXNzaXZlbWFwLCAvLyBlbWlzc2l2ZU1hcFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuZm9nLFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIubGlnaHRzLFxuICAgICAge1xuICAgICAgICBjdXRvZmY6IHsgdmFsdWU6IDAuNSB9LFxuICAgICAgICBjb2xvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDEuMCwgMS4wLCAxLjApIH0sXG4gICAgICAgIGNvbG9yQWxwaGE6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICBzaGFkZUNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC45NywgMC44MSwgMC44NikgfSxcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICAgICAgICBtYWluVGV4X1NUOiB7IHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApIH0sXG4gICAgICAgIHNoYWRlVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICByZWNlaXZlU2hhZG93UmF0ZTogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHJlY2VpdmVTaGFkb3dUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXG4gICAgICAgIHNoYWRpbmdHcmFkZVJhdGU6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICBzaGFkaW5nR3JhZGVUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXG4gICAgICAgIHNoYWRlU2hpZnQ6IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICBzaGFkZVRvb255OiB7IHZhbHVlOiAwLjkgfSxcbiAgICAgICAgbGlnaHRDb2xvckF0dGVudWF0aW9uOiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgICAgaW5kaXJlY3RMaWdodEludGVuc2l0eTogeyB2YWx1ZTogMC4xIH0sXG4gICAgICAgIHJpbVRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgcmltQ29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjAsIDAuMCwgMC4wKSB9LFxuICAgICAgICByaW1MaWdodGluZ01peDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHJpbUZyZXNuZWxQb3dlcjogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHJpbUxpZnQ6IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICBzcGhlcmVBZGQ6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgZW1pc3Npb25Db2xvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuMCwgMC4wLCAwLjApIH0sXG4gICAgICAgIG91dGxpbmVXaWR0aFRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgb3V0bGluZVdpZHRoOiB7IHZhbHVlOiAwLjUgfSxcbiAgICAgICAgb3V0bGluZVNjYWxlZE1heERpc3RhbmNlOiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgb3V0bGluZUNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcbiAgICAgICAgb3V0bGluZUxpZ2h0aW5nTWl4OiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgdXZBbmltTWFza1RleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgdXZBbmltT2Zmc2V0WDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHV2QW5pbU9mZnNldFk6IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICB1dkFuaW1UaGV0YTogeyB2YWx1ZTogMC4wIH0sXG4gICAgICB9LFxuICAgIF0pO1xuXG4gICAgLy8gPT0gZmluYWxseSBjb21waWxlIHRoZSBzaGFkZXIgcHJvZ3JhbSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuc2V0VmFsdWVzKHBhcmFtZXRlcnMpO1xuXG4gICAgLy8gPT0gdXBkYXRlIHNoYWRlciBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XG4gIH1cblxuICBnZXQgbWFpblRleCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubWFwO1xuICB9XG5cbiAgc2V0IG1haW5UZXgodDogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcbiAgICB0aGlzLm1hcCA9IHQ7XG4gIH1cblxuICBnZXQgYnVtcE1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubm9ybWFsTWFwO1xuICB9XG5cbiAgc2V0IGJ1bXBNYXAodDogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcbiAgICB0aGlzLm5vcm1hbE1hcCA9IHQ7XG4gIH1cblxuICAvKipcbiAgICogR2V0dGluZyB0aGUgYGJ1bXBTY2FsZWAgcmV1dHJucyBpdHMgeCBjb21wb25lbnQgb2YgYG5vcm1hbFNjYWxlYCAoYXNzdW1pbmcgeCBhbmQgeSBjb21wb25lbnQgb2YgYG5vcm1hbFNjYWxlYCBhcmUgc2FtZSkuXG4gICAqL1xuICBnZXQgYnVtcFNjYWxlKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMubm9ybWFsU2NhbGUueDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXR0aW5nIHRoZSBgYnVtcFNjYWxlYCB3aWxsIGJlIGNvbnZlcnQgdGhlIHZhbHVlIGludG8gVmVjdG9yMiBgbm9ybWFsU2NhbGVgIC5cbiAgICovXG4gIHNldCBidW1wU2NhbGUodDogbnVtYmVyKSB7XG4gICAgdGhpcy5ub3JtYWxTY2FsZS5zZXQodCwgdCk7XG4gIH1cblxuICBnZXQgZW1pc3Npb25NYXAoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLmVtaXNzaXZlTWFwO1xuICB9XG5cbiAgc2V0IGVtaXNzaW9uTWFwKHQ6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XG4gICAgdGhpcy5lbWlzc2l2ZU1hcCA9IHQ7XG4gIH1cblxuICBnZXQgYmxlbmRNb2RlKCk6IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fYmxlbmRNb2RlO1xuICB9XG5cbiAgc2V0IGJsZW5kTW9kZShtOiBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZSkge1xuICAgIHRoaXMuX2JsZW5kTW9kZSA9IG07XG5cbiAgICB0aGlzLmRlcHRoV3JpdGUgPSB0aGlzLl9ibGVuZE1vZGUgIT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50O1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPVxuICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudCB8fFxuICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudFdpdGhaV3JpdGU7XG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICB9XG5cbiAgZ2V0IGRlYnVnTW9kZSgpOiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fZGVidWdNb2RlO1xuICB9XG5cbiAgc2V0IGRlYnVnTW9kZShtOiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlKSB7XG4gICAgdGhpcy5fZGVidWdNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgfVxuXG4gIGdldCBvdXRsaW5lV2lkdGhNb2RlKCk6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0bGluZVdpZHRoTW9kZTtcbiAgfVxuXG4gIHNldCBvdXRsaW5lV2lkdGhNb2RlKG06IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlKSB7XG4gICAgdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9IG07XG5cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICBnZXQgb3V0bGluZUNvbG9yTW9kZSgpOiBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX291dGxpbmVDb2xvck1vZGU7XG4gIH1cblxuICBzZXQgb3V0bGluZUNvbG9yTW9kZShtOiBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSkge1xuICAgIHRoaXMuX291dGxpbmVDb2xvck1vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICB9XG5cbiAgZ2V0IGN1bGxNb2RlKCk6IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX2N1bGxNb2RlO1xuICB9XG5cbiAgc2V0IGN1bGxNb2RlKG06IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSkge1xuICAgIHRoaXMuX2N1bGxNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XG4gIH1cblxuICBnZXQgb3V0bGluZUN1bGxNb2RlKCk6IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX291dGxpbmVDdWxsTW9kZTtcbiAgfVxuXG4gIHNldCBvdXRsaW5lQ3VsbE1vZGUobTogTVRvb25NYXRlcmlhbEN1bGxNb2RlKSB7XG4gICAgdGhpcy5fb3V0bGluZUN1bGxNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XG4gIH1cblxuICBnZXQgeldyaXRlKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuZGVwdGhXcml0ZSA/IDEgOiAwO1xuICB9XG5cbiAgc2V0IHpXcml0ZShpOiBudW1iZXIpIHtcbiAgICB0aGlzLmRlcHRoV3JpdGUgPSAwLjUgPD0gaTtcbiAgfVxuXG4gIGdldCBpc091dGxpbmUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2lzT3V0bGluZTtcbiAgfVxuXG4gIHNldCBpc091dGxpbmUoYjogYm9vbGVhbikge1xuICAgIHRoaXMuX2lzT3V0bGluZSA9IGI7XG5cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhpcyBtYXRlcmlhbC5cbiAgICogVXN1YWxseSB0aGlzIHdpbGwgYmUgY2FsbGVkIHZpYSBbW1ZSTS51cGRhdGVdXSBzbyB5b3UgZG9uJ3QgaGF2ZSB0byBjYWxsIHRoaXMgbWFudWFsbHkuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWUgc2luY2UgbGFzdCB1cGRhdGVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGVWUk1NYXRlcmlhbHMoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuX3V2QW5pbU9mZnNldFggPSB0aGlzLl91dkFuaW1PZmZzZXRYICsgZGVsdGEgKiB0aGlzLnV2QW5pbVNjcm9sbFg7XG4gICAgdGhpcy5fdXZBbmltT2Zmc2V0WSA9IHRoaXMuX3V2QW5pbU9mZnNldFkgLSBkZWx0YSAqIHRoaXMudXZBbmltU2Nyb2xsWTsgLy8gTmVnYXRpdmUgc2luY2UgdCBheGlzIG9mIHV2cyBhcmUgb3Bwb3NpdGUgZnJvbSBVbml0eSdzIG9uZVxuICAgIHRoaXMuX3V2QW5pbVBoYXNlID0gdGhpcy5fdXZBbmltUGhhc2UgKyBkZWx0YSAqIHRoaXMudXZBbmltUm90YXRpb247XG5cbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XG4gIH1cblxuICBwdWJsaWMgY29weShzb3VyY2U6IHRoaXMpOiB0aGlzIHtcbiAgICBzdXBlci5jb3B5KHNvdXJjZSk7XG5cbiAgICAvLyA9PSBjb3B5IG1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5jdXRvZmYgPSBzb3VyY2UuY3V0b2ZmO1xuICAgIHRoaXMuY29sb3IuY29weShzb3VyY2UuY29sb3IpO1xuICAgIHRoaXMuc2hhZGVDb2xvci5jb3B5KHNvdXJjZS5zaGFkZUNvbG9yKTtcbiAgICB0aGlzLm1hcCA9IHNvdXJjZS5tYXA7XG4gICAgdGhpcy5tYWluVGV4X1NULmNvcHkoc291cmNlLm1haW5UZXhfU1QpO1xuICAgIHRoaXMuc2hhZGVUZXh0dXJlID0gc291cmNlLnNoYWRlVGV4dHVyZTtcbiAgICB0aGlzLm5vcm1hbE1hcCA9IHNvdXJjZS5ub3JtYWxNYXA7XG4gICAgdGhpcy5ub3JtYWxNYXBUeXBlID0gc291cmNlLm5vcm1hbE1hcFR5cGU7XG4gICAgdGhpcy5ub3JtYWxTY2FsZS5jb3B5KHRoaXMubm9ybWFsU2NhbGUpO1xuICAgIHRoaXMucmVjZWl2ZVNoYWRvd1JhdGUgPSBzb3VyY2UucmVjZWl2ZVNoYWRvd1JhdGU7XG4gICAgdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSA9IHNvdXJjZS5yZWNlaXZlU2hhZG93VGV4dHVyZTtcbiAgICB0aGlzLnNoYWRpbmdHcmFkZVJhdGUgPSBzb3VyY2Uuc2hhZGluZ0dyYWRlUmF0ZTtcbiAgICB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgPSBzb3VyY2Uuc2hhZGluZ0dyYWRlVGV4dHVyZTtcbiAgICB0aGlzLnNoYWRlU2hpZnQgPSBzb3VyY2Uuc2hhZGVTaGlmdDtcbiAgICB0aGlzLnNoYWRlVG9vbnkgPSBzb3VyY2Uuc2hhZGVUb29ueTtcbiAgICB0aGlzLmxpZ2h0Q29sb3JBdHRlbnVhdGlvbiA9IHNvdXJjZS5saWdodENvbG9yQXR0ZW51YXRpb247XG4gICAgdGhpcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5ID0gc291cmNlLmluZGlyZWN0TGlnaHRJbnRlbnNpdHk7XG4gICAgdGhpcy5yaW1UZXh0dXJlID0gc291cmNlLnJpbVRleHR1cmU7XG4gICAgdGhpcy5yaW1Db2xvci5jb3B5KHNvdXJjZS5yaW1Db2xvcik7XG4gICAgdGhpcy5yaW1MaWdodGluZ01peCA9IHNvdXJjZS5yaW1MaWdodGluZ01peDtcbiAgICB0aGlzLnJpbUZyZXNuZWxQb3dlciA9IHNvdXJjZS5yaW1GcmVzbmVsUG93ZXI7XG4gICAgdGhpcy5yaW1MaWZ0ID0gc291cmNlLnJpbUxpZnQ7XG4gICAgdGhpcy5zcGhlcmVBZGQgPSBzb3VyY2Uuc3BoZXJlQWRkO1xuICAgIHRoaXMuZW1pc3Npb25Db2xvci5jb3B5KHNvdXJjZS5lbWlzc2lvbkNvbG9yKTtcbiAgICB0aGlzLmVtaXNzaXZlTWFwID0gc291cmNlLmVtaXNzaXZlTWFwO1xuICAgIHRoaXMub3V0bGluZVdpZHRoVGV4dHVyZSA9IHNvdXJjZS5vdXRsaW5lV2lkdGhUZXh0dXJlO1xuICAgIHRoaXMub3V0bGluZVdpZHRoID0gc291cmNlLm91dGxpbmVXaWR0aDtcbiAgICB0aGlzLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZSA9IHNvdXJjZS5vdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2U7XG4gICAgdGhpcy5vdXRsaW5lQ29sb3IuY29weShzb3VyY2Uub3V0bGluZUNvbG9yKTtcbiAgICB0aGlzLm91dGxpbmVMaWdodGluZ01peCA9IHNvdXJjZS5vdXRsaW5lTGlnaHRpbmdNaXg7XG4gICAgdGhpcy51dkFuaW1NYXNrVGV4dHVyZSA9IHNvdXJjZS51dkFuaW1NYXNrVGV4dHVyZTtcbiAgICB0aGlzLnV2QW5pbVNjcm9sbFggPSBzb3VyY2UudXZBbmltU2Nyb2xsWDtcbiAgICB0aGlzLnV2QW5pbVNjcm9sbFkgPSBzb3VyY2UudXZBbmltU2Nyb2xsWTtcbiAgICB0aGlzLnV2QW5pbVJvdGF0aW9uID0gc291cmNlLnV2QW5pbVJvdGF0aW9uO1xuXG4gICAgdGhpcy5kZWJ1Z01vZGUgPSBzb3VyY2UuZGVidWdNb2RlO1xuICAgIHRoaXMuYmxlbmRNb2RlID0gc291cmNlLmJsZW5kTW9kZTtcbiAgICB0aGlzLm91dGxpbmVXaWR0aE1vZGUgPSBzb3VyY2Uub3V0bGluZVdpZHRoTW9kZTtcbiAgICB0aGlzLm91dGxpbmVDb2xvck1vZGUgPSBzb3VyY2Uub3V0bGluZUNvbG9yTW9kZTtcbiAgICB0aGlzLmN1bGxNb2RlID0gc291cmNlLmN1bGxNb2RlO1xuICAgIHRoaXMub3V0bGluZUN1bGxNb2RlID0gc291cmNlLm91dGxpbmVDdWxsTW9kZTtcblxuICAgIHRoaXMuaXNPdXRsaW5lID0gc291cmNlLmlzT3V0bGluZTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGx5IHVwZGF0ZWQgdW5pZm9ybSB2YXJpYWJsZXMuXG4gICAqL1xuICBwcml2YXRlIF9hcHBseVVuaWZvcm1zKCk6IHZvaWQge1xuICAgIHRoaXMudW5pZm9ybXMudXZBbmltT2Zmc2V0WC52YWx1ZSA9IHRoaXMuX3V2QW5pbU9mZnNldFg7XG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1PZmZzZXRZLnZhbHVlID0gdGhpcy5fdXZBbmltT2Zmc2V0WTtcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbVRoZXRhLnZhbHVlID0gVEFVICogdGhpcy5fdXZBbmltUGhhc2U7XG5cbiAgICBpZiAoIXRoaXMuc2hvdWxkQXBwbHlVbmlmb3Jtcykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnNob3VsZEFwcGx5VW5pZm9ybXMgPSBmYWxzZTtcblxuICAgIHRoaXMudW5pZm9ybXMuY3V0b2ZmLnZhbHVlID0gdGhpcy5jdXRvZmY7XG4gICAgdGhpcy51bmlmb3Jtcy5jb2xvci52YWx1ZS5zZXRSR0IodGhpcy5jb2xvci54LCB0aGlzLmNvbG9yLnksIHRoaXMuY29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5jb2xvckFscGhhLnZhbHVlID0gdGhpcy5jb2xvci53O1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVDb2xvci52YWx1ZS5zZXRSR0IodGhpcy5zaGFkZUNvbG9yLngsIHRoaXMuc2hhZGVDb2xvci55LCB0aGlzLnNoYWRlQ29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5tYXAudmFsdWUgPSB0aGlzLm1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm1haW5UZXhfU1QudmFsdWUuY29weSh0aGlzLm1haW5UZXhfU1QpO1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVUZXh0dXJlLnZhbHVlID0gdGhpcy5zaGFkZVRleHR1cmU7XG4gICAgdGhpcy51bmlmb3Jtcy5ub3JtYWxNYXAudmFsdWUgPSB0aGlzLm5vcm1hbE1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm5vcm1hbFNjYWxlLnZhbHVlLmNvcHkodGhpcy5ub3JtYWxTY2FsZSk7XG4gICAgdGhpcy51bmlmb3Jtcy5yZWNlaXZlU2hhZG93UmF0ZS52YWx1ZSA9IHRoaXMucmVjZWl2ZVNoYWRvd1JhdGU7XG4gICAgdGhpcy51bmlmb3Jtcy5yZWNlaXZlU2hhZG93VGV4dHVyZS52YWx1ZSA9IHRoaXMucmVjZWl2ZVNoYWRvd1RleHR1cmU7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkaW5nR3JhZGVSYXRlLnZhbHVlID0gdGhpcy5zaGFkaW5nR3JhZGVSYXRlO1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGluZ0dyYWRlVGV4dHVyZS52YWx1ZSA9IHRoaXMuc2hhZGluZ0dyYWRlVGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlU2hpZnQudmFsdWUgPSB0aGlzLnNoYWRlU2hpZnQ7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkZVRvb255LnZhbHVlID0gdGhpcy5zaGFkZVRvb255O1xuICAgIHRoaXMudW5pZm9ybXMubGlnaHRDb2xvckF0dGVudWF0aW9uLnZhbHVlID0gdGhpcy5saWdodENvbG9yQXR0ZW51YXRpb247XG4gICAgdGhpcy51bmlmb3Jtcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5LnZhbHVlID0gdGhpcy5pbmRpcmVjdExpZ2h0SW50ZW5zaXR5O1xuICAgIHRoaXMudW5pZm9ybXMucmltVGV4dHVyZS52YWx1ZSA9IHRoaXMucmltVGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUNvbG9yLnZhbHVlLnNldFJHQih0aGlzLnJpbUNvbG9yLngsIHRoaXMucmltQ29sb3IueSwgdGhpcy5yaW1Db2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUxpZ2h0aW5nTWl4LnZhbHVlID0gdGhpcy5yaW1MaWdodGluZ01peDtcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUZyZXNuZWxQb3dlci52YWx1ZSA9IHRoaXMucmltRnJlc25lbFBvd2VyO1xuICAgIHRoaXMudW5pZm9ybXMucmltTGlmdC52YWx1ZSA9IHRoaXMucmltTGlmdDtcbiAgICB0aGlzLnVuaWZvcm1zLnNwaGVyZUFkZC52YWx1ZSA9IHRoaXMuc3BoZXJlQWRkO1xuICAgIHRoaXMudW5pZm9ybXMuZW1pc3Npb25Db2xvci52YWx1ZS5zZXRSR0IodGhpcy5lbWlzc2lvbkNvbG9yLngsIHRoaXMuZW1pc3Npb25Db2xvci55LCB0aGlzLmVtaXNzaW9uQ29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZU1hcC52YWx1ZSA9IHRoaXMuZW1pc3NpdmVNYXA7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGhUZXh0dXJlLnZhbHVlID0gdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlO1xuICAgIHRoaXMudW5pZm9ybXMub3V0bGluZVdpZHRoLnZhbHVlID0gdGhpcy5vdXRsaW5lV2lkdGg7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2UudmFsdWUgPSB0aGlzLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZTtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvci52YWx1ZS5zZXRSR0IodGhpcy5vdXRsaW5lQ29sb3IueCwgdGhpcy5vdXRsaW5lQ29sb3IueSwgdGhpcy5vdXRsaW5lQ29sb3Iueik7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lTGlnaHRpbmdNaXgudmFsdWUgPSB0aGlzLm91dGxpbmVMaWdodGluZ01peDtcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbU1hc2tUZXh0dXJlLnZhbHVlID0gdGhpcy51dkFuaW1NYXNrVGV4dHVyZTtcblxuICAgIC8vIGFwcGx5IGNvbG9yIHNwYWNlIHRvIHVuaWZvcm0gY29sb3JzXG4gICAgaWYgKHRoaXMuZW5jb2RpbmcgPT09IFRIUkVFLnNSR0JFbmNvZGluZykge1xuICAgICAgdGhpcy51bmlmb3Jtcy5jb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLnNoYWRlQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xuICAgICAgdGhpcy51bmlmb3Jtcy5yaW1Db2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLmVtaXNzaW9uQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xuICAgICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lQ29sb3IudmFsdWUuY29udmVydFNSR0JUb0xpbmVhcigpO1xuICAgIH1cblxuICAgIHRoaXMuX3VwZGF0ZUN1bGxGYWNlKCk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVTaGFkZXJDb2RlKCk6IHZvaWQge1xuICAgIGNvbnN0IHVzZVV2SW5WZXJ0ID0gdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlICE9PSBudWxsO1xuICAgIGNvbnN0IHVzZVV2SW5GcmFnID1cbiAgICAgIHRoaXMubWFwICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbCB8fFxuICAgICAgdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSAhPT0gbnVsbCB8fFxuICAgICAgdGhpcy5zaGFkaW5nR3JhZGVUZXh0dXJlICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnJpbVRleHR1cmUgIT09IG51bGwgfHxcbiAgICAgIHRoaXMudXZBbmltTWFza1RleHR1cmUgIT09IG51bGw7XG5cbiAgICB0aGlzLmRlZmluZXMgPSB7XG4gICAgICAvLyBVc2VkIGZvciBjb21wYXRzXG4gICAgICBUSFJFRV9WUk1fVEhSRUVfUkVWSVNJT046IHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCksXG5cbiAgICAgIE9VVExJTkU6IHRoaXMuX2lzT3V0bGluZSxcbiAgICAgIEJMRU5ETU9ERV9PUEFRVUU6IHRoaXMuX2JsZW5kTW9kZSA9PT0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuT3BhcXVlLFxuICAgICAgQkxFTkRNT0RFX0NVVE9VVDogdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5DdXRvdXQsXG4gICAgICBCTEVORE1PREVfVFJBTlNQQVJFTlQ6XG4gICAgICAgIHRoaXMuX2JsZW5kTW9kZSA9PT0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuVHJhbnNwYXJlbnQgfHxcbiAgICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudFdpdGhaV3JpdGUsXG4gICAgICBNVE9PTl9VU0VfVVY6IHVzZVV2SW5WZXJ0IHx8IHVzZVV2SW5GcmFnLCAvLyB3ZSBjYW4ndCB1c2UgYFVTRV9VVmAgLCBpdCB3aWxsIGJlIHJlZGVmaW5lZCBpbiBXZWJHTFByb2dyYW0uanNcbiAgICAgIE1UT09OX1VWU19WRVJURVhfT05MWTogdXNlVXZJblZlcnQgJiYgIXVzZVV2SW5GcmFnLFxuICAgICAgVVNFX1NIQURFVEVYVFVSRTogdGhpcy5zaGFkZVRleHR1cmUgIT09IG51bGwsXG4gICAgICBVU0VfUkVDRUlWRVNIQURPV1RFWFRVUkU6IHRoaXMucmVjZWl2ZVNoYWRvd1RleHR1cmUgIT09IG51bGwsXG4gICAgICBVU0VfU0hBRElOR0dSQURFVEVYVFVSRTogdGhpcy5zaGFkaW5nR3JhZGVUZXh0dXJlICE9PSBudWxsLFxuICAgICAgVVNFX1JJTVRFWFRVUkU6IHRoaXMucmltVGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9TUEhFUkVBREQ6IHRoaXMuc3BoZXJlQWRkICE9PSBudWxsLFxuICAgICAgVVNFX09VVExJTkVXSURUSFRFWFRVUkU6IHRoaXMub3V0bGluZVdpZHRoVGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9VVkFOSU1NQVNLVEVYVFVSRTogdGhpcy51dkFuaW1NYXNrVGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIERFQlVHX05PUk1BTDogdGhpcy5fZGVidWdNb2RlID09PSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlLk5vcm1hbCxcbiAgICAgIERFQlVHX0xJVFNIQURFUkFURTogdGhpcy5fZGVidWdNb2RlID09PSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlLkxpdFNoYWRlUmF0ZSxcbiAgICAgIERFQlVHX1VWOiB0aGlzLl9kZWJ1Z01vZGUgPT09IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuVVYsXG4gICAgICBPVVRMSU5FX1dJRFRIX1dPUkxEOiB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlID09PSBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZS5Xb3JsZENvb3JkaW5hdGVzLFxuICAgICAgT1VUTElORV9XSURUSF9TQ1JFRU46IHRoaXMuX291dGxpbmVXaWR0aE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLlNjcmVlbkNvb3JkaW5hdGVzLFxuICAgICAgT1VUTElORV9DT0xPUl9GSVhFRDogdGhpcy5fb3V0bGluZUNvbG9yTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUuRml4ZWRDb2xvcixcbiAgICAgIE9VVExJTkVfQ09MT1JfTUlYRUQ6IHRoaXMuX291dGxpbmVDb2xvck1vZGUgPT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlLk1peGVkTGlnaHRpbmcsXG4gICAgfTtcblxuICAgIC8vID09IGdlbmVyYXRlIHNoYWRlciBjb2RlID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLnZlcnRleFNoYWRlciA9IHZlcnRleFNoYWRlcjtcbiAgICB0aGlzLmZyYWdtZW50U2hhZGVyID0gZnJhZ21lbnRTaGFkZXI7XG5cbiAgICAvLyA9PSB0ZXh0dXJlIGVuY29kaW5ncyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQ09NUEFUOiBwcmUtcjEzN1xuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTM3KSB7XG4gICAgICBjb25zdCBlbmNvZGluZ3MgPVxuICAgICAgICAodGhpcy5zaGFkZVRleHR1cmUgIT09IG51bGxcbiAgICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbignc2hhZGVUZXh0dXJlVGV4ZWxUb0xpbmVhcicsIHRoaXMuc2hhZGVUZXh0dXJlLmVuY29kaW5nKSArICdcXG4nXG4gICAgICAgICAgOiAnJykgK1xuICAgICAgICAodGhpcy5zcGhlcmVBZGQgIT09IG51bGxcbiAgICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbignc3BoZXJlQWRkVGV4ZWxUb0xpbmVhcicsIHRoaXMuc3BoZXJlQWRkLmVuY29kaW5nKSArICdcXG4nXG4gICAgICAgICAgOiAnJykgK1xuICAgICAgICAodGhpcy5yaW1UZXh0dXJlICE9PSBudWxsXG4gICAgICAgICAgPyBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24oJ3JpbVRleHR1cmVUZXhlbFRvTGluZWFyJywgdGhpcy5yaW1UZXh0dXJlLmVuY29kaW5nKSArICdcXG4nXG4gICAgICAgICAgOiAnJyk7XG4gICAgICB0aGlzLmZyYWdtZW50U2hhZGVyID0gZW5jb2RpbmdzICsgZnJhZ21lbnRTaGFkZXI7XG4gICAgfVxuXG4gICAgLy8gPT0gc2V0IG5lZWRzVXBkYXRlIGZsYWcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMubmVlZHNVcGRhdGUgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBfdXBkYXRlQ3VsbEZhY2UoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLmlzT3V0bGluZSkge1xuICAgICAgaWYgKHRoaXMuY3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5PZmYpIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuRG91YmxlU2lkZTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5jdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkZyb250KSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkJhY2tTaWRlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuQmFjaykge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Gcm9udFNpZGU7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0aGlzLm91dGxpbmVDdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLk9mZikge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Eb3VibGVTaWRlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm91dGxpbmVDdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkZyb250KSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkJhY2tTaWRlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm91dGxpbmVDdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkJhY2spIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuRnJvbnRTaWRlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwiLyogdHNsaW50OmRpc2FibGU6bWVtYmVyLW9yZGVyaW5nICovXG5cbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB2ZXJ0ZXhTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL3VubGl0LnZlcnQnO1xuaW1wb3J0IGZyYWdtZW50U2hhZGVyIGZyb20gJy4vc2hhZGVycy91bmxpdC5mcmFnJztcblxuZXhwb3J0IGludGVyZmFjZSBWUk1VbmxpdE1hdGVyaWFsUGFyYW1ldGVycyBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsUGFyYW1ldGVycyB7XG4gIGN1dG9mZj86IG51bWJlcjsgLy8gX0N1dG9mZlxuICBtYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfTWFpblRleFxuICBtYWluVGV4PzogVEhSRUUuVGV4dHVyZTsgLy8gX01haW5UZXggKHdpbGwgYmUgcmVuYW1lZCB0byBtYXApXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgbWFpblRleF9TVD86IFRIUkVFLlZlY3RvcjQ7IC8vIF9NYWluVGV4X1NUXG5cbiAgcmVuZGVyVHlwZT86IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlIHwgbnVtYmVyO1xufVxuXG5leHBvcnQgZW51bSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZSB7XG4gIE9wYXF1ZSxcbiAgQ3V0b3V0LFxuICBUcmFuc3BhcmVudCxcbiAgVHJhbnNwYXJlbnRXaXRoWldyaXRlLFxufVxuXG4vKipcbiAqIFRoaXMgaXMgYSBtYXRlcmlhbCB0aGF0IGlzIGFuIGVxdWl2YWxlbnQgb2YgXCJWUk0vVW5saXQqKipcIiBvbiBWUk0gc3BlYywgdGhvc2UgbWF0ZXJpYWxzIGFyZSBhbHJlYWR5IGtpbmRhIGRlcHJlY2F0ZWQgdGhvdWdoLi4uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1VbmxpdE1hdGVyaWFsIGV4dGVuZHMgVEhSRUUuU2hhZGVyTWF0ZXJpYWwge1xuICAvKipcbiAgICogUmVhZG9ubHkgYm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGlzIGlzIGEgW1tWUk1VbmxpdE1hdGVyaWFsXV0uXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgaXNWUk1VbmxpdE1hdGVyaWFsOiBib29sZWFuID0gdHJ1ZTtcblxuICBwdWJsaWMgY3V0b2ZmID0gMC41O1xuICBwdWJsaWMgbWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9NYWluVGV4XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgcHVibGljIG1haW5UZXhfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfTWFpblRleF9TVFxuICBwcml2YXRlIF9yZW5kZXJUeXBlID0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuT3BhcXVlO1xuXG4gIHB1YmxpYyBzaG91bGRBcHBseVVuaWZvcm1zID0gdHJ1ZTsgLy8gd2hlbiB0aGlzIGlzIHRydWUsIGFwcGx5VW5pZm9ybXMgZWZmZWN0c1xuXG4gIGNvbnN0cnVjdG9yKHBhcmFtZXRlcnM/OiBWUk1VbmxpdE1hdGVyaWFsUGFyYW1ldGVycykge1xuICAgIHN1cGVyKCk7XG5cbiAgICBpZiAocGFyYW1ldGVycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBwYXJhbWV0ZXJzID0ge307XG4gICAgfVxuXG4gICAgLy8gPT0gZW5hYmxpbmcgYnVuY2ggb2Ygc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHBhcmFtZXRlcnMuZm9nID0gdHJ1ZTtcbiAgICBwYXJhbWV0ZXJzLmNsaXBwaW5nID0gdHJ1ZTtcblxuICAgIC8vIENPTVBBVDogcHJlLXIxMjlcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMTc4OFxuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTI5KSB7XG4gICAgICAocGFyYW1ldGVycyBhcyBhbnkpLnNraW5uaW5nID0gKHBhcmFtZXRlcnMgYXMgYW55KS5za2lubmluZyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDT01QQVQ6IHByZS1yMTMxXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjIxNjlcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEzMSkge1xuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaFRhcmdldHMgPSAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoVGFyZ2V0cyB8fCBmYWxzZTtcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhOb3JtYWxzID0gKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaE5vcm1hbHMgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gPT0gdW5pZm9ybXMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHBhcmFtZXRlcnMudW5pZm9ybXMgPSBUSFJFRS5Vbmlmb3Jtc1V0aWxzLm1lcmdlKFtcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmNvbW1vbiwgLy8gbWFwXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5mb2csXG4gICAgICB7XG4gICAgICAgIGN1dG9mZjogeyB2YWx1ZTogMC41IH0sXG4gICAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgICAgICAgbWFpblRleF9TVDogeyB2YWx1ZTogbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKSB9LFxuICAgICAgfSxcbiAgICBdKTtcblxuICAgIC8vID09IGZpbmFsbHkgY29tcGlsZSB0aGUgc2hhZGVyIHByb2dyYW0gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLnNldFZhbHVlcyhwYXJhbWV0ZXJzKTtcblxuICAgIC8vID09IHVwZGF0ZSBzaGFkZXIgc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gICAgdGhpcy5fYXBwbHlVbmlmb3JtcygpO1xuICB9XG5cbiAgZ2V0IG1haW5UZXgoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLm1hcDtcbiAgfVxuXG4gIHNldCBtYWluVGV4KHQ6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XG4gICAgdGhpcy5tYXAgPSB0O1xuICB9XG5cbiAgZ2V0IHJlbmRlclR5cGUoKTogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUge1xuICAgIHJldHVybiB0aGlzLl9yZW5kZXJUeXBlO1xuICB9XG5cbiAgc2V0IHJlbmRlclR5cGUodDogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUpIHtcbiAgICB0aGlzLl9yZW5kZXJUeXBlID0gdDtcblxuICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRoaXMuX3JlbmRlclR5cGUgIT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50O1xuICAgIHRoaXMudHJhbnNwYXJlbnQgPVxuICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQgfHxcbiAgICAgIHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoaXMgbWF0ZXJpYWwuXG4gICAqIFVzdWFsbHkgdGhpcyB3aWxsIGJlIGNhbGxlZCB2aWEgW1tWUk0udXBkYXRlXV0gc28geW91IGRvbid0IGhhdmUgdG8gY2FsbCB0aGlzIG1hbnVhbGx5LlxuICAgKlxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lIHNpbmNlIGxhc3QgdXBkYXRlXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlVlJNTWF0ZXJpYWxzKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XG4gIH1cblxuICBwdWJsaWMgY29weShzb3VyY2U6IHRoaXMpOiB0aGlzIHtcbiAgICBzdXBlci5jb3B5KHNvdXJjZSk7XG5cbiAgICAvLyA9PSBjb3B5IG1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5jdXRvZmYgPSBzb3VyY2UuY3V0b2ZmO1xuICAgIHRoaXMubWFwID0gc291cmNlLm1hcDtcbiAgICB0aGlzLm1haW5UZXhfU1QuY29weShzb3VyY2UubWFpblRleF9TVCk7XG4gICAgdGhpcy5yZW5kZXJUeXBlID0gc291cmNlLnJlbmRlclR5cGU7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBseSB1cGRhdGVkIHVuaWZvcm0gdmFyaWFibGVzLlxuICAgKi9cbiAgcHJpdmF0ZSBfYXBwbHlVbmlmb3JtcygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuc2hvdWxkQXBwbHlVbmlmb3Jtcykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLnNob3VsZEFwcGx5VW5pZm9ybXMgPSBmYWxzZTtcblxuICAgIHRoaXMudW5pZm9ybXMuY3V0b2ZmLnZhbHVlID0gdGhpcy5jdXRvZmY7XG4gICAgdGhpcy51bmlmb3Jtcy5tYXAudmFsdWUgPSB0aGlzLm1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm1haW5UZXhfU1QudmFsdWUuY29weSh0aGlzLm1haW5UZXhfU1QpO1xuICB9XG5cbiAgcHJpdmF0ZSBfdXBkYXRlU2hhZGVyQ29kZSgpOiB2b2lkIHtcbiAgICB0aGlzLmRlZmluZXMgPSB7XG4gICAgICBSRU5ERVJUWVBFX09QQVFVRTogdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuT3BhcXVlLFxuICAgICAgUkVOREVSVFlQRV9DVVRPVVQ6IHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLkN1dG91dCxcbiAgICAgIFJFTkRFUlRZUEVfVFJBTlNQQVJFTlQ6XG4gICAgICAgIHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50IHx8XG4gICAgICAgIHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50V2l0aFpXcml0ZSxcbiAgICB9O1xuXG4gICAgdGhpcy52ZXJ0ZXhTaGFkZXIgPSB2ZXJ0ZXhTaGFkZXI7XG4gICAgdGhpcy5mcmFnbWVudFNoYWRlciA9IGZyYWdtZW50U2hhZGVyO1xuXG4gICAgLy8gPT0gc2V0IG5lZWRzVXBkYXRlIGZsYWcgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMubmVlZHNVcGRhdGUgPSB0cnVlO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBHTFRGU2NoZW1hLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyBNVG9vbk1hdGVyaWFsLCBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSB9IGZyb20gJy4vTVRvb25NYXRlcmlhbCc7XG5pbXBvcnQgeyBWUk1VbmxpdE1hdGVyaWFsLCBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZSB9IGZyb20gJy4vVlJNVW5saXRNYXRlcmlhbCc7XG5cbi8qKlxuICogT3B0aW9ucyBmb3IgYSBbW1ZSTU1hdGVyaWFsSW1wb3J0ZXJdXSBpbnN0YW5jZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWUk1NYXRlcmlhbEltcG9ydGVyT3B0aW9ucyB7XG4gIC8qKlxuICAgKiBTcGVjaWZ5IHRoZSBlbmNvZGluZyBvZiBpbnB1dCB1bmlmb3JtIGNvbG9ycyBhbmQgdGV4dHVyZXMuXG4gICAqXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuc1JHQkVuY29kaW5nYCwgdXNlIGBUSFJFRS5zUkdCRW5jb2RpbmdgLlxuICAgKlxuICAgKiBUaGUgaW1wb3J0ZXIgd2lsbCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYCBpZiB0aGlzIG9wdGlvbiBpc24ndCBzcGVjaWZpZWQuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9yZW5kZXJlcnMvV2ViR0xSZW5kZXJlci5vdXRwdXRFbmNvZGluZ1xuICAgKi9cbiAgZW5jb2Rpbmc/OiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmc7XG5cbiAgLyoqXG4gICAqIEEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgYFByb21pc2VgIG9mIGVudmlyb25tZW50IG1hcCB0ZXh0dXJlLlxuICAgKiBUaGUgaW1wb3J0ZXIgd2lsbCBhdHRlbXB0IHRvIGNhbGwgdGhpcyBmdW5jdGlvbiB3aGVuIGl0IGhhdmUgdG8gdXNlIGFuIGVudm1hcC5cbiAgICovXG4gIHJlcXVlc3RFbnZNYXA/OiAoKSA9PiBQcm9taXNlPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcbn1cblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgVlJNIG1hdGVyaWFscyBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1NYXRlcmlhbEltcG9ydGVyIHtcbiAgcHJpdmF0ZSByZWFkb25seSBfZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZztcbiAgcHJpdmF0ZSByZWFkb25seSBfcmVxdWVzdEVudk1hcD86ICgpID0+IFByb21pc2U8VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNTWF0ZXJpYWxJbXBvcnRlci5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyBvZiB0aGUgVlJNTWF0ZXJpYWxJbXBvcnRlclxuICAgKi9cbiAgY29uc3RydWN0b3Iob3B0aW9uczogVlJNTWF0ZXJpYWxJbXBvcnRlck9wdGlvbnMgPSB7fSkge1xuICAgIHRoaXMuX2VuY29kaW5nID0gb3B0aW9ucy5lbmNvZGluZyB8fCBUSFJFRS5MaW5lYXJFbmNvZGluZztcbiAgICBpZiAodGhpcy5fZW5jb2RpbmcgIT09IFRIUkVFLkxpbmVhckVuY29kaW5nICYmIHRoaXMuX2VuY29kaW5nICE9PSBUSFJFRS5zUkdCRW5jb2RpbmcpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgJ1RoZSBzcGVjaWZpZWQgY29sb3IgZW5jb2RpbmcgbWlnaHQgbm90IHdvcmsgcHJvcGVybHkgd2l0aCBWUk1NYXRlcmlhbEltcG9ydGVyLiBZb3UgbWlnaHQgd2FudCB0byB1c2UgVEhSRUUuc1JHQkVuY29kaW5nIGluc3RlYWQuJyxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgdGhpcy5fcmVxdWVzdEVudk1hcCA9IG9wdGlvbnMucmVxdWVzdEVudk1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0IGFsbCB0aGUgbWF0ZXJpYWxzIG9mIGdpdmVuIEdMVEYgYmFzZWQgb24gVlJNIGV4dGVuc2lvbiBmaWVsZCBgbWF0ZXJpYWxQcm9wZXJ0aWVzYC5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZjogR0xURik6IFByb21pc2U8VEhSRUUuTWF0ZXJpYWxbXSB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgbWF0ZXJpYWxQcm9wZXJ0aWVzOiBWUk1TY2hlbWEuTWF0ZXJpYWxbXSB8IHVuZGVmaW5lZCA9IHZybUV4dC5tYXRlcmlhbFByb3BlcnRpZXM7XG4gICAgaWYgKCFtYXRlcmlhbFByb3BlcnRpZXMpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG5vZGVQcmltaXRpdmVzTWFwID0gYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGYpO1xuICAgIGNvbnN0IG1hdGVyaWFsTGlzdDogeyBbdnJtTWF0ZXJpYWxJbmRleDogbnVtYmVyXTogeyBzdXJmYWNlOiBUSFJFRS5NYXRlcmlhbDsgb3V0bGluZT86IFRIUkVFLk1hdGVyaWFsIH0gfSA9IHt9O1xuICAgIGNvbnN0IG1hdGVyaWFsczogVEhSRUUuTWF0ZXJpYWxbXSA9IFtdOyAvLyByZXN1bHRcblxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgQXJyYXkuZnJvbShub2RlUHJpbWl0aXZlc01hcC5lbnRyaWVzKCkpLm1hcChhc3luYyAoW25vZGVJbmRleCwgcHJpbWl0aXZlc10pID0+IHtcbiAgICAgICAgY29uc3Qgc2NoZW1hTm9kZTogR0xURlNjaGVtYS5Ob2RlID0gZ2x0Zi5wYXJzZXIuanNvbi5ub2Rlc1tub2RlSW5kZXhdO1xuICAgICAgICBjb25zdCBzY2hlbWFNZXNoOiBHTFRGU2NoZW1hLk1lc2ggPSBnbHRmLnBhcnNlci5qc29uLm1lc2hlc1tzY2hlbWFOb2RlLm1lc2ghXTtcblxuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICBwcmltaXRpdmVzLm1hcChhc3luYyAocHJpbWl0aXZlLCBwcmltaXRpdmVJbmRleCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgc2NoZW1hUHJpbWl0aXZlID0gc2NoZW1hTWVzaC5wcmltaXRpdmVzW3ByaW1pdGl2ZUluZGV4XTtcblxuICAgICAgICAgICAgLy8gc29tZSBnbFRGIG1pZ2h0IGhhdmUgYm90aCBgbm9kZS5tZXNoYCBhbmQgYG5vZGUuY2hpbGRyZW5gIGF0IG9uY2VcbiAgICAgICAgICAgIC8vIGFuZCBHTFRGTG9hZGVyIGhhbmRsZXMgYm90aCBtZXNoIHByaW1pdGl2ZXMgYW5kIFwiY2hpbGRyZW5cIiBpbiBnbFRGIGFzIFwiY2hpbGRyZW5cIiBpbiBUSFJFRVxuICAgICAgICAgICAgLy8gSXQgc2VlbXMgR0xURkxvYWRlciBoYW5kbGVzIHByaW1pdGl2ZXMgZmlyc3QgdGhlbiBoYW5kbGVzIFwiY2hpbGRyZW5cIiBpbiBnbFRGIChpdCdzIGx1Y2t5ISlcbiAgICAgICAgICAgIC8vIHNvIHdlIHNob3VsZCBpZ25vcmUgKHByaW1pdGl2ZXMubGVuZ3RoKXRoIGFuZCBmb2xsb3dpbmcgY2hpbGRyZW4gb2YgYG1lc2guY2hpbGRyZW5gXG4gICAgICAgICAgICAvLyBUT0RPOiBzYW5pdGl6ZSB0aGlzIGFmdGVyIEdMVEZMb2FkZXIgcGx1Z2luIHN5c3RlbSBnZXRzIGludHJvZHVjZWQgOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMTg0MjFcbiAgICAgICAgICAgIGlmICghc2NoZW1hUHJpbWl0aXZlKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlR2VvbWV0cnkgPSBwcmltaXRpdmUuZ2VvbWV0cnk7XG4gICAgICAgICAgICBjb25zdCBwcmltaXRpdmVWZXJ0aWNlcyA9IHByaW1pdGl2ZUdlb21ldHJ5LmluZGV4XG4gICAgICAgICAgICAgID8gcHJpbWl0aXZlR2VvbWV0cnkuaW5kZXguY291bnRcbiAgICAgICAgICAgICAgOiBwcmltaXRpdmVHZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uLmNvdW50IC8gMztcblxuICAgICAgICAgICAgLy8gaWYgcHJpbWl0aXZlcyBtYXRlcmlhbCBpcyBub3QgYW4gYXJyYXksIG1ha2UgaXQgYW4gYXJyYXlcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwcmltaXRpdmUubWF0ZXJpYWwpKSB7XG4gICAgICAgICAgICAgIHByaW1pdGl2ZS5tYXRlcmlhbCA9IFtwcmltaXRpdmUubWF0ZXJpYWxdO1xuICAgICAgICAgICAgICBwcmltaXRpdmVHZW9tZXRyeS5hZGRHcm91cCgwLCBwcmltaXRpdmVWZXJ0aWNlcywgMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGNyZWF0ZSAvIHB1c2ggdG8gY2FjaGUgKG9yIHBvcCBmcm9tIGNhY2hlKSB2cm0gbWF0ZXJpYWxzXG4gICAgICAgICAgICBjb25zdCB2cm1NYXRlcmlhbEluZGV4ID0gc2NoZW1hUHJpbWl0aXZlLm1hdGVyaWFsITtcblxuICAgICAgICAgICAgbGV0IHByb3BzID0gbWF0ZXJpYWxQcm9wZXJ0aWVzW3ZybU1hdGVyaWFsSW5kZXhdO1xuICAgICAgICAgICAgaWYgKCFwcm9wcykge1xuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICAgYFZSTU1hdGVyaWFsSW1wb3J0ZXI6IFRoZXJlIGFyZSBubyBtYXRlcmlhbCBkZWZpbml0aW9uIGZvciBtYXRlcmlhbCAjJHt2cm1NYXRlcmlhbEluZGV4fSBvbiBWUk0gZXh0ZW5zaW9uLmAsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIHByb3BzID0geyBzaGFkZXI6ICdWUk1fVVNFX0dMVEZTSEFERVInIH07IC8vIGZhbGxiYWNrXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGxldCB2cm1NYXRlcmlhbHM6IHsgc3VyZmFjZTogVEhSRUUuTWF0ZXJpYWw7IG91dGxpbmU/OiBUSFJFRS5NYXRlcmlhbCB9O1xuICAgICAgICAgICAgaWYgKG1hdGVyaWFsTGlzdFt2cm1NYXRlcmlhbEluZGV4XSkge1xuICAgICAgICAgICAgICB2cm1NYXRlcmlhbHMgPSBtYXRlcmlhbExpc3RbdnJtTWF0ZXJpYWxJbmRleF07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB2cm1NYXRlcmlhbHMgPSBhd2FpdCB0aGlzLmNyZWF0ZVZSTU1hdGVyaWFscyhwcmltaXRpdmUubWF0ZXJpYWxbMF0sIHByb3BzLCBnbHRmKTtcbiAgICAgICAgICAgICAgbWF0ZXJpYWxMaXN0W3ZybU1hdGVyaWFsSW5kZXhdID0gdnJtTWF0ZXJpYWxzO1xuXG4gICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKHZybU1hdGVyaWFscy5zdXJmYWNlKTtcbiAgICAgICAgICAgICAgaWYgKHZybU1hdGVyaWFscy5vdXRsaW5lKSB7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWxzLnB1c2godnJtTWF0ZXJpYWxzLm91dGxpbmUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHN1cmZhY2VcbiAgICAgICAgICAgIHByaW1pdGl2ZS5tYXRlcmlhbFswXSA9IHZybU1hdGVyaWFscy5zdXJmYWNlO1xuXG4gICAgICAgICAgICAvLyBlbnZtYXBcbiAgICAgICAgICAgIGlmICh0aGlzLl9yZXF1ZXN0RW52TWFwICYmICh2cm1NYXRlcmlhbHMuc3VyZmFjZSBhcyBhbnkpLmlzTWVzaFN0YW5kYXJkTWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgdGhpcy5fcmVxdWVzdEVudk1hcCgpLnRoZW4oKGVudk1hcCkgPT4ge1xuICAgICAgICAgICAgICAgICh2cm1NYXRlcmlhbHMuc3VyZmFjZSBhcyBhbnkpLmVudk1hcCA9IGVudk1hcDtcbiAgICAgICAgICAgICAgICB2cm1NYXRlcmlhbHMuc3VyZmFjZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZW5kZXIgb3JkZXJcbiAgICAgICAgICAgIHByaW1pdGl2ZS5yZW5kZXJPcmRlciA9IHByb3BzLnJlbmRlclF1ZXVlIHx8IDIwMDA7XG5cbiAgICAgICAgICAgIC8vIG91dGxpbmUgKFwiMiBwYXNzIHNoYWRpbmcgdXNpbmcgZ3JvdXBzXCIgdHJpY2sgaGVyZSlcbiAgICAgICAgICAgIGlmICh2cm1NYXRlcmlhbHMub3V0bGluZSkge1xuICAgICAgICAgICAgICBwcmltaXRpdmUubWF0ZXJpYWxbMV0gPSB2cm1NYXRlcmlhbHMub3V0bGluZTtcbiAgICAgICAgICAgICAgcHJpbWl0aXZlR2VvbWV0cnkuYWRkR3JvdXAoMCwgcHJpbWl0aXZlVmVydGljZXMsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHJldHVybiBtYXRlcmlhbHM7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgY3JlYXRlVlJNTWF0ZXJpYWxzKFxuICAgIG9yaWdpbmFsTWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsLFxuICAgIHZybVByb3BzOiBWUk1TY2hlbWEuTWF0ZXJpYWwsXG4gICAgZ2x0ZjogR0xURixcbiAgKTogUHJvbWlzZTx7XG4gICAgc3VyZmFjZTogVEhSRUUuTWF0ZXJpYWw7XG4gICAgb3V0bGluZT86IFRIUkVFLk1hdGVyaWFsO1xuICB9PiB7XG4gICAgbGV0IG5ld1N1cmZhY2U6IFRIUkVFLk1hdGVyaWFsIHwgdW5kZWZpbmVkO1xuICAgIGxldCBuZXdPdXRsaW5lOiBUSFJFRS5NYXRlcmlhbCB8IHVuZGVmaW5lZDtcblxuICAgIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vTVRvb24nKSB7XG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcblxuICAgICAgLy8gd2UgbmVlZCB0byBnZXQgcmlkIG9mIHRoZXNlIHByb3BlcnRpZXNcbiAgICAgIFsnc3JjQmxlbmQnLCAnZHN0QmxlbmQnLCAnaXNGaXJzdFNldHVwJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgICBpZiAocGFyYW1zW25hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkZWxldGUgcGFyYW1zW25hbWVdO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gdGhlc2UgdGV4dHVyZXMgbXVzdCBiZSBzUkdCIEVuY29kaW5nLCBkZXBlbmRzIG9uIGN1cnJlbnQgY29sb3JzcGFjZVxuICAgICAgWydtYWluVGV4JywgJ3NoYWRlVGV4dHVyZScsICdlbWlzc2lvbk1hcCcsICdzcGhlcmVBZGQnLCAncmltVGV4dHVyZSddLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgaWYgKHBhcmFtc1tuYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcGFyYW1zW25hbWVdLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBzcGVjaWZ5IHVuaWZvcm0gY29sb3IgZW5jb2RpbmdzXG4gICAgICBwYXJhbXMuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcblxuICAgICAgLy8gZG9uZVxuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBNVG9vbk1hdGVyaWFsKHBhcmFtcyk7XG5cbiAgICAgIC8vIG91dGxpbmVcbiAgICAgIGlmIChwYXJhbXMub3V0bGluZVdpZHRoTW9kZSAhPT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuTm9uZSkge1xuICAgICAgICBwYXJhbXMuaXNPdXRsaW5lID0gdHJ1ZTtcbiAgICAgICAgbmV3T3V0bGluZSA9IG5ldyBNVG9vbk1hdGVyaWFsKHBhcmFtcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vVW5saXRUZXh0dXJlJykge1xuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLk9wYXF1ZTtcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL1VubGl0Q3V0b3V0Jykge1xuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLkN1dG91dDtcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL1VubGl0VHJhbnNwYXJlbnQnKSB7XG4gICAgICAvLyB0aGlzIGlzIHZlcnkgbGVnYWN5XG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcbiAgICAgIHBhcmFtcy5yZW5kZXJUeXBlID0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQ7XG4gICAgICBuZXdTdXJmYWNlID0gbmV3IFZSTVVubGl0TWF0ZXJpYWwocGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9VbmxpdFRyYW5zcGFyZW50WldyaXRlJykge1xuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAodnJtUHJvcHMuc2hhZGVyICE9PSAnVlJNX1VTRV9HTFRGU0hBREVSJykge1xuICAgICAgICBjb25zb2xlLndhcm4oYFVua25vd24gc2hhZGVyIGRldGVjdGVkOiBcIiR7dnJtUHJvcHMuc2hhZGVyfVwiYCk7XG4gICAgICAgIC8vIHRoZW4gcHJlc3VtZSBhcyBWUk1fVVNFX0dMVEZTSEFERVJcbiAgICAgIH1cblxuICAgICAgbmV3U3VyZmFjZSA9IHRoaXMuX2NvbnZlcnRHTFRGTWF0ZXJpYWwob3JpZ2luYWxNYXRlcmlhbC5jbG9uZSgpKTtcbiAgICB9XG5cbiAgICBuZXdTdXJmYWNlLm5hbWUgPSBvcmlnaW5hbE1hdGVyaWFsLm5hbWU7XG4gICAgbmV3U3VyZmFjZS51c2VyRGF0YSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxNYXRlcmlhbC51c2VyRGF0YSkpO1xuICAgIG5ld1N1cmZhY2UudXNlckRhdGEudnJtTWF0ZXJpYWxQcm9wZXJ0aWVzID0gdnJtUHJvcHM7XG5cbiAgICBpZiAobmV3T3V0bGluZSkge1xuICAgICAgbmV3T3V0bGluZS5uYW1lID0gb3JpZ2luYWxNYXRlcmlhbC5uYW1lICsgJyAoT3V0bGluZSknO1xuICAgICAgbmV3T3V0bGluZS51c2VyRGF0YSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxNYXRlcmlhbC51c2VyRGF0YSkpO1xuICAgICAgbmV3T3V0bGluZS51c2VyRGF0YS52cm1NYXRlcmlhbFByb3BlcnRpZXMgPSB2cm1Qcm9wcztcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3VyZmFjZTogbmV3U3VyZmFjZSxcbiAgICAgIG91dGxpbmU6IG5ld091dGxpbmUsXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBpZiAobmFtZVswXSAhPT0gJ18nKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFZSTU1hdGVyaWFsczogR2l2ZW4gcHJvcGVydHkgbmFtZSBcIiR7bmFtZX1cIiBtaWdodCBiZSBpbnZhbGlkYCk7XG4gICAgICByZXR1cm4gbmFtZTtcbiAgICB9XG4gICAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuXG4gICAgaWYgKCEvW0EtWl0vLnRlc3QobmFtZVswXSkpIHtcbiAgICAgIGNvbnNvbGUud2FybihgVlJNTWF0ZXJpYWxzOiBHaXZlbiBwcm9wZXJ0eSBuYW1lIFwiJHtuYW1lfVwiIG1pZ2h0IGJlIGludmFsaWRgKTtcbiAgICAgIHJldHVybiBuYW1lO1xuICAgIH1cbiAgICByZXR1cm4gbmFtZVswXS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zdWJzdHJpbmcoMSk7XG4gIH1cblxuICBwcml2YXRlIF9jb252ZXJ0R0xURk1hdGVyaWFsKG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCk6IFRIUkVFLk1hdGVyaWFsIHtcbiAgICBpZiAoKG1hdGVyaWFsIGFzIGFueSkuaXNNZXNoU3RhbmRhcmRNYXRlcmlhbCkge1xuICAgICAgY29uc3QgbXRsID0gbWF0ZXJpYWwgYXMgVEhSRUUuTWVzaFN0YW5kYXJkTWF0ZXJpYWw7XG5cbiAgICAgIGlmIChtdGwubWFwKSB7XG4gICAgICAgIG10bC5tYXAuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcbiAgICAgIH1cbiAgICAgIGlmIChtdGwuZW1pc3NpdmVNYXApIHtcbiAgICAgICAgbXRsLmVtaXNzaXZlTWFwLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9lbmNvZGluZyA9PT0gVEhSRUUuTGluZWFyRW5jb2RpbmcpIHtcbiAgICAgICAgbXRsLmNvbG9yLmNvbnZlcnRMaW5lYXJUb1NSR0IoKTtcbiAgICAgICAgbXRsLmVtaXNzaXZlLmNvbnZlcnRMaW5lYXJUb1NSR0IoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoKG1hdGVyaWFsIGFzIGFueSkuaXNNZXNoQmFzaWNNYXRlcmlhbCkge1xuICAgICAgY29uc3QgbXRsID0gbWF0ZXJpYWwgYXMgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWw7XG5cbiAgICAgIGlmIChtdGwubWFwKSB7XG4gICAgICAgIG10bC5tYXAuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2VuY29kaW5nID09PSBUSFJFRS5MaW5lYXJFbmNvZGluZykge1xuICAgICAgICBtdGwuY29sb3IuY29udmVydExpbmVhclRvU1JHQigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBtYXRlcmlhbDtcbiAgfVxuXG4gIHByaXZhdGUgX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMoXG4gICAgb3JpZ2luYWxNYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwsXG4gICAgdnJtUHJvcHM6IFZSTVNjaGVtYS5NYXRlcmlhbCxcbiAgICBnbHRmOiBHTFRGLFxuICApOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IHRhc2tMaXN0OiBBcnJheTxQcm9taXNlPGFueT4+ID0gW107XG4gICAgY29uc3QgcGFyYW1zOiBhbnkgPSB7fTtcblxuICAgIC8vIGV4dHJhY3QgdGV4dHVyZSBwcm9wZXJ0aWVzXG4gICAgaWYgKHZybVByb3BzLnRleHR1cmVQcm9wZXJ0aWVzKSB7XG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgT2JqZWN0LmtleXModnJtUHJvcHMudGV4dHVyZVByb3BlcnRpZXMpKSB7XG4gICAgICAgIGNvbnN0IG5ld05hbWUgPSB0aGlzLl9yZW5hbWVNYXRlcmlhbFByb3BlcnR5KG5hbWUpO1xuICAgICAgICBjb25zdCB0ZXh0dXJlSW5kZXggPSB2cm1Qcm9wcy50ZXh0dXJlUHJvcGVydGllc1tuYW1lXTtcblxuICAgICAgICB0YXNrTGlzdC5wdXNoKFxuICAgICAgICAgIGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ3RleHR1cmUnLCB0ZXh0dXJlSW5kZXgpLnRoZW4oKHRleHR1cmU6IFRIUkVFLlRleHR1cmUpID0+IHtcbiAgICAgICAgICAgIHBhcmFtc1tuZXdOYW1lXSA9IHRleHR1cmU7XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXh0cmFjdCBmbG9hdCBwcm9wZXJ0aWVzXG4gICAgaWYgKHZybVByb3BzLmZsb2F0UHJvcGVydGllcykge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKHZybVByb3BzLmZsb2F0UHJvcGVydGllcykpIHtcbiAgICAgICAgY29uc3QgbmV3TmFtZSA9IHRoaXMuX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZSk7XG4gICAgICAgIHBhcmFtc1tuZXdOYW1lXSA9IHZybVByb3BzLmZsb2F0UHJvcGVydGllc1tuYW1lXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleHRyYWN0IHZlY3RvciAoY29sb3IgdGJoKSBwcm9wZXJ0aWVzXG4gICAgaWYgKHZybVByb3BzLnZlY3RvclByb3BlcnRpZXMpIHtcbiAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBPYmplY3Qua2V5cyh2cm1Qcm9wcy52ZWN0b3JQcm9wZXJ0aWVzKSkge1xuICAgICAgICBsZXQgbmV3TmFtZSA9IHRoaXMuX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZSk7XG5cbiAgICAgICAgLy8gaWYgdGhpcyBpcyB0ZXh0dXJlU1QgKHNhbWUgbmFtZSBhcyB0ZXh0dXJlIG5hbWUgaXRzZWxmKSwgYWRkICdfU1QnXG4gICAgICAgIGNvbnN0IGlzVGV4dHVyZVNUID0gW1xuICAgICAgICAgICdfTWFpblRleCcsXG4gICAgICAgICAgJ19TaGFkZVRleHR1cmUnLFxuICAgICAgICAgICdfQnVtcE1hcCcsXG4gICAgICAgICAgJ19SZWNlaXZlU2hhZG93VGV4dHVyZScsXG4gICAgICAgICAgJ19TaGFkaW5nR3JhZGVUZXh0dXJlJyxcbiAgICAgICAgICAnX1JpbVRleHR1cmUnLFxuICAgICAgICAgICdfU3BoZXJlQWRkJyxcbiAgICAgICAgICAnX0VtaXNzaW9uTWFwJyxcbiAgICAgICAgICAnX091dGxpbmVXaWR0aFRleHR1cmUnLFxuICAgICAgICAgICdfVXZBbmltTWFza1RleHR1cmUnLFxuICAgICAgICBdLnNvbWUoKHRleHR1cmVOYW1lKSA9PiBuYW1lID09PSB0ZXh0dXJlTmFtZSk7XG4gICAgICAgIGlmIChpc1RleHR1cmVTVCkge1xuICAgICAgICAgIG5ld05hbWUgKz0gJ19TVCc7XG4gICAgICAgIH1cblxuICAgICAgICBwYXJhbXNbbmV3TmFtZV0gPSBuZXcgVEhSRUUuVmVjdG9yNCguLi52cm1Qcm9wcy52ZWN0b3JQcm9wZXJ0aWVzW25hbWVdKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDT01QQVQ6IHByZS1yMTI5XG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjE3ODhcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEyOSkge1xuICAgICAgcGFyYW1zLnNraW5uaW5nID0gKG9yaWdpbmFsTWF0ZXJpYWwgYXMgYW55KS5za2lubmluZyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDT01QQVQ6IHByZS1yMTMxXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjIxNjlcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEzMSkge1xuICAgICAgcGFyYW1zLm1vcnBoVGFyZ2V0cyA9IChvcmlnaW5hbE1hdGVyaWFsIGFzIGFueSkubW9ycGhUYXJnZXRzIHx8IGZhbHNlO1xuICAgICAgcGFyYW1zLm1vcnBoTm9ybWFscyA9IChvcmlnaW5hbE1hdGVyaWFsIGFzIGFueSkubW9ycGhOb3JtYWxzIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiBQcm9taXNlLmFsbCh0YXNrTGlzdCkudGhlbigoKSA9PiBwYXJhbXMpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1NZXRhIH0gZnJvbSAnLi9WUk1NZXRhJztcbmltcG9ydCB7IFZSTU1ldGFJbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuL1ZSTU1ldGFJbXBvcnRlck9wdGlvbnMnO1xuXG4vKipcbiAqIEFuIGltcG9ydGVyIHRoYXQgaW1wb3J0cyBhIHtAbGluayBWUk1NZXRhfSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1NZXRhSW1wb3J0ZXIge1xuICAvKipcbiAgICogSWYgYHRydWVgLCBpdCB3b24ndCBsb2FkIGl0cyB0aHVtYm5haWwgdGV4dHVyZSAoe0BsaW5rIFZSTU1ldGEudGV4dHVyZX0pLiBgZmFsc2VgIGJ5IGRlZmF1bHQuXG4gICAqL1xuICBwdWJsaWMgaWdub3JlVGV4dHVyZTogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zPzogVlJNTWV0YUltcG9ydGVyT3B0aW9ucykge1xuICAgIHRoaXMuaWdub3JlVGV4dHVyZSA9IG9wdGlvbnM/Lmlnbm9yZVRleHR1cmUgPz8gZmFsc2U7XG4gIH1cblxuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTU1ldGEgfCBudWxsPiB7XG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XG4gICAgaWYgKCF2cm1FeHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYU1ldGE6IFZSTVNjaGVtYS5NZXRhIHwgdW5kZWZpbmVkID0gdnJtRXh0Lm1ldGE7XG4gICAgaWYgKCFzY2hlbWFNZXRhKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBsZXQgdGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgfCB1bmRlZmluZWQ7XG4gICAgaWYgKCF0aGlzLmlnbm9yZVRleHR1cmUgJiYgc2NoZW1hTWV0YS50ZXh0dXJlICE9IG51bGwgJiYgc2NoZW1hTWV0YS50ZXh0dXJlICE9PSAtMSkge1xuICAgICAgdGV4dHVyZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ3RleHR1cmUnLCBzY2hlbWFNZXRhLnRleHR1cmUpO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBhbGxvd2VkVXNlck5hbWU6IHNjaGVtYU1ldGEuYWxsb3dlZFVzZXJOYW1lLFxuICAgICAgYXV0aG9yOiBzY2hlbWFNZXRhLmF1dGhvcixcbiAgICAgIGNvbW1lcmNpYWxVc3NhZ2VOYW1lOiBzY2hlbWFNZXRhLmNvbW1lcmNpYWxVc3NhZ2VOYW1lLFxuICAgICAgY29udGFjdEluZm9ybWF0aW9uOiBzY2hlbWFNZXRhLmNvbnRhY3RJbmZvcm1hdGlvbixcbiAgICAgIGxpY2Vuc2VOYW1lOiBzY2hlbWFNZXRhLmxpY2Vuc2VOYW1lLFxuICAgICAgb3RoZXJMaWNlbnNlVXJsOiBzY2hlbWFNZXRhLm90aGVyTGljZW5zZVVybCxcbiAgICAgIG90aGVyUGVybWlzc2lvblVybDogc2NoZW1hTWV0YS5vdGhlclBlcm1pc3Npb25VcmwsXG4gICAgICByZWZlcmVuY2U6IHNjaGVtYU1ldGEucmVmZXJlbmNlLFxuICAgICAgc2V4dWFsVXNzYWdlTmFtZTogc2NoZW1hTWV0YS5zZXh1YWxVc3NhZ2VOYW1lLFxuICAgICAgdGV4dHVyZTogdGV4dHVyZSA/PyB1bmRlZmluZWQsXG4gICAgICB0aXRsZTogc2NoZW1hTWV0YS50aXRsZSxcbiAgICAgIHZlcnNpb246IHNjaGVtYU1ldGEudmVyc2lvbixcbiAgICAgIHZpb2xlbnRVc3NhZ2VOYW1lOiBzY2hlbWFNZXRhLnZpb2xlbnRVc3NhZ2VOYW1lLFxuICAgIH07XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuY29uc3QgX21hdEEgPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xuXG4vKipcbiAqIEEgY29tcGF0IGZ1bmN0aW9uIGZvciBgTWF0cml4NC5pbnZlcnQoKWAgLyBgTWF0cml4NC5nZXRJbnZlcnNlKClgLlxuICogYE1hdHJpeDQuaW52ZXJ0KClgIGlzIGludHJvZHVjZWQgaW4gcjEyMyBhbmQgYE1hdHJpeDQuZ2V0SW52ZXJzZSgpYCBlbWl0cyBhIHdhcm5pbmcuXG4gKiBXZSBhcmUgZ29pbmcgdG8gdXNlIHRoaXMgY29tcGF0IGZvciBhIHdoaWxlLlxuICogQHBhcmFtIHRhcmdldCBBIHRhcmdldCBtYXRyaXhcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1hdDRJbnZlcnRDb21wYXQ8VCBleHRlbmRzIFRIUkVFLk1hdHJpeDQ+KHRhcmdldDogVCk6IFQge1xuICBpZiAoKHRhcmdldCBhcyBhbnkpLmludmVydCkge1xuICAgIHRhcmdldC5pbnZlcnQoKTtcbiAgfSBlbHNlIHtcbiAgICAodGFyZ2V0IGFzIGFueSkuZ2V0SW52ZXJzZShfbWF0QS5jb3B5KHRhcmdldCkpO1xuICB9XG5cbiAgcmV0dXJuIHRhcmdldDtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IG1hdDRJbnZlcnRDb21wYXQgfSBmcm9tICcuL21hdDRJbnZlcnRDb21wYXQnO1xuXG5leHBvcnQgY2xhc3MgTWF0cml4NEludmVyc2VDYWNoZSB7XG4gIC8qKlxuICAgKiBUaGUgdGFyZ2V0IG1hdHJpeC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtYXRyaXg6IFRIUkVFLk1hdHJpeDQ7XG5cbiAgLyoqXG4gICAqIEEgY2FjaGUgb2YgaW52ZXJzZSBvZiBjdXJyZW50IG1hdHJpeC5cbiAgICovXG4gIHByaXZhdGUgcmVhZG9ubHkgX2ludmVyc2VDYWNoZSA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XG5cbiAgLyoqXG4gICAqIEEgZmxhZyB0aGF0IG1ha2VzIGl0IHdhbnQgdG8gcmVjYWxjdWxhdGUgaXRzIHtAbGluayBfaW52ZXJzZUNhY2hlfS5cbiAgICogV2lsbCBiZSBzZXQgYHRydWVgIHdoZW4gYGVsZW1lbnRzYCBhcmUgbXV0YXRlZCBhbmQgYmUgdXNlZCBpbiBgZ2V0SW52ZXJzZWAuXG4gICAqL1xuICBwcml2YXRlIF9zaG91bGRVcGRhdGVJbnZlcnNlID0gdHJ1ZTtcblxuICAvKipcbiAgICogVGhlIG9yaWdpbmFsIG9mIGBtYXRyaXguZWxlbWVudHNgXG4gICAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbEVsZW1lbnRzOiBudW1iZXJbXTtcblxuICAvKipcbiAgICogSW52ZXJzZSBvZiBnaXZlbiBtYXRyaXguXG4gICAqIE5vdGUgdGhhdCBpdCB3aWxsIHJldHVybiBpdHMgaW50ZXJuYWwgcHJpdmF0ZSBpbnN0YW5jZS5cbiAgICogTWFrZSBzdXJlIGNvcHlpbmcgdGhpcyBiZWZvcmUgbXV0YXRlIHRoaXMuXG4gICAqL1xuICBwdWJsaWMgZ2V0IGludmVyc2UoKTogVEhSRUUuTWF0cml4NCB7XG4gICAgaWYgKHRoaXMuX3Nob3VsZFVwZGF0ZUludmVyc2UpIHtcbiAgICAgIG1hdDRJbnZlcnRDb21wYXQodGhpcy5faW52ZXJzZUNhY2hlLmNvcHkodGhpcy5tYXRyaXgpKTtcbiAgICAgIHRoaXMuX3Nob3VsZFVwZGF0ZUludmVyc2UgPSBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5faW52ZXJzZUNhY2hlO1xuICB9XG5cbiAgcHVibGljIGNvbnN0cnVjdG9yKG1hdHJpeDogVEhSRUUuTWF0cml4NCkge1xuICAgIHRoaXMubWF0cml4ID0gbWF0cml4O1xuXG4gICAgY29uc3QgaGFuZGxlcjogUHJveHlIYW5kbGVyPG51bWJlcltdPiA9IHtcbiAgICAgIHNldDogKG9iaiwgcHJvcDogYW55LCBuZXdWYWwpID0+IHtcbiAgICAgICAgdGhpcy5fc2hvdWxkVXBkYXRlSW52ZXJzZSA9IHRydWU7XG4gICAgICAgIG9ialtwcm9wXSA9IG5ld1ZhbDtcblxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0sXG4gICAgfTtcblxuICAgIHRoaXMuX29yaWdpbmFsRWxlbWVudHMgPSBtYXRyaXguZWxlbWVudHM7XG4gICAgbWF0cml4LmVsZW1lbnRzID0gbmV3IFByb3h5KG1hdHJpeC5lbGVtZW50cywgaGFuZGxlcik7XG4gIH1cblxuICBwdWJsaWMgcmV2ZXJ0KCk6IHZvaWQge1xuICAgIHRoaXMubWF0cml4LmVsZW1lbnRzID0gdGhpcy5fb3JpZ2luYWxFbGVtZW50cztcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgbWF0NEludmVydENvbXBhdCB9IGZyb20gJy4uL3V0aWxzL21hdDRJbnZlcnRDb21wYXQnO1xuaW1wb3J0IHsgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSB9IGZyb20gJy4uL3V0aWxzL21hdGgnO1xuaW1wb3J0IHsgTWF0cml4NEludmVyc2VDYWNoZSB9IGZyb20gJy4uL3V0aWxzL01hdHJpeDRJbnZlcnNlQ2FjaGUnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaCB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzJztcbi8vIGJhc2VkIG9uXG4vLyBodHRwOi8vcm9ja2V0anVtcC5za3IuanAvdW5pdHkzZC8xMDkvXG4vLyBodHRwczovL2dpdGh1Yi5jb20vZHdhbmdvL1VuaVZSTS9ibG9iL21hc3Rlci9TY3JpcHRzL1NwcmluZ0JvbmUvVlJNU3ByaW5nQm9uZS5jc1xuXG5jb25zdCBJREVOVElUWV9NQVRSSVg0ID0gT2JqZWN0LmZyZWV6ZShuZXcgVEhSRUUuTWF0cml4NCgpKTtcbmNvbnN0IElERU5USVRZX1FVQVRFUk5JT04gPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkpO1xuXG4vLyDoqIjnrpfkuK3jga7kuIDmmYLkv53lrZjnlKjlpInmlbDvvIjkuIDluqbjgqTjg7Pjgrnjgr/jg7PjgrnjgpLkvZzjgaPjgZ/jgonjgYLjgajjga/kvb/jgYTlm57jgZnvvIlcbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3YzQiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNDID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF9xdWF0QSA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5jb25zdCBfbWF0QSA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XG5jb25zdCBfbWF0QiA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRzIGEgc2luZ2xlIHNwcmluZyBib25lIG9mIGEgVlJNLlxuICogSXQgc2hvdWxkIGJlIG1hbmFnZWQgYnkgYSBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyXV0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lIHtcbiAgLyoqXG4gICAqIFJhZGl1cyBvZiB0aGUgYm9uZSwgd2lsbCBiZSB1c2VkIGZvciBjb2xsaXNpb24uXG4gICAqL1xuICBwdWJsaWMgcmFkaXVzOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFN0aWZmbmVzcyBmb3JjZSBvZiB0aGUgYm9uZS4gSW5jcmVhc2luZyB0aGUgdmFsdWUgPSBmYXN0ZXIgY29udmVyZ2VuY2UgKGZlZWxzIFwiaGFyZGVyXCIpLlxuICAgKiBPbiBVbmlWUk0sIGl0cyByYW5nZSBvbiBHVUkgaXMgYmV0d2VlbiBgMC4wYCBhbmQgYDQuMGAgLlxuICAgKi9cbiAgcHVibGljIHN0aWZmbmVzc0ZvcmNlOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFBvd2VyIG9mIHRoZSBncmF2aXR5IGFnYWluc3QgdGhpcyBib25lLlxuICAgKiBUaGUgXCJwb3dlclwiIHVzZWQgaW4gaGVyZSBpcyB2ZXJ5IGZhciBmcm9tIHNjaWVudGlmaWMgcGh5c2ljcyB0ZXJtLi4uXG4gICAqL1xuICBwdWJsaWMgZ3Jhdml0eVBvd2VyOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIERpcmVjdGlvbiBvZiB0aGUgZ3Jhdml0eSBhZ2FpbnN0IHRoaXMgYm9uZS5cbiAgICogVXN1YWxseSBpdCBzaG91bGQgYmUgbm9ybWFsaXplZC5cbiAgICovXG4gIHB1YmxpYyBncmF2aXR5RGlyOiBUSFJFRS5WZWN0b3IzO1xuXG4gIC8qKlxuICAgKiBEcmFnIGZvcmNlIG9mIHRoZSBib25lLiBJbmNyZWFzaW5nIHRoZSB2YWx1ZSA9IGxlc3Mgb3NjaWxsYXRpb24gKGZlZWxzIFwiaGVhdmllclwiKS5cbiAgICogT24gVW5pVlJNLCBpdHMgcmFuZ2Ugb24gR1VJIGlzIGJldHdlZW4gYDAuMGAgYW5kIGAxLjBgIC5cbiAgICovXG4gIHB1YmxpYyBkcmFnRm9yY2U6IG51bWJlcjtcblxuICAvKipcbiAgICogQ29sbGlkZXIgZ3JvdXBzIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cbiAgICovXG4gIHB1YmxpYyBjb2xsaWRlcnM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2hbXTtcblxuICAvKipcbiAgICogQW4gT2JqZWN0M0QgYXR0YWNoZWQgdG8gdGhpcyBib25lLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGJvbmU6IFRIUkVFLk9iamVjdDNEO1xuXG4gIC8qKlxuICAgKiBDdXJyZW50IHBvc2l0aW9uIG9mIGNoaWxkIHRhaWwsIGluIHdvcmxkIHVuaXQuIFdpbGwgYmUgdXNlZCBmb3IgdmVybGV0IGludGVncmF0aW9uLlxuICAgKi9cbiAgcHJvdGVjdGVkIF9jdXJyZW50VGFpbCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIFByZXZpb3VzIHBvc2l0aW9uIG9mIGNoaWxkIHRhaWwsIGluIHdvcmxkIHVuaXQuIFdpbGwgYmUgdXNlZCBmb3IgdmVybGV0IGludGVncmF0aW9uLlxuICAgKi9cbiAgcHJvdGVjdGVkIF9wcmV2VGFpbCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIE5leHQgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXG4gICAqIEFjdHVhbGx5IHVzZWQgb25seSBpbiBbW3VwZGF0ZV1dIGFuZCBpdCdzIGtpbmQgb2YgdGVtcG9yYXJ5IHZhcmlhYmxlLlxuICAgKi9cbiAgcHJvdGVjdGVkIF9uZXh0VGFpbCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIEluaXRpYWwgYXhpcyBvZiB0aGUgYm9uZSwgaW4gbG9jYWwgdW5pdC5cbiAgICovXG4gIHByb3RlY3RlZCBfYm9uZUF4aXMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG4gIC8qKlxuICAgKiBMZW5ndGggb2YgdGhlIGJvbmUgaW4gcmVsYXRpdmUgc3BhY2UgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciBub3JtYWxpemF0aW9uIGluIHVwZGF0ZSBsb29wLlxuICAgKiBJdCdzIHNhbWUgYXMgbG9jYWwgdW5pdCBsZW5ndGggdW5sZXNzIHRoZXJlIGFyZSBzY2FsZSB0cmFuc2Zvcm1hdGlvbiBpbiB3b3JsZCBtYXRyaXguXG4gICAqL1xuICBwcm90ZWN0ZWQgX2NlbnRlclNwYWNlQm9uZUxlbmd0aDogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBQb3NpdGlvbiBvZiB0aGlzIGJvbmUgaW4gcmVsYXRpdmUgc3BhY2UsIGtpbmQgb2YgYSB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBwcm90ZWN0ZWQgX2NlbnRlclNwYWNlUG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG4gIC8qKlxuICAgKiBUaGlzIHNwcmluZ2JvbmUgd2lsbCBiZSBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBzcGFjZSByZWxhdGl2ZSBmcm9tIHRoaXMgb2JqZWN0LlxuICAgKiBJZiB0aGlzIGlzIGBudWxsYCwgc3ByaW5nYm9uZSB3aWxsIGJlIGNhbGN1bGF0ZWQgaW4gd29ybGQgc3BhY2UuXG4gICAqL1xuICBwcm90ZWN0ZWQgX2NlbnRlcjogVEhSRUUuT2JqZWN0M0QgfCBudWxsID0gbnVsbDtcbiAgcHVibGljIGdldCBjZW50ZXIoKTogVEhSRUUuT2JqZWN0M0QgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5fY2VudGVyO1xuICB9XG4gIHB1YmxpYyBzZXQgY2VudGVyKGNlbnRlcjogVEhSRUUuT2JqZWN0M0QgfCBudWxsKSB7XG4gICAgLy8gY29udmVydCB0YWlscyB0byB3b3JsZCBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeENlbnRlclRvV29ybGQoX21hdEEpO1xuXG4gICAgdGhpcy5fY3VycmVudFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcbiAgICB0aGlzLl9wcmV2VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuICAgIHRoaXMuX25leHRUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG5cbiAgICAvLyB1bmluc3RhbGwgaW52ZXJzZSBjYWNoZVxuICAgIGlmICh0aGlzLl9jZW50ZXI/LnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5KSB7XG4gICAgICAodGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5IGFzIE1hdHJpeDRJbnZlcnNlQ2FjaGUpLnJldmVydCgpO1xuICAgICAgZGVsZXRlIHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eTtcbiAgICB9XG5cbiAgICAvLyBjaGFuZ2UgdGhlIGNlbnRlclxuICAgIHRoaXMuX2NlbnRlciA9IGNlbnRlcjtcblxuICAgIC8vIGluc3RhbGwgaW52ZXJzZSBjYWNoZVxuICAgIGlmICh0aGlzLl9jZW50ZXIpIHtcbiAgICAgIGlmICghdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5KSB7XG4gICAgICAgIHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSA9IG5ldyBNYXRyaXg0SW52ZXJzZUNhY2hlKHRoaXMuX2NlbnRlci5tYXRyaXhXb3JsZCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gY29udmVydCB0YWlscyB0byBjZW50ZXIgc3BhY2VcbiAgICB0aGlzLl9nZXRNYXRyaXhXb3JsZFRvQ2VudGVyKF9tYXRBKTtcblxuICAgIHRoaXMuX2N1cnJlbnRUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG4gICAgdGhpcy5fcHJldlRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcbiAgICB0aGlzLl9uZXh0VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuXG4gICAgLy8gY29udmVydCBjZW50ZXIgc3BhY2UgZGVwZW5kYW50IHN0YXRlXG4gICAgX21hdEEubXVsdGlwbHkodGhpcy5ib25lLm1hdHJpeFdvcmxkKTsgLy8g8J+UpSA/P1xuXG4gICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbi5zZXRGcm9tTWF0cml4UG9zaXRpb24oX21hdEEpO1xuXG4gICAgdGhpcy5fY2VudGVyU3BhY2VCb25lTGVuZ3RoID0gX3YzQVxuICAgICAgLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbilcbiAgICAgIC5hcHBseU1hdHJpeDQoX21hdEEpXG4gICAgICAuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pXG4gICAgICAubGVuZ3RoKCk7XG4gIH1cblxuICAvKipcbiAgICogUm90YXRpb24gb2YgcGFyZW50IGJvbmUsIGluIHdvcmxkIHVuaXQuXG4gICAqIFdlIHNob3VsZCB1cGRhdGUgdGhpcyBjb25zdGFudGx5IGluIFtbdXBkYXRlXV0uXG4gICAqL1xuICBwcml2YXRlIF9wYXJlbnRXb3JsZFJvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgbG9jYWwgbWF0cml4IG9mIHRoZSBib25lLlxuICAgKi9cbiAgcHJpdmF0ZSBfaW5pdGlhbExvY2FsTWF0cml4ID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgcm90YXRpb24gb2YgdGhlIGJvbmUuXG4gICAqL1xuICBwcml2YXRlIF9pbml0aWFsTG9jYWxSb3RhdGlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5cbiAgLyoqXG4gICAqIEluaXRpYWwgc3RhdGUgb2YgdGhlIHBvc2l0aW9uIG9mIGl0cyBjaGlsZC5cbiAgICovXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNU3ByaW5nQm9uZS5cbiAgICpcbiAgICogQHBhcmFtIGJvbmUgQW4gT2JqZWN0M0QgdGhhdCB3aWxsIGJlIGF0dGFjaGVkIHRvIHRoaXMgYm9uZVxuICAgKiBAcGFyYW0gcGFyYW1zIFNldmVyYWwgcGFyYW1ldGVycyByZWxhdGVkIHRvIGJlaGF2aW9yIG9mIHRoZSBzcHJpbmcgYm9uZVxuICAgKi9cbiAgY29uc3RydWN0b3IoYm9uZTogVEhSRUUuT2JqZWN0M0QsIHBhcmFtczogVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgPSB7fSkge1xuICAgIHRoaXMuYm9uZSA9IGJvbmU7IC8vIHVuaVZSTeOBp+OBriBwYXJlbnRcbiAgICB0aGlzLmJvbmUubWF0cml4QXV0b1VwZGF0ZSA9IGZhbHNlOyAvLyB1cGRhdGXjgavjgojjgoroqIjnrpfjgZXjgozjgovjga7jgad0aHJlZS5qc+WGheOBp+OBruiHquWLleWHpueQhuOBr+S4jeimgVxuXG4gICAgdGhpcy5yYWRpdXMgPSBwYXJhbXMucmFkaXVzID8/IDAuMDI7XG4gICAgdGhpcy5zdGlmZm5lc3NGb3JjZSA9IHBhcmFtcy5zdGlmZm5lc3NGb3JjZSA/PyAxLjA7XG4gICAgdGhpcy5ncmF2aXR5RGlyID0gcGFyYW1zLmdyYXZpdHlEaXJcbiAgICAgID8gbmV3IFRIUkVFLlZlY3RvcjMoKS5jb3B5KHBhcmFtcy5ncmF2aXR5RGlyKVxuICAgICAgOiBuZXcgVEhSRUUuVmVjdG9yMygpLnNldCgwLjAsIC0xLjAsIDAuMCk7XG4gICAgdGhpcy5ncmF2aXR5UG93ZXIgPSBwYXJhbXMuZ3Jhdml0eVBvd2VyID8/IDAuMDtcbiAgICB0aGlzLmRyYWdGb3JjZSA9IHBhcmFtcy5kcmFnRm9yY2UgPz8gMC40O1xuICAgIHRoaXMuY29sbGlkZXJzID0gcGFyYW1zLmNvbGxpZGVycyA/PyBbXTtcblxuICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24uc2V0RnJvbU1hdHJpeFBvc2l0aW9uKHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7XG5cbiAgICB0aGlzLl9pbml0aWFsTG9jYWxNYXRyaXguY29weSh0aGlzLmJvbmUubWF0cml4KTtcbiAgICB0aGlzLl9pbml0aWFsTG9jYWxSb3RhdGlvbi5jb3B5KHRoaXMuYm9uZS5xdWF0ZXJuaW9uKTtcblxuICAgIGlmICh0aGlzLmJvbmUuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyDmnKvnq6/jga7jg5zjg7zjg7PjgILlrZDjg5zjg7zjg7PjgYzjgYTjgarjgYTjgZ/jgoHjgIzoh6rliIbjga7lsJHjgZflhYjjgI3jgYzlrZDjg5zjg7zjg7PjgajjgYTjgYbjgZPjgajjgavjgZnjgotcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kd2FuZ28vVW5pVlJNL2Jsb2IvbWFzdGVyL0Fzc2V0cy9WUk0vVW5pVlJNL1NjcmlwdHMvU3ByaW5nQm9uZS9WUk1TcHJpbmdCb25lLmNzI0wyNDZcbiAgICAgIHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24uY29weSh0aGlzLmJvbmUucG9zaXRpb24pLm5vcm1hbGl6ZSgpLm11bHRpcGx5U2NhbGFyKDAuMDcpOyAvLyB2cm0wIHJlcXVpcmVzIGEgN2NtIGZpeGVkIGJvbmUgbGVuZ3RoIGZvciB0aGUgZmluYWwgbm9kZSBpbiBhIGNoYWluIC0gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy92cm0tc3BlY2lmaWNhdGlvbi90cmVlL21hc3Rlci9zcGVjaWZpY2F0aW9uL1ZSTUNfc3ByaW5nQm9uZS0xLjAtYmV0YSNhYm91dC1zcHJpbmctY29uZmlndXJhdGlvblxuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBmaXJzdENoaWxkID0gdGhpcy5ib25lLmNoaWxkcmVuWzBdO1xuICAgICAgdGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbi5jb3B5KGZpcnN0Q2hpbGQucG9zaXRpb24pO1xuICAgIH1cblxuICAgIC8vIEFwcGx5IHVwZGF0ZWQgcG9zaXRpb24gdG8gdGFpbCBzdGF0ZXNcbiAgICB0aGlzLmJvbmUubG9jYWxUb1dvcmxkKHRoaXMuX2N1cnJlbnRUYWlsLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbikpO1xuICAgIHRoaXMuX3ByZXZUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xuICAgIHRoaXMuX25leHRUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xuXG4gICAgdGhpcy5fYm9uZUF4aXMuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKS5ub3JtYWxpemUoKTtcbiAgICB0aGlzLl9jZW50ZXJTcGFjZUJvbmVMZW5ndGggPSBfdjNBXG4gICAgICAuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKVxuICAgICAgLmFwcGx5TWF0cml4NCh0aGlzLmJvbmUubWF0cml4V29ybGQpXG4gICAgICAuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pXG4gICAgICAubGVuZ3RoKCk7XG5cbiAgICB0aGlzLmNlbnRlciA9IHBhcmFtcy5jZW50ZXIgPz8gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB0aGUgc3RhdGUgb2YgdGhpcyBib25lLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjYWxsIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXIucmVzZXRdXSBpbnN0ZWFkLlxuICAgKi9cbiAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xuICAgIHRoaXMuYm9uZS5xdWF0ZXJuaW9uLmNvcHkodGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24pO1xuXG4gICAgLy8gV2UgbmVlZCB0byB1cGRhdGUgaXRzIG1hdHJpeFdvcmxkIG1hbnVhbGx5LCBzaW5jZSB3ZSB0d2Vha2VkIHRoZSBib25lIGJ5IG91ciBoYW5kXG4gICAgdGhpcy5ib25lLnVwZGF0ZU1hdHJpeCgpO1xuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCksIHRoaXMuYm9uZS5tYXRyaXgpO1xuICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24uc2V0RnJvbU1hdHJpeFBvc2l0aW9uKHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7XG5cbiAgICAvLyBBcHBseSB1cGRhdGVkIHBvc2l0aW9uIHRvIHRhaWwgc3RhdGVzXG4gICAgdGhpcy5ib25lLmxvY2FsVG9Xb3JsZCh0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pKTtcbiAgICB0aGlzLl9wcmV2VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcbiAgICB0aGlzLl9uZXh0VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHN0YXRlIG9mIHRoaXMgYm9uZS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gY2FsbCBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyLnVwZGF0ZV1dIGluc3RlYWQuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIGlmIChkZWx0YSA8PSAwKSByZXR1cm47XG5cbiAgICBpZiAodGhpcy5ib25lLnBhcmVudCkge1xuICAgICAgLy8gU3ByaW5nQm9uZeOBr+imquOBi+OCiemghuOBq+WHpueQhuOBleOCjOOBpuOBhOOBj+OBn+OCgeOAgVxuICAgICAgLy8g6Kaq44GubWF0cml4V29ybGTjga/mnIDmlrDnirbmhYvjga7liY3mj5Djgad3b3JsZE1hdHJpeOOBi+OCiXF1YXRlcm5pb27jgpLlj5bjgorlh7rjgZnjgIJcbiAgICAgIC8vIOWItumZkOOBr+OBguOCi+OBkeOCjOOBqeOAgeioiOeul+OBr+WwkeOBquOBhOOBruOBp2dldFdvcmxkUXVhdGVybmlvbuOBp+OBr+OBquOBj+OBk+OBruaWueazleOCkuWPluOCi+OAglxuICAgICAgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmJvbmUucGFyZW50LCB0aGlzLl9wYXJlbnRXb3JsZFJvdGF0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyZW50V29ybGRSb3RhdGlvbi5jb3B5KElERU5USVRZX1FVQVRFUk5JT04pO1xuICAgIH1cblxuICAgIC8vIEdldCBib25lIHBvc2l0aW9uIGluIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEEpO1xuICAgIF9tYXRBLm11bHRpcGx5KHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7IC8vIPCflKUgPz9cbiAgICB0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG5cbiAgICAvLyBHZXQgcGFyZW50IHBvc2l0aW9uIGluIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEIpO1xuICAgIF9tYXRCLm11bHRpcGx5KHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCkpO1xuXG4gICAgLy8gc2V2ZXJhbCBwYXJhbWV0ZXJzXG4gICAgY29uc3Qgc3RpZmZuZXNzID0gdGhpcy5zdGlmZm5lc3NGb3JjZSAqIGRlbHRhO1xuICAgIGNvbnN0IGV4dGVybmFsID0gX3YzQi5jb3B5KHRoaXMuZ3Jhdml0eURpcikubXVsdGlwbHlTY2FsYXIodGhpcy5ncmF2aXR5UG93ZXIgKiBkZWx0YSk7XG5cbiAgICAvLyB2ZXJsZXTnqY3liIbjgafmrKHjga7kvY3nva7jgpLoqIjnrpdcbiAgICB0aGlzLl9uZXh0VGFpbFxuICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXG4gICAgICAuYWRkKFxuICAgICAgICBfdjNBXG4gICAgICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXG4gICAgICAgICAgLnN1Yih0aGlzLl9wcmV2VGFpbClcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoMSAtIHRoaXMuZHJhZ0ZvcmNlKSxcbiAgICAgICkgLy8g5YmN44OV44Os44O844Og44Gu56e75YuV44KS57aZ57aa44GZ44KLKOa4m+ihsOOCguOBguOCi+OCiClcbiAgICAgIC5hZGQoXG4gICAgICAgIF92M0FcbiAgICAgICAgICAuY29weSh0aGlzLl9ib25lQXhpcylcbiAgICAgICAgICAuYXBwbHlNYXRyaXg0KHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeClcbiAgICAgICAgICAuYXBwbHlNYXRyaXg0KF9tYXRCKVxuICAgICAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgICAgICAubm9ybWFsaXplKClcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoc3RpZmZuZXNzKSxcbiAgICAgICkgLy8g6Kaq44Gu5Zue6Lui44Gr44KI44KL5a2Q44Oc44O844Oz44Gu56e75YuV55uu5qiZXG4gICAgICAuYWRkKGV4dGVybmFsKTsgLy8g5aSW5Yqb44Gr44KI44KL56e75YuV6YePXG5cbiAgICAvLyBub3JtYWxpemUgYm9uZSBsZW5ndGhcbiAgICB0aGlzLl9uZXh0VGFpbFxuICAgICAgLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKVxuICAgICAgLm5vcm1hbGl6ZSgpXG4gICAgICAubXVsdGlwbHlTY2FsYXIodGhpcy5fY2VudGVyU3BhY2VCb25lTGVuZ3RoKVxuICAgICAgLmFkZCh0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcblxuICAgIC8vIENvbGxpc2lvbuOBp+enu+WLlVxuICAgIHRoaXMuX2NvbGxpc2lvbih0aGlzLl9uZXh0VGFpbCk7XG5cbiAgICB0aGlzLl9wcmV2VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcbiAgICB0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX25leHRUYWlsKTtcblxuICAgIC8vIEFwcGx5IHJvdGF0aW9uLCBjb252ZXJ0IHZlY3RvcjMgdGhpbmcgaW50byBhY3R1YWwgcXVhdGVybmlvblxuICAgIC8vIE9yaWdpbmFsIFVuaVZSTSBpcyBkb2luZyB3b3JsZCB1bml0IGNhbGN1bHVzIGF0IGhlcmUgYnV0IHdlJ3JlIGdvbm5hIGRvIHRoaXMgb24gbG9jYWwgdW5pdFxuICAgIC8vIHNpbmNlIFRocmVlLmpzIGlzIG5vdCBnb29kIGF0IHdvcmxkIGNvb3JkaW5hdGlvbiBzdHVmZlxuICAgIGNvbnN0IGluaXRpYWxDZW50ZXJTcGFjZU1hdHJpeEludiA9IG1hdDRJbnZlcnRDb21wYXQoX21hdEEuY29weShfbWF0Qi5tdWx0aXBseSh0aGlzLl9pbml0aWFsTG9jYWxNYXRyaXgpKSk7XG4gICAgY29uc3QgYXBwbHlSb3RhdGlvbiA9IF9xdWF0QS5zZXRGcm9tVW5pdFZlY3RvcnMoXG4gICAgICB0aGlzLl9ib25lQXhpcyxcbiAgICAgIF92M0EuY29weSh0aGlzLl9uZXh0VGFpbCkuYXBwbHlNYXRyaXg0KGluaXRpYWxDZW50ZXJTcGFjZU1hdHJpeEludikubm9ybWFsaXplKCksXG4gICAgKTtcblxuICAgIHRoaXMuYm9uZS5xdWF0ZXJuaW9uLmNvcHkodGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24pLm11bHRpcGx5KGFwcGx5Um90YXRpb24pO1xuXG4gICAgLy8gV2UgbmVlZCB0byB1cGRhdGUgaXRzIG1hdHJpeFdvcmxkIG1hbnVhbGx5LCBzaW5jZSB3ZSB0d2Vha2VkIHRoZSBib25lIGJ5IG91ciBoYW5kXG4gICAgdGhpcy5ib25lLnVwZGF0ZU1hdHJpeCgpO1xuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCksIHRoaXMuYm9uZS5tYXRyaXgpO1xuICB9XG5cbiAgLyoqXG4gICAqIERvIGNvbGxpc2lvbiBtYXRoIGFnYWluc3QgZXZlcnkgY29sbGlkZXJzIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cbiAgICpcbiAgICogQHBhcmFtIHRhaWwgVGhlIHRhaWwgeW91IHdhbnQgdG8gcHJvY2Vzc1xuICAgKi9cbiAgcHJpdmF0ZSBfY29sbGlzaW9uKHRhaWw6IFRIUkVFLlZlY3RvcjMpOiB2b2lkIHtcbiAgICB0aGlzLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xuICAgICAgdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0QSk7XG4gICAgICBfbWF0QS5tdWx0aXBseShjb2xsaWRlci5tYXRyaXhXb3JsZCk7XG4gICAgICBjb25zdCBjb2xsaWRlckNlbnRlclNwYWNlUG9zaXRpb24gPSBfdjNBLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG4gICAgICBjb25zdCBjb2xsaWRlclJhZGl1cyA9IGNvbGxpZGVyLmdlb21ldHJ5LmJvdW5kaW5nU3BoZXJlIS5yYWRpdXM7IC8vIHRoZSBib3VuZGluZyBzcGhlcmUgaXMgZ3VhcmFudGVlZCB0byBiZSBleGlzdCBieSBWUk1TcHJpbmdCb25lSW1wb3J0ZXIuX2NyZWF0ZUNvbGxpZGVyTWVzaFxuICAgICAgY29uc3QgciA9IHRoaXMucmFkaXVzICsgY29sbGlkZXJSYWRpdXM7XG5cbiAgICAgIGlmICh0YWlsLmRpc3RhbmNlVG9TcXVhcmVkKGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbikgPD0gciAqIHIpIHtcbiAgICAgICAgLy8g44OS44OD44OI44CCQ29sbGlkZXLjga7ljYrlvoTmlrnlkJHjgavmirzjgZflh7rjgZlcbiAgICAgICAgY29uc3Qgbm9ybWFsID0gX3YzQi5zdWJWZWN0b3JzKHRhaWwsIGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbikubm9ybWFsaXplKCk7XG4gICAgICAgIGNvbnN0IHBvc0Zyb21Db2xsaWRlciA9IF92M0MuYWRkVmVjdG9ycyhjb2xsaWRlckNlbnRlclNwYWNlUG9zaXRpb24sIG5vcm1hbC5tdWx0aXBseVNjYWxhcihyKSk7XG5cbiAgICAgICAgLy8gbm9ybWFsaXplIGJvbmUgbGVuZ3RoXG4gICAgICAgIHRhaWwuY29weShcbiAgICAgICAgICBwb3NGcm9tQ29sbGlkZXJcbiAgICAgICAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgICAgICAgIC5ub3JtYWxpemUoKVxuICAgICAgICAgICAgLm11bHRpcGx5U2NhbGFyKHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aClcbiAgICAgICAgICAgIC5hZGQodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbiksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbWF0cml4IHRoYXQgY29udmVydHMgY2VudGVyIHNwYWNlIGludG8gd29ybGQgc3BhY2UuXG4gICAqIEBwYXJhbSB0YXJnZXQgVGFyZ2V0IG1hdHJpeFxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0TWF0cml4Q2VudGVyVG9Xb3JsZCh0YXJnZXQ6IFRIUkVFLk1hdHJpeDQpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICBpZiAodGhpcy5fY2VudGVyKSB7XG4gICAgICB0YXJnZXQuY29weSh0aGlzLl9jZW50ZXIubWF0cml4V29ybGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXQuaWRlbnRpdHkoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG1hdHJpeCB0aGF0IGNvbnZlcnRzIHdvcmxkIHNwYWNlIGludG8gY2VudGVyIHNwYWNlLlxuICAgKiBAcGFyYW0gdGFyZ2V0IFRhcmdldCBtYXRyaXhcbiAgICovXG4gIHByaXZhdGUgX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIodGFyZ2V0OiBUSFJFRS5NYXRyaXg0KTogVEhSRUUuTWF0cml4NCB7XG4gICAgaWYgKHRoaXMuX2NlbnRlcikge1xuICAgICAgdGFyZ2V0LmNvcHkoKHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSBhcyBNYXRyaXg0SW52ZXJzZUNhY2hlKS5pbnZlcnNlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0LmlkZW50aXR5KCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRhcmdldDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB3b3JsZCBtYXRyaXggb2YgaXRzIHBhcmVudCBvYmplY3QuXG4gICAqL1xuICBwcml2YXRlIF9nZXRQYXJlbnRNYXRyaXhXb3JsZCgpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICByZXR1cm4gdGhpcy5ib25lLnBhcmVudCA/IHRoaXMuYm9uZS5wYXJlbnQubWF0cml4V29ybGQgOiBJREVOVElUWV9NQVRSSVg0O1xuICB9XG59XG4iLCJpbXBvcnQgeyBWUk1TcHJpbmdCb25lIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBzcHJpbmcgYm9uZSBncm91cCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IHR5cGUgVlJNU3ByaW5nQm9uZUdyb3VwID0gVlJNU3ByaW5nQm9uZVtdO1xuXG4vKipcbiAqIEEgY2xhc3MgbWFuYWdlcyBldmVyeSBzcHJpbmcgYm9uZXMgb24gYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lTWFuYWdlciB7XG4gIHB1YmxpYyByZWFkb25seSBjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSA9IFtdO1xuICBwdWJsaWMgcmVhZG9ubHkgc3ByaW5nQm9uZUdyb3VwTGlzdDogVlJNU3ByaW5nQm9uZUdyb3VwW10gPSBbXTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXVxuICAgKlxuICAgKiBAcGFyYW0gc3ByaW5nQm9uZUdyb3VwTGlzdCBBbiBhcnJheSBvZiBbW1ZSTVNwcmluZ0JvbmVHcm91cF1dXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IoY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10sIHNwcmluZ0JvbmVHcm91cExpc3Q6IFZSTVNwcmluZ0JvbmVHcm91cFtdKSB7XG4gICAgdGhpcy5jb2xsaWRlckdyb3VwcyA9IGNvbGxpZGVyR3JvdXBzO1xuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdCA9IHNwcmluZ0JvbmVHcm91cExpc3Q7XG4gIH1cblxuICAvKipcbiAgICogU2V0IGFsbCBib25lcyBiZSBjYWxjdWxhdGVkIGJhc2VkIG9uIHRoZSBzcGFjZSByZWxhdGl2ZSBmcm9tIHRoaXMgb2JqZWN0LlxuICAgKiBJZiBgbnVsbGAgaXMgZ2l2ZW4sIHNwcmluZ2JvbmUgd2lsbCBiZSBjYWxjdWxhdGVkIGluIHdvcmxkIHNwYWNlLlxuICAgKiBAcGFyYW0gcm9vdCBSb290IG9iamVjdCwgb3IgYG51bGxgXG4gICAqL1xuICBwdWJsaWMgc2V0Q2VudGVyKHJvb3Q6IFRIUkVFLk9iamVjdDNEIHwgbnVsbCk6IHZvaWQge1xuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcbiAgICAgIHNwcmluZ0JvbmVHcm91cC5mb3JFYWNoKChzcHJpbmdCb25lKSA9PiB7XG4gICAgICAgIHNwcmluZ0JvbmUuY2VudGVyID0gcm9vdDtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBldmVyeSBzcHJpbmcgYm9uZSBhdHRhY2hlZCB0byB0aGlzIG1hbmFnZXIuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcbiAgICovXG4gIHB1YmxpYyBsYXRlVXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBjb25zdCB1cGRhdGVkT2JqZWN0U2V0ID0gbmV3IFNldDxUSFJFRS5PYmplY3QzRD4oKTtcblxuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcbiAgICAgIHNwcmluZ0JvbmVHcm91cC5mb3JFYWNoKChzcHJpbmdCb25lKSA9PiB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVdvcmxkTWF0cml4KHVwZGF0ZWRPYmplY3RTZXQsIHNwcmluZ0JvbmUuYm9uZSk7XG4gICAgICAgIHNwcmluZ0JvbmUudXBkYXRlKGRlbHRhKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IGV2ZXJ5IHNwcmluZyBib25lIGF0dGFjaGVkIHRvIHRoaXMgbWFuYWdlci5cbiAgICovXG4gIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcbiAgICBjb25zdCB1cGRhdGVkT2JqZWN0U2V0ID0gbmV3IFNldDxUSFJFRS5PYmplY3QzRD4oKTtcblxuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcbiAgICAgIHNwcmluZ0JvbmVHcm91cC5mb3JFYWNoKChzcHJpbmdCb25lKSA9PiB7XG4gICAgICAgIHRoaXMuX3VwZGF0ZVdvcmxkTWF0cml4KHVwZGF0ZWRPYmplY3RTZXQsIHNwcmluZ0JvbmUuYm9uZSk7XG4gICAgICAgIHNwcmluZ0JvbmUucmVzZXQoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB3b3JsZE1hdHJpeCBvZiBnaXZlbiBvYmplY3QsIHJlc3BlY3RpbmcgaXRzIGFuY2VzdG9ycy5cbiAgICogY2FsbGVkIGJlZm9yZSB1cGRhdGUgc3ByaW5nYm9uZS5cbiAgICogQHBhcmFtIHVwZGF0ZWRPYmplY3RTZXQgU2V0IG9mIG5vZGUgd2hpY2ggd29ybGRNYXRyaXggaXMgdXBkYXRlZC5cbiAgICogQHBhcmFtIG5vZGUgdGFyZ2V0IGJvbmUgbm9kZS5cbiAgICovXG4gIHByaXZhdGUgX3VwZGF0ZVdvcmxkTWF0cml4KHVwZGF0ZWRPYmplY3RTZXQ6IFNldDxUSFJFRS5PYmplY3QzRD4sIG5vZGU6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gICAgaWYgKHVwZGF0ZWRPYmplY3RTZXQuaGFzKG5vZGUpKSByZXR1cm47XG5cbiAgICBpZiAobm9kZS5wYXJlbnQpIHRoaXMuX3VwZGF0ZVdvcmxkTWF0cml4KHVwZGF0ZWRPYmplY3RTZXQsIG5vZGUucGFyZW50KTtcbiAgICBub2RlLnVwZGF0ZVdvcmxkTWF0cml4KGZhbHNlLCBmYWxzZSk7XG5cbiAgICB1cGRhdGVkT2JqZWN0U2V0LmFkZChub2RlKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgR0xURk5vZGUsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmUgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmUnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAsIFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2ggfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVHcm91cCwgVlJNU3ByaW5nQm9uZU1hbmFnZXIgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lUGFyYW1ldGVycyc7XG5cbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5jb25zdCBfY29sbGlkZXJNYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7IHZpc2libGU6IGZhbHNlIH0pO1xuXG4vKipcbiAqIEFuIGltcG9ydGVyIHRoYXQgaW1wb3J0cyBhIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1Mb29rQXRIZWFkXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVNYW5hZ2VyIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5zZWNvbmRhcnlBbmltYXRpb247XG4gICAgaWYgKCFzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24pIHJldHVybiBudWxsO1xuXG4gICAgLy8g6KGd56qB5Yik5a6a55CD5L2T44Oh44OD44K344Ol44CCXG4gICAgY29uc3QgY29sbGlkZXJHcm91cHMgPSBhd2FpdCB0aGlzLl9pbXBvcnRDb2xsaWRlck1lc2hHcm91cHMoZ2x0Ziwgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uKTtcblxuICAgIC8vIOWQjOOBmOWxnuaAp++8iHN0aWZmaW5lc3PjgoRkcmFnRm9yY2XjgYzlkIzjgZjvvInjga7jg5zjg7zjg7Pjga9ib25lR3JvdXDjgavjgb7jgajjgoHjgonjgozjgabjgYTjgovjgIJcbiAgICAvLyDkuIDliJfjgaDjgZHjgafjga/jgarjgYTjgZPjgajjgavms6jmhI/jgIJcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBMaXN0ID0gYXdhaXQgdGhpcy5faW1wb3J0U3ByaW5nQm9uZUdyb3VwTGlzdChnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24sIGNvbGxpZGVyR3JvdXBzKTtcblxuICAgIHJldHVybiBuZXcgVlJNU3ByaW5nQm9uZU1hbmFnZXIoY29sbGlkZXJHcm91cHMsIHNwcmluZ0JvbmVHcm91cExpc3QpO1xuICB9XG5cbiAgcHJvdGVjdGVkIF9jcmVhdGVTcHJpbmdCb25lKGJvbmU6IFRIUkVFLk9iamVjdDNELCBwYXJhbXM6IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzID0ge30pOiBWUk1TcHJpbmdCb25lIHtcbiAgICByZXR1cm4gbmV3IFZSTVNwcmluZ0JvbmUoYm9uZSwgcGFyYW1zKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBhc3luYyBfaW1wb3J0U3ByaW5nQm9uZUdyb3VwTGlzdChcbiAgICBnbHRmOiBHTFRGLFxuICAgIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbixcbiAgICBjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSxcbiAgKTogUHJvbWlzZTxWUk1TcHJpbmdCb25lR3JvdXBbXT4ge1xuICAgIGNvbnN0IHNwcmluZ0JvbmVHcm91cHM6IFZSTVNjaGVtYS5TZWNvbmRhcnlBbmltYXRpb25TcHJpbmdbXSA9IHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbi5ib25lR3JvdXBzIHx8IFtdO1xuXG4gICAgY29uc3Qgc3ByaW5nQm9uZUdyb3VwTGlzdDogVlJNU3ByaW5nQm9uZUdyb3VwW10gPSBbXTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgc3ByaW5nQm9uZUdyb3Vwcy5tYXAoYXN5bmMgKHZybUJvbmVHcm91cCkgPT4ge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLnN0aWZmaW5lc3MgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpci54ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpci55ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpci56ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eVBvd2VyID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZHJhZ0ZvcmNlID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuaGl0UmFkaXVzID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuY29sbGlkZXJHcm91cHMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ib25lcyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmNlbnRlciA9PT0gdW5kZWZpbmVkXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHN0aWZmbmVzc0ZvcmNlID0gdnJtQm9uZUdyb3VwLnN0aWZmaW5lc3M7XG4gICAgICAgIGNvbnN0IGdyYXZpdHlEaXIgPSBuZXcgVEhSRUUuVmVjdG9yMyhcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpci54LFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnksXG4gICAgICAgICAgLXZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnosIC8vIFZSTSAwLjAgdXNlcyBsZWZ0LWhhbmRlZCB5LXVwXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGdyYXZpdHlQb3dlciA9IHZybUJvbmVHcm91cC5ncmF2aXR5UG93ZXI7XG4gICAgICAgIGNvbnN0IGRyYWdGb3JjZSA9IHZybUJvbmVHcm91cC5kcmFnRm9yY2U7XG4gICAgICAgIGNvbnN0IHJhZGl1cyA9IHZybUJvbmVHcm91cC5oaXRSYWRpdXM7XG5cbiAgICAgICAgY29uc3QgY29sbGlkZXJzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoW10gPSBbXTtcbiAgICAgICAgdnJtQm9uZUdyb3VwLmNvbGxpZGVyR3JvdXBzLmZvckVhY2goKGNvbGxpZGVySW5kZXgpID0+IHtcbiAgICAgICAgICBjb2xsaWRlcnMucHVzaCguLi5jb2xsaWRlckdyb3Vwc1tjb2xsaWRlckluZGV4XS5jb2xsaWRlcnMpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCBzcHJpbmdCb25lR3JvdXA6IFZSTVNwcmluZ0JvbmVHcm91cCA9IFtdO1xuICAgICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuYm9uZXMubWFwKGFzeW5jIChub2RlSW5kZXgpID0+IHtcbiAgICAgICAgICAgIC8vIFZSTeOBruaDheWgseOBi+OCieOAjOaPuuOCjOODouODjuOAjeODnOODvOODs+OBruODq+ODvOODiOOBjOWPluOCjOOCi1xuICAgICAgICAgICAgY29uc3Qgc3ByaW5nUm9vdEJvbmU6IEdMVEZOb2RlID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIG5vZGVJbmRleCk7XG5cbiAgICAgICAgICAgIGNvbnN0IGNlbnRlcjogR0xURk5vZGUgPVxuICAgICAgICAgICAgICB2cm1Cb25lR3JvdXAuY2VudGVyISAhPT0gLTEgPyBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgdnJtQm9uZUdyb3VwLmNlbnRlciEpIDogbnVsbDtcblxuICAgICAgICAgICAgLy8gaXQncyB3ZWlyZCBidXQgdGhlcmUgbWlnaHQgYmUgY2FzZXMgd2UgY2FuJ3QgZmluZCB0aGUgcm9vdCBib25lXG4gICAgICAgICAgICBpZiAoIXNwcmluZ1Jvb3RCb25lKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgc3ByaW5nUm9vdEJvbmUudHJhdmVyc2UoKGJvbmUpID0+IHtcbiAgICAgICAgICAgICAgY29uc3Qgc3ByaW5nQm9uZSA9IHRoaXMuX2NyZWF0ZVNwcmluZ0JvbmUoYm9uZSwge1xuICAgICAgICAgICAgICAgIHJhZGl1cyxcbiAgICAgICAgICAgICAgICBzdGlmZm5lc3NGb3JjZSxcbiAgICAgICAgICAgICAgICBncmF2aXR5RGlyLFxuICAgICAgICAgICAgICAgIGdyYXZpdHlQb3dlcixcbiAgICAgICAgICAgICAgICBkcmFnRm9yY2UsXG4gICAgICAgICAgICAgICAgY29sbGlkZXJzLFxuICAgICAgICAgICAgICAgIGNlbnRlcixcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIHNwcmluZ0JvbmVHcm91cC5wdXNoKHNwcmluZ0JvbmUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG5cbiAgICAgICAgc3ByaW5nQm9uZUdyb3VwTGlzdC5wdXNoKHNwcmluZ0JvbmVHcm91cCk7XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcmV0dXJuIHNwcmluZ0JvbmVHcm91cExpc3Q7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGFuIGFycmF5IG9mIFtbVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBdXS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24gQSBgc2Vjb25kYXJ5QW5pbWF0aW9uYCBmaWVsZCBvZiBWUk1cbiAgICovXG4gIHByb3RlY3RlZCBhc3luYyBfaW1wb3J0Q29sbGlkZXJNZXNoR3JvdXBzKFxuICAgIGdsdGY6IEdMVEYsXG4gICAgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uLFxuICApOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10+IHtcbiAgICBjb25zdCB2cm1Db2xsaWRlckdyb3VwcyA9IHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbi5jb2xsaWRlckdyb3VwcztcbiAgICBpZiAodnJtQ29sbGlkZXJHcm91cHMgPT09IHVuZGVmaW5lZCkgcmV0dXJuIFtdO1xuXG4gICAgY29uc3QgY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10gPSBbXTtcbiAgICB2cm1Db2xsaWRlckdyb3Vwcy5mb3JFYWNoKGFzeW5jIChjb2xsaWRlckdyb3VwKSA9PiB7XG4gICAgICBpZiAoY29sbGlkZXJHcm91cC5ub2RlID09PSB1bmRlZmluZWQgfHwgY29sbGlkZXJHcm91cC5jb2xsaWRlcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGJvbmUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgY29sbGlkZXJHcm91cC5ub2RlKTtcbiAgICAgIGNvbnN0IGNvbGxpZGVyczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaFtdID0gW107XG4gICAgICBjb2xsaWRlckdyb3VwLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgY29sbGlkZXIub2Zmc2V0ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgY29sbGlkZXIub2Zmc2V0LnkgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldC56ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBjb2xsaWRlci5yYWRpdXMgPT09IHVuZGVmaW5lZFxuICAgICAgICApIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvZmZzZXQgPSBfdjNBLnNldChcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueCxcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueSxcbiAgICAgICAgICAtY29sbGlkZXIub2Zmc2V0LnosIC8vIFZSTSAwLjAgdXNlcyBsZWZ0LWhhbmRlZCB5LXVwXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IGNvbGxpZGVyTWVzaCA9IHRoaXMuX2NyZWF0ZUNvbGxpZGVyTWVzaChjb2xsaWRlci5yYWRpdXMsIG9mZnNldCk7XG5cbiAgICAgICAgYm9uZS5hZGQoY29sbGlkZXJNZXNoKTtcbiAgICAgICAgY29sbGlkZXJzLnB1c2goY29sbGlkZXJNZXNoKTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCBjb2xsaWRlck1lc2hHcm91cCA9IHtcbiAgICAgICAgbm9kZTogY29sbGlkZXJHcm91cC5ub2RlLFxuICAgICAgICBjb2xsaWRlcnMsXG4gICAgICB9O1xuICAgICAgY29sbGlkZXJHcm91cHMucHVzaChjb2xsaWRlck1lc2hHcm91cCk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gY29sbGlkZXJHcm91cHM7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgY29sbGlkZXIgbWVzaC5cbiAgICpcbiAgICogQHBhcmFtIHJhZGl1cyBSYWRpdXMgb2YgdGhlIG5ldyBjb2xsaWRlciBtZXNoXG4gICAqIEBwYXJhbSBvZmZzZXQgT2ZmZXN0IG9mIHRoZSBuZXcgY29sbGlkZXIgbWVzaFxuICAgKi9cbiAgcHJvdGVjdGVkIF9jcmVhdGVDb2xsaWRlck1lc2gocmFkaXVzOiBudW1iZXIsIG9mZnNldDogVEhSRUUuVmVjdG9yMyk6IFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2gge1xuICAgIGNvbnN0IGNvbGxpZGVyTWVzaCA9IG5ldyBUSFJFRS5NZXNoKG5ldyBUSFJFRS5TcGhlcmVCdWZmZXJHZW9tZXRyeShyYWRpdXMsIDgsIDQpLCBfY29sbGlkZXJNYXRlcmlhbCk7XG5cbiAgICBjb2xsaWRlck1lc2gucG9zaXRpb24uY29weShvZmZzZXQpO1xuXG4gICAgLy8gdGhlIG5hbWUgaGF2ZSB0byBiZSB0aGlzIGluIG9yZGVyIHRvIGV4Y2x1ZGUgY29sbGlkZXJzIGZyb20gYm91bmRpbmcgYm94XG4gICAgLy8gKFNlZSBWaWV3ZXIudHMsIHNlYXJjaCBmb3IgY2hpbGQubmFtZSA9PT0gJ3ZybUNvbGxpZGVyU3BoZXJlJylcbiAgICBjb2xsaWRlck1lc2gubmFtZSA9ICd2cm1Db2xsaWRlclNwaGVyZSc7XG5cbiAgICAvLyBXZSB3aWxsIHVzZSB0aGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUgZm9yIGNvbGxpc2lvbiB2cyBib25lcy5cbiAgICAvLyBgYm91bmRpbmdTcGhlcmVgIG11c3QgYmUgY3JlYXRlZCB0byBjb21wdXRlIHRoZSByYWRpdXMuXG4gICAgY29sbGlkZXJNZXNoLmdlb21ldHJ5LmNvbXB1dGVCb3VuZGluZ1NwaGVyZSgpO1xuXG4gICAgcmV0dXJuIGNvbGxpZGVyTWVzaDtcbiAgfVxufVxuIiwiaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNQmxlbmRTaGFwZUltcG9ydGVyIH0gZnJvbSAnLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uSW1wb3J0ZXIgfSBmcm9tICcuL2ZpcnN0cGVyc29uJztcbmltcG9ydCB7IFZSTUh1bWFub2lkSW1wb3J0ZXIgfSBmcm9tICcuL2h1bWFub2lkL1ZSTUh1bWFub2lkSW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0SW1wb3J0ZXIgfSBmcm9tICcuL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1NYXRlcmlhbEltcG9ydGVyIH0gZnJvbSAnLi9tYXRlcmlhbCc7XG5pbXBvcnQgeyBWUk1NZXRhSW1wb3J0ZXIgfSBmcm9tICcuL21ldGEvVlJNTWV0YUltcG9ydGVyJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVJbXBvcnRlciB9IGZyb20gJy4vc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lSW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNIH0gZnJvbSAnLi9WUk0nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZSTUltcG9ydGVyT3B0aW9ucyB7XG4gIG1ldGFJbXBvcnRlcj86IFZSTU1ldGFJbXBvcnRlcjtcbiAgbG9va0F0SW1wb3J0ZXI/OiBWUk1Mb29rQXRJbXBvcnRlcjtcbiAgaHVtYW5vaWRJbXBvcnRlcj86IFZSTUh1bWFub2lkSW1wb3J0ZXI7XG4gIGJsZW5kU2hhcGVJbXBvcnRlcj86IFZSTUJsZW5kU2hhcGVJbXBvcnRlcjtcbiAgZmlyc3RQZXJzb25JbXBvcnRlcj86IFZSTUZpcnN0UGVyc29uSW1wb3J0ZXI7XG4gIG1hdGVyaWFsSW1wb3J0ZXI/OiBWUk1NYXRlcmlhbEltcG9ydGVyO1xuICBzcHJpbmdCb25lSW1wb3J0ZXI/OiBWUk1TcHJpbmdCb25lSW1wb3J0ZXI7XG59XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1dXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1JbXBvcnRlciB7XG4gIHByb3RlY3RlZCByZWFkb25seSBfbWV0YUltcG9ydGVyOiBWUk1NZXRhSW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfYmxlbmRTaGFwZUltcG9ydGVyOiBWUk1CbGVuZFNoYXBlSW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfbG9va0F0SW1wb3J0ZXI6IFZSTUxvb2tBdEltcG9ydGVyO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX2h1bWFub2lkSW1wb3J0ZXI6IFZSTUh1bWFub2lkSW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfZmlyc3RQZXJzb25JbXBvcnRlcjogVlJNRmlyc3RQZXJzb25JbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9tYXRlcmlhbEltcG9ydGVyOiBWUk1NYXRlcmlhbEltcG9ydGVyO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX3NwcmluZ0JvbmVJbXBvcnRlcjogVlJNU3ByaW5nQm9uZUltcG9ydGVyO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNSW1wb3J0ZXIuXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zIFtbVlJNSW1wb3J0ZXJPcHRpb25zXV0sIG9wdGlvbmFsbHkgY29udGFpbnMgaW1wb3J0ZXJzIGZvciBlYWNoIGNvbXBvbmVudFxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFZSTUltcG9ydGVyT3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5fbWV0YUltcG9ydGVyID0gb3B0aW9ucy5tZXRhSW1wb3J0ZXIgfHwgbmV3IFZSTU1ldGFJbXBvcnRlcigpO1xuICAgIHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlciA9IG9wdGlvbnMuYmxlbmRTaGFwZUltcG9ydGVyIHx8IG5ldyBWUk1CbGVuZFNoYXBlSW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9sb29rQXRJbXBvcnRlciA9IG9wdGlvbnMubG9va0F0SW1wb3J0ZXIgfHwgbmV3IFZSTUxvb2tBdEltcG9ydGVyKCk7XG4gICAgdGhpcy5faHVtYW5vaWRJbXBvcnRlciA9IG9wdGlvbnMuaHVtYW5vaWRJbXBvcnRlciB8fCBuZXcgVlJNSHVtYW5vaWRJbXBvcnRlcigpO1xuICAgIHRoaXMuX2ZpcnN0UGVyc29uSW1wb3J0ZXIgPSBvcHRpb25zLmZpcnN0UGVyc29uSW1wb3J0ZXIgfHwgbmV3IFZSTUZpcnN0UGVyc29uSW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9tYXRlcmlhbEltcG9ydGVyID0gb3B0aW9ucy5tYXRlcmlhbEltcG9ydGVyIHx8IG5ldyBWUk1NYXRlcmlhbEltcG9ydGVyKCk7XG4gICAgdGhpcy5fc3ByaW5nQm9uZUltcG9ydGVyID0gb3B0aW9ucy5zcHJpbmdCb25lSW1wb3J0ZXIgfHwgbmV3IFZSTVNwcmluZ0JvbmVJbXBvcnRlcigpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlY2VpdmUgYSBHTFRGIG9iamVjdCByZXRyaWV2ZWQgZnJvbSBgVEhSRUUuR0xURkxvYWRlcmAgYW5kIGNyZWF0ZSBhIG5ldyBbW1ZSTV1dIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICovXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNPiB7XG4gICAgaWYgKGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucyA9PT0gdW5kZWZpbmVkIHx8IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucy5WUk0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBWUk0gZXh0ZW5zaW9uIG9uIHRoZSBHTFRGJyk7XG4gICAgfVxuICAgIGNvbnN0IHNjZW5lID0gZ2x0Zi5zY2VuZTtcblxuICAgIHNjZW5lLnVwZGF0ZU1hdHJpeFdvcmxkKGZhbHNlKTtcblxuICAgIC8vIFNraW5uZWQgb2JqZWN0IHNob3VsZCBub3QgYmUgZnJ1c3R1bUN1bGxlZFxuICAgIC8vIFNpbmNlIHByZS1za2lubmVkIHBvc2l0aW9uIG1pZ2h0IGJlIG91dHNpZGUgb2Ygdmlld1xuICAgIHNjZW5lLnRyYXZlcnNlKChvYmplY3QzZCkgPT4ge1xuICAgICAgaWYgKChvYmplY3QzZCBhcyBhbnkpLmlzTWVzaCkge1xuICAgICAgICBvYmplY3QzZC5mcnVzdHVtQ3VsbGVkID0gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCBtZXRhID0gKGF3YWl0IHRoaXMuX21ldGFJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IG1hdGVyaWFscyA9IChhd2FpdCB0aGlzLl9tYXRlcmlhbEltcG9ydGVyLmNvbnZlcnRHTFRGTWF0ZXJpYWxzKGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBodW1hbm9pZCA9IChhd2FpdCB0aGlzLl9odW1hbm9pZEltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgZmlyc3RQZXJzb24gPSBodW1hbm9pZCA/IChhd2FpdCB0aGlzLl9maXJzdFBlcnNvbkltcG9ydGVyLmltcG9ydChnbHRmLCBodW1hbm9pZCkpIHx8IHVuZGVmaW5lZCA6IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGJsZW5kU2hhcGVQcm94eSA9IChhd2FpdCB0aGlzLl9ibGVuZFNoYXBlSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBsb29rQXQgPVxuICAgICAgZmlyc3RQZXJzb24gJiYgYmxlbmRTaGFwZVByb3h5ICYmIGh1bWFub2lkXG4gICAgICAgID8gKGF3YWl0IHRoaXMuX2xvb2tBdEltcG9ydGVyLmltcG9ydChnbHRmLCBmaXJzdFBlcnNvbiwgYmxlbmRTaGFwZVByb3h5LCBodW1hbm9pZCkpIHx8IHVuZGVmaW5lZFxuICAgICAgICA6IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IHNwcmluZ0JvbmVNYW5hZ2VyID0gKGF3YWl0IHRoaXMuX3NwcmluZ0JvbmVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIHJldHVybiBuZXcgVlJNKHtcbiAgICAgIHNjZW5lOiBnbHRmLnNjZW5lLFxuICAgICAgbWV0YSxcbiAgICAgIG1hdGVyaWFscyxcbiAgICAgIGh1bWFub2lkLFxuICAgICAgZmlyc3RQZXJzb24sXG4gICAgICBibGVuZFNoYXBlUHJveHksXG4gICAgICBsb29rQXQsXG4gICAgICBzcHJpbmdCb25lTWFuYWdlcixcbiAgICB9KTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNQmxlbmRTaGFwZVByb3h5IH0gZnJvbSAnLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi9maXJzdHBlcnNvbic7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4vaHVtYW5vaWQnO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZCB9IGZyb20gJy4vbG9va2F0JztcbmltcG9ydCB7IFZSTU1ldGEgfSBmcm9tICcuL21ldGEvVlJNTWV0YSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lTWFuYWdlciB9IGZyb20gJy4vc3ByaW5nYm9uZSc7XG5pbXBvcnQgeyBkZWVwRGlzcG9zZSB9IGZyb20gJy4vdXRpbHMvZGlzcG9zZXInO1xuaW1wb3J0IHsgVlJNSW1wb3J0ZXIsIFZSTUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4vVlJNSW1wb3J0ZXInO1xuXG4vKipcbiAqIFBhcmFtZXRlcnMgZm9yIGEgW1tWUk1dXSBjbGFzcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWUk1QYXJhbWV0ZXJzIHtcbiAgc2NlbmU6IFRIUkVFLlNjZW5lIHwgVEhSRUUuR3JvdXA7IC8vIENPTVBBVDogYEdMVEYuc2NlbmVgIGlzIGdvaW5nIHRvIGJlIGBUSFJFRS5Hcm91cGAgaW4gcjExNFxuICBodW1hbm9pZD86IFZSTUh1bWFub2lkO1xuICBibGVuZFNoYXBlUHJveHk/OiBWUk1CbGVuZFNoYXBlUHJveHk7XG4gIGZpcnN0UGVyc29uPzogVlJNRmlyc3RQZXJzb247XG4gIGxvb2tBdD86IFZSTUxvb2tBdEhlYWQ7XG4gIG1hdGVyaWFscz86IFRIUkVFLk1hdGVyaWFsW107XG4gIHNwcmluZ0JvbmVNYW5hZ2VyPzogVlJNU3ByaW5nQm9uZU1hbmFnZXI7XG4gIG1ldGE/OiBWUk1NZXRhO1xufVxuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCByZXByZXNlbnRzIGEgc2luZ2xlIFZSTSBtb2RlbC5cbiAqIFNlZSB0aGUgZG9jdW1lbnRhdGlvbiBvZiBbW1ZSTS5mcm9tXV0gZm9yIHRoZSBtb3N0IGJhc2ljIHVzZSBvZiBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk0ge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTSBmcm9tIGEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlci5cbiAgICogSXQncyBwcm9iYWJseSBhIHRoaW5nIHdoYXQgeW91IHdhbnQgdG8gZ2V0IHN0YXJ0ZWQgd2l0aCBWUk1zLlxuICAgKlxuICAgKiBAZXhhbXBsZSBNb3N0IGJhc2ljIHVzZSBvZiBWUk1cbiAgICogYGBgXG4gICAqIGNvbnN0IHNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG4gICAqXG4gICAqIG5ldyBUSFJFRS5HTFRGTG9hZGVyKCkubG9hZCggJ21vZGVscy90aHJlZS12cm0tZ2lybC52cm0nLCAoIGdsdGYgKSA9PiB7XG4gICAqXG4gICAqICAgVEhSRUUuVlJNLmZyb20oIGdsdGYgKS50aGVuKCAoIHZybSApID0+IHtcbiAgICpcbiAgICogICAgIHNjZW5lLmFkZCggdnJtLnNjZW5lICk7XG4gICAqXG4gICAqICAgfSApO1xuICAgKlxuICAgKiB9ICk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyB0aGF0IHdpbGwgYmUgdXNlZCBpbiBpbXBvcnRlclxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBhc3luYyBmcm9tKGdsdGY6IEdMVEYsIG9wdGlvbnM6IFZSTUltcG9ydGVyT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxWUk0+IHtcbiAgICBjb25zdCBpbXBvcnRlciA9IG5ldyBWUk1JbXBvcnRlcihvcHRpb25zKTtcbiAgICByZXR1cm4gYXdhaXQgaW1wb3J0ZXIuaW1wb3J0KGdsdGYpO1xuICB9XG4gIC8qKlxuICAgKiBgVEhSRUUuU2NlbmVgIG9yIGBUSFJFRS5Hcm91cGAgKGRlcGVuZHMgb24geW91ciB0aHJlZS5qcyByZXZpc2lvbikgdGhhdCBjb250YWlucyB0aGUgZW50aXJlIFZSTS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzY2VuZTogVEhSRUUuU2NlbmUgfCBUSFJFRS5Hcm91cDsgLy8gQ09NUEFUOiBgR0xURi5zY2VuZWAgaXMgZ29pbmcgdG8gYmUgYFRIUkVFLkdyb3VwYCBpbiByMTE0XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIFtbVlJNSHVtYW5vaWRdXSBvZiB0aGUgVlJNLlxuICAgKiBZb3UgY2FuIGNvbnRyb2wgZWFjaCBib25lcyB1c2luZyBbW1ZSTUh1bWFub2lkLmdldEJvbmVOb2RlXV0uXG4gICAqXG4gICAqIEBUT0RPIEFkZCBhIGxpbmsgdG8gVlJNIHNwZWNcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbm9pZD86IFZSTUh1bWFub2lkO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBbW1ZSTUJsZW5kU2hhcGVQcm94eV1dIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGNvbnRyb2wgdGhlc2UgZmFjaWFsIGV4cHJlc3Npb25zIHZpYSBbW1ZSTUJsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZV1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGJsZW5kU2hhcGVQcm94eT86IFZSTUJsZW5kU2hhcGVQcm94eTtcblxuICAvKipcbiAgICogQ29udGFpbnMgW1tWUk1GaXJzdFBlcnNvbl1dIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBjYW4gdXNlIHZhcmlvdXMgZmVhdHVyZSBvZiB0aGUgZmlyc3RQZXJzb24gZmllbGQuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZmlyc3RQZXJzb24/OiBWUk1GaXJzdFBlcnNvbjtcblxuICAvKipcbiAgICogQ29udGFpbnMgW1tWUk1Mb29rQXRIZWFkXV0gb2YgdGhlIFZSTS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gdXNlIFtbVlJNTG9va0F0SGVhZC50YXJnZXRdXSB0byBjb250cm9sIHRoZSBleWUgZGlyZWN0aW9uIG9mIHlvdXIgVlJNcy5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBsb29rQXQ/OiBWUk1Mb29rQXRIZWFkO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBtYXRlcmlhbHMgb2YgdGhlIFZSTS5cbiAgICogYHVwZGF0ZVZSTU1hdGVyaWFsc2AgbWV0aG9kIG9mIHRoZXNlIG1hdGVyaWFscyB3aWxsIGJlIGNhbGxlZCB2aWEgaXRzIFtbVlJNLnVwZGF0ZV1dIG1ldGhvZC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtYXRlcmlhbHM/OiBUSFJFRS5NYXRlcmlhbFtdO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBtZXRhIGZpZWxkcyBvZiB0aGUgVlJNLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byByZWZlciB0aGVzZSBsaWNlbnNlIGZpZWxkcyBiZWZvcmUgdXNlIHlvdXIgVlJNcy5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtZXRhPzogVlJNTWV0YTtcblxuICAvKipcbiAgICogQSBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyXV0gbWFuaXB1bGF0ZXMgYWxsIHNwcmluZyBib25lcyBhdHRhY2hlZCBvbiB0aGUgVlJNLlxuICAgKiBVc3VhbGx5IHlvdSBkb24ndCBoYXZlIHRvIGNhcmUgYWJvdXQgdGhpcyBwcm9wZXJ0eS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzcHJpbmdCb25lTWFuYWdlcj86IFZSTVNwcmluZ0JvbmVNYW5hZ2VyO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcGFyYW1zIFtbVlJNUGFyYW1ldGVyc11dIHRoYXQgcmVwcmVzZW50cyBjb21wb25lbnRzIG9mIHRoZSBWUk1cbiAgICovXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihwYXJhbXM6IFZSTVBhcmFtZXRlcnMpIHtcbiAgICB0aGlzLnNjZW5lID0gcGFyYW1zLnNjZW5lO1xuICAgIHRoaXMuaHVtYW5vaWQgPSBwYXJhbXMuaHVtYW5vaWQ7XG4gICAgdGhpcy5ibGVuZFNoYXBlUHJveHkgPSBwYXJhbXMuYmxlbmRTaGFwZVByb3h5O1xuICAgIHRoaXMuZmlyc3RQZXJzb24gPSBwYXJhbXMuZmlyc3RQZXJzb247XG4gICAgdGhpcy5sb29rQXQgPSBwYXJhbXMubG9va0F0O1xuICAgIHRoaXMubWF0ZXJpYWxzID0gcGFyYW1zLm1hdGVyaWFscztcbiAgICB0aGlzLnNwcmluZ0JvbmVNYW5hZ2VyID0gcGFyYW1zLnNwcmluZ0JvbmVNYW5hZ2VyO1xuICAgIHRoaXMubWV0YSA9IHBhcmFtcy5tZXRhO1xuICB9XG5cbiAgLyoqXG4gICAqICoqWW91IG5lZWQgdG8gY2FsbCB0aGlzIG9uIHlvdXIgdXBkYXRlIGxvb3AuKipcbiAgICpcbiAgICogVGhpcyBmdW5jdGlvbiB1cGRhdGVzIGV2ZXJ5IFZSTSBjb21wb25lbnRzLlxuICAgKlxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sb29rQXQpIHtcbiAgICAgIHRoaXMubG9va0F0LnVwZGF0ZShkZWx0YSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYmxlbmRTaGFwZVByb3h5KSB7XG4gICAgICB0aGlzLmJsZW5kU2hhcGVQcm94eS51cGRhdGUoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zcHJpbmdCb25lTWFuYWdlcikge1xuICAgICAgdGhpcy5zcHJpbmdCb25lTWFuYWdlci5sYXRlVXBkYXRlKGRlbHRhKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tYXRlcmlhbHMpIHtcbiAgICAgIHRoaXMubWF0ZXJpYWxzLmZvckVhY2goKG1hdGVyaWFsOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKG1hdGVyaWFsLnVwZGF0ZVZSTU1hdGVyaWFscykge1xuICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVZSTU1hdGVyaWFscyhkZWx0YSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwb3NlIGV2ZXJ5dGhpbmcgYWJvdXQgdGhlIFZSTSBpbnN0YW5jZS5cbiAgICovXG4gIHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICBpZiAoc2NlbmUpIHtcbiAgICAgIGRlZXBEaXNwb3NlKHNjZW5lKTtcbiAgICB9XG5cbiAgICB0aGlzLm1ldGE/LnRleHR1cmU/LmRpc3Bvc2UoKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNIH0gZnJvbSAnLi4vVlJNJztcblxuY29uc3QgX3YyQSA9IG5ldyBUSFJFRS5WZWN0b3IyKCk7XG5cbmNvbnN0IF9jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKC0xLCAxLCAtMSwgMSwgLTEsIDEpO1xuY29uc3QgX21hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHsgY29sb3I6IDB4ZmZmZmZmLCBzaWRlOiBUSFJFRS5Eb3VibGVTaWRlIH0pO1xuY29uc3QgX3BsYW5lID0gbmV3IFRIUkVFLk1lc2gobmV3IFRIUkVFLlBsYW5lQnVmZmVyR2VvbWV0cnkoMiwgMiksIF9tYXRlcmlhbCk7XG5jb25zdCBfc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcbl9zY2VuZS5hZGQoX3BsYW5lKTtcblxuLyoqXG4gKiBFeHRyYWN0IGEgdGh1bWJuYWlsIGltYWdlIGJsb2IgZnJvbSBhIHtAbGluayBWUk19LlxuICogSWYgdGhlIHZybSBkb2VzIG5vdCBoYXZlIGEgdGh1bWJuYWlsLCBpdCB3aWxsIHRocm93IGFuIGVycm9yLlxuICogQHBhcmFtIHJlbmRlcmVyIFJlbmRlcmVyXG4gKiBAcGFyYW0gdnJtIFZSTSB3aXRoIGEgdGh1bWJuYWlsXG4gKiBAcGFyYW0gc2l6ZSB3aWR0aCAvIGhlaWdodCBvZiB0aGUgaW1hZ2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RUaHVtYm5haWxCbG9iKHJlbmRlcmVyOiBUSFJFRS5XZWJHTFJlbmRlcmVyLCB2cm06IFZSTSwgc2l6ZSA9IDUxMik6IFByb21pc2U8QmxvYj4ge1xuICAvLyBnZXQgdGhlIHRleHR1cmVcbiAgY29uc3QgdGV4dHVyZSA9IHZybS5tZXRhPy50ZXh0dXJlO1xuICBpZiAoIXRleHR1cmUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2V4dHJhY3RUaHVtYm5haWxCbG9iOiBUaGlzIFZSTSBkb2VzIG5vdCBoYXZlIGEgdGh1bWJuYWlsJyk7XG4gIH1cblxuICBjb25zdCBjYW52YXMgPSByZW5kZXJlci5nZXRDb250ZXh0KCkuY2FudmFzO1xuXG4gIC8vIHN0b3JlIHRoZSBjdXJyZW50IHJlc29sdXRpb25cbiAgcmVuZGVyZXIuZ2V0U2l6ZShfdjJBKTtcbiAgY29uc3QgcHJldldpZHRoID0gX3YyQS54O1xuICBjb25zdCBwcmV2SGVpZ2h0ID0gX3YyQS55O1xuXG4gIC8vIG92ZXJ3cml0ZSB0aGUgcmVzb2x1dGlvblxuICByZW5kZXJlci5zZXRTaXplKHNpemUsIHNpemUsIGZhbHNlKTtcblxuICAvLyBhc3NpZ24gdGhlIHRleHR1cmUgdG8gcGxhbmVcbiAgX21hdGVyaWFsLm1hcCA9IHRleHR1cmU7XG5cbiAgLy8gcmVuZGVyXG4gIHJlbmRlcmVyLnJlbmRlcihfc2NlbmUsIF9jYW1lcmEpO1xuXG4gIC8vIHVuYXNzaWduIHRoZSB0ZXh0dXJlXG4gIF9tYXRlcmlhbC5tYXAgPSBudWxsO1xuXG4gIC8vIGdldCBibG9iXG4gIGlmIChjYW52YXMgaW5zdGFuY2VvZiBPZmZzY3JlZW5DYW52YXMpIHtcbiAgICByZXR1cm4gY2FudmFzLmNvbnZlcnRUb0Jsb2IoKS5maW5hbGx5KCgpID0+IHtcbiAgICAgIC8vIHJldmVydCB0byBwcmV2aW91cyByZXNvbHV0aW9uXG4gICAgICByZW5kZXJlci5zZXRTaXplKHByZXZXaWR0aCwgcHJldkhlaWdodCwgZmFsc2UpO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjYW52YXMudG9CbG9iKChibG9iKSA9PiB7XG4gICAgICAvLyByZXZlcnQgdG8gcHJldmlvdXMgcmVzb2x1dGlvblxuICAgICAgcmVuZGVyZXIuc2V0U2l6ZShwcmV2V2lkdGgsIHByZXZIZWlnaHQsIGZhbHNlKTtcblxuICAgICAgaWYgKGJsb2IgPT0gbnVsbCkge1xuICAgICAgICByZWplY3QoJ2V4dHJhY3RUaHVtYm5haWxCbG9iOiBGYWlsZWQgdG8gY3JlYXRlIGEgYmxvYicpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZShibG9iKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogVHJhdmVyc2UgZ2l2ZW4gb2JqZWN0IGFuZCByZW1vdmUgdW5uZWNlc3NhcmlseSBib3VuZCBqb2ludHMgZnJvbSBldmVyeSBgVEhSRUUuU2tpbm5lZE1lc2hgLlxuICogU29tZSBlbnZpcm9ubWVudHMgbGlrZSBtb2JpbGUgZGV2aWNlcyBoYXZlIGEgbG93ZXIgbGltaXQgb2YgYm9uZXMgYW5kIG1pZ2h0IGJlIHVuYWJsZSB0byBwZXJmb3JtIG1lc2ggc2tpbm5pbmcsIHRoaXMgZnVuY3Rpb24gbWlnaHQgcmVzb2x2ZSBzdWNoIGFuIGlzc3VlLlxuICogQWxzbyB0aGlzIGZ1bmN0aW9uIG1pZ2h0IGdyZWF0bHkgaW1wcm92ZSB0aGUgcGVyZm9ybWFuY2Ugb2YgbWVzaCBza2lubmluZy5cbiAqXG4gKiBAcGFyYW0gcm9vdCBSb290IG9iamVjdCB0aGF0IHdpbGwgYmUgdHJhdmVyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVVbm5lY2Vzc2FyeUpvaW50cyhyb290OiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xuICAvLyBzb21lIG1lc2hlcyBtaWdodCBzaGFyZSBhIHNhbWUgc2tpbkluZGV4IGF0dHJpYnV0ZSBhbmQgdGhpcyBtYXAgcHJldmVudHMgdG8gY29udmVydCB0aGUgYXR0cmlidXRlIHR3aWNlXG4gIGNvbnN0IHNrZWxldG9uTGlzdDogTWFwPFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZSwgVEhSRUUuU2tlbGV0b24+ID0gbmV3IE1hcCgpO1xuXG4gIC8vIFRyYXZlcnNlIGFuIGVudGlyZSB0cmVlXG4gIHJvb3QudHJhdmVyc2UoKG9iaikgPT4ge1xuICAgIGlmIChvYmoudHlwZSAhPT0gJ1NraW5uZWRNZXNoJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc2ggPSBvYmogYXMgVEhSRUUuU2tpbm5lZE1lc2g7XG4gICAgY29uc3QgZ2VvbWV0cnkgPSBtZXNoLmdlb21ldHJ5O1xuICAgIGNvbnN0IGF0dHJpYnV0ZSA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbkluZGV4JykgYXMgVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xuXG4gICAgLy8gbG9vayBmb3IgZXhpc3Rpbmcgc2tlbGV0b25cbiAgICBsZXQgc2tlbGV0b24gPSBza2VsZXRvbkxpc3QuZ2V0KGF0dHJpYnV0ZSk7XG5cbiAgICBpZiAoIXNrZWxldG9uKSB7XG4gICAgICAvLyBnZW5lcmF0ZSByZWR1Y2VkIGJvbmUgbGlzdFxuICAgICAgY29uc3QgYm9uZXM6IFRIUkVFLkJvbmVbXSA9IFtdOyAvLyBuZXcgbGlzdCBvZiBib25lXG4gICAgICBjb25zdCBib25lSW52ZXJzZXM6IFRIUkVFLk1hdHJpeDRbXSA9IFtdOyAvLyBuZXcgbGlzdCBvZiBib25lSW52ZXJzZVxuICAgICAgY29uc3QgYm9uZUluZGV4TWFwOiB7IFtpbmRleDogbnVtYmVyXTogbnVtYmVyIH0gPSB7fTsgLy8gbWFwIG9mIG9sZCBib25lIGluZGV4IHZzLiBuZXcgYm9uZSBpbmRleFxuXG4gICAgICAvLyBjcmVhdGUgYSBuZXcgYm9uZSBtYXBcbiAgICAgIGNvbnN0IGFycmF5ID0gYXR0cmlidXRlLmFycmF5IGFzIG51bWJlcltdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbmRleCA9IGFycmF5W2ldO1xuXG4gICAgICAgIC8vIG5ldyBza2luSW5kZXggYnVmZmVyXG4gICAgICAgIGlmIChib25lSW5kZXhNYXBbaW5kZXhdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBib25lSW5kZXhNYXBbaW5kZXhdID0gYm9uZXMubGVuZ3RoO1xuICAgICAgICAgIGJvbmVzLnB1c2gobWVzaC5za2VsZXRvbi5ib25lc1tpbmRleF0pO1xuICAgICAgICAgIGJvbmVJbnZlcnNlcy5wdXNoKG1lc2guc2tlbGV0b24uYm9uZUludmVyc2VzW2luZGV4XSk7XG4gICAgICAgIH1cblxuICAgICAgICBhcnJheVtpXSA9IGJvbmVJbmRleE1hcFtpbmRleF07XG4gICAgICB9XG5cbiAgICAgIC8vIHJlcGxhY2Ugd2l0aCBuZXcgaW5kaWNlc1xuICAgICAgYXR0cmlidXRlLmNvcHlBcnJheShhcnJheSk7XG4gICAgICBhdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG4gICAgICAvLyByZXBsYWNlIHdpdGggbmV3IGluZGljZXNcbiAgICAgIHNrZWxldG9uID0gbmV3IFRIUkVFLlNrZWxldG9uKGJvbmVzLCBib25lSW52ZXJzZXMpO1xuICAgICAgc2tlbGV0b25MaXN0LnNldChhdHRyaWJ1dGUsIHNrZWxldG9uKTtcbiAgICB9XG5cbiAgICBtZXNoLmJpbmQoc2tlbGV0b24sIG5ldyBUSFJFRS5NYXRyaXg0KCkpO1xuICAgIC8vICAgICAgICAgICAgICAgICAgXl5eXl5eXl5eXl5eXl5eXl5eXiB0cmFuc2Zvcm0gb2YgbWVzaGVzIHNob3VsZCBiZSBpZ25vcmVkXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vS2hyb25vc0dyb3VwL2dsVEYvdHJlZS9tYXN0ZXIvc3BlY2lmaWNhdGlvbi8yLjAjc2tpbnNcbiAgfSk7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBCdWZmZXJBdHRyaWJ1dGUgfSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogVHJhdmVyc2UgZ2l2ZW4gb2JqZWN0IGFuZCByZW1vdmUgdW5uZWNlc3NhcnkgdmVydGljZXMgZnJvbSBldmVyeSBCdWZmZXJHZW9tZXRyaWVzLlxuICogVGhpcyBvbmx5IHByb2Nlc3NlcyBidWZmZXIgZ2VvbWV0cmllcyB3aXRoIGluZGV4IGJ1ZmZlci5cbiAqXG4gKiBUaHJlZS5qcyBjcmVhdGVzIG1vcnBoIHRleHR1cmVzIGZvciBlYWNoIGdlb21ldHJpZXMgYW5kIGl0IHNvbWV0aW1lcyBjb25zdW1lcyB1bm5lY2Vzc2FyeSBhbW91bnQgb2YgVlJBTSBmb3IgY2VydGFpbiBtb2RlbHMuXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgb3B0aW1pemUgZ2VvbWV0cmllcyB0byByZWR1Y2UgdGhlIHNpemUgb2YgbW9ycGggdGV4dHVyZS5cbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9pc3N1ZXMvMjMwOTVcbiAqXG4gKiBAcGFyYW0gcm9vdCBSb290IG9iamVjdCB0aGF0IHdpbGwgYmUgdHJhdmVyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVVbm5lY2Vzc2FyeVZlcnRpY2VzKHJvb3Q6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gIGNvbnN0IGdlb21ldHJ5TWFwID0gbmV3IE1hcDxUSFJFRS5CdWZmZXJHZW9tZXRyeSwgVEhSRUUuQnVmZmVyR2VvbWV0cnk+KCk7XG5cbiAgLy8gVHJhdmVyc2UgYW4gZW50aXJlIHRyZWVcbiAgcm9vdC50cmF2ZXJzZSgob2JqKSA9PiB7XG4gICAgaWYgKCEob2JqIGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzaCA9IG9iaiBhcyBUSFJFRS5NZXNoO1xuICAgIGNvbnN0IGdlb21ldHJ5ID0gbWVzaC5nZW9tZXRyeTtcblxuICAgIC8vIGlmIHRoZSBnZW9tZXRyeSBkb2VzIG5vdCBoYXZlIGFuIGluZGV4IGJ1ZmZlciBpdCBkb2VzIG5vdCBuZWVkIHRvIHByb2Nlc3NcbiAgICBjb25zdCBvcmlnaWFubEluZGV4ID0gZ2VvbWV0cnkuaW5kZXg7XG4gICAgaWYgKG9yaWdpYW5sSW5kZXggPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHNraXAgYWxyZWFkeSBwcm9jZXNzZWQgZ2VvbWV0cnlcbiAgICBjb25zdCBuZXdHZW9tZXRyeUFscmVhZHlFeGlzdGVkID0gZ2VvbWV0cnlNYXAuZ2V0KGdlb21ldHJ5KTtcbiAgICBpZiAobmV3R2VvbWV0cnlBbHJlYWR5RXhpc3RlZCAhPSBudWxsKSB7XG4gICAgICBtZXNoLmdlb21ldHJ5ID0gbmV3R2VvbWV0cnlBbHJlYWR5RXhpc3RlZDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBuZXdHZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXG4gICAgLy8gY29weSB2YXJpb3VzIHByb3BlcnRpZXNcbiAgICAvLyBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi8xYTI0MWVmMTAwNDg3NzBkNTZlMDZkNmNkNmE2NGM3NmNjNzIwZjk1L3NyYy9jb3JlL0J1ZmZlckdlb21ldHJ5LmpzI0wxMDExXG4gICAgbmV3R2VvbWV0cnkubmFtZSA9IGdlb21ldHJ5Lm5hbWU7XG5cbiAgICBuZXdHZW9tZXRyeS5tb3JwaFRhcmdldHNSZWxhdGl2ZSA9IGdlb21ldHJ5Lm1vcnBoVGFyZ2V0c1JlbGF0aXZlO1xuXG4gICAgZ2VvbWV0cnkuZ3JvdXBzLmZvckVhY2goKGdyb3VwKSA9PiB7XG4gICAgICBuZXdHZW9tZXRyeS5hZGRHcm91cChncm91cC5zdGFydCwgZ3JvdXAuY291bnQsIGdyb3VwLm1hdGVyaWFsSW5kZXgpO1xuICAgIH0pO1xuXG4gICAgbmV3R2VvbWV0cnkuYm91bmRpbmdCb3ggPSBnZW9tZXRyeS5ib3VuZGluZ0JveD8uY2xvbmUoKSA/PyBudWxsO1xuICAgIG5ld0dlb21ldHJ5LmJvdW5kaW5nU3BoZXJlID0gZ2VvbWV0cnkuYm91bmRpbmdTcGhlcmU/LmNsb25lKCkgPz8gbnVsbDtcblxuICAgIG5ld0dlb21ldHJ5LnNldERyYXdSYW5nZShnZW9tZXRyeS5kcmF3UmFuZ2Uuc3RhcnQsIGdlb21ldHJ5LmRyYXdSYW5nZS5jb3VudCk7XG5cbiAgICBuZXdHZW9tZXRyeS51c2VyRGF0YSA9IGdlb21ldHJ5LnVzZXJEYXRhO1xuXG4gICAgLy8gc2V0IHRvIGdlb21ldHJ5TWFwXG4gICAgZ2VvbWV0cnlNYXAuc2V0KGdlb21ldHJ5LCBuZXdHZW9tZXRyeSk7XG5cbiAgICAvKiogZnJvbSBvcmlnaW5hbCBpbmRleCB0byBuZXcgaW5kZXggKi9cbiAgICBjb25zdCBvcmlnaW5hbEluZGV4TmV3SW5kZXhNYXA6IG51bWJlcltdID0gW107XG5cbiAgICAvKiogZnJvbSBuZXcgaW5kZXggdG8gb3JpZ2luYWwgaW5kZXggKi9cbiAgICBjb25zdCBuZXdJbmRleE9yaWdpbmFsSW5kZXhNYXA6IG51bWJlcltdID0gW107XG5cbiAgICAvLyByZW9yZ2FuaXplIGluZGljZXNcbiAgICB7XG4gICAgICBjb25zdCBvcmlnaW5hbEluZGV4QXJyYXkgPSBvcmlnaWFubEluZGV4LmFycmF5O1xuICAgICAgY29uc3QgbmV3SW5kZXhBcnJheSA9IG5ldyAob3JpZ2luYWxJbmRleEFycmF5LmNvbnN0cnVjdG9yIGFzIGFueSkob3JpZ2luYWxJbmRleEFycmF5Lmxlbmd0aCk7XG5cbiAgICAgIGxldCBpbmRleEhlYWQgPSAwO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9yaWdpbmFsSW5kZXhBcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBvcmlnaW5hbEluZGV4ID0gb3JpZ2luYWxJbmRleEFycmF5W2ldO1xuXG4gICAgICAgIGxldCBuZXdJbmRleCA9IG9yaWdpbmFsSW5kZXhOZXdJbmRleE1hcFtvcmlnaW5hbEluZGV4XTtcbiAgICAgICAgaWYgKG5ld0luZGV4ID09IG51bGwpIHtcbiAgICAgICAgICBvcmlnaW5hbEluZGV4TmV3SW5kZXhNYXBbb3JpZ2luYWxJbmRleF0gPSBpbmRleEhlYWQ7XG4gICAgICAgICAgbmV3SW5kZXhPcmlnaW5hbEluZGV4TWFwW2luZGV4SGVhZF0gPSBvcmlnaW5hbEluZGV4O1xuICAgICAgICAgIG5ld0luZGV4ID0gaW5kZXhIZWFkO1xuICAgICAgICAgIGluZGV4SGVhZCsrO1xuICAgICAgICB9XG4gICAgICAgIG5ld0luZGV4QXJyYXlbaV0gPSBuZXdJbmRleDtcbiAgICAgIH1cblxuICAgICAgbmV3R2VvbWV0cnkuc2V0SW5kZXgobmV3IEJ1ZmZlckF0dHJpYnV0ZShuZXdJbmRleEFycmF5LCAxLCBmYWxzZSkpO1xuICAgIH1cblxuICAgIC8vIHJlb3JnYW5pemUgYXR0cmlidXRlc1xuICAgIE9iamVjdC5rZXlzKGdlb21ldHJ5LmF0dHJpYnV0ZXMpLmZvckVhY2goKGF0dHJpYnV0ZU5hbWUpID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsQXR0cmlidXRlID0gZ2VvbWV0cnkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSBhcyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XG5cbiAgICAgIGlmICgob3JpZ2luYWxBdHRyaWJ1dGUgYXMgYW55KS5pc0ludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlczogSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUgaXMgbm90IHN1cHBvcnRlZCcpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvcmlnaW5hbEF0dHJpYnV0ZUFycmF5ID0gb3JpZ2luYWxBdHRyaWJ1dGUuYXJyYXk7XG4gICAgICBjb25zdCB7IGl0ZW1TaXplLCBub3JtYWxpemVkIH0gPSBvcmlnaW5hbEF0dHJpYnV0ZTtcblxuICAgICAgY29uc3QgbmV3QXR0cmlidXRlQXJyYXkgPSBuZXcgKG9yaWdpbmFsQXR0cmlidXRlQXJyYXkuY29uc3RydWN0b3IgYXMgYW55KShcbiAgICAgICAgbmV3SW5kZXhPcmlnaW5hbEluZGV4TWFwLmxlbmd0aCAqIGl0ZW1TaXplLFxuICAgICAgKTtcblxuICAgICAgbmV3SW5kZXhPcmlnaW5hbEluZGV4TWFwLmZvckVhY2goKG9yaWdpbmFsSW5kZXgsIGkpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBpdGVtU2l6ZTsgaisrKSB7XG4gICAgICAgICAgbmV3QXR0cmlidXRlQXJyYXlbaSAqIGl0ZW1TaXplICsgal0gPSBvcmlnaW5hbEF0dHJpYnV0ZUFycmF5W29yaWdpbmFsSW5kZXggKiBpdGVtU2l6ZSArIGpdO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgbmV3R2VvbWV0cnkuc2V0QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIG5ldyBCdWZmZXJBdHRyaWJ1dGUobmV3QXR0cmlidXRlQXJyYXksIGl0ZW1TaXplLCBub3JtYWxpemVkKSk7XG4gICAgfSk7XG5cbiAgICAvLyByZW9yZ2FuaXplIG1vcnBoIGF0dHJpYnV0ZXNcbiAgICAvKiogVHJ1ZSBpZiBhbGwgbW9ycGhzIGFyZSB6ZXJvLiAqL1xuICAgIGxldCBpc051bGxNb3JwaCA9IHRydWU7XG5cbiAgICBPYmplY3Qua2V5cyhnZW9tZXRyeS5tb3JwaEF0dHJpYnV0ZXMpLmZvckVhY2goKGF0dHJpYnV0ZU5hbWUpID0+IHtcbiAgICAgIG5ld0dlb21ldHJ5Lm1vcnBoQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9IFtdO1xuXG4gICAgICBjb25zdCBtb3JwaHMgPSBnZW9tZXRyeS5tb3JwaEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICBmb3IgKGxldCBpTW9ycGggPSAwOyBpTW9ycGggPCBtb3JwaHMubGVuZ3RoOyBpTW9ycGgrKykge1xuICAgICAgICBjb25zdCBvcmlnaW5hbEF0dHJpYnV0ZSA9IG1vcnBoc1tpTW9ycGhdIGFzIFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcblxuICAgICAgICBpZiAoKG9yaWdpbmFsQXR0cmlidXRlIGFzIGFueSkuaXNJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlczogSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUgaXMgbm90IHN1cHBvcnRlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3JpZ2luYWxBdHRyaWJ1dGVBcnJheSA9IG9yaWdpbmFsQXR0cmlidXRlLmFycmF5O1xuICAgICAgICBjb25zdCB7IGl0ZW1TaXplLCBub3JtYWxpemVkIH0gPSBvcmlnaW5hbEF0dHJpYnV0ZTtcblxuICAgICAgICBjb25zdCBuZXdBdHRyaWJ1dGVBcnJheSA9IG5ldyAob3JpZ2luYWxBdHRyaWJ1dGVBcnJheS5jb25zdHJ1Y3RvciBhcyBhbnkpKFxuICAgICAgICAgIG5ld0luZGV4T3JpZ2luYWxJbmRleE1hcC5sZW5ndGggKiBpdGVtU2l6ZSxcbiAgICAgICAgKTtcblxuICAgICAgICBuZXdJbmRleE9yaWdpbmFsSW5kZXhNYXAuZm9yRWFjaCgob3JpZ2luYWxJbmRleCwgaSkgPT4ge1xuICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgaXRlbVNpemU7IGorKykge1xuICAgICAgICAgICAgbmV3QXR0cmlidXRlQXJyYXlbaSAqIGl0ZW1TaXplICsgal0gPSBvcmlnaW5hbEF0dHJpYnV0ZUFycmF5W29yaWdpbmFsSW5kZXggKiBpdGVtU2l6ZSArIGpdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaXNOdWxsTW9ycGggPSBpc051bGxNb3JwaCAmJiBuZXdBdHRyaWJ1dGVBcnJheS5ldmVyeSgodjogbnVtYmVyKSA9PiB2ID09PSAwKTtcblxuICAgICAgICBuZXdHZW9tZXRyeS5tb3JwaEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV1baU1vcnBoXSA9IG5ldyBCdWZmZXJBdHRyaWJ1dGUoXG4gICAgICAgICAgbmV3QXR0cmlidXRlQXJyYXksXG4gICAgICAgICAgaXRlbVNpemUsXG4gICAgICAgICAgbm9ybWFsaXplZCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIElmIGFsbCBtb3JwaHMgYXJlIHplcm8sIGp1c3QgZGlzY2FyZCB0aGUgbW9ycGggYXR0cmlidXRlcyB3ZSd2ZSBqdXN0IG1hZGVcbiAgICBpZiAoaXNOdWxsTW9ycGgpIHtcbiAgICAgIG5ld0dlb21ldHJ5Lm1vcnBoQXR0cmlidXRlcyA9IHt9O1xuICAgIH1cblxuICAgIG1lc2guZ2VvbWV0cnkgPSBuZXdHZW9tZXRyeTtcbiAgfSk7XG5cbiAgQXJyYXkuZnJvbShnZW9tZXRyeU1hcC5rZXlzKCkpLmZvckVhY2goKG9yaWdpbmFsR2VvbWV0cnkpID0+IHtcbiAgICBvcmlnaW5hbEdlb21ldHJ5LmRpc3Bvc2UoKTtcbiAgfSk7XG59XG4iLCJpbXBvcnQgeyBleHRyYWN0VGh1bWJuYWlsQmxvYiB9IGZyb20gJy4vZXh0cmFjdFRodW1ibmFpbEJsb2InO1xuaW1wb3J0IHsgcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMgfSBmcm9tICcuL3JlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzJztcbmltcG9ydCB7IHJlbW92ZVVubmVjZXNzYXJ5VmVydGljZXMgfSBmcm9tICcuL3JlbW92ZVVubmVjZXNzYXJ5VmVydGljZXMnO1xuXG5leHBvcnQgY2xhc3MgVlJNVXRpbHMge1xuICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIHRoaXMgY2xhc3MgaXMgbm90IG1lYW50IHRvIGJlIGluc3RhbnRpYXRlZFxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBleHRyYWN0VGh1bWJuYWlsQmxvYiA9IGV4dHJhY3RUaHVtYm5haWxCbG9iO1xuICBwdWJsaWMgc3RhdGljIHJlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzID0gcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHM7XG4gIHB1YmxpYyBzdGF0aWMgcmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlcyA9IHJlbW92ZVVubmVjZXNzYXJ5VmVydGljZXM7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi4vbG9va2F0L1ZSTUxvb2tBdEhlYWQnO1xuaW1wb3J0IHsgVlJNRGVidWdPcHRpb25zIH0gZnJvbSAnLi9WUk1EZWJ1Z09wdGlvbnMnO1xuXG5jb25zdCBfdjMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SGVhZERlYnVnIGV4dGVuZHMgVlJNTG9va0F0SGVhZCB7XG4gIHByaXZhdGUgX2ZhY2VEaXJlY3Rpb25IZWxwZXI/OiBUSFJFRS5BcnJvd0hlbHBlcjtcblxuICBwdWJsaWMgc2V0dXBIZWxwZXIoc2NlbmU6IFRIUkVFLk9iamVjdDNELCBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlRmFjZURpcmVjdGlvbkhlbHBlcikge1xuICAgICAgdGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlciA9IG5ldyBUSFJFRS5BcnJvd0hlbHBlcihcbiAgICAgICAgbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgLTEpLFxuICAgICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAwKSxcbiAgICAgICAgMC41LFxuICAgICAgICAweGZmMDBmZixcbiAgICAgICk7XG4gICAgICBzY2VuZS5hZGQodGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlcik7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcblxuICAgIGlmICh0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyKSB7XG4gICAgICB0aGlzLmZpcnN0UGVyc29uLmdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbih0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyLnBvc2l0aW9uKTtcbiAgICAgIHRoaXMuX2ZhY2VEaXJlY3Rpb25IZWxwZXIuc2V0RGlyZWN0aW9uKHRoaXMuZ2V0TG9va0F0V29ybGREaXJlY3Rpb24oX3YzKSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi4vZmlyc3RwZXJzb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZCc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi4vbG9va2F0L1ZSTUxvb2tBdEhlYWQnO1xuaW1wb3J0IHsgVlJNTG9va0F0SW1wb3J0ZXIgfSBmcm9tICcuLi9sb29rYXQvVlJNTG9va0F0SW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZERlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkRGVidWcnO1xuXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SW1wb3J0ZXJEZWJ1ZyBleHRlbmRzIFZSTUxvb2tBdEltcG9ydGVyIHtcbiAgcHVibGljIGltcG9ydChcbiAgICBnbHRmOiBHTFRGLFxuICAgIGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbixcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICk6IFZSTUxvb2tBdEhlYWQgfCBudWxsIHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5maXJzdFBlcnNvbjtcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBhcHBseWVyID0gdGhpcy5faW1wb3J0QXBwbHllcihzY2hlbWFGaXJzdFBlcnNvbiwgYmxlbmRTaGFwZVByb3h5LCBodW1hbm9pZCk7XG4gICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRIZWFkRGVidWcoZmlyc3RQZXJzb24sIGFwcGx5ZXIgfHwgdW5kZWZpbmVkKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXIgfSBmcm9tICcuLi9zcHJpbmdib25lJztcbmltcG9ydCB7IFZSTURlYnVnT3B0aW9ucyB9IGZyb20gJy4vVlJNRGVidWdPcHRpb25zJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZURlYnVnJztcbmltcG9ydCB7IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgfSBmcm9tICcuL1ZSTURlYnVnJztcblxuY29uc3QgX2NvbGxpZGVyR2l6bW9NYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7XG4gIGNvbG9yOiAweGZmMDBmZixcbiAgd2lyZWZyYW1lOiB0cnVlLFxuICB0cmFuc3BhcmVudDogdHJ1ZSxcbiAgZGVwdGhUZXN0OiBmYWxzZSxcbn0pO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBzaW5nbGUgc3ByaW5nIGJvbmUgZ3JvdXAgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCB0eXBlIFZSTVNwcmluZ0JvbmVHcm91cERlYnVnID0gVlJNU3ByaW5nQm9uZURlYnVnW107XG5cbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnIGV4dGVuZHMgVlJNU3ByaW5nQm9uZU1hbmFnZXIge1xuICBwdWJsaWMgc2V0dXBIZWxwZXIoc2NlbmU6IFRIUkVFLk9iamVjdDNELCBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKGRlYnVnT3B0aW9uLmRpc2FibGVTcHJpbmdCb25lSGVscGVyKSByZXR1cm47XG5cbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QuZm9yRWFjaCgoc3ByaW5nQm9uZUdyb3VwKSA9PiB7XG4gICAgICBzcHJpbmdCb25lR3JvdXAuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xuICAgICAgICBpZiAoKHNwcmluZ0JvbmUgYXMgYW55KS5nZXRHaXptbykge1xuICAgICAgICAgIGNvbnN0IGdpem1vID0gKHNwcmluZ0JvbmUgYXMgVlJNU3ByaW5nQm9uZURlYnVnKS5nZXRHaXptbygpO1xuICAgICAgICAgIHNjZW5lLmFkZChnaXptbyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckdyb3VwKSA9PiB7XG4gICAgICBjb2xsaWRlckdyb3VwLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xuICAgICAgICBjb2xsaWRlci5tYXRlcmlhbCA9IF9jb2xsaWRlckdpem1vTWF0ZXJpYWw7XG4gICAgICAgIGNvbGxpZGVyLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lIH0gZnJvbSAnLi4vc3ByaW5nYm9uZSc7XG5pbXBvcnQgeyBWUk1fR0laTU9fUkVOREVSX09SREVSIH0gZnJvbSAnLi9WUk1EZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4uL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVEZWJ1ZyBleHRlbmRzIFZSTVNwcmluZ0JvbmUge1xuICBwcml2YXRlIF9naXptbz86IFRIUkVFLkFycm93SGVscGVyO1xuXG4gIGNvbnN0cnVjdG9yKGJvbmU6IFRIUkVFLk9iamVjdDNELCBwYXJhbXM6IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzKSB7XG4gICAgc3VwZXIoYm9uZSwgcGFyYW1zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3ByaW5nIGJvbmUgZ2l6bW8sIGFzIGBUSFJFRS5BcnJvd0hlbHBlcmAuXG4gICAqIFVzZWZ1bCBmb3IgZGVidWdnaW5nIHNwcmluZyBib25lcy5cbiAgICovXG4gIHB1YmxpYyBnZXRHaXptbygpOiBUSFJFRS5BcnJvd0hlbHBlciB7XG4gICAgLy8gcmV0dXJuIGlmIGdpem1vIGlzIGFscmVhZHkgZXhpc3RlZFxuICAgIGlmICh0aGlzLl9naXptbykge1xuICAgICAgcmV0dXJuIHRoaXMuX2dpem1vO1xuICAgIH1cblxuICAgIGNvbnN0IG5leHRUYWlsUmVsYXRpdmUgPSBfdjNBLmNvcHkodGhpcy5fbmV4dFRhaWwpLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcbiAgICBjb25zdCBuZXh0VGFpbFJlbGF0aXZlTGVuZ3RoID0gbmV4dFRhaWxSZWxhdGl2ZS5sZW5ndGgoKTtcblxuICAgIHRoaXMuX2dpem1vID0gbmV3IFRIUkVFLkFycm93SGVscGVyKFxuICAgICAgbmV4dFRhaWxSZWxhdGl2ZS5ub3JtYWxpemUoKSxcbiAgICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24sXG4gICAgICBuZXh0VGFpbFJlbGF0aXZlTGVuZ3RoLFxuICAgICAgMHhmZmZmMDAsXG4gICAgICB0aGlzLnJhZGl1cyxcbiAgICAgIHRoaXMucmFkaXVzLFxuICAgICk7XG5cbiAgICAvLyBpdCBzaG91bGQgYmUgYWx3YXlzIHZpc2libGVcbiAgICB0aGlzLl9naXptby5saW5lLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcbiAgICB0aGlzLl9naXptby5jb25lLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcbiAgICAodGhpcy5fZ2l6bW8ubGluZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgKHRoaXMuX2dpem1vLmxpbmUubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLnRyYW5zcGFyZW50ID0gdHJ1ZTtcbiAgICAodGhpcy5fZ2l6bW8uY29uZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgKHRoaXMuX2dpem1vLmNvbmUubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLnRyYW5zcGFyZW50ID0gdHJ1ZTtcblxuICAgIHJldHVybiB0aGlzLl9naXptbztcbiAgfVxuXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIHN1cGVyLnVwZGF0ZShkZWx0YSk7XG4gICAgLy8gbGFzdGx5IHdlJ3JlIGdvbm5hIHVwZGF0ZSBnaXptb1xuICAgIHRoaXMuX3VwZGF0ZUdpem1vKCk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVHaXptbygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2dpem1vKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZSA9IF92M0EuY29weSh0aGlzLl9jdXJyZW50VGFpbCkuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pO1xuICAgIGNvbnN0IG5leHRUYWlsUmVsYXRpdmVMZW5ndGggPSBuZXh0VGFpbFJlbGF0aXZlLmxlbmd0aCgpO1xuXG4gICAgdGhpcy5fZ2l6bW8uc2V0RGlyZWN0aW9uKG5leHRUYWlsUmVsYXRpdmUubm9ybWFsaXplKCkpO1xuICAgIHRoaXMuX2dpem1vLnNldExlbmd0aChuZXh0VGFpbFJlbGF0aXZlTGVuZ3RoLCB0aGlzLnJhZGl1cywgdGhpcy5yYWRpdXMpO1xuICAgIHRoaXMuX2dpem1vLnBvc2l0aW9uLmNvcHkodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbik7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVJbXBvcnRlciB9IGZyb20gJy4uL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZUltcG9ydGVyJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcnO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZURlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lRGVidWcnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgfSBmcm9tICcuLi9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzJztcblxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVJbXBvcnRlckRlYnVnIGV4dGVuZHMgVlJNU3ByaW5nQm9uZUltcG9ydGVyIHtcbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5zZWNvbmRhcnlBbmltYXRpb247XG4gICAgaWYgKCFzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24pIHJldHVybiBudWxsO1xuXG4gICAgLy8g6KGd56qB5Yik5a6a55CD5L2T44Oh44OD44K344Ol44CCXG4gICAgY29uc3QgY29sbGlkZXJHcm91cHMgPSBhd2FpdCB0aGlzLl9pbXBvcnRDb2xsaWRlck1lc2hHcm91cHMoZ2x0Ziwgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uKTtcblxuICAgIC8vIOWQjOOBmOWxnuaAp++8iHN0aWZmaW5lc3PjgoRkcmFnRm9yY2XjgYzlkIzjgZjvvInjga7jg5zjg7zjg7Pjga9ib25lR3JvdXDjgavjgb7jgajjgoHjgonjgozjgabjgYTjgovjgIJcbiAgICAvLyDkuIDliJfjgaDjgZHjgafjga/jgarjgYTjgZPjgajjgavms6jmhI/jgIJcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBMaXN0ID0gYXdhaXQgdGhpcy5faW1wb3J0U3ByaW5nQm9uZUdyb3VwTGlzdChnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24sIGNvbGxpZGVyR3JvdXBzKTtcblxuICAgIHJldHVybiBuZXcgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zyhjb2xsaWRlckdyb3Vwcywgc3ByaW5nQm9uZUdyb3VwTGlzdCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NyZWF0ZVNwcmluZ0JvbmUoYm9uZTogVEhSRUUuT2JqZWN0M0QsIHBhcmFtczogVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMpOiBWUk1TcHJpbmdCb25lRGVidWcge1xuICAgIHJldHVybiBuZXcgVlJNU3ByaW5nQm9uZURlYnVnKGJvbmUsIHBhcmFtcyk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTUltcG9ydGVyLCBWUk1JbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuLi9WUk1JbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1EZWJ1ZyB9IGZyb20gJy4vVlJNRGVidWcnO1xuaW1wb3J0IHsgVlJNRGVidWdPcHRpb25zIH0gZnJvbSAnLi9WUk1EZWJ1Z09wdGlvbnMnO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZERlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkRGVidWcnO1xuaW1wb3J0IHsgVlJNTG9va0F0SW1wb3J0ZXJEZWJ1ZyB9IGZyb20gJy4vVlJNTG9va0F0SW1wb3J0ZXJEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zyc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1EZWJ1Z11dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUltcG9ydGVyRGVidWcgZXh0ZW5kcyBWUk1JbXBvcnRlciB7XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubG9va0F0SW1wb3J0ZXIgPSBvcHRpb25zLmxvb2tBdEltcG9ydGVyIHx8IG5ldyBWUk1Mb29rQXRJbXBvcnRlckRlYnVnKCk7XG4gICAgb3B0aW9ucy5zcHJpbmdCb25lSW1wb3J0ZXIgPSBvcHRpb25zLnNwcmluZ0JvbmVJbXBvcnRlciB8fCBuZXcgVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcoKTtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURiwgZGVidWdPcHRpb25zOiBWUk1EZWJ1Z09wdGlvbnMgPSB7fSk6IFByb21pc2U8VlJNRGVidWc+IHtcbiAgICBpZiAoZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zID09PSB1bmRlZmluZWQgfHwgZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zLlZSTSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIFZSTSBleHRlbnNpb24gb24gdGhlIEdMVEYnKTtcbiAgICB9XG4gICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lO1xuXG4gICAgc2NlbmUudXBkYXRlTWF0cml4V29ybGQoZmFsc2UpO1xuXG4gICAgLy8gU2tpbm5lZCBvYmplY3Qgc2hvdWxkIG5vdCBiZSBmcnVzdHVtQ3VsbGVkXG4gICAgLy8gU2luY2UgcHJlLXNraW5uZWQgcG9zaXRpb24gbWlnaHQgYmUgb3V0c2lkZSBvZiB2aWV3XG4gICAgc2NlbmUudHJhdmVyc2UoKG9iamVjdDNkKSA9PiB7XG4gICAgICBpZiAoKG9iamVjdDNkIGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICAgIG9iamVjdDNkLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IG1ldGEgPSAoYXdhaXQgdGhpcy5fbWV0YUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgbWF0ZXJpYWxzID0gKGF3YWl0IHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIuY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGh1bWFub2lkID0gKGF3YWl0IHRoaXMuX2h1bWFub2lkSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbiA9IGh1bWFub2lkID8gKGF3YWl0IHRoaXMuX2ZpcnN0UGVyc29uSW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgYmxlbmRTaGFwZVByb3h5ID0gKGF3YWl0IHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGxvb2tBdCA9XG4gICAgICBmaXJzdFBlcnNvbiAmJiBibGVuZFNoYXBlUHJveHkgJiYgaHVtYW5vaWRcbiAgICAgICAgPyAoYXdhaXQgdGhpcy5fbG9va0F0SW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgIGlmICgobG9va0F0IGFzIGFueSkuc2V0dXBIZWxwZXIpIHtcbiAgICAgIChsb29rQXQgYXMgVlJNTG9va0F0SGVhZERlYnVnKS5zZXR1cEhlbHBlcihzY2VuZSwgZGVidWdPcHRpb25zKTtcbiAgICB9XG5cbiAgICBjb25zdCBzcHJpbmdCb25lTWFuYWdlciA9IChhd2FpdCB0aGlzLl9zcHJpbmdCb25lSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG4gICAgaWYgKChzcHJpbmdCb25lTWFuYWdlciBhcyBhbnkpLnNldHVwSGVscGVyKSB7XG4gICAgICAoc3ByaW5nQm9uZU1hbmFnZXIgYXMgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zykuc2V0dXBIZWxwZXIoc2NlbmUsIGRlYnVnT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBWUk1EZWJ1ZyhcbiAgICAgIHtcbiAgICAgICAgc2NlbmU6IGdsdGYuc2NlbmUsXG4gICAgICAgIG1ldGEsXG4gICAgICAgIG1hdGVyaWFscyxcbiAgICAgICAgaHVtYW5vaWQsXG4gICAgICAgIGZpcnN0UGVyc29uLFxuICAgICAgICBibGVuZFNoYXBlUHJveHksXG4gICAgICAgIGxvb2tBdCxcbiAgICAgICAgc3ByaW5nQm9uZU1hbmFnZXIsXG4gICAgICB9LFxuICAgICAgZGVidWdPcHRpb25zLFxuICAgICk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTSwgVlJNUGFyYW1ldGVycyB9IGZyb20gJy4uL1ZSTSc7XG5pbXBvcnQgeyBWUk1JbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuLi9WUk1JbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1EZWJ1Z09wdGlvbnMgfSBmcm9tICcuL1ZSTURlYnVnT3B0aW9ucyc7XG5pbXBvcnQgeyBWUk1JbXBvcnRlckRlYnVnIH0gZnJvbSAnLi9WUk1JbXBvcnRlckRlYnVnJztcblxuZXhwb3J0IGNvbnN0IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgPSAxMDAwMDtcblxuLyoqXG4gKiBbW1ZSTV1dIGJ1dCBpdCBoYXMgc29tZSB1c2VmdWwgZ2l6bW9zLlxuICovXG5leHBvcnQgY2xhc3MgVlJNRGVidWcgZXh0ZW5kcyBWUk0ge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTURlYnVnIGZyb20gYSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyLlxuICAgKlxuICAgKiBTZWUgW1tWUk0uZnJvbV1dIGZvciBhIGRldGFpbGVkIGV4YW1wbGUuXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHRoYXQgd2lsbCBiZSB1c2VkIGluIGltcG9ydGVyXG4gICAqIEBwYXJhbSBkZWJ1Z09wdGlvbiBPcHRpb25zIGZvciBWUk1EZWJ1ZyBmZWF0dXJlc1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBhc3luYyBmcm9tKFxuICAgIGdsdGY6IEdMVEYsXG4gICAgb3B0aW9uczogVlJNSW1wb3J0ZXJPcHRpb25zID0ge30sXG4gICAgZGVidWdPcHRpb246IFZSTURlYnVnT3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPFZSTT4ge1xuICAgIGNvbnN0IGltcG9ydGVyID0gbmV3IFZSTUltcG9ydGVyRGVidWcob3B0aW9ucyk7XG4gICAgcmV0dXJuIGF3YWl0IGltcG9ydGVyLmltcG9ydChnbHRmLCBkZWJ1Z09wdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTURlYnVnIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcGFyYW1zIFtbVlJNUGFyYW1ldGVyc11dIHRoYXQgcmVwcmVzZW50cyBjb21wb25lbnRzIG9mIHRoZSBWUk1cbiAgICogQHBhcmFtIGRlYnVnT3B0aW9uIE9wdGlvbnMgZm9yIFZSTURlYnVnIGZlYXR1cmVzXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwYXJhbXM6IFZSTVBhcmFtZXRlcnMsIGRlYnVnT3B0aW9uOiBWUk1EZWJ1Z09wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKHBhcmFtcyk7XG5cbiAgICAvLyBHaXptb+OCkuWxlemWi1xuICAgIGlmICghZGVidWdPcHRpb24uZGlzYWJsZUJveEhlbHBlcikge1xuICAgICAgdGhpcy5zY2VuZS5hZGQobmV3IFRIUkVFLkJveEhlbHBlcih0aGlzLnNjZW5lKSk7XG4gICAgfVxuXG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlU2tlbGV0b25IZWxwZXIpIHtcbiAgICAgIHRoaXMuc2NlbmUuYWRkKG5ldyBUSFJFRS5Ta2VsZXRvbkhlbHBlcih0aGlzLnNjZW5lKSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbIl92MyIsIlZFQ1RPUjNfRlJPTlQiLCJfcXVhdCIsIl92M0EiLCJfcXVhdEEiLCJfdjNCIiwiX3YzQyIsInZlcnRleFNoYWRlciIsImZyYWdtZW50U2hhZGVyIiwiX21hdEEiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDbkcsUUFBUSxTQUFTLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUU7QUFDdEcsUUFBUSxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLEVBQUU7QUFDdEgsUUFBUSxJQUFJLENBQUMsQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsVUFBVSxJQUFJLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7QUFDOUUsS0FBSyxDQUFDLENBQUM7QUFDUDs7QUM3RUE7QUFJQSxTQUFTLGVBQWUsQ0FBQyxRQUF3QixFQUFBO0lBQy9DLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsWUFBWSxLQUFJO0FBQzdDLFFBQUEsTUFBTSxLQUFLLEdBQUksUUFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM5QyxRQUFBLElBQUksS0FBSyxLQUFMLElBQUEsSUFBQSxLQUFLLHVCQUFMLEtBQUssQ0FBRSxTQUFTLEVBQUU7WUFDcEIsTUFBTSxPQUFPLEdBQUcsS0FBc0IsQ0FBQztZQUN2QyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbkIsU0FBQTtBQUNILEtBQUMsQ0FBQyxDQUFDO0lBRUgsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ3JCLENBQUM7QUFFRCxTQUFTLE9BQU8sQ0FBQyxRQUF3QixFQUFBO0FBQ3ZDLElBQUEsTUFBTSxRQUFRLEdBQXNDLFFBQWdCLENBQUMsUUFBUSxDQUFDO0FBQzlFLElBQUEsSUFBSSxRQUFRLEVBQUU7UUFDWixRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDcEIsS0FBQTtBQUVELElBQUEsTUFBTSxRQUFRLEdBQXVDLFFBQWdCLENBQUMsUUFBUSxDQUFDO0FBQy9FLElBQUEsSUFBSSxRQUFRLEVBQUU7QUFDWixRQUFBLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUMzQixZQUFBLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUF3QixLQUFLLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzNFLFNBQUE7QUFBTSxhQUFBLElBQUksUUFBUSxFQUFFO1lBQ25CLGVBQWUsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMzQixTQUFBO0FBQ0YsS0FBQTtBQUNILENBQUM7QUFFSyxTQUFVLFdBQVcsQ0FBQyxRQUF3QixFQUFBO0FBQ2xELElBQUEsUUFBUSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUM3Qjs7QUN6QkEsSUFBSyw4QkFNSixDQUFBO0FBTkQsQ0FBQSxVQUFLLDhCQUE4QixFQUFBO0FBQ2pDLElBQUEsOEJBQUEsQ0FBQSw4QkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFFBQU0sQ0FBQTtBQUNOLElBQUEsOEJBQUEsQ0FBQSw4QkFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFNBQU8sQ0FBQTtBQUNQLElBQUEsOEJBQUEsQ0FBQSw4QkFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFNBQU8sQ0FBQTtBQUNQLElBQUEsOEJBQUEsQ0FBQSw4QkFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFNBQU8sQ0FBQTtBQUNQLElBQUEsOEJBQUEsQ0FBQSw4QkFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLE9BQUssQ0FBQTtBQUNQLENBQUMsRUFOSSw4QkFBOEIsS0FBOUIsOEJBQThCLEdBTWxDLEVBQUEsQ0FBQSxDQUFBLENBQUE7QUFXRCxNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNoQyxNQUFNQSxLQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDaEMsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDaEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7QUFFakM7QUFDQTtBQUNhLE1BQUEsa0JBQW1CLFNBQVEsS0FBSyxDQUFDLFFBQVEsQ0FBQTtBQU9wRCxJQUFBLFdBQUEsQ0FBWSxjQUFzQixFQUFBO0FBQ2hDLFFBQUEsS0FBSyxFQUFFLENBQUM7UUFQSCxJQUFNLENBQUEsTUFBQSxHQUFHLEdBQUcsQ0FBQztRQUNiLElBQVEsQ0FBQSxRQUFBLEdBQUcsS0FBSyxDQUFDO1FBRWhCLElBQU0sQ0FBQSxNQUFBLEdBQXdCLEVBQUUsQ0FBQztRQUNqQyxJQUFlLENBQUEsZUFBQSxHQUFpQyxFQUFFLENBQUM7QUFJekQsUUFBQSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQXdCLHFCQUFBLEVBQUEsY0FBYyxFQUFFLENBQUM7O0FBR3JELFFBQUEsSUFBSSxDQUFDLElBQUksR0FBRyxzQkFBc0IsQ0FBQzs7O0FBR25DLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7S0FDdEI7QUFFTSxJQUFBLE9BQU8sQ0FBQyxJQUEyRSxFQUFBOztBQUV4RixRQUFBLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBRWpDLFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDZixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07WUFDbkIsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjtZQUN2QyxNQUFNO0FBQ1AsU0FBQSxDQUFDLENBQUM7S0FDSjtBQUVNLElBQUEsZ0JBQWdCLENBQUMsSUFLdkIsRUFBQTtBQUNDLFFBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUMvQixRQUFBLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7QUFFdkMsUUFBQSxJQUFJLEtBQUssR0FBSSxRQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQzVDLElBQUksQ0FBQyxLQUFLLEVBQUU7O1lBRVYsT0FBTztBQUNSLFNBQUE7QUFDRCxRQUFBLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztBQUVuQyxRQUFBLElBQUksSUFBb0MsQ0FBQztBQUN6QyxRQUFBLElBQUksWUFBa0YsQ0FBQztBQUN2RixRQUFBLElBQUksV0FBaUYsQ0FBQztBQUN0RixRQUFBLElBQUksVUFBZ0YsQ0FBQztRQUVyRixJQUFJLEtBQUssQ0FBQyxTQUFTLEVBQUU7QUFDbkIsWUFBQSxJQUFJLEdBQUcsOEJBQThCLENBQUMsT0FBTyxDQUFDO0FBQzlDLFlBQUEsWUFBWSxHQUFJLEtBQXVCLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDaEQsWUFBQSxXQUFXLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUM5RCxVQUFVLEdBQUcsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNwRCxTQUFBO2FBQU0sSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFO0FBQzFCLFlBQUEsSUFBSSxHQUFHLDhCQUE4QixDQUFDLE9BQU8sQ0FBQztBQUM5QyxZQUFBLFlBQVksR0FBSSxLQUF1QixDQUFDLEtBQUssRUFBRSxDQUFDO0FBQ2hELFlBQUEsV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDOUQsVUFBVSxHQUFHLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDcEQsU0FBQTthQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsRUFBRTtBQUMxQixZQUFBLElBQUksR0FBRyw4QkFBOEIsQ0FBQyxPQUFPLENBQUM7QUFDOUMsWUFBQSxZQUFZLEdBQUksS0FBdUIsQ0FBQyxLQUFLLEVBQUUsQ0FBQzs7Ozs7Ozs7Ozs7WUFZaEQsV0FBVyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLFNBQVMsQ0FBQztBQUMxQyxnQkFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNuQixnQkFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNuQixnQkFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNuQixnQkFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztBQUNwQixhQUFBLENBQUMsQ0FBQztZQUNILFVBQVUsR0FBRyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3BELFNBQUE7YUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUU7QUFDeEIsWUFBQSxJQUFJLEdBQUcsOEJBQThCLENBQUMsS0FBSyxDQUFDO0FBQzVDLFlBQUEsWUFBWSxHQUFJLEtBQXFCLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDOUMsWUFBQSxXQUFXLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUM1RCxVQUFVLEdBQUcsV0FBVyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNwRCxTQUFBO0FBQU0sYUFBQTtBQUNMLFlBQUEsSUFBSSxHQUFHLDhCQUE4QixDQUFDLE1BQU0sQ0FBQztZQUM3QyxZQUFZLEdBQUcsS0FBZSxDQUFDO0FBQy9CLFlBQUEsV0FBVyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEMsWUFBQSxVQUFVLEdBQUcsV0FBVyxHQUFHLFlBQVksQ0FBQztBQUN6QyxTQUFBO0FBRUQsUUFBQSxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQztZQUN4QixRQUFRO1lBQ1IsWUFBWTtZQUNaLFlBQVk7WUFDWixXQUFXO1lBQ1gsVUFBVTtZQUNWLElBQUk7QUFDTCxTQUFBLENBQUMsQ0FBQztLQUNKO0FBRUQ7OztBQUdHO0lBQ0ksV0FBVyxHQUFBO0FBQ2hCLFFBQUEsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7UUFFeEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUk7WUFDM0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUk7QUFDM0IsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRTtvQkFDL0IsT0FBTztBQUNSLGlCQUFBO0FBQ0QsZ0JBQUEsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQ3ZFLGFBQUMsQ0FBQyxDQUFDO0FBQ0wsU0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLGFBQWEsS0FBSTtZQUM3QyxNQUFNLElBQUksR0FBSSxhQUFhLENBQUMsUUFBZ0IsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDekUsSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFO2dCQUN0QixPQUFPO0FBQ1IsYUFBQTtBQUVELFlBQUEsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLDhCQUE4QixDQUFDLE1BQU0sRUFBRTtBQUNoRSxnQkFBQSxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsVUFBb0IsQ0FBQztnQkFDckQsYUFBYSxDQUFDLFFBQWdCLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDL0UsYUFBQTtBQUFNLGlCQUFBLElBQUksYUFBYSxDQUFDLElBQUksS0FBSyw4QkFBOEIsQ0FBQyxPQUFPLEVBQUU7QUFDeEUsZ0JBQUEsTUFBTSxVQUFVLEdBQUcsYUFBYSxDQUFDLFVBQTJCLENBQUM7Z0JBQzVELGFBQWEsQ0FBQyxRQUFnQixDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RyxhQUFBO0FBQU0saUJBQUEsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLDhCQUE4QixDQUFDLE9BQU8sRUFBRTtBQUN4RSxnQkFBQSxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsVUFBMkIsQ0FBQztnQkFDNUQsYUFBYSxDQUFDLFFBQWdCLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQ0EsS0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN6RyxhQUFBO0FBQU0saUJBQUEsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLDhCQUE4QixDQUFDLE9BQU8sRUFBRTtBQUN4RSxnQkFBQSxNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsVUFBMkIsQ0FBQztnQkFDNUQsYUFBYSxDQUFDLFFBQWdCLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3pHLGFBQUE7QUFBTSxpQkFBQSxJQUFJLGFBQWEsQ0FBQyxJQUFJLEtBQUssOEJBQThCLENBQUMsS0FBSyxFQUFFO0FBQ3RFLGdCQUFBLE1BQU0sVUFBVSxHQUFHLGFBQWEsQ0FBQyxVQUF5QixDQUFDO2dCQUMxRCxhQUFhLENBQUMsUUFBZ0IsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDNUcsYUFBQTtZQUVELElBQUksT0FBUSxhQUFhLENBQUMsUUFBZ0IsQ0FBQyxtQkFBbUIsS0FBSyxTQUFTLEVBQUU7QUFDM0UsZ0JBQUEsYUFBYSxDQUFDLFFBQWdCLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0FBQzVELGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQztLQUNKO0FBRUQ7O0FBRUc7SUFDSSxrQkFBa0IsR0FBQTtRQUN2QixJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSTtZQUMzQixJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSTtBQUMzQixnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFO29CQUMvQixPQUFPO0FBQ1IsaUJBQUE7Z0JBQ0QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUMxRCxhQUFDLENBQUMsQ0FBQztBQUNMLFNBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxhQUFhLEtBQUk7WUFDN0MsTUFBTSxJQUFJLEdBQUksYUFBYSxDQUFDLFFBQWdCLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3pFLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtnQkFDdEIsT0FBTztBQUNSLGFBQUE7QUFFRCxZQUFBLElBQUksYUFBYSxDQUFDLElBQUksS0FBSyw4QkFBOEIsQ0FBQyxNQUFNLEVBQUU7QUFDaEUsZ0JBQUEsTUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDLFlBQXNCLENBQUM7Z0JBQ3pELGFBQWEsQ0FBQyxRQUFnQixDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsR0FBRyxZQUFZLENBQUM7QUFDNUUsYUFBQTtBQUFNLGlCQUFBLElBQUksYUFBYSxDQUFDLElBQUksS0FBSyw4QkFBOEIsQ0FBQyxPQUFPLEVBQUU7QUFDeEUsZ0JBQUEsTUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDLFlBQTZCLENBQUM7QUFDaEUsZ0JBQUEsYUFBYSxDQUFDLFFBQWdCLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNoRixhQUFBO0FBQU0saUJBQUEsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLDhCQUE4QixDQUFDLE9BQU8sRUFBRTtBQUN4RSxnQkFBQSxNQUFNLFlBQVksR0FBRyxhQUFhLENBQUMsWUFBNkIsQ0FBQztBQUNoRSxnQkFBQSxhQUFhLENBQUMsUUFBZ0IsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ2hGLGFBQUE7QUFBTSxpQkFBQSxJQUFJLGFBQWEsQ0FBQyxJQUFJLEtBQUssOEJBQThCLENBQUMsT0FBTyxFQUFFO0FBQ3hFLGdCQUFBLE1BQU0sWUFBWSxHQUFHLGFBQWEsQ0FBQyxZQUE2QixDQUFDO0FBQ2hFLGdCQUFBLGFBQWEsQ0FBQyxRQUFnQixDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDaEYsYUFBQTtBQUFNLGlCQUFBLElBQUksYUFBYSxDQUFDLElBQUksS0FBSyw4QkFBOEIsQ0FBQyxLQUFLLEVBQUU7QUFDdEUsZ0JBQUEsTUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDLFlBQTJCLENBQUM7QUFDOUQsZ0JBQUEsYUFBYSxDQUFDLFFBQWdCLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUNoRixhQUFBO1lBRUQsSUFBSSxPQUFRLGFBQWEsQ0FBQyxRQUFnQixDQUFDLG1CQUFtQixLQUFLLFNBQVMsRUFBRTtBQUMzRSxnQkFBQSxhQUFhLENBQUMsUUFBZ0IsQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLENBQUM7QUFDNUQsYUFBQTtBQUNILFNBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFDRjs7QUM5TkQ7QUFDQTtBQUNBO0FBRUE7QUFDTSxJQUFXLFVBbWNoQjtBQW5jRCxDQUFBLFVBQWlCLFNBQVMsRUFBQTtBQXFFeEIsSUFBQSxDQUFBLFVBQVksb0JBQW9CLEVBQUE7QUFDOUIsUUFBQSxvQkFBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLEdBQU8sQ0FBQTtBQUNQLFFBQUEsb0JBQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxPQUFlLENBQUE7QUFDZixRQUFBLG9CQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZSxDQUFBO0FBQ2YsUUFBQSxvQkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFNBQWtCLENBQUE7QUFDbEIsUUFBQSxvQkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFNBQWtCLENBQUE7QUFDbEIsUUFBQSxvQkFBQSxDQUFBLEdBQUEsQ0FBQSxHQUFBLEdBQU8sQ0FBQTtBQUNQLFFBQUEsb0JBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxLQUFXLENBQUE7QUFDWCxRQUFBLG9CQUFBLENBQUEsR0FBQSxDQUFBLEdBQUEsR0FBTyxDQUFBO0FBQ1AsUUFBQSxvQkFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQVcsQ0FBQTtBQUNYLFFBQUEsb0JBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQixDQUFBO0FBQ3JCLFFBQUEsb0JBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQixDQUFBO0FBQ3JCLFFBQUEsb0JBQUEsQ0FBQSxXQUFBLENBQUEsR0FBQSxXQUF1QixDQUFBO0FBQ3ZCLFFBQUEsb0JBQUEsQ0FBQSxRQUFBLENBQUEsR0FBQSxRQUFpQixDQUFBO0FBQ2pCLFFBQUEsb0JBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFtQixDQUFBO0FBQ25CLFFBQUEsb0JBQUEsQ0FBQSxHQUFBLENBQUEsR0FBQSxHQUFPLENBQUE7QUFDUCxRQUFBLG9CQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsUUFBaUIsQ0FBQTtBQUNqQixRQUFBLG9CQUFBLENBQUEsR0FBQSxDQUFBLEdBQUEsR0FBTyxDQUFBO0FBQ1AsUUFBQSxvQkFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFNBQW1CLENBQUE7QUFDckIsS0FBQyxFQW5CVyxTQUFvQixDQUFBLG9CQUFBLEtBQXBCLDhCQUFvQixHQW1CL0IsRUFBQSxDQUFBLENBQUEsQ0FBQTtBQWdERCxJQUFBLENBQUEsVUFBWSx5QkFBeUIsRUFBQTtBQUNuQyxRQUFBLHlCQUFBLENBQUEsWUFBQSxDQUFBLEdBQUEsWUFBeUIsQ0FBQTtBQUN6QixRQUFBLHlCQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsTUFBYSxDQUFBO0FBQ2YsS0FBQyxFQUhXLFNBQXlCLENBQUEseUJBQUEsS0FBekIsbUNBQXlCLEdBR3BDLEVBQUEsQ0FBQSxDQUFBLENBQUE7QUE2RUQsSUFBQSxDQUFBLFVBQVksZ0JBQWdCLEVBQUE7QUFDMUIsUUFBQSxnQkFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWUsQ0FBQTtBQUNmLFFBQUEsZ0JBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxNQUFhLENBQUE7QUFDYixRQUFBLGdCQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsTUFBYSxDQUFBO0FBQ2IsUUFBQSxnQkFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQVcsQ0FBQTtBQUNYLFFBQUEsZ0JBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFtQixDQUFBO0FBQ25CLFFBQUEsZ0JBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQixDQUFBO0FBQ3JCLFFBQUEsZ0JBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQixDQUFBO0FBQ3JCLFFBQUEsZ0JBQUEsQ0FBQSxpQkFBQSxDQUFBLEdBQUEsaUJBQW1DLENBQUE7QUFDbkMsUUFBQSxnQkFBQSxDQUFBLHVCQUFBLENBQUEsR0FBQSx1QkFBK0MsQ0FBQTtBQUMvQyxRQUFBLGdCQUFBLENBQUEsbUJBQUEsQ0FBQSxHQUFBLG1CQUF1QyxDQUFBO0FBQ3ZDLFFBQUEsZ0JBQUEsQ0FBQSxrQkFBQSxDQUFBLEdBQUEsa0JBQXFDLENBQUE7QUFDckMsUUFBQSxnQkFBQSxDQUFBLHdCQUFBLENBQUEsR0FBQSx3QkFBaUQsQ0FBQTtBQUNqRCxRQUFBLGdCQUFBLENBQUEsb0JBQUEsQ0FBQSxHQUFBLG9CQUF5QyxDQUFBO0FBQ3pDLFFBQUEsZ0JBQUEsQ0FBQSxjQUFBLENBQUEsR0FBQSxjQUE2QixDQUFBO0FBQzdCLFFBQUEsZ0JBQUEsQ0FBQSxjQUFBLENBQUEsR0FBQSxjQUE2QixDQUFBO0FBQzdCLFFBQUEsZ0JBQUEsQ0FBQSxrQkFBQSxDQUFBLEdBQUEsa0JBQXFDLENBQUE7QUFDckMsUUFBQSxnQkFBQSxDQUFBLHdCQUFBLENBQUEsR0FBQSx3QkFBaUQsQ0FBQTtBQUNqRCxRQUFBLGdCQUFBLENBQUEsb0JBQUEsQ0FBQSxHQUFBLG9CQUF5QyxDQUFBO0FBQ3pDLFFBQUEsZ0JBQUEsQ0FBQSxnQkFBQSxDQUFBLEdBQUEsZ0JBQWlDLENBQUE7QUFDakMsUUFBQSxnQkFBQSxDQUFBLHNCQUFBLENBQUEsR0FBQSxzQkFBNkMsQ0FBQTtBQUM3QyxRQUFBLGdCQUFBLENBQUEsa0JBQUEsQ0FBQSxHQUFBLGtCQUFxQyxDQUFBO0FBQ3JDLFFBQUEsZ0JBQUEsQ0FBQSxjQUFBLENBQUEsR0FBQSxjQUE2QixDQUFBO0FBQzdCLFFBQUEsZ0JBQUEsQ0FBQSxpQkFBQSxDQUFBLEdBQUEsaUJBQW1DLENBQUE7QUFDbkMsUUFBQSxnQkFBQSxDQUFBLHVCQUFBLENBQUEsR0FBQSx1QkFBK0MsQ0FBQTtBQUMvQyxRQUFBLGdCQUFBLENBQUEsbUJBQUEsQ0FBQSxHQUFBLG1CQUF1QyxDQUFBO0FBQ3ZDLFFBQUEsZ0JBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQixDQUFBO0FBQ3JCLFFBQUEsZ0JBQUEsQ0FBQSxjQUFBLENBQUEsR0FBQSxjQUE2QixDQUFBO0FBQzdCLFFBQUEsZ0JBQUEsQ0FBQSxjQUFBLENBQUEsR0FBQSxjQUE2QixDQUFBO0FBQzdCLFFBQUEsZ0JBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxNQUFhLENBQUE7QUFDYixRQUFBLGdCQUFBLENBQUEsVUFBQSxDQUFBLEdBQUEsVUFBcUIsQ0FBQTtBQUNyQixRQUFBLGdCQUFBLENBQUEsV0FBQSxDQUFBLEdBQUEsV0FBdUIsQ0FBQTtBQUN2QixRQUFBLGdCQUFBLENBQUEsV0FBQSxDQUFBLEdBQUEsV0FBdUIsQ0FBQTtBQUN2QixRQUFBLGdCQUFBLENBQUEsa0JBQUEsQ0FBQSxHQUFBLGtCQUFxQyxDQUFBO0FBQ3JDLFFBQUEsZ0JBQUEsQ0FBQSx3QkFBQSxDQUFBLEdBQUEsd0JBQWlELENBQUE7QUFDakQsUUFBQSxnQkFBQSxDQUFBLG9CQUFBLENBQUEsR0FBQSxvQkFBeUMsQ0FBQTtBQUN6QyxRQUFBLGdCQUFBLENBQUEsbUJBQUEsQ0FBQSxHQUFBLG1CQUF1QyxDQUFBO0FBQ3ZDLFFBQUEsZ0JBQUEsQ0FBQSx5QkFBQSxDQUFBLEdBQUEseUJBQW1ELENBQUE7QUFDbkQsUUFBQSxnQkFBQSxDQUFBLHFCQUFBLENBQUEsR0FBQSxxQkFBMkMsQ0FBQTtBQUMzQyxRQUFBLGdCQUFBLENBQUEsZUFBQSxDQUFBLEdBQUEsZUFBK0IsQ0FBQTtBQUMvQixRQUFBLGdCQUFBLENBQUEsZUFBQSxDQUFBLEdBQUEsZUFBK0IsQ0FBQTtBQUMvQixRQUFBLGdCQUFBLENBQUEsbUJBQUEsQ0FBQSxHQUFBLG1CQUF1QyxDQUFBO0FBQ3ZDLFFBQUEsZ0JBQUEsQ0FBQSx5QkFBQSxDQUFBLEdBQUEseUJBQW1ELENBQUE7QUFDbkQsUUFBQSxnQkFBQSxDQUFBLHFCQUFBLENBQUEsR0FBQSxxQkFBMkMsQ0FBQTtBQUMzQyxRQUFBLGdCQUFBLENBQUEsaUJBQUEsQ0FBQSxHQUFBLGlCQUFtQyxDQUFBO0FBQ25DLFFBQUEsZ0JBQUEsQ0FBQSx1QkFBQSxDQUFBLEdBQUEsdUJBQStDLENBQUE7QUFDL0MsUUFBQSxnQkFBQSxDQUFBLG1CQUFBLENBQUEsR0FBQSxtQkFBdUMsQ0FBQTtBQUN2QyxRQUFBLGdCQUFBLENBQUEsZUFBQSxDQUFBLEdBQUEsZUFBK0IsQ0FBQTtBQUMvQixRQUFBLGdCQUFBLENBQUEsa0JBQUEsQ0FBQSxHQUFBLGtCQUFxQyxDQUFBO0FBQ3JDLFFBQUEsZ0JBQUEsQ0FBQSx3QkFBQSxDQUFBLEdBQUEsd0JBQWlELENBQUE7QUFDakQsUUFBQSxnQkFBQSxDQUFBLG9CQUFBLENBQUEsR0FBQSxvQkFBeUMsQ0FBQTtBQUN6QyxRQUFBLGdCQUFBLENBQUEsV0FBQSxDQUFBLEdBQUEsV0FBdUIsQ0FBQTtBQUN2QixRQUFBLGdCQUFBLENBQUEsZUFBQSxDQUFBLEdBQUEsZUFBK0IsQ0FBQTtBQUMvQixRQUFBLGdCQUFBLENBQUEsZUFBQSxDQUFBLEdBQUEsZUFBK0IsQ0FBQTtBQUMvQixRQUFBLGdCQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZSxDQUFBO0FBQ2YsUUFBQSxnQkFBQSxDQUFBLFlBQUEsQ0FBQSxHQUFBLFlBQXlCLENBQUE7QUFDM0IsS0FBQyxFQXhEVyxTQUFnQixDQUFBLGdCQUFBLEtBQWhCLDBCQUFnQixHQXdEM0IsRUFBQSxDQUFBLENBQUEsQ0FBQTtBQXdFRCxJQUFBLENBQUEsVUFBWSxtQkFBbUIsRUFBQTtBQUM3QixRQUFBLG1CQUFBLENBQUEsVUFBQSxDQUFBLEdBQUEsVUFBcUIsQ0FBQTtBQUNyQixRQUFBLG1CQUFBLENBQUEsMEJBQUEsQ0FBQSxHQUFBLDBCQUFxRCxDQUFBO0FBQ3JELFFBQUEsbUJBQUEsQ0FBQSxZQUFBLENBQUEsR0FBQSxZQUF5QixDQUFBO0FBQzNCLEtBQUMsRUFKVyxTQUFtQixDQUFBLG1CQUFBLEtBQW5CLDZCQUFtQixHQUk5QixFQUFBLENBQUEsQ0FBQSxDQUFBO0FBU0QsSUFBQSxDQUFBLFVBQVksY0FBYyxFQUFBO0FBQ3hCLFFBQUEsY0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWUsQ0FBQTtBQUNmLFFBQUEsY0FBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFVBQXFCLENBQUE7QUFDdkIsS0FBQyxFQUhXLFNBQWMsQ0FBQSxjQUFBLEtBQWQsd0JBQWMsR0FHekIsRUFBQSxDQUFBLENBQUEsQ0FBQTtBQUtELElBQUEsQ0FBQSxVQUFZLGVBQWUsRUFBQTtBQUN6QixRQUFBLGVBQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxLQUFXLENBQUE7QUFDWCxRQUFBLGVBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxPQUFjLENBQUE7QUFDZCxRQUFBLGVBQUEsQ0FBQSxRQUFBLENBQUEsR0FBQSxVQUFtQixDQUFBO0FBQ25CLFFBQUEsZUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLGFBQXdCLENBQUE7QUFDeEIsUUFBQSxlQUFBLENBQUEsVUFBQSxDQUFBLEdBQUEsYUFBd0IsQ0FBQTtBQUN4QixRQUFBLGVBQUEsQ0FBQSxRQUFBLENBQUEsR0FBQSxVQUFtQixDQUFBO0FBQ25CLFFBQUEsZUFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFVBQW1CLENBQUE7QUFDbkIsUUFBQSxlQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZSxDQUFBO0FBQ2YsUUFBQSxlQUFBLENBQUEsMEJBQUEsQ0FBQSxHQUFBLDJCQUFzRCxDQUFBO0FBQ3hELEtBQUMsRUFWVyxTQUFlLENBQUEsZUFBQSxLQUFmLHlCQUFlLEdBVTFCLEVBQUEsQ0FBQSxDQUFBLENBQUE7QUE0RUgsQ0FBQyxFQW5jZ0IsU0FBUyxLQUFULFNBQVMsR0FtY3pCLEVBQUEsQ0FBQSxDQUFBOztBQ3JjRCxTQUFTLHlCQUF5QixDQUFDLElBQVUsRUFBRSxTQUFpQixFQUFFLElBQW9CLEVBQUE7QUFDcEY7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpREc7O0FBR0gsSUFBQSxNQUFNLFVBQVUsR0FBb0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3RFLElBQUEsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQztJQUNsQyxJQUFJLFNBQVMsSUFBSSxJQUFJLEVBQUU7QUFDckIsUUFBQSxPQUFPLElBQUksQ0FBQztBQUNiLEtBQUE7O0FBR0QsSUFBQSxNQUFNLFVBQVUsR0FBb0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3ZFLElBQUEsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7O0lBR3BELE1BQU0sVUFBVSxHQUFvQixFQUFFLENBQUM7QUFDdkMsSUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxLQUFJO0FBQ3ZCLFFBQUEsSUFBSSxVQUFVLENBQUMsTUFBTSxHQUFHLGNBQWMsRUFBRTtZQUN0QyxJQUFLLE1BQWMsQ0FBQyxNQUFNLEVBQUU7QUFDMUIsZ0JBQUEsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUF1QixDQUFDLENBQUM7QUFDMUMsYUFBQTtBQUNGLFNBQUE7QUFDSCxLQUFDLENBQUMsQ0FBQztBQUVILElBQUEsT0FBTyxVQUFVLENBQUM7QUFDcEIsQ0FBQztBQUVEOzs7Ozs7OztBQVFHO0FBQ21CLFNBQUEsNkJBQTZCLENBQUMsSUFBVSxFQUFFLFNBQWlCLEVBQUE7O0FBQy9FLFFBQUEsTUFBTSxJQUFJLEdBQW1CLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQ2hGLE9BQU8seUJBQXlCLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztLQUN6RCxDQUFBLENBQUE7QUFBQSxDQUFBO0FBRUQ7Ozs7Ozs7O0FBUUc7QUFDRyxTQUFnQiw4QkFBOEIsQ0FBQyxJQUFVLEVBQUE7O1FBQzdELE1BQU0sS0FBSyxHQUFxQixNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzFFLFFBQUEsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQTJCLENBQUM7UUFFL0MsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxLQUFLLEtBQUk7WUFDNUIsTUFBTSxNQUFNLEdBQUcseUJBQXlCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztZQUM1RCxJQUFJLE1BQU0sSUFBSSxJQUFJLEVBQUU7QUFDbEIsZ0JBQUEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDeEIsYUFBQTtBQUNILFNBQUMsQ0FBQyxDQUFDO0FBRUgsUUFBQSxPQUFPLEdBQUcsQ0FBQztLQUNaLENBQUEsQ0FBQTtBQUFBOztBQ2xISyxTQUFVLHNCQUFzQixDQUFDLElBQVksRUFBQTtBQUNqRCxJQUFBLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtBQUNuQixRQUFBLE9BQU8sQ0FBQyxJQUFJLENBQUMsZ0RBQWdELElBQUksQ0FBQSxrQkFBQSxDQUFvQixDQUFDLENBQUM7QUFDdkYsUUFBQSxPQUFPLElBQUksQ0FBQztBQUNiLEtBQUE7QUFDRCxJQUFBLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBRXpCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQzFCLFFBQUEsT0FBTyxDQUFDLElBQUksQ0FBQyxnREFBZ0QsSUFBSSxDQUFBLGtCQUFBLENBQW9CLENBQUMsQ0FBQztBQUN2RixRQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2IsS0FBQTtBQUNELElBQUEsT0FBTyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuRDs7QUNWQTs7OztBQUlHO0FBQ0csU0FBVSxRQUFRLENBQUMsS0FBYSxFQUFBO0FBQ3BDLElBQUEsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzdDLENBQUM7QUFvQkQsTUFBTSxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDdEMsTUFBTSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakIsSUFBSSxLQUFLLENBQUMsVUFBVSxHQUFHO0FBd0J6Qzs7Ozs7QUFLRztBQUNhLFNBQUEsc0JBQXNCLENBQUMsTUFBc0IsRUFBRSxHQUFxQixFQUFBO0lBQ2xGLE1BQU0sQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRSxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFDckQsSUFBQSxPQUFPLEdBQUcsQ0FBQztBQUNiOztNQzVEYSxrQkFBa0IsQ0FBQTtBQWdCN0I7O0FBRUc7QUFDSCxJQUFBLFdBQUEsR0FBQTtBQWxCQTs7QUFFRztRQUNjLElBQWlCLENBQUEsaUJBQUEsR0FBMkMsRUFBRSxDQUFDO0FBRWhGOztBQUVHO1FBQ2MsSUFBb0IsQ0FBQSxvQkFBQSxHQUFnRSxFQUFFLENBQUM7QUFFeEc7O0FBRUc7UUFDYyxJQUFrQixDQUFBLGtCQUFBLEdBQWEsRUFBRSxDQUFDOztLQU9sRDtBQUVEOztBQUVHO0FBQ0gsSUFBQSxJQUFXLFdBQVcsR0FBQTtRQUNwQixPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7S0FDNUM7QUFFRDs7QUFFRztBQUNILElBQUEsSUFBVyxtQkFBbUIsR0FBQTtRQUM1QixPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztLQUNsQztBQUVEOztBQUVHO0FBQ0gsSUFBQSxJQUFXLGlCQUFpQixHQUFBO1FBQzFCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDO0tBQ2hDO0FBRUQ7Ozs7QUFJRztBQUNJLElBQUEsa0JBQWtCLENBQUMsSUFBNkMsRUFBQTtRQUNyRSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBc0MsQ0FBQyxDQUFDO1FBQ3JGLE1BQU0sVUFBVSxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsVUFBVSxDQUFDLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2xHLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDZixZQUFBLE9BQU8sQ0FBQyxJQUFJLENBQUMsMkJBQTJCLElBQUksQ0FBQSxDQUFFLENBQUMsQ0FBQztBQUNoRCxZQUFBLE9BQU8sU0FBUyxDQUFDO0FBQ2xCLFNBQUE7QUFDRCxRQUFBLE9BQU8sVUFBVSxDQUFDO0tBQ25CO0FBRUQ7Ozs7O0FBS0c7QUFDSSxJQUFBLHVCQUF1QixDQUM1QixJQUFZLEVBQ1osVUFBc0QsRUFDdEQsVUFBOEIsRUFBQTtBQUU5QixRQUFBLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxVQUFVLENBQUM7QUFDMUMsUUFBQSxJQUFJLFVBQVUsRUFBRTtBQUNkLFlBQUEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUM5QyxTQUFBO0FBQU0sYUFBQTtBQUNMLFlBQUEsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNwQyxTQUFBO0tBQ0Y7QUFFRDs7OztBQUlHO0FBQ0ksSUFBQSxRQUFRLENBQUMsSUFBNkMsRUFBQTs7UUFDM0QsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pELE9BQU8sQ0FBQSxFQUFBLEdBQUEsVUFBVSxLQUFBLElBQUEsSUFBVixVQUFVLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQVYsVUFBVSxDQUFFLE1BQU0sTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxJQUFJLENBQUM7S0FDbkM7QUFFRDs7Ozs7QUFLRztJQUNJLFFBQVEsQ0FBQyxJQUE2QyxFQUFFLE1BQWMsRUFBQTtRQUMzRSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakQsUUFBQSxJQUFJLFVBQVUsRUFBRTtBQUNkLFlBQUEsVUFBVSxDQUFDLE1BQU0sR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDdEMsU0FBQTtLQUNGO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF5Qkc7QUFDSSxJQUFBLHNCQUFzQixDQUFDLElBQTZDLEVBQUE7UUFDekUsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pELFFBQUEsT0FBTyxVQUFVLEdBQUcsQ0FBRyxFQUFBLFVBQVUsQ0FBQyxJQUFJLENBQVMsT0FBQSxDQUFBLEdBQUcsSUFBSSxDQUFDO0tBQ3hEO0FBRUQ7O0FBRUc7SUFDSSxNQUFNLEdBQUE7QUFDWCxRQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFJO1lBQ25ELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoRCxVQUFVLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztBQUNsQyxTQUFDLENBQUMsQ0FBQztBQUVILFFBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUk7WUFDbkQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hELFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztBQUMzQixTQUFDLENBQUMsQ0FBQztLQUNKO0FBQ0Y7O0FDOUlEOztBQUVHO01BQ1UscUJBQXFCLENBQUE7QUFDaEM7Ozs7QUFJRztBQUNVLElBQUEsTUFBTSxDQUFDLElBQVUsRUFBQTs7O0FBQzVCLFlBQUEsTUFBTSxNQUFNLEdBQThCLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBRSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxHQUFHLENBQUM7WUFDM0UsSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNYLGdCQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2IsYUFBQTtBQUVELFlBQUEsTUFBTSxnQkFBZ0IsR0FBcUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDO1lBQ25GLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtBQUNyQixnQkFBQSxPQUFPLElBQUksQ0FBQztBQUNiLGFBQUE7QUFFRCxZQUFBLE1BQU0sVUFBVSxHQUFHLElBQUksa0JBQWtCLEVBQUUsQ0FBQztBQUU1QyxZQUFBLE1BQU0sZ0JBQWdCLEdBQTRDLGdCQUFnQixDQUFDLGdCQUFnQixDQUFDO1lBQ3BHLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtBQUNyQixnQkFBQSxPQUFPLFVBQVUsQ0FBQztBQUNuQixhQUFBO1lBRUQsTUFBTSxtQkFBbUIsR0FBZ0UsRUFBRSxDQUFDO1lBRTVGLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FDZixnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBTyxXQUFXLEtBQUksU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBO0FBQ3pDLGdCQUFBLE1BQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxJQUFJLENBQUM7Z0JBQzlCLElBQUksSUFBSSxLQUFLLFNBQVMsRUFBRTtBQUN0QixvQkFBQSxPQUFPLENBQUMsSUFBSSxDQUFDLDREQUE0RCxDQUFDLENBQUM7b0JBQzNFLE9BQU87QUFDUixpQkFBQTtBQUVELGdCQUFBLElBQUksVUFBc0QsQ0FBQztnQkFDM0QsSUFDRSxXQUFXLENBQUMsVUFBVTtBQUN0QixvQkFBQSxXQUFXLENBQUMsVUFBVSxLQUFLLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPO0FBQ2pFLG9CQUFBLENBQUMsbUJBQW1CLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQyxFQUM1QztBQUNBLG9CQUFBLFVBQVUsR0FBRyxXQUFXLENBQUMsVUFBVSxDQUFDO0FBQ3BDLG9CQUFBLG1CQUFtQixDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUMsR0FBRyxJQUFJLENBQUM7QUFDcEQsaUJBQUE7QUFFRCxnQkFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNDLGdCQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO2dCQUV0QixLQUFLLENBQUMsUUFBUSxHQUFHLFdBQVcsQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDO2dCQUUvQyxJQUFJLFdBQVcsQ0FBQyxLQUFLLEVBQUU7b0JBQ3JCLFdBQVcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQU8sSUFBSSxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTt3QkFDdkMsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLFNBQVMsRUFBRTs0QkFDdkQsT0FBTztBQUNSLHlCQUFBO3dCQUVELE1BQU0sY0FBYyxHQUFhLEVBQUUsQ0FBQztBQUNuQyx3QkFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUEyQixDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDLEtBQUk7QUFDaEUsNEJBQUEsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUU7QUFDM0IsZ0NBQUEsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN4Qiw2QkFBQTtBQUNILHlCQUFDLENBQUMsQ0FBQztBQUVILHdCQUFBLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQzt3QkFFcEMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBTyxTQUFTLEtBQUksU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBOzs0QkFDckMsTUFBTSxVQUFVLElBQUksTUFBTSw2QkFBNkIsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLENBQUUsQ0FBQzs7QUFHM0UsNEJBQUEsSUFDRSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQ2YsQ0FBQyxTQUFTLEtBQ1IsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMscUJBQXFCLENBQUM7QUFDOUMsZ0NBQUEsZ0JBQWdCLEdBQUcsU0FBUyxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FDNUQsRUFDRDtnQ0FDQSxPQUFPLENBQUMsSUFBSSxDQUNWLENBQTBCLHVCQUFBLEVBQUEsV0FBVyxDQUFDLElBQUksQ0FBc0IsbUJBQUEsRUFBQSxnQkFBZ0IsQ0FBeUIsdUJBQUEsQ0FBQSxDQUMxRyxDQUFDO2dDQUNGLE9BQU87QUFDUiw2QkFBQTs0QkFFRCxLQUFLLENBQUMsT0FBTyxDQUFDO0FBQ1osZ0NBQUEsTUFBTSxFQUFFLFVBQVU7Z0NBQ2xCLGdCQUFnQjtBQUNoQixnQ0FBQSxNQUFNLEVBQUUsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLE1BQU0sbUNBQUksR0FBRztBQUMzQiw2QkFBQSxDQUFDLENBQUM7eUJBQ0osQ0FBQSxDQUFDLENBQ0gsQ0FBQztxQkFDSCxDQUFBLENBQUMsQ0FBQztBQUNKLGlCQUFBO0FBRUQsZ0JBQUEsTUFBTSxjQUFjLEdBQUcsV0FBVyxDQUFDLGNBQWMsQ0FBQztBQUNsRCxnQkFBQSxJQUFJLGNBQWMsRUFBRTtBQUNsQixvQkFBQSxjQUFjLENBQUMsT0FBTyxDQUFDLENBQUMsYUFBYSxLQUFJO0FBQ3ZDLHdCQUFBLElBQ0UsYUFBYSxDQUFDLFlBQVksS0FBSyxTQUFTOzRCQUN4QyxhQUFhLENBQUMsWUFBWSxLQUFLLFNBQVM7QUFDeEMsNEJBQUEsYUFBYSxDQUFDLFdBQVcsS0FBSyxTQUFTLEVBQ3ZDOzRCQUNBLE9BQU87QUFDUix5QkFBQTt3QkFFRCxNQUFNLFNBQVMsR0FBcUIsRUFBRSxDQUFDO3dCQUN2QyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDLE1BQU0sS0FBSTs0QkFDN0IsSUFBSyxNQUFjLENBQUMsUUFBUSxFQUFFO0FBQzVCLGdDQUFBLE1BQU0sUUFBUSxHQUF1QyxNQUFjLENBQUMsUUFBUSxDQUFDO0FBQzdFLGdDQUFBLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUMzQixvQ0FBQSxTQUFTLENBQUMsSUFBSSxDQUNaLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FDaEIsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsWUFBYSxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQ25GLENBQ0YsQ0FBQztBQUNILGlDQUFBO0FBQU0scUNBQUEsSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxZQUFZLElBQUksU0FBUyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtBQUM3RixvQ0FBQSxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzFCLGlDQUFBO0FBQ0YsNkJBQUE7QUFDSCx5QkFBQyxDQUFDLENBQUM7QUFFSCx3QkFBQSxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxLQUFJOzRCQUM3QixLQUFLLENBQUMsZ0JBQWdCLENBQUM7Z0NBQ3JCLFFBQVE7QUFDUixnQ0FBQSxZQUFZLEVBQUUsc0JBQXNCLENBQUMsYUFBYSxDQUFDLFlBQWEsQ0FBQztnQ0FDakUsV0FBVyxFQUFFLGFBQWEsQ0FBQyxXQUFZO0FBQ3hDLDZCQUFBLENBQUMsQ0FBQztBQUNMLHlCQUFDLENBQUMsQ0FBQztBQUNMLHFCQUFDLENBQUMsQ0FBQztBQUNKLGlCQUFBO2dCQUVELFVBQVUsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQzdELENBQUEsQ0FBQyxDQUNILENBQUM7QUFFRixZQUFBLE9BQU8sVUFBVSxDQUFDOztBQUNuQixLQUFBO0FBQ0Y7O0FDOUlELE1BQU1DLGVBQWEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUV2RSxNQUFNQyxPQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7QUFFckMsSUFBSyxlQUtKLENBQUE7QUFMRCxDQUFBLFVBQUssZUFBZSxFQUFBO0FBQ2xCLElBQUEsZUFBQSxDQUFBLGVBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxNQUFJLENBQUE7QUFDSixJQUFBLGVBQUEsQ0FBQSxlQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsTUFBSSxDQUFBO0FBQ0osSUFBQSxlQUFBLENBQUEsZUFBQSxDQUFBLGlCQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxpQkFBZSxDQUFBO0FBQ2YsSUFBQSxlQUFBLENBQUEsZUFBQSxDQUFBLGlCQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxpQkFBZSxDQUFBO0FBQ2pCLENBQUMsRUFMSSxlQUFlLEtBQWYsZUFBZSxHQUtuQixFQUFBLENBQUEsQ0FBQSxDQUFBO0FBRUQ7OztBQUdHO01BQ1UsMkJBQTJCLENBQUE7QUF3QnRDOzs7OztBQUtHO0lBQ0gsV0FBWSxDQUFBLGVBQW1DLEVBQUUsVUFBMkIsRUFBQTtRQUMxRSxJQUFJLENBQUMsZUFBZSxHQUFHLDJCQUEyQixDQUFDLHFCQUFxQixDQUFDLGVBQWUsQ0FBQyxDQUFDO0FBQzFGLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7S0FDOUI7SUFoQ08sT0FBTyxxQkFBcUIsQ0FBQyxlQUFtQyxFQUFBO0FBQ3RFLFFBQUEsUUFBUSxlQUFlO0FBQ3JCLFlBQUEsS0FBSyxNQUFNO2dCQUNULE9BQU8sZUFBZSxDQUFDLElBQUksQ0FBQztBQUM5QixZQUFBLEtBQUssaUJBQWlCO2dCQUNwQixPQUFPLGVBQWUsQ0FBQyxlQUFlLENBQUM7QUFDekMsWUFBQSxLQUFLLGlCQUFpQjtnQkFDcEIsT0FBTyxlQUFlLENBQUMsZUFBZSxDQUFDO0FBQ3pDLFlBQUE7Z0JBQ0UsT0FBTyxlQUFlLENBQUMsSUFBSSxDQUFDO0FBQy9CLFNBQUE7S0FDRjtBQXNCRixDQUFBO01BRVksY0FBYyxDQUFBO0FBd0J6Qjs7Ozs7O0FBTUc7QUFDSCxJQUFBLFdBQUEsQ0FDRSxlQUF5QixFQUN6QixxQkFBb0MsRUFDcEMsZUFBOEMsRUFBQTtRQWxCL0IsSUFBZ0IsQ0FBQSxnQkFBQSxHQUFrQyxFQUFFLENBQUM7QUFHOUQsUUFBQSxJQUFBLENBQUEscUJBQXFCLEdBQUcsY0FBYyxDQUFDLCtCQUErQixDQUFDO0FBQ3ZFLFFBQUEsSUFBQSxDQUFBLHFCQUFxQixHQUFHLGNBQWMsQ0FBQywrQkFBK0IsQ0FBQztRQUV2RSxJQUFZLENBQUEsWUFBQSxHQUFHLEtBQUssQ0FBQztBQWMzQixRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7QUFDeEMsUUFBQSxJQUFJLENBQUMsc0JBQXNCLEdBQUcscUJBQXFCLENBQUM7QUFDcEQsUUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZUFBZSxDQUFDO0tBQ3pDO0FBRUQsSUFBQSxJQUFXLGVBQWUsR0FBQTtRQUN4QixPQUFPLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztLQUM5QjtBQUVELElBQUEsSUFBVyxlQUFlLEdBQUE7UUFDeEIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7S0FDOUI7QUFFTSxJQUFBLDRCQUE0QixDQUFDLE1BQXFCLEVBQUE7QUFDdkQsUUFBQSxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUNELGVBQWEsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUVDLE9BQUssQ0FBQyxDQUFDLENBQUM7S0FDekc7QUFFRDs7Ozs7Ozs7QUFRRztBQUNILElBQUEsSUFBVyxvQkFBb0IsR0FBQTtRQUM3QixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztLQUNuQztBQUVEOzs7Ozs7OztBQVFHO0FBQ0gsSUFBQSxJQUFXLG9CQUFvQixHQUFBO1FBQzdCLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDO0tBQ25DO0FBRU0sSUFBQSx3QkFBd0IsQ0FBQyxNQUFxQixFQUFBO1FBQ25ELE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQztLQUNqRDtBQUVEOzs7Ozs7QUFNRztBQUNJLElBQUEsMkJBQTJCLENBQUMsRUFBaUIsRUFBQTs7O0FBR2xELFFBQUEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDO1FBQzNDLE1BQU0sRUFBRSxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNoRSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUNuRCxRQUFBLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2pDO0FBRUQ7Ozs7Ozs7Ozs7O0FBV0c7QUFDSSxJQUFBLEtBQUssQ0FBQyxFQUNYLG9CQUFvQixHQUFHLGNBQWMsQ0FBQywrQkFBK0IsRUFDckUsb0JBQW9CLEdBQUcsY0FBYyxDQUFDLCtCQUErQixHQUN0RSxHQUFHLEVBQUUsRUFBQTtRQUNKLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNyQixPQUFPO0FBQ1IsU0FBQTtBQUNELFFBQUEsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDekIsUUFBQSxJQUFJLENBQUMscUJBQXFCLEdBQUcsb0JBQW9CLENBQUM7QUFDbEQsUUFBQSxJQUFJLENBQUMscUJBQXFCLEdBQUcsb0JBQW9CLENBQUM7UUFFbEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSTtBQUNyQyxZQUFBLElBQUksSUFBSSxDQUFDLGVBQWUsS0FBSyxlQUFlLENBQUMsZUFBZSxFQUFFO2dCQUM1RCxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsS0FBSTtvQkFDcEMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDbkQsaUJBQUMsQ0FBQyxDQUFDO0FBQ0osYUFBQTtBQUFNLGlCQUFBLElBQUksSUFBSSxDQUFDLGVBQWUsS0FBSyxlQUFlLENBQUMsZUFBZSxFQUFFO2dCQUNuRSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsS0FBSTtvQkFDcEMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7QUFDbkQsaUJBQUMsQ0FBQyxDQUFDO0FBQ0osYUFBQTtBQUFNLGlCQUFBLElBQUksSUFBSSxDQUFDLGVBQWUsS0FBSyxlQUFlLENBQUMsSUFBSSxFQUFFO0FBQ3hELGdCQUFBLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDNUMsYUFBQTtBQUNILFNBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFFTyxJQUFBLGlCQUFpQixDQUFDLFNBQW1CLEVBQUUsR0FBZSxFQUFFLFNBQXFCLEVBQUUsT0FBaUIsRUFBQTtRQUN0RyxJQUFJLEtBQUssR0FBRyxDQUFDLENBQUM7UUFDZCxJQUFJLEdBQUcsSUFBSSxJQUFJLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDakMsWUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzVDLGdCQUFBLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDdkIsTUFBTSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDM0IsTUFBTSxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUMzQixnQkFBQSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkIsZ0JBQUEsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTNCLGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFBRSxTQUFTO0FBQ3ZELGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFBRSxTQUFTO0FBQ3ZELGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFBRSxTQUFTO0FBQ3ZELGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFBRSxTQUFTO0FBRXZELGdCQUFBLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNuQixnQkFBQSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDM0IsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUFFLFNBQVM7QUFDdkQsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUFFLFNBQVM7QUFDdkQsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUFFLFNBQVM7QUFDdkQsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUFFLFNBQVM7QUFFdkQsZ0JBQUEsTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25CLGdCQUFBLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzQixnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQUUsU0FBUztBQUN2RCxnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQUUsU0FBUztBQUN2RCxnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQUUsU0FBUztBQUN2RCxnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQUUsU0FBUztBQUV2RCxnQkFBQSxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkIsZ0JBQUEsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLGdCQUFBLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN4QixhQUFBO0FBQ0YsU0FBQTtBQUNELFFBQUEsT0FBTyxLQUFLLENBQUM7S0FDZDtJQUVPLGlCQUFpQixDQUFDLEdBQXNCLEVBQUUsaUJBQTJCLEVBQUE7QUFDM0UsUUFBQSxNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdEUsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFBLEVBQUcsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDO0FBQ2hDLFFBQUEsR0FBRyxDQUFDLGFBQWEsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDO1FBQ3RDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBRTNDLFFBQUEsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQztRQUU5QixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQztRQUMvRCxNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUM7QUFDckIsUUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQ2hELFlBQUEsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEcsU0FBQTtRQUVELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUMsS0FBSyxDQUFDO1FBQ2pFLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQztBQUN0QixRQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDakQsWUFBQSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzRyxTQUFBO0FBRUQsUUFBQSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbEMsSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNWLFlBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0FBQzlELFNBQUE7UUFDRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUU3QyxRQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1FBQzdGLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztRQUNqQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQzlCLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbEMsU0FBQTtBQUNELFFBQUEsUUFBUSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQzs7UUFHL0IsSUFBSSxHQUFHLENBQUMsY0FBYyxFQUFFO0FBQ3RCLFlBQUEsR0FBRyxDQUFDLGNBQWMsR0FBRyxHQUFHLENBQUMsY0FBYyxDQUFDO0FBQ3pDLFNBQUE7UUFDRCxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxFQUFFLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDakcsUUFBQSxPQUFPLEdBQUcsQ0FBQztLQUNaO0lBRU8sa0NBQWtDLENBQUMsTUFBc0IsRUFBRSxJQUF1QixFQUFBO1FBQ3hGLE1BQU0sZ0JBQWdCLEdBQWEsRUFBRSxDQUFDO0FBQ3RDLFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxFQUFFLEtBQUssS0FBSTtBQUMxQyxZQUFBLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUM7QUFBRSxnQkFBQSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDOUQsU0FBQyxDQUFDLENBQUM7O0FBR0gsUUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxFQUFFO1lBQzVCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBQy9DLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1lBQy9DLE9BQU87QUFDUixTQUFBO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDNUMsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0FBQy9ELFFBQUEsTUFBTSxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztLQUNyQjtBQUVPLElBQUEsb0JBQW9CLENBQUMsVUFBMkIsRUFBQTtBQUN0RCxRQUFBLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLEtBQUk7QUFDL0IsWUFBQSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssYUFBYSxFQUFFO2dCQUNwQyxNQUFNLFdBQVcsR0FBRyxTQUE4QixDQUFDO2dCQUNuRCxJQUFJLENBQUMsa0NBQWtDLENBQUMsV0FBVyxDQUFDLE1BQU8sRUFBRSxXQUFXLENBQUMsQ0FBQztBQUMzRSxhQUFBO0FBQU0saUJBQUE7QUFDTCxnQkFBQSxJQUFJLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQ2xDLFNBQVMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ2xELGlCQUFBO0FBQ0YsYUFBQTtBQUNILFNBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFFRDs7O0FBR0c7QUFDSyxJQUFBLGNBQWMsQ0FBQyxJQUFjLEVBQUE7QUFDbkMsUUFBQSxJQUFJLElBQUksS0FBSyxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7QUFDbEMsWUFBQSxPQUFPLElBQUksQ0FBQztBQUNiLFNBQUE7QUFBTSxhQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ3ZCLFlBQUEsT0FBTyxLQUFLLENBQUM7QUFDZCxTQUFBO0FBQU0sYUFBQTtZQUNMLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDekMsU0FBQTtLQUNGOztBQWhRRDs7OztBQUlHO0FBQ3FCLGNBQStCLENBQUEsK0JBQUEsR0FBRyxDQUFDLENBQUM7QUFFNUQ7Ozs7QUFJRztBQUNxQixjQUErQixDQUFBLCtCQUFBLEdBQUcsRUFBRTs7QUM3RDlEOztBQUVHO01BQ1Usc0JBQXNCLENBQUE7QUFDakM7Ozs7O0FBS0c7SUFDVSxNQUFNLENBQUMsSUFBVSxFQUFFLFFBQXFCLEVBQUE7OztBQUNuRCxZQUFBLE1BQU0sTUFBTSxHQUE4QixDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQUUsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsR0FBRyxDQUFDO1lBQzNFLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDWCxnQkFBQSxPQUFPLElBQUksQ0FBQztBQUNiLGFBQUE7QUFFRCxZQUFBLE1BQU0saUJBQWlCLEdBQXNDLE1BQU0sQ0FBQyxXQUFXLENBQUM7WUFDaEYsSUFBSSxDQUFDLGlCQUFpQixFQUFFO0FBQ3RCLGdCQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2IsYUFBQTtBQUVELFlBQUEsTUFBTSxvQkFBb0IsR0FBRyxpQkFBaUIsQ0FBQyxlQUFlLENBQUM7QUFFL0QsWUFBQSxJQUFJLGVBQWdDLENBQUM7WUFDckMsSUFBSSxvQkFBb0IsS0FBSyxTQUFTLElBQUksb0JBQW9CLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQ3JFLGVBQWUsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN6RSxhQUFBO0FBQU0saUJBQUE7QUFDTCxnQkFBQSxlQUFlLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsb0JBQW9CLENBQUMsQ0FBQztBQUNqRixhQUFBO1lBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRTtBQUNwQixnQkFBQSxPQUFPLENBQUMsSUFBSSxDQUFDLG1FQUFtRSxDQUFDLENBQUM7QUFDbEYsZ0JBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixhQUFBO0FBRUQsWUFBQSxNQUFNLHFCQUFxQixHQUFHLGlCQUFpQixDQUFDLHFCQUFxQjtrQkFDakUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUNmLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLENBQUMsRUFDekMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsQ0FBQyxFQUN6QyxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLENBQUUsQ0FDNUM7QUFDSCxrQkFBRSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztZQUV0QyxNQUFNLGVBQWUsR0FBa0MsRUFBRSxDQUFDO0FBQzFELFlBQUEsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLDhCQUE4QixDQUFDLElBQUksQ0FBQyxDQUFDO0FBRXJFLFlBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxLQUFJO0FBQzFFLGdCQUFBLE1BQU0sVUFBVSxHQUFvQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7QUFFdEUsZ0JBQUEsTUFBTSxJQUFJLEdBQUcsaUJBQWlCLENBQUMsZUFBZTtBQUM1QyxzQkFBRSxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLElBQUksQ0FBQztzQkFDekUsU0FBUyxDQUFDO0FBQ2QsZ0JBQUEsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLDJCQUEyQixDQUFDLElBQUksS0FBQSxJQUFBLElBQUosSUFBSSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFKLElBQUksQ0FBRSxlQUFlLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUMzRixhQUFDLENBQUMsQ0FBQztZQUVILE9BQU8sSUFBSSxjQUFjLENBQUMsZUFBZSxFQUFFLHFCQUFxQixFQUFFLGVBQWUsQ0FBQyxDQUFDOztBQUNwRixLQUFBO0FBQ0Y7O0FDN0REOztBQUVHO01BQ1UsWUFBWSxDQUFBO0FBV3ZCOzs7OztBQUtHO0lBQ0gsV0FBbUIsQ0FBQSxJQUFjLEVBQUUsVUFBeUIsRUFBQTtBQUMxRCxRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQ2pCLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7S0FDOUI7QUFDRjs7QUN6QkQ7Ozs7O0FBS0c7QUFDRyxTQUFVLGdCQUFnQixDQUE2QixNQUFTLEVBQUE7SUFDcEUsSUFBSyxNQUFjLENBQUMsTUFBTSxFQUFFO1FBQzFCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUNqQixLQUFBO0FBQU0sU0FBQTtRQUNKLE1BQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUMzQixLQUFBO0FBRUQsSUFBQSxPQUFPLE1BQU0sQ0FBQztBQUNoQjs7QUNSQSxNQUFNQyxNQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakMsTUFBTUMsUUFBTSxHQUFHLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO0FBRXRDOztBQUVHO01BQ1UsV0FBVyxDQUFBO0FBa0J0Qjs7OztBQUlHO0lBQ0gsV0FBbUIsQ0FBQSxTQUE0QixFQUFFLGdCQUFxQyxFQUFBO0FBWHRGOzs7QUFHRztRQUNhLElBQVEsQ0FBQSxRQUFBLEdBQVksRUFBRSxDQUFDO1FBUXJDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3BELFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGdCQUFnQixDQUFDO0FBRXpDLFFBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDaEM7QUFFRDs7OztBQUlHO0lBQ0ksT0FBTyxHQUFBO1FBQ1osTUFBTSxJQUFJLEdBQVksRUFBRSxDQUFDO0FBQ3pCLFFBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsV0FBVyxLQUFJO1lBQ25ELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBeUMsQ0FBRSxDQUFDOztZQUcxRSxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE9BQU87QUFDUixhQUFBOztBQUdELFlBQUEsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQ3JCLE9BQU87QUFDUixhQUFBOzs7WUFJREQsTUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ2xCQyxRQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7WUFFbEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUM3QyxZQUFBLElBQUksU0FBUyxLQUFULElBQUEsSUFBQSxTQUFTLHVCQUFULFNBQVMsQ0FBRSxRQUFRLEVBQUU7Z0JBQ3ZCRCxNQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUM3QyxhQUFBO0FBQ0QsWUFBQSxJQUFJLFNBQVMsS0FBVCxJQUFBLElBQUEsU0FBUyx1QkFBVCxTQUFTLENBQUUsUUFBUSxFQUFFO2dCQUN2QixnQkFBZ0IsQ0FBQ0MsUUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUN4RCxhQUFBOztBQUdELFlBQUFELE1BQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3hCLFlBQUFDLFFBQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBRXBDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRztBQUNsQixnQkFBQSxRQUFRLEVBQUVELE1BQUksQ0FBQyxPQUFPLEVBQWdCO0FBQ3RDLGdCQUFBLFFBQVEsRUFBRUMsUUFBTSxDQUFDLE9BQU8sRUFBZ0I7YUFDekMsQ0FBQztTQUNILEVBQUUsRUFBYSxDQUFDLENBQUM7QUFDbEIsUUFBQSxPQUFPLElBQUksQ0FBQztLQUNiO0FBRUQ7Ozs7Ozs7QUFPRztBQUNJLElBQUEsT0FBTyxDQUFDLFVBQW1CLEVBQUE7UUFDaEMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLEtBQUk7QUFDM0MsWUFBQSxNQUFNLEtBQUssR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFFLENBQUM7WUFDcEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFzQyxDQUFDLENBQUM7O1lBR3RFLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ1QsT0FBTztBQUNSLGFBQUE7WUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzFDLElBQUksQ0FBQyxTQUFTLEVBQUU7Z0JBQ2QsT0FBTztBQUNSLGFBQUE7WUFFRCxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xCLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFFeEMsSUFBSSxTQUFTLENBQUMsUUFBUSxFQUFFO0FBQ3RCLG9CQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDRCxNQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELGlCQUFBO0FBQ0YsYUFBQTtZQUVELElBQUksS0FBSyxDQUFDLFFBQVEsRUFBRTtnQkFDbEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUUxQyxJQUFJLFNBQVMsQ0FBQyxRQUFRLEVBQUU7QUFDdEIsb0JBQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUNDLFFBQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7QUFDaEUsaUJBQUE7QUFDRixhQUFBO0FBQ0gsU0FBQyxDQUFDLENBQUM7S0FDSjtBQUVEOztBQUVHO0lBQ0ksU0FBUyxHQUFBO0FBQ2QsUUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsS0FBSTtZQUN6RCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQXNDLENBQUMsQ0FBQztZQUV0RSxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE9BQU87QUFDUixhQUFBO0FBRUQsWUFBQSxJQUFJLElBQUksS0FBSixJQUFBLElBQUEsSUFBSSx1QkFBSixJQUFJLENBQUUsUUFBUSxFQUFFO2dCQUNsQixJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDeEMsYUFBQTtBQUVELFlBQUEsSUFBSSxJQUFJLEtBQUosSUFBQSxJQUFBLElBQUksdUJBQUosSUFBSSxDQUFFLFFBQVEsRUFBRTtnQkFDbEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQzFDLGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQztLQUNKO0FBRUQ7Ozs7OztBQU1HO0FBQ0ksSUFBQSxPQUFPLENBQUMsSUFBZ0MsRUFBQTs7QUFDN0MsUUFBQSxPQUFPLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUksSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsU0FBUyxDQUFDO0tBQzlDO0FBRUQ7Ozs7Ozs7QUFPRztBQUNJLElBQUEsUUFBUSxDQUFDLElBQWdDLEVBQUE7O1FBQzlDLE9BQU8sQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxFQUFFLENBQUM7S0FDcEM7QUFFRDs7Ozs7O0FBTUc7QUFDSSxJQUFBLFdBQVcsQ0FBQyxJQUFnQyxFQUFBOztBQUNqRCxRQUFBLE9BQU8sQ0FBQSxFQUFBLEdBQUEsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBRSxJQUFJLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUksSUFBSSxDQUFDO0tBQy9DO0FBRUQ7Ozs7Ozs7QUFPRztBQUNJLElBQUEsWUFBWSxDQUFDLElBQWdDLEVBQUE7O1FBQ2xELE9BQU8sQ0FBQSxFQUFBLEdBQUEsTUFBQSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQUksSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsRUFBRSxDQUFDO0tBQzlEO0FBRUQ7O0FBRUc7QUFDSyxJQUFBLGlCQUFpQixDQUFDLFNBQTRCLEVBQUE7QUFDcEQsUUFBQSxNQUFNLEtBQUssR0FBa0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxLQUFJO0FBQzVGLFlBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUNqQixZQUFBLE9BQU8sS0FBSyxDQUFDO1NBQ2QsRUFBRSxFQUE0QixDQUFrQixDQUFDO0FBRWxELFFBQUEsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSTtBQUN6QixZQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNuQyxTQUFDLENBQUMsQ0FBQztBQUVILFFBQUEsT0FBTyxLQUFLLENBQUM7S0FDZDtBQUNGOztBQzVNRDs7QUFFRztNQUNVLG1CQUFtQixDQUFBO0FBQzlCOzs7O0FBSUc7QUFDVSxJQUFBLE1BQU0sQ0FBQyxJQUFVLEVBQUE7OztBQUM1QixZQUFBLE1BQU0sTUFBTSxHQUE4QixDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQUUsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsR0FBRyxDQUFDO1lBQzNFLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDWCxnQkFBQSxPQUFPLElBQUksQ0FBQztBQUNiLGFBQUE7QUFFRCxZQUFBLE1BQU0sY0FBYyxHQUFtQyxNQUFNLENBQUMsUUFBUSxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxjQUFjLEVBQUU7QUFDbkIsZ0JBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixhQUFBO1lBRUQsTUFBTSxjQUFjLEdBQXNCLEVBQUUsQ0FBQztZQUM3QyxJQUFJLGNBQWMsQ0FBQyxVQUFVLEVBQUU7QUFDN0IsZ0JBQUEsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLGNBQWMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQU8sSUFBSSxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTtvQkFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLEVBQUU7d0JBQ25DLE9BQU87QUFDUixxQkFBQTtBQUVELG9CQUFBLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDaEUsY0FBYyxDQUFDLElBQUksQ0FBQzt3QkFDbEIsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJO0FBQ2Ysd0JBQUEsSUFBSSxFQUFFLElBQUksWUFBWSxDQUFDLElBQUksRUFBRTs0QkFDM0IsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVOzRCQUMzQixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7NEJBQ3JGLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQzs0QkFDdEUsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDOzRCQUN0RSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCO3lCQUN4QyxDQUFDO0FBQ0gscUJBQUEsQ0FBQyxDQUFDO2lCQUNKLENBQUEsQ0FBQyxDQUNILENBQUM7QUFDSCxhQUFBO0FBRUQsWUFBQSxNQUFNLGdCQUFnQixHQUF3QjtnQkFDNUMsVUFBVSxFQUFFLGNBQWMsQ0FBQyxVQUFVO2dCQUNyQyxVQUFVLEVBQUUsY0FBYyxDQUFDLFVBQVU7Z0JBQ3JDLGFBQWEsRUFBRSxjQUFjLENBQUMsYUFBYTtnQkFDM0MsYUFBYSxFQUFFLGNBQWMsQ0FBQyxhQUFhO2dCQUMzQyxhQUFhLEVBQUUsY0FBYyxDQUFDLGFBQWE7Z0JBQzNDLGFBQWEsRUFBRSxjQUFjLENBQUMsYUFBYTtnQkFDM0MsV0FBVyxFQUFFLGNBQWMsQ0FBQyxXQUFXO2dCQUN2QyxpQkFBaUIsRUFBRSxjQUFjLENBQUMsaUJBQWlCO2FBQ3BELENBQUM7QUFFRixZQUFBLE9BQU8sSUFBSSxXQUFXLENBQUMsY0FBYyxFQUFFLGdCQUFnQixDQUFDLENBQUM7O0FBQzFELEtBQUE7QUFDRjs7QUNoRUQ7Ozs7Ozs7O0FBUUc7QUFDSCxNQUFNLGFBQWEsR0FBRyxDQUFDLEVBQVUsRUFBRSxFQUFVLEVBQUUsRUFBVSxFQUFFLEVBQVUsRUFBRSxDQUFTLEtBQVk7QUFDMUYsSUFBQSxNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNyQixJQUFBLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDakIsSUFBQSxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO0lBQ25CLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ2pDLE1BQU0sR0FBRyxHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUM5QixJQUFBLE1BQU0sR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFDcEIsSUFBQSxPQUFPLEVBQUUsR0FBRyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQztBQUM3QyxDQUFDLENBQUM7QUFFRjs7Ozs7OztBQU9HO0FBQ0gsTUFBTSxhQUFhLEdBQUcsQ0FBQyxHQUFhLEVBQUUsQ0FBUyxLQUFZOztBQUV6RCxJQUFBLElBQUksR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDbEIsUUFBQSxNQUFNLElBQUksS0FBSyxDQUFDLDBFQUEwRSxDQUFDLENBQUM7QUFDN0YsS0FBQTtBQUNELElBQUEsSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7QUFDeEIsUUFBQSxNQUFNLElBQUksS0FBSyxDQUFDLDZFQUE2RSxDQUFDLENBQUM7QUFDaEcsS0FBQTs7QUFHRCxJQUFBLElBQUksT0FBTyxDQUFDO0FBQ1osSUFBQSxLQUFLLE9BQU8sR0FBRyxDQUFDLEdBQUksT0FBTyxFQUFFLEVBQUU7QUFDN0IsUUFBQSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFHLE9BQU8sRUFBRTtZQUM3QixPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzdCLFNBQUE7YUFBTSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFO1lBQ2hDLE1BQU07QUFDUCxTQUFBO0FBQ0YsS0FBQTtBQUVELElBQUEsTUFBTSxNQUFNLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQztJQUMzQixJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUU7UUFDZCxPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzVCLEtBQUE7O0lBR0QsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztJQUMzQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0FBQzVCLElBQUEsTUFBTSxRQUFRLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQzs7SUFHdEMsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDL0IsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDaEMsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDL0IsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxPQUFPLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDaEMsSUFBQSxPQUFPLGFBQWEsQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDakQsQ0FBQyxDQUFDO0FBRUY7Ozs7O0FBS0c7TUFDVSxjQUFjLENBQUE7QUFrQnpCOzs7Ozs7QUFNRztBQUNILElBQUEsV0FBQSxDQUFZLE1BQWUsRUFBRSxNQUFlLEVBQUUsS0FBZ0IsRUFBQTtBQXhCOUQ7Ozs7QUFJRztBQUNJLFFBQUEsSUFBQSxDQUFBLEtBQUssR0FBYSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUVsRTs7QUFFRztRQUNJLElBQWlCLENBQUEsaUJBQUEsR0FBRyxJQUFJLENBQUM7QUFFaEM7O0FBRUc7UUFDSSxJQUFpQixDQUFBLGlCQUFBLEdBQUcsSUFBSSxDQUFDO1FBVTlCLElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtBQUN4QixZQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUM7QUFDakMsU0FBQTtRQUVELElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtBQUN4QixZQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUM7QUFDakMsU0FBQTtRQUVELElBQUksS0FBSyxLQUFLLFNBQVMsRUFBRTtBQUN2QixZQUFBLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO0FBQ3BCLFNBQUE7S0FDRjtBQUVEOzs7O0FBSUc7QUFDSSxJQUFBLEdBQUcsQ0FBQyxHQUFXLEVBQUE7QUFDcEIsUUFBQSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBQ3hFLFFBQUEsTUFBTSxDQUFDLEdBQUcsVUFBVSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztBQUM5QyxRQUFBLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDO0tBQzlEO0FBQ0Y7O0FDcEhEOzs7QUFHRztNQUNtQixnQkFBZ0IsQ0FBQTtBQVlyQzs7QUNiRDs7QUFFRztBQUNHLE1BQU8sMEJBQTJCLFNBQVEsZ0JBQWdCLENBQUE7QUFTOUQ7Ozs7Ozs7QUFPRztBQUNILElBQUEsV0FBQSxDQUNFLGVBQW1DLEVBQ25DLGVBQStCLEVBQy9CLGlCQUFpQyxFQUNqQyxlQUErQixFQUFBO0FBRS9CLFFBQUEsS0FBSyxFQUFFLENBQUM7QUF0Qk0sUUFBQSxJQUFBLENBQUEsSUFBSSxHQUFHLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLENBQUM7QUF3QnBFLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGVBQWUsQ0FBQztBQUN4QyxRQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxpQkFBaUIsQ0FBQztBQUM1QyxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7QUFFeEMsUUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZUFBZSxDQUFDO0tBQ3pDO0lBRU0sSUFBSSxHQUFBO0FBQ1QsUUFBQSxPQUFPLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLENBQUM7S0FDdkQ7QUFFTSxJQUFBLE1BQU0sQ0FBQyxLQUFrQixFQUFBO0FBQzlCLFFBQUEsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNyQixRQUFBLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFFckIsSUFBSSxJQUFJLEdBQUcsR0FBRyxFQUFFO0FBQ2QsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDM0UsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzdHLFNBQUE7QUFBTSxhQUFBO0FBQ0wsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDN0UsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUN4RyxTQUFBO1FBRUQsSUFBSSxJQUFJLEdBQUcsR0FBRyxFQUFFO0FBQ2QsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDN0UsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzVHLFNBQUE7QUFBTSxhQUFBO0FBQ0wsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDOUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMxRyxTQUFBO0tBQ0Y7QUFDRjs7QUMzREQsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFFdkUsTUFBTUQsTUFBSSxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQ2pDLE1BQU1FLE1BQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUNqQyxNQUFNQyxNQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakMsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7QUFFckM7O0FBRUc7TUFDVSxhQUFhLENBQUE7QUE0QnhCOzs7OztBQUtHO0lBQ0gsV0FBWSxDQUFBLFdBQTJCLEVBQUUsT0FBMEIsRUFBQTtBQXJCbkU7Ozs7QUFJRztRQUNJLElBQVUsQ0FBQSxVQUFBLEdBQUcsSUFBSSxDQUFDO0FBUWYsUUFBQSxJQUFBLENBQUEsTUFBTSxHQUFnQixJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBU3hGLFFBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxXQUFXLENBQUM7QUFDL0IsUUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztLQUN4QjtBQUVEOzs7O0FBSUc7QUFDSSxJQUFBLHVCQUF1QixDQUFDLE1BQXFCLEVBQUE7QUFDbEQsUUFBQSxNQUFNLEdBQUcsR0FBRyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUM1RSxRQUFBLE9BQU8sTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUNoRjtBQUVEOzs7OztBQUtHO0FBQ0ksSUFBQSxNQUFNLENBQUMsUUFBdUIsRUFBQTtRQUNuQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFdkMsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNsQyxTQUFBO0tBQ0Y7QUFFRDs7Ozs7QUFLRztBQUNJLElBQUEsTUFBTSxDQUFDLEtBQWEsRUFBQTtBQUN6QixRQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ2xDLFlBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDSCxNQUFJLENBQUMsQ0FBQyxDQUFDO1lBRWhELElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDaEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2xDLGFBQUE7QUFDRixTQUFBO0tBQ0Y7SUFFUyxVQUFVLENBQUMsTUFBbUIsRUFBRSxRQUF1QixFQUFBO1FBQy9ELE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsMkJBQTJCLENBQUNFLE1BQUksQ0FBQyxDQUFDOztBQUd4RSxRQUFBLE1BQU0sU0FBUyxHQUFHQyxNQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQzs7QUFHcEUsUUFBQSxTQUFTLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzs7QUFHN0csUUFBQSxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JHLFFBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUVsRCxRQUFBLE9BQU8sTUFBTSxDQUFDO0tBQ2Y7O0FBNUZzQixhQUFBLENBQUEsV0FBVyxHQUFHLEtBQUssQ0FBQzs7QUNWN0MsTUFBTSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUV6RTs7QUFFRztBQUNHLE1BQU8sb0JBQXFCLFNBQVEsZ0JBQWdCLENBQUE7QUFXeEQ7Ozs7Ozs7O0FBUUc7SUFDSCxXQUNFLENBQUEsUUFBcUIsRUFDckIsb0JBQW9DLEVBQ3BDLG9CQUFvQyxFQUNwQyxpQkFBaUMsRUFDakMsZUFBK0IsRUFBQTtBQUUvQixRQUFBLEtBQUssRUFBRSxDQUFDO0FBMUJNLFFBQUEsSUFBQSxDQUFBLElBQUksR0FBRyxTQUFTLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDO0FBNEI5RCxRQUFBLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxvQkFBb0IsQ0FBQztBQUNsRCxRQUFBLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxvQkFBb0IsQ0FBQztBQUNsRCxRQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxpQkFBaUIsQ0FBQztBQUM1QyxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7QUFFeEMsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3pFLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUM1RTtBQUVNLElBQUEsTUFBTSxDQUFDLEtBQWtCLEVBQUE7QUFDOUIsUUFBQSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3JCLFFBQUEsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQzs7UUFHckIsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2pCLElBQUksSUFBSSxHQUFHLEdBQUcsRUFBRTtBQUNkLGdCQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEQsYUFBQTtBQUFNLGlCQUFBO2dCQUNMLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM1QyxhQUFBO1lBRUQsSUFBSSxJQUFJLEdBQUcsR0FBRyxFQUFFO0FBQ2QsZ0JBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNuRCxhQUFBO0FBQU0saUJBQUE7Z0JBQ0wsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2pELGFBQUE7WUFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDL0MsU0FBQTs7UUFHRCxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDbEIsSUFBSSxJQUFJLEdBQUcsR0FBRyxFQUFFO0FBQ2QsZ0JBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoRCxhQUFBO0FBQU0saUJBQUE7Z0JBQ0wsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzVDLGFBQUE7WUFFRCxJQUFJLElBQUksR0FBRyxHQUFHLEVBQUU7QUFDZCxnQkFBQSxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ25ELGFBQUE7QUFBTSxpQkFBQTtnQkFDTCxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDakQsYUFBQTtZQUVELElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUNoRCxTQUFBO0tBQ0Y7QUFDRjs7QUM3RUQ7QUFDQTtBQUNBO0FBQ0EsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUM7QUFFOUI7O0FBRUc7TUFDVSxpQkFBaUIsQ0FBQTtBQUM1Qjs7Ozs7O0FBTUc7QUFDSSxJQUFBLE1BQU0sQ0FDWCxJQUFVLEVBQ1YsV0FBMkIsRUFDM0IsZUFBbUMsRUFDbkMsUUFBcUIsRUFBQTs7QUFFckIsUUFBQSxNQUFNLE1BQU0sR0FBOEIsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEdBQUcsQ0FBQztRQUMzRSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ1gsWUFBQSxPQUFPLElBQUksQ0FBQztBQUNiLFNBQUE7QUFFRCxRQUFBLE1BQU0saUJBQWlCLEdBQXNDLE1BQU0sQ0FBQyxXQUFXLENBQUM7UUFDaEYsSUFBSSxDQUFDLGlCQUFpQixFQUFFO0FBQ3RCLFlBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixTQUFBO0FBRUQsUUFBQSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNsRixPQUFPLElBQUksYUFBYSxDQUFDLFdBQVcsRUFBRSxPQUFPLElBQUksU0FBUyxDQUFDLENBQUM7S0FDN0Q7QUFFUyxJQUFBLGNBQWMsQ0FDdEIsaUJBQXdDLEVBQ3hDLGVBQW1DLEVBQ25DLFFBQXFCLEVBQUE7QUFFckIsUUFBQSxNQUFNLHFCQUFxQixHQUFHLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDO0FBQ3RFLFFBQUEsTUFBTSxxQkFBcUIsR0FBRyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQztBQUN0RSxRQUFBLE1BQU0sa0JBQWtCLEdBQUcsaUJBQWlCLENBQUMsa0JBQWtCLENBQUM7QUFDaEUsUUFBQSxNQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDO1FBRTVELFFBQVEsaUJBQWlCLENBQUMsY0FBYztBQUN0QyxZQUFBLEtBQUssU0FBUyxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRTtnQkFDN0MsSUFDRSxxQkFBcUIsS0FBSyxTQUFTO0FBQ25DLG9CQUFBLHFCQUFxQixLQUFLLFNBQVM7QUFDbkMsb0JBQUEsa0JBQWtCLEtBQUssU0FBUztvQkFDaEMsZ0JBQWdCLEtBQUssU0FBUyxFQUM5QjtBQUNBLG9CQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2IsaUJBQUE7QUFBTSxxQkFBQTtBQUNMLG9CQUFBLE9BQU8sSUFBSSxvQkFBb0IsQ0FDN0IsUUFBUSxFQUNSLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxxQkFBcUIsQ0FBQyxFQUNsRCxJQUFJLENBQUMsc0JBQXNCLENBQUMscUJBQXFCLENBQUMsRUFDbEQsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGtCQUFrQixDQUFDLEVBQy9DLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUM5QyxDQUFDO0FBQ0gsaUJBQUE7QUFDRixhQUFBO0FBQ0QsWUFBQSxLQUFLLFNBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLEVBQUU7Z0JBQ25ELElBQUkscUJBQXFCLEtBQUssU0FBUyxJQUFJLGtCQUFrQixLQUFLLFNBQVMsSUFBSSxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7QUFDN0csb0JBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixpQkFBQTtBQUFNLHFCQUFBO29CQUNMLE9BQU8sSUFBSSwwQkFBMEIsQ0FDbkMsZUFBZSxFQUNmLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxxQkFBcUIsQ0FBQyxFQUN4RCxJQUFJLENBQUMsNEJBQTRCLENBQUMsa0JBQWtCLENBQUMsRUFDckQsSUFBSSxDQUFDLDRCQUE0QixDQUFDLGdCQUFnQixDQUFDLENBQ3BELENBQUM7QUFDSCxpQkFBQTtBQUNGLGFBQUE7QUFDRCxZQUFBLFNBQVM7QUFDUCxnQkFBQSxPQUFPLElBQUksQ0FBQztBQUNiLGFBQUE7QUFDRixTQUFBO0tBQ0Y7QUFFTyxJQUFBLHNCQUFzQixDQUFDLEdBQW1DLEVBQUE7UUFDaEUsT0FBTyxJQUFJLGNBQWMsQ0FDdkIsT0FBTyxHQUFHLENBQUMsTUFBTSxLQUFLLFFBQVEsR0FBRyxPQUFPLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQ2pFLE9BQU8sR0FBRyxDQUFDLE1BQU0sS0FBSyxRQUFRLEdBQUcsT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsU0FBUyxFQUNqRSxHQUFHLENBQUMsS0FBSyxDQUNWLENBQUM7S0FDSDtBQUVPLElBQUEsNEJBQTRCLENBQUMsR0FBbUMsRUFBQTtBQUN0RSxRQUFBLE9BQU8sSUFBSSxjQUFjLENBQUMsT0FBTyxHQUFHLENBQUMsTUFBTSxLQUFLLFFBQVEsR0FBRyxPQUFPLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQUUsR0FBRyxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDckg7QUFDRjs7Ozs7O0FDdkdEO0FBQ0E7QUFDQSxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDMUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzNCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQztBQUM1QixNQUFNLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDMUIsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzNCO0FBRUE7OztBQUdHO0FBQ0ksTUFBTSxxQkFBcUIsR0FBRyxDQUFDLFFBQStCLEtBQXNCO0lBQ3pGLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksR0FBRyxFQUFFO0FBQ3ZDLFFBQUEsUUFBUSxRQUFRO1lBQ2QsS0FBSyxLQUFLLENBQUMsY0FBYztBQUN2QixnQkFBQSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQ2pDLEtBQUssS0FBSyxDQUFDLFlBQVk7QUFDckIsZ0JBQUEsT0FBTyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztBQUMvQixZQUFBO0FBQ0UsZ0JBQUEsT0FBTyxDQUFDLElBQUksQ0FBQywyQ0FBMkMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNwRSxnQkFBQSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQ2xDLFNBQUE7QUFDRixLQUFBO0FBQU0sU0FBQTs7QUFFTCxRQUFBLFFBQVEsUUFBUTtZQUNkLEtBQUssS0FBSyxDQUFDLGNBQWM7QUFDdkIsZ0JBQUEsT0FBTyxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNqQyxLQUFLLEtBQUssQ0FBQyxZQUFZO0FBQ3JCLGdCQUFBLE9BQU8sQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7QUFDL0IsWUFBQSxLQUFLLFlBQVk7QUFDZixnQkFBQSxPQUFPLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0FBQy9CLFlBQUEsS0FBSyxhQUFhO0FBQ2hCLGdCQUFBLE9BQU8sQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztBQUNwQyxZQUFBLEtBQUssY0FBYztBQUNqQixnQkFBQSxPQUFPLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDLENBQUM7QUFDckMsWUFBQSxLQUFLLFlBQVk7QUFDZixnQkFBQSxPQUFPLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLENBQUM7QUFDdEMsWUFBQSxLQUFLLGFBQWE7QUFDaEIsZ0JBQUEsT0FBTyxDQUFDLE9BQU8sRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO0FBQ3ZELFlBQUE7QUFDRSxnQkFBQSxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixHQUFHLFFBQVEsQ0FBQyxDQUFDO0FBQ3hELFNBQUE7QUFDRixLQUFBO0FBQ0gsQ0FBQyxDQUFDO0FBRUY7Ozs7O0FBS0c7QUFDSSxNQUFNLHdCQUF3QixHQUFHLENBQUMsWUFBb0IsRUFBRSxRQUErQixLQUFZO0FBQ3hHLElBQUEsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDbkQsSUFBQSxPQUFPLE9BQU8sR0FBRyxZQUFZLEdBQUcsMEJBQTBCLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO0FBQ2xILENBQUM7O0FDMUREO0FBT0EsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7SUF3RWQsc0JBSVg7QUFKRCxDQUFBLFVBQVkscUJBQXFCLEVBQUE7QUFDL0IsSUFBQSxxQkFBQSxDQUFBLHFCQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsS0FBRyxDQUFBO0FBQ0gsSUFBQSxxQkFBQSxDQUFBLHFCQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsT0FBSyxDQUFBO0FBQ0wsSUFBQSxxQkFBQSxDQUFBLHFCQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsTUFBSSxDQUFBO0FBQ04sQ0FBQyxFQUpXLHFCQUFxQixLQUFyQixxQkFBcUIsR0FJaEMsRUFBQSxDQUFBLENBQUEsQ0FBQTtJQUVXLHVCQUtYO0FBTEQsQ0FBQSxVQUFZLHNCQUFzQixFQUFBO0FBQ2hDLElBQUEsc0JBQUEsQ0FBQSxzQkFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLE1BQUksQ0FBQTtBQUNKLElBQUEsc0JBQUEsQ0FBQSxzQkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFFBQU0sQ0FBQTtBQUNOLElBQUEsc0JBQUEsQ0FBQSxzQkFBQSxDQUFBLGNBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLGNBQVksQ0FBQTtBQUNaLElBQUEsc0JBQUEsQ0FBQSxzQkFBQSxDQUFBLElBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLElBQUUsQ0FBQTtBQUNKLENBQUMsRUFMVyxzQkFBc0IsS0FBdEIsc0JBQXNCLEdBS2pDLEVBQUEsQ0FBQSxDQUFBLENBQUE7SUFFVyw4QkFHWDtBQUhELENBQUEsVUFBWSw2QkFBNkIsRUFBQTtBQUN2QyxJQUFBLDZCQUFBLENBQUEsNkJBQUEsQ0FBQSxZQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxZQUFVLENBQUE7QUFDVixJQUFBLDZCQUFBLENBQUEsNkJBQUEsQ0FBQSxlQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxlQUFhLENBQUE7QUFDZixDQUFDLEVBSFcsNkJBQTZCLEtBQTdCLDZCQUE2QixHQUd4QyxFQUFBLENBQUEsQ0FBQSxDQUFBO0lBRVcsOEJBSVg7QUFKRCxDQUFBLFVBQVksNkJBQTZCLEVBQUE7QUFDdkMsSUFBQSw2QkFBQSxDQUFBLDZCQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsTUFBSSxDQUFBO0FBQ0osSUFBQSw2QkFBQSxDQUFBLDZCQUFBLENBQUEsa0JBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLGtCQUFnQixDQUFBO0FBQ2hCLElBQUEsNkJBQUEsQ0FBQSw2QkFBQSxDQUFBLG1CQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxtQkFBaUIsQ0FBQTtBQUNuQixDQUFDLEVBSlcsNkJBQTZCLEtBQTdCLDZCQUE2QixHQUl4QyxFQUFBLENBQUEsQ0FBQSxDQUFBO0lBRVcsd0JBS1g7QUFMRCxDQUFBLFVBQVksdUJBQXVCLEVBQUE7QUFDakMsSUFBQSx1QkFBQSxDQUFBLHVCQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsUUFBTSxDQUFBO0FBQ04sSUFBQSx1QkFBQSxDQUFBLHVCQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsUUFBTSxDQUFBO0FBQ04sSUFBQSx1QkFBQSxDQUFBLHVCQUFBLENBQUEsYUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsYUFBVyxDQUFBO0FBQ1gsSUFBQSx1QkFBQSxDQUFBLHVCQUFBLENBQUEsdUJBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLHVCQUFxQixDQUFBO0FBQ3ZCLENBQUMsRUFMVyx1QkFBdUIsS0FBdkIsdUJBQXVCLEdBS2xDLEVBQUEsQ0FBQSxDQUFBLENBQUE7QUFFRDs7Ozs7QUFLRztBQUNVLE1BQUEsYUFBYyxTQUFRLEtBQUssQ0FBQyxjQUFjLENBQUE7QUFpRnJELElBQUEsV0FBQSxDQUFZLGFBQThCLEVBQUUsRUFBQTtBQUMxQyxRQUFBLEtBQUssRUFBRSxDQUFDO0FBakZWOztBQUVHO1FBQ2EsSUFBZSxDQUFBLGVBQUEsR0FBWSxJQUFJLENBQUM7QUFFekMsUUFBQSxJQUFBLENBQUEsTUFBTSxHQUFHLEdBQUcsQ0FBQztBQUNiLFFBQUEsSUFBQSxDQUFBLEtBQUssR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDOUMsUUFBQSxJQUFBLENBQUEsVUFBVSxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN0RCxRQUFBLElBQUEsQ0FBQSxHQUFHLEdBQXlCLElBQUksQ0FBQzs7QUFFakMsUUFBQSxJQUFBLENBQUEsVUFBVSxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNuRCxRQUFBLElBQUEsQ0FBQSxZQUFZLEdBQXlCLElBQUksQ0FBQzs7QUFFMUMsUUFBQSxJQUFBLENBQUEsU0FBUyxHQUF5QixJQUFJLENBQUM7QUFDdkMsUUFBQSxJQUFBLENBQUEsYUFBYSxHQUFHLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQztBQUM1QyxRQUFBLElBQUEsQ0FBQSxXQUFXLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQzs7QUFFMUMsUUFBQSxJQUFBLENBQUEsaUJBQWlCLEdBQUcsR0FBRyxDQUFDO0FBQ3hCLFFBQUEsSUFBQSxDQUFBLG9CQUFvQixHQUF5QixJQUFJLENBQUM7O0FBRWxELFFBQUEsSUFBQSxDQUFBLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztBQUN2QixRQUFBLElBQUEsQ0FBQSxtQkFBbUIsR0FBeUIsSUFBSSxDQUFDOztBQUVqRCxRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDO0FBQ2pCLFFBQUEsSUFBQSxDQUFBLFVBQVUsR0FBRyxHQUFHLENBQUM7QUFDakIsUUFBQSxJQUFBLENBQUEscUJBQXFCLEdBQUcsR0FBRyxDQUFDO0FBQzVCLFFBQUEsSUFBQSxDQUFBLHNCQUFzQixHQUFHLEdBQUcsQ0FBQztBQUM3QixRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQXlCLElBQUksQ0FBQztBQUN4QyxRQUFBLElBQUEsQ0FBQSxRQUFRLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ2pELFFBQUEsSUFBQSxDQUFBLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFDckIsUUFBQSxJQUFBLENBQUEsZUFBZSxHQUFHLEdBQUcsQ0FBQztBQUN0QixRQUFBLElBQUEsQ0FBQSxPQUFPLEdBQUcsR0FBRyxDQUFDO0FBQ2QsUUFBQSxJQUFBLENBQUEsU0FBUyxHQUF5QixJQUFJLENBQUM7O0FBRXZDLFFBQUEsSUFBQSxDQUFBLGFBQWEsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdEQsUUFBQSxJQUFBLENBQUEsV0FBVyxHQUF5QixJQUFJLENBQUM7O0FBRXpDLFFBQUEsSUFBQSxDQUFBLG1CQUFtQixHQUF5QixJQUFJLENBQUM7O0FBRWpELFFBQUEsSUFBQSxDQUFBLFlBQVksR0FBRyxHQUFHLENBQUM7QUFDbkIsUUFBQSxJQUFBLENBQUEsd0JBQXdCLEdBQUcsR0FBRyxDQUFDO0FBQy9CLFFBQUEsSUFBQSxDQUFBLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDckQsUUFBQSxJQUFBLENBQUEsa0JBQWtCLEdBQUcsR0FBRyxDQUFDO0FBQ3pCLFFBQUEsSUFBQSxDQUFBLGlCQUFpQixHQUF5QixJQUFJLENBQUM7QUFDL0MsUUFBQSxJQUFBLENBQUEsYUFBYSxHQUFHLEdBQUcsQ0FBQztBQUNwQixRQUFBLElBQUEsQ0FBQSxhQUFhLEdBQUcsR0FBRyxDQUFDO0FBQ3BCLFFBQUEsSUFBQSxDQUFBLGNBQWMsR0FBRyxHQUFHLENBQUM7QUFFckIsUUFBQSxJQUFBLENBQUEsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0FBZ0IxQixRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQUcsc0JBQXNCLENBQUMsSUFBSSxDQUFDO0FBQ3pDLFFBQUEsSUFBQSxDQUFBLFVBQVUsR0FBRyx1QkFBdUIsQ0FBQyxNQUFNLENBQUM7QUFDNUMsUUFBQSxJQUFBLENBQUEsaUJBQWlCLEdBQUcsNkJBQTZCLENBQUMsSUFBSSxDQUFDO0FBQ3ZELFFBQUEsSUFBQSxDQUFBLGlCQUFpQixHQUFHLDZCQUE2QixDQUFDLFVBQVUsQ0FBQztBQUM3RCxRQUFBLElBQUEsQ0FBQSxTQUFTLEdBQUcscUJBQXFCLENBQUMsSUFBSSxDQUFDO0FBQ3ZDLFFBQUEsSUFBQSxDQUFBLGdCQUFnQixHQUFHLHFCQUFxQixDQUFDLEtBQUssQ0FBQzs7OztRQUsvQyxJQUFVLENBQUEsVUFBQSxHQUFHLEtBQUssQ0FBQztRQUVuQixJQUFjLENBQUEsY0FBQSxHQUFHLEdBQUcsQ0FBQztRQUNyQixJQUFjLENBQUEsY0FBQSxHQUFHLEdBQUcsQ0FBQztRQUNyQixJQUFZLENBQUEsWUFBQSxHQUFHLEdBQUcsQ0FBQztRQUt6QixJQUFJLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQztBQUM1RCxRQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxLQUFLLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssS0FBSyxDQUFDLFlBQVksRUFBRTtBQUNsRixZQUFBLE9BQU8sQ0FBQyxJQUFJLENBQ1YsMkhBQTJILENBQzVILENBQUM7QUFDSCxTQUFBOztBQUdELFFBQUE7WUFDRSxjQUFjO1lBQ2QsaUJBQWlCO1lBQ2pCLFlBQVk7WUFDWix5QkFBeUI7WUFDekIsd0JBQXdCO1lBQ3hCLGVBQWU7WUFDZixjQUFjO1lBQ2QsZ0JBQWdCO1lBQ2hCLHdCQUF3QjtZQUN4QixzQkFBc0I7WUFDdEIsVUFBVTtZQUNWLFVBQVU7QUFDWCxTQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxLQUFJO0FBQ2hCLFlBQUEsSUFBSyxVQUFrQixDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsRUFBRTs7QUFFMUMsZ0JBQUEsT0FBUSxVQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ2pDLGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQzs7QUFHSCxRQUFBLFVBQVUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLFFBQUEsVUFBVSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7QUFDekIsUUFBQSxVQUFVLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQzs7O1FBSTNCLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFO1lBQ3JDLFVBQWtCLENBQUMsUUFBUSxHQUFJLFVBQWtCLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQztBQUN0RSxTQUFBOzs7UUFJRCxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtZQUNyQyxVQUFrQixDQUFDLFlBQVksR0FBSSxVQUFrQixDQUFDLFlBQVksSUFBSSxLQUFLLENBQUM7WUFDNUUsVUFBa0IsQ0FBQyxZQUFZLEdBQUksVUFBa0IsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDO0FBQzlFLFNBQUE7O1FBR0QsVUFBVSxDQUFDLFFBQVEsR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQztZQUM5QyxLQUFLLENBQUMsV0FBVyxDQUFDLE1BQU07WUFDeEIsS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTO1lBQzNCLEtBQUssQ0FBQyxXQUFXLENBQUMsV0FBVztZQUM3QixLQUFLLENBQUMsV0FBVyxDQUFDLEdBQUc7WUFDckIsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNO0FBQ3hCLFlBQUE7QUFDRSxnQkFBQSxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQ3RCLGdCQUFBLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRTtBQUNoRCxnQkFBQSxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQzFCLGdCQUFBLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsRUFBRTs7QUFFeEQsZ0JBQUEsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRTtBQUM1RCxnQkFBQSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0FBQzdCLGdCQUFBLGlCQUFpQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUNqQyxnQkFBQSxvQkFBb0IsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7QUFDckMsZ0JBQUEsZ0JBQWdCLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQ2hDLGdCQUFBLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtBQUNwQyxnQkFBQSxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQzFCLGdCQUFBLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFDMUIsZ0JBQUEscUJBQXFCLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQ3JDLGdCQUFBLHNCQUFzQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUN0QyxnQkFBQSxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0FBQzNCLGdCQUFBLFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRTtBQUNuRCxnQkFBQSxjQUFjLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQzlCLGdCQUFBLGVBQWUsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFDL0IsZ0JBQUEsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUN2QixnQkFBQSxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0FBQzFCLGdCQUFBLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRTtBQUN4RCxnQkFBQSxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7QUFDcEMsZ0JBQUEsWUFBWSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUM1QixnQkFBQSx3QkFBd0IsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFDeEMsZ0JBQUEsWUFBWSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFO0FBQ3ZELGdCQUFBLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUNsQyxnQkFBQSxpQkFBaUIsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7QUFDbEMsZ0JBQUEsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUM3QixnQkFBQSxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0FBQzdCLGdCQUFBLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7QUFDNUIsYUFBQTtBQUNGLFNBQUEsQ0FBQyxDQUFDOztBQUdILFFBQUEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQzs7UUFHM0IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO0tBQ3ZCO0FBRUQsSUFBQSxJQUFJLE9BQU8sR0FBQTtRQUNULE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQztLQUNqQjtJQUVELElBQUksT0FBTyxDQUFDLENBQXVCLEVBQUE7QUFDakMsUUFBQSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQztLQUNkO0FBRUQsSUFBQSxJQUFJLE9BQU8sR0FBQTtRQUNULE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztLQUN2QjtJQUVELElBQUksT0FBTyxDQUFDLENBQXVCLEVBQUE7QUFDakMsUUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztLQUNwQjtBQUVEOztBQUVHO0FBQ0gsSUFBQSxJQUFJLFNBQVMsR0FBQTtBQUNYLFFBQUEsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztLQUMzQjtBQUVEOztBQUVHO0lBQ0gsSUFBSSxTQUFTLENBQUMsQ0FBUyxFQUFBO1FBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztLQUM1QjtBQUVELElBQUEsSUFBSSxXQUFXLEdBQUE7UUFDYixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7S0FDekI7SUFFRCxJQUFJLFdBQVcsQ0FBQyxDQUF1QixFQUFBO0FBQ3JDLFFBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7S0FDdEI7QUFFRCxJQUFBLElBQUksU0FBUyxHQUFBO1FBQ1gsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0tBQ3hCO0lBRUQsSUFBSSxTQUFTLENBQUMsQ0FBMEIsRUFBQTtBQUN0QyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1FBRXBCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsS0FBSyx1QkFBdUIsQ0FBQyxXQUFXLENBQUM7QUFDMUUsUUFBQSxJQUFJLENBQUMsV0FBVztBQUNkLFlBQUEsSUFBSSxDQUFDLFVBQVUsS0FBSyx1QkFBdUIsQ0FBQyxXQUFXO0FBQ3ZELGdCQUFBLElBQUksQ0FBQyxVQUFVLEtBQUssdUJBQXVCLENBQUMscUJBQXFCLENBQUM7UUFDcEUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7S0FDMUI7QUFFRCxJQUFBLElBQUksU0FBUyxHQUFBO1FBQ1gsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0tBQ3hCO0lBRUQsSUFBSSxTQUFTLENBQUMsQ0FBeUIsRUFBQTtBQUNyQyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1FBRXBCLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0tBQzFCO0FBRUQsSUFBQSxJQUFJLGdCQUFnQixHQUFBO1FBQ2xCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDO0tBQy9CO0lBRUQsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFnQyxFQUFBO0FBQ25ELFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztRQUUzQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztLQUMxQjtBQUVELElBQUEsSUFBSSxnQkFBZ0IsR0FBQTtRQUNsQixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztLQUMvQjtJQUVELElBQUksZ0JBQWdCLENBQUMsQ0FBZ0MsRUFBQTtBQUNuRCxRQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLENBQUM7UUFFM0IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7S0FDMUI7QUFFRCxJQUFBLElBQUksUUFBUSxHQUFBO1FBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0tBQ3ZCO0lBRUQsSUFBSSxRQUFRLENBQUMsQ0FBd0IsRUFBQTtBQUNuQyxRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1FBRW5CLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztLQUN4QjtBQUVELElBQUEsSUFBSSxlQUFlLEdBQUE7UUFDakIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7S0FDOUI7SUFFRCxJQUFJLGVBQWUsQ0FBQyxDQUF3QixFQUFBO0FBQzFDLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztRQUUxQixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7S0FDeEI7QUFFRCxJQUFBLElBQUksTUFBTSxHQUFBO1FBQ1IsT0FBTyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDaEM7SUFFRCxJQUFJLE1BQU0sQ0FBQyxDQUFTLEVBQUE7QUFDbEIsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUM7S0FDNUI7QUFFRCxJQUFBLElBQUksU0FBUyxHQUFBO1FBQ1gsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO0tBQ3hCO0lBRUQsSUFBSSxTQUFTLENBQUMsQ0FBVSxFQUFBO0FBQ3RCLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7UUFFcEIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0tBQ3hCO0FBRUQ7Ozs7O0FBS0c7QUFDSSxJQUFBLGtCQUFrQixDQUFDLEtBQWEsRUFBQTtBQUNyQyxRQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztBQUN2RSxRQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztBQUN2RSxRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUVwRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7S0FDdkI7QUFFTSxJQUFBLElBQUksQ0FBQyxNQUFZLEVBQUE7QUFDdEIsUUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztBQUduQixRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDOUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3hDLFFBQUEsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUN4QyxRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztBQUN4QyxRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUNsQyxRQUFBLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQztRQUMxQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDeEMsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDO0FBQ2xELFFBQUEsSUFBSSxDQUFDLG9CQUFvQixHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQztBQUN4RCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7QUFDaEQsUUFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDO0FBQ3RELFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQ3BDLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO0FBQ3BDLFFBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQztBQUMxRCxRQUFBLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxNQUFNLENBQUMsc0JBQXNCLENBQUM7QUFDNUQsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFDcEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3BDLFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDO0FBQzVDLFFBQUEsSUFBSSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDO0FBQzlDLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDO0FBQzlCLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO1FBQ2xDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUM5QyxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUN0QyxRQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxNQUFNLENBQUMsbUJBQW1CLENBQUM7QUFDdEQsUUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUM7QUFDeEMsUUFBQSxJQUFJLENBQUMsd0JBQXdCLEdBQUcsTUFBTSxDQUFDLHdCQUF3QixDQUFDO1FBQ2hFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM1QyxRQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUM7QUFDcEQsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDO0FBQ2xELFFBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDO0FBQzFDLFFBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDO0FBQzFDLFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDO0FBRTVDLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQ2xDLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQ2xDLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztBQUNoRCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7QUFDaEQsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7QUFDaEMsUUFBQSxJQUFJLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQUM7QUFFOUMsUUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFFbEMsUUFBQSxPQUFPLElBQUksQ0FBQztLQUNiO0FBRUQ7O0FBRUc7SUFDSyxjQUFjLEdBQUE7UUFDcEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDeEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7QUFDeEQsUUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7QUFFMUQsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFO1lBQzdCLE9BQU87QUFDUixTQUFBO0FBQ0QsUUFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsS0FBSyxDQUFDO1FBRWpDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUMzRSxRQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDbkMsUUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztRQUNyRCxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztBQUMvQyxRQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3ZELElBQUksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUMvRCxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUM7UUFDckUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDO1FBQzdELElBQUksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztRQUNuRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNqRCxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUNqRCxJQUFJLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUM7UUFDdkUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLHNCQUFzQixDQUFDO1FBQ3pFLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ2pELElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUN6RCxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztRQUMzRCxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQztRQUMzQyxJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUMvQyxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0csSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUM7UUFDbkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDO1FBQ25FLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQ3JELElBQUksQ0FBQyxRQUFRLENBQUMsd0JBQXdCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQztRQUM3RSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1FBQ2pFLElBQUksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQzs7QUFHL0QsUUFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssS0FBSyxDQUFDLFlBQVksRUFBRTtZQUN4QyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUNoRCxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUNyRCxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUNuRCxJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztZQUN4RCxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztBQUN4RCxTQUFBO1FBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0tBQ3hCO0lBRU8saUJBQWlCLEdBQUE7QUFDdkIsUUFBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEtBQUssSUFBSSxDQUFDO0FBQ3RELFFBQUEsTUFBTSxXQUFXLEdBQ2YsSUFBSSxDQUFDLEdBQUcsS0FBSyxJQUFJO1lBQ2pCLElBQUksQ0FBQyxZQUFZLEtBQUssSUFBSTtZQUMxQixJQUFJLENBQUMsb0JBQW9CLEtBQUssSUFBSTtZQUNsQyxJQUFJLENBQUMsbUJBQW1CLEtBQUssSUFBSTtZQUNqQyxJQUFJLENBQUMsVUFBVSxLQUFLLElBQUk7QUFDeEIsWUFBQSxJQUFJLENBQUMsaUJBQWlCLEtBQUssSUFBSSxDQUFDO1FBRWxDLElBQUksQ0FBQyxPQUFPLEdBQUc7O1lBRWIsd0JBQXdCLEVBQUUsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO1lBRXRELE9BQU8sRUFBRSxJQUFJLENBQUMsVUFBVTtBQUN4QixZQUFBLGdCQUFnQixFQUFFLElBQUksQ0FBQyxVQUFVLEtBQUssdUJBQXVCLENBQUMsTUFBTTtBQUNwRSxZQUFBLGdCQUFnQixFQUFFLElBQUksQ0FBQyxVQUFVLEtBQUssdUJBQXVCLENBQUMsTUFBTTtBQUNwRSxZQUFBLHFCQUFxQixFQUNuQixJQUFJLENBQUMsVUFBVSxLQUFLLHVCQUF1QixDQUFDLFdBQVc7QUFDdkQsZ0JBQUEsSUFBSSxDQUFDLFVBQVUsS0FBSyx1QkFBdUIsQ0FBQyxxQkFBcUI7WUFDbkUsWUFBWSxFQUFFLFdBQVcsSUFBSSxXQUFXO0FBQ3hDLFlBQUEscUJBQXFCLEVBQUUsV0FBVyxJQUFJLENBQUMsV0FBVztBQUNsRCxZQUFBLGdCQUFnQixFQUFFLElBQUksQ0FBQyxZQUFZLEtBQUssSUFBSTtBQUM1QyxZQUFBLHdCQUF3QixFQUFFLElBQUksQ0FBQyxvQkFBb0IsS0FBSyxJQUFJO0FBQzVELFlBQUEsdUJBQXVCLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixLQUFLLElBQUk7QUFDMUQsWUFBQSxjQUFjLEVBQUUsSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJO0FBQ3hDLFlBQUEsYUFBYSxFQUFFLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSTtBQUN0QyxZQUFBLHVCQUF1QixFQUFFLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxJQUFJO0FBQzFELFlBQUEscUJBQXFCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixLQUFLLElBQUk7QUFDdEQsWUFBQSxZQUFZLEVBQUUsSUFBSSxDQUFDLFVBQVUsS0FBSyxzQkFBc0IsQ0FBQyxNQUFNO0FBQy9ELFlBQUEsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLFVBQVUsS0FBSyxzQkFBc0IsQ0FBQyxZQUFZO0FBQzNFLFlBQUEsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLEtBQUssc0JBQXNCLENBQUMsRUFBRTtBQUN2RCxZQUFBLG1CQUFtQixFQUFFLElBQUksQ0FBQyxpQkFBaUIsS0FBSyw2QkFBNkIsQ0FBQyxnQkFBZ0I7QUFDOUYsWUFBQSxvQkFBb0IsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEtBQUssNkJBQTZCLENBQUMsaUJBQWlCO0FBQ2hHLFlBQUEsbUJBQW1CLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixLQUFLLDZCQUE2QixDQUFDLFVBQVU7QUFDeEYsWUFBQSxtQkFBbUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEtBQUssNkJBQTZCLENBQUMsYUFBYTtTQUM1RixDQUFDOztBQUdGLFFBQUEsSUFBSSxDQUFDLFlBQVksR0FBR0MsY0FBWSxDQUFDO0FBQ2pDLFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBR0MsZ0JBQWMsQ0FBQzs7O1FBSXJDLElBQUksUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQ3RDLFlBQUEsTUFBTSxTQUFTLEdBQ2IsQ0FBQyxJQUFJLENBQUMsWUFBWSxLQUFLLElBQUk7QUFDekIsa0JBQUUsd0JBQXdCLENBQUMsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJO2tCQUN4RixFQUFFO0FBQ04saUJBQUMsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJO0FBQ3RCLHNCQUFFLHdCQUF3QixDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSTtzQkFDbEYsRUFBRSxDQUFDO0FBQ1AsaUJBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJO0FBQ3ZCLHNCQUFFLHdCQUF3QixDQUFDLHlCQUF5QixFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSTtzQkFDcEYsRUFBRSxDQUFDLENBQUM7QUFDVixZQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxHQUFHQSxnQkFBYyxDQUFDO0FBQ2xELFNBQUE7O0FBR0QsUUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztLQUN6QjtJQUVPLGVBQWUsR0FBQTtBQUNyQixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ25CLFlBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtBQUMvQyxnQkFBQSxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7QUFDOUIsYUFBQTtBQUFNLGlCQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxxQkFBcUIsQ0FBQyxLQUFLLEVBQUU7QUFDeEQsZ0JBQUEsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDO0FBQzVCLGFBQUE7QUFBTSxpQkFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUsscUJBQXFCLENBQUMsSUFBSSxFQUFFO0FBQ3ZELGdCQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQztBQUM3QixhQUFBO0FBQ0YsU0FBQTtBQUFNLGFBQUE7QUFDTCxZQUFBLElBQUksSUFBSSxDQUFDLGVBQWUsS0FBSyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUU7QUFDdEQsZ0JBQUEsSUFBSSxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDO0FBQzlCLGFBQUE7QUFBTSxpQkFBQSxJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUsscUJBQXFCLENBQUMsS0FBSyxFQUFFO0FBQy9ELGdCQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQztBQUM1QixhQUFBO0FBQU0saUJBQUEsSUFBSSxJQUFJLENBQUMsZUFBZSxLQUFLLHFCQUFxQixDQUFDLElBQUksRUFBRTtBQUM5RCxnQkFBQSxJQUFJLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7QUFDN0IsYUFBQTtBQUNGLFNBQUE7S0FDRjtBQUNGOzs7Ozs7QUM1bUJEO0lBZ0JZLDJCQUtYO0FBTEQsQ0FBQSxVQUFZLDBCQUEwQixFQUFBO0FBQ3BDLElBQUEsMEJBQUEsQ0FBQSwwQkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFFBQU0sQ0FBQTtBQUNOLElBQUEsMEJBQUEsQ0FBQSwwQkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFFBQU0sQ0FBQTtBQUNOLElBQUEsMEJBQUEsQ0FBQSwwQkFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLGFBQVcsQ0FBQTtBQUNYLElBQUEsMEJBQUEsQ0FBQSwwQkFBQSxDQUFBLHVCQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSx1QkFBcUIsQ0FBQTtBQUN2QixDQUFDLEVBTFcsMEJBQTBCLEtBQTFCLDBCQUEwQixHQUtyQyxFQUFBLENBQUEsQ0FBQSxDQUFBO0FBRUQ7O0FBRUc7QUFDVSxNQUFBLGdCQUFpQixTQUFRLEtBQUssQ0FBQyxjQUFjLENBQUE7QUFjeEQsSUFBQSxXQUFBLENBQVksVUFBdUMsRUFBQTtBQUNqRCxRQUFBLEtBQUssRUFBRSxDQUFDO0FBZFY7O0FBRUc7UUFDYSxJQUFrQixDQUFBLGtCQUFBLEdBQVksSUFBSSxDQUFDO1FBRTVDLElBQU0sQ0FBQSxNQUFBLEdBQUcsR0FBRyxDQUFDO0FBQ2IsUUFBQSxJQUFBLENBQUEsR0FBRyxHQUF5QixJQUFJLENBQUM7O0FBRWpDLFFBQUEsSUFBQSxDQUFBLFVBQVUsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDbEQsUUFBQSxJQUFBLENBQUEsV0FBVyxHQUFHLDBCQUEwQixDQUFDLE1BQU0sQ0FBQztBQUVqRCxRQUFBLElBQUEsQ0FBQSxtQkFBbUIsR0FBRyxJQUFJLENBQUM7UUFLaEMsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFO1lBQzVCLFVBQVUsR0FBRyxFQUFFLENBQUM7QUFDakIsU0FBQTs7QUFHRCxRQUFBLFVBQVUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO0FBQ3RCLFFBQUEsVUFBVSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7OztRQUkzQixJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtZQUNyQyxVQUFrQixDQUFDLFFBQVEsR0FBSSxVQUFrQixDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUM7QUFDdEUsU0FBQTs7O1FBSUQsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUU7WUFDckMsVUFBa0IsQ0FBQyxZQUFZLEdBQUksVUFBa0IsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDO1lBQzVFLFVBQWtCLENBQUMsWUFBWSxHQUFJLFVBQWtCLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztBQUM5RSxTQUFBOztRQUdELFVBQVUsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUM7WUFDOUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNO1lBQ3hCLEtBQUssQ0FBQyxXQUFXLENBQUMsR0FBRztBQUNyQixZQUFBO0FBQ0UsZ0JBQUEsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTs7QUFFdEIsZ0JBQUEsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRTtBQUM3RCxhQUFBO0FBQ0YsU0FBQSxDQUFDLENBQUM7O0FBR0gsUUFBQSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDOztRQUczQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7S0FDdkI7QUFFRCxJQUFBLElBQUksT0FBTyxHQUFBO1FBQ1QsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDO0tBQ2pCO0lBRUQsSUFBSSxPQUFPLENBQUMsQ0FBdUIsRUFBQTtBQUNqQyxRQUFBLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0tBQ2Q7QUFFRCxJQUFBLElBQUksVUFBVSxHQUFBO1FBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO0tBQ3pCO0lBRUQsSUFBSSxVQUFVLENBQUMsQ0FBNkIsRUFBQTtBQUMxQyxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1FBRXJCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFdBQVcsS0FBSywwQkFBMEIsQ0FBQyxXQUFXLENBQUM7QUFDOUUsUUFBQSxJQUFJLENBQUMsV0FBVztBQUNkLFlBQUEsSUFBSSxDQUFDLFdBQVcsS0FBSywwQkFBMEIsQ0FBQyxXQUFXO0FBQzNELGdCQUFBLElBQUksQ0FBQyxXQUFXLEtBQUssMEJBQTBCLENBQUMscUJBQXFCLENBQUM7UUFDeEUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7S0FDMUI7QUFFRDs7Ozs7QUFLRztBQUNJLElBQUEsa0JBQWtCLENBQUMsS0FBYSxFQUFBO1FBQ3JDLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztLQUN2QjtBQUVNLElBQUEsSUFBSSxDQUFDLE1BQVksRUFBQTtBQUN0QixRQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7O0FBR25CLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQzVCLFFBQUEsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUN4QyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQztBQUVwQyxRQUFBLE9BQU8sSUFBSSxDQUFDO0tBQ2I7QUFFRDs7QUFFRztJQUNLLGNBQWMsR0FBQTtBQUNwQixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLEVBQUU7WUFDN0IsT0FBTztBQUNSLFNBQUE7QUFDRCxRQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxLQUFLLENBQUM7UUFFakMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDekMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7QUFDbkMsUUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztLQUN0RDtJQUVPLGlCQUFpQixHQUFBO1FBQ3ZCLElBQUksQ0FBQyxPQUFPLEdBQUc7QUFDYixZQUFBLGlCQUFpQixFQUFFLElBQUksQ0FBQyxXQUFXLEtBQUssMEJBQTBCLENBQUMsTUFBTTtBQUN6RSxZQUFBLGlCQUFpQixFQUFFLElBQUksQ0FBQyxXQUFXLEtBQUssMEJBQTBCLENBQUMsTUFBTTtBQUN6RSxZQUFBLHNCQUFzQixFQUNwQixJQUFJLENBQUMsV0FBVyxLQUFLLDBCQUEwQixDQUFDLFdBQVc7QUFDM0QsZ0JBQUEsSUFBSSxDQUFDLFdBQVcsS0FBSywwQkFBMEIsQ0FBQyxxQkFBcUI7U0FDeEUsQ0FBQztBQUVGLFFBQUEsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7QUFDakMsUUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQzs7QUFHckMsUUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztLQUN6QjtBQUNGOztBQzlIRDs7QUFFRztNQUNVLG1CQUFtQixDQUFBO0FBSTlCOzs7O0FBSUc7QUFDSCxJQUFBLFdBQUEsQ0FBWSxVQUFzQyxFQUFFLEVBQUE7UUFDbEQsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUM7QUFDMUQsUUFBQSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLEtBQUssQ0FBQyxZQUFZLEVBQUU7QUFDcEYsWUFBQSxPQUFPLENBQUMsSUFBSSxDQUNWLGtJQUFrSSxDQUNuSSxDQUFDO0FBQ0gsU0FBQTtBQUVELFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDO0tBQzdDO0FBRUQ7Ozs7QUFJRztBQUNVLElBQUEsb0JBQW9CLENBQUMsSUFBVSxFQUFBOzs7QUFDMUMsWUFBQSxNQUFNLE1BQU0sR0FBOEIsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEdBQUcsQ0FBQztZQUMzRSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ1gsZ0JBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixhQUFBO0FBRUQsWUFBQSxNQUFNLGtCQUFrQixHQUFxQyxNQUFNLENBQUMsa0JBQWtCLENBQUM7WUFDdkYsSUFBSSxDQUFDLGtCQUFrQixFQUFFO0FBQ3ZCLGdCQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2IsYUFBQTtBQUVELFlBQUEsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLDhCQUE4QixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3JFLE1BQU0sWUFBWSxHQUEwRixFQUFFLENBQUM7QUFDL0csWUFBQSxNQUFNLFNBQVMsR0FBcUIsRUFBRSxDQUFDO1lBRXZDLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FDZixLQUFLLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQU8sQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLEtBQUksU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBO0FBQzVFLGdCQUFBLE1BQU0sVUFBVSxHQUFvQixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDdEUsZ0JBQUEsTUFBTSxVQUFVLEdBQW9CLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsSUFBSyxDQUFDLENBQUM7QUFFOUUsZ0JBQUEsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBTyxTQUFTLEVBQUUsY0FBYyxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTtvQkFDakQsTUFBTSxlQUFlLEdBQUcsVUFBVSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsQ0FBQzs7Ozs7O29CQU85RCxJQUFJLENBQUMsZUFBZSxFQUFFO3dCQUNwQixPQUFPO0FBQ1IscUJBQUE7QUFFRCxvQkFBQSxNQUFNLGlCQUFpQixHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUM7QUFDN0Msb0JBQUEsTUFBTSxpQkFBaUIsR0FBRyxpQkFBaUIsQ0FBQyxLQUFLO0FBQy9DLDBCQUFFLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxLQUFLOzBCQUM3QixpQkFBaUIsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUM7O29CQUdwRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEVBQUU7d0JBQ3RDLFNBQVMsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7d0JBQzFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDckQscUJBQUE7O0FBR0Qsb0JBQUEsTUFBTSxnQkFBZ0IsR0FBRyxlQUFlLENBQUMsUUFBUyxDQUFDO0FBRW5ELG9CQUFBLElBQUksS0FBSyxHQUFHLGtCQUFrQixDQUFDLGdCQUFnQixDQUFDLENBQUM7b0JBQ2pELElBQUksQ0FBQyxLQUFLLEVBQUU7QUFDVix3QkFBQSxPQUFPLENBQUMsSUFBSSxDQUNWLHVFQUF1RSxnQkFBZ0IsQ0FBQSxrQkFBQSxDQUFvQixDQUM1RyxDQUFDO3dCQUNGLEtBQUssR0FBRyxFQUFFLE1BQU0sRUFBRSxvQkFBb0IsRUFBRSxDQUFDO0FBQzFDLHFCQUFBO0FBRUQsb0JBQUEsSUFBSSxZQUFtRSxDQUFDO0FBQ3hFLG9CQUFBLElBQUksWUFBWSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7QUFDbEMsd0JBQUEsWUFBWSxHQUFHLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO0FBQy9DLHFCQUFBO0FBQU0seUJBQUE7QUFDTCx3QkFBQSxZQUFZLEdBQUcsTUFBTSxJQUFJLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDakYsd0JBQUEsWUFBWSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsWUFBWSxDQUFDO0FBRTlDLHdCQUFBLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO3dCQUNyQyxJQUFJLFlBQVksQ0FBQyxPQUFPLEVBQUU7QUFDeEIsNEJBQUEsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDdEMseUJBQUE7QUFDRixxQkFBQTs7b0JBR0QsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDOztvQkFHN0MsSUFBSSxJQUFJLENBQUMsY0FBYyxJQUFLLFlBQVksQ0FBQyxPQUFlLENBQUMsc0JBQXNCLEVBQUU7d0JBQy9FLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEtBQUk7QUFDbkMsNEJBQUEsWUFBWSxDQUFDLE9BQWUsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBQzlDLDRCQUFBLFlBQVksQ0FBQyxPQUFPLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztBQUMxQyx5QkFBQyxDQUFDLENBQUM7QUFDSixxQkFBQTs7b0JBR0QsU0FBUyxDQUFDLFdBQVcsR0FBRyxLQUFLLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQzs7b0JBR2xELElBQUksWUFBWSxDQUFDLE9BQU8sRUFBRTt3QkFDeEIsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsT0FBTyxDQUFDO3dCQUM3QyxpQkFBaUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQyxDQUFDO0FBQ3JELHFCQUFBO2lCQUNGLENBQUEsQ0FBQyxDQUNILENBQUM7YUFDSCxDQUFBLENBQUMsQ0FDSCxDQUFDO0FBRUYsWUFBQSxPQUFPLFNBQVMsQ0FBQzs7QUFDbEIsS0FBQTtBQUVZLElBQUEsa0JBQWtCLENBQzdCLGdCQUFnQyxFQUNoQyxRQUE0QixFQUM1QixJQUFVLEVBQUE7O0FBS1YsWUFBQSxJQUFJLFVBQXNDLENBQUM7QUFDM0MsWUFBQSxJQUFJLFVBQXNDLENBQUM7QUFFM0MsWUFBQSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssV0FBVyxFQUFFO0FBQ25DLGdCQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQzs7QUFHdkYsZ0JBQUEsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLGNBQWMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSTtBQUN4RCxvQkFBQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLEVBQUU7QUFDOUIsd0JBQUEsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckIscUJBQUE7QUFDSCxpQkFBQyxDQUFDLENBQUM7O0FBR0gsZ0JBQUEsQ0FBQyxTQUFTLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFJO0FBQ3JGLG9CQUFBLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsRUFBRTt3QkFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQ3hDLHFCQUFBO0FBQ0gsaUJBQUMsQ0FBQyxDQUFDOztBQUdILGdCQUFBLE1BQU0sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzs7QUFHakMsZ0JBQUEsVUFBVSxHQUFHLElBQUksYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztBQUd2QyxnQkFBQSxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyw2QkFBNkIsQ0FBQyxJQUFJLEVBQUU7QUFDbEUsb0JBQUEsTUFBTSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7QUFDeEIsb0JBQUEsVUFBVSxHQUFHLElBQUksYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hDLGlCQUFBO0FBQ0YsYUFBQTtBQUFNLGlCQUFBLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxrQkFBa0IsRUFBRTs7QUFFakQsZ0JBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3ZGLGdCQUFBLE1BQU0sQ0FBQyxVQUFVLEdBQUcsMEJBQTBCLENBQUMsTUFBTSxDQUFDO0FBQ3RELGdCQUFBLFVBQVUsR0FBRyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQzNDLGFBQUE7QUFBTSxpQkFBQSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssaUJBQWlCLEVBQUU7O0FBRWhELGdCQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN2RixnQkFBQSxNQUFNLENBQUMsVUFBVSxHQUFHLDBCQUEwQixDQUFDLE1BQU0sQ0FBQztBQUN0RCxnQkFBQSxVQUFVLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUMzQyxhQUFBO0FBQU0saUJBQUEsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLHNCQUFzQixFQUFFOztBQUVyRCxnQkFBQSxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDdkYsZ0JBQUEsTUFBTSxDQUFDLFVBQVUsR0FBRywwQkFBMEIsQ0FBQyxXQUFXLENBQUM7QUFDM0QsZ0JBQUEsVUFBVSxHQUFHLElBQUksZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0MsYUFBQTtBQUFNLGlCQUFBLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyw0QkFBNEIsRUFBRTs7QUFFM0QsZ0JBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3ZGLGdCQUFBLE1BQU0sQ0FBQyxVQUFVLEdBQUcsMEJBQTBCLENBQUMscUJBQXFCLENBQUM7QUFDckUsZ0JBQUEsVUFBVSxHQUFHLElBQUksZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDM0MsYUFBQTtBQUFNLGlCQUFBO0FBQ0wsZ0JBQUEsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLG9CQUFvQixFQUFFO29CQUM1QyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUEsMEJBQUEsRUFBNkIsUUFBUSxDQUFDLE1BQU0sQ0FBRyxDQUFBLENBQUEsQ0FBQyxDQUFDOztBQUUvRCxpQkFBQTtnQkFFRCxVQUFVLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGdCQUFnQixDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDbEUsYUFBQTtBQUVELFlBQUEsVUFBVSxDQUFDLElBQUksR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUM7QUFDeEMsWUFBQSxVQUFVLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzVFLFlBQUEsVUFBVSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsR0FBRyxRQUFRLENBQUM7QUFFckQsWUFBQSxJQUFJLFVBQVUsRUFBRTtnQkFDZCxVQUFVLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDLElBQUksR0FBRyxZQUFZLENBQUM7QUFDdkQsZ0JBQUEsVUFBVSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztBQUM1RSxnQkFBQSxVQUFVLENBQUMsUUFBUSxDQUFDLHFCQUFxQixHQUFHLFFBQVEsQ0FBQztBQUN0RCxhQUFBO1lBRUQsT0FBTztBQUNMLGdCQUFBLE9BQU8sRUFBRSxVQUFVO0FBQ25CLGdCQUFBLE9BQU8sRUFBRSxVQUFVO2FBQ3BCLENBQUM7U0FDSCxDQUFBLENBQUE7QUFBQSxLQUFBO0FBRU8sSUFBQSx1QkFBdUIsQ0FBQyxJQUFZLEVBQUE7QUFDMUMsUUFBQSxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7QUFDbkIsWUFBQSxPQUFPLENBQUMsSUFBSSxDQUFDLHNDQUFzQyxJQUFJLENBQUEsa0JBQUEsQ0FBb0IsQ0FBQyxDQUFDO0FBQzdFLFlBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixTQUFBO0FBQ0QsUUFBQSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUV6QixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUMxQixZQUFBLE9BQU8sQ0FBQyxJQUFJLENBQUMsc0NBQXNDLElBQUksQ0FBQSxrQkFBQSxDQUFvQixDQUFDLENBQUM7QUFDN0UsWUFBQSxPQUFPLElBQUksQ0FBQztBQUNiLFNBQUE7QUFDRCxRQUFBLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7S0FDbEQ7QUFFTyxJQUFBLG9CQUFvQixDQUFDLFFBQXdCLEVBQUE7UUFDbkQsSUFBSyxRQUFnQixDQUFDLHNCQUFzQixFQUFFO1lBQzVDLE1BQU0sR0FBRyxHQUFHLFFBQXNDLENBQUM7WUFFbkQsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFO2dCQUNYLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDbkMsYUFBQTtZQUNELElBQUksR0FBRyxDQUFDLFdBQVcsRUFBRTtnQkFDbkIsR0FBRyxDQUFDLFdBQVcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztBQUMzQyxhQUFBO0FBRUQsWUFBQSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUssS0FBSyxDQUFDLGNBQWMsRUFBRTtBQUMzQyxnQkFBQSxHQUFHLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLENBQUM7QUFDaEMsZ0JBQUEsR0FBRyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0FBQ3BDLGFBQUE7QUFDRixTQUFBO1FBRUQsSUFBSyxRQUFnQixDQUFDLG1CQUFtQixFQUFFO1lBQ3pDLE1BQU0sR0FBRyxHQUFHLFFBQW1DLENBQUM7WUFFaEQsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFO2dCQUNYLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDbkMsYUFBQTtBQUVELFlBQUEsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLEtBQUssQ0FBQyxjQUFjLEVBQUU7QUFDM0MsZ0JBQUEsR0FBRyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0FBQ2pDLGFBQUE7QUFDRixTQUFBO0FBRUQsUUFBQSxPQUFPLFFBQVEsQ0FBQztLQUNqQjtBQUVPLElBQUEsMEJBQTBCLENBQ2hDLGdCQUFnQyxFQUNoQyxRQUE0QixFQUM1QixJQUFVLEVBQUE7UUFFVixNQUFNLFFBQVEsR0FBd0IsRUFBRSxDQUFDO1FBQ3pDLE1BQU0sTUFBTSxHQUFRLEVBQUUsQ0FBQzs7UUFHdkIsSUFBSSxRQUFRLENBQUMsaUJBQWlCLEVBQUU7WUFDOUIsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO2dCQUMxRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ25ELE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUV0RCxnQkFBQSxRQUFRLENBQUMsSUFBSSxDQUNYLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFzQixLQUFJO0FBQ2pGLG9CQUFBLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUM7aUJBQzNCLENBQUMsQ0FDSCxDQUFDO0FBQ0gsYUFBQTtBQUNGLFNBQUE7O1FBR0QsSUFBSSxRQUFRLENBQUMsZUFBZSxFQUFFO1lBQzVCLEtBQUssTUFBTSxJQUFJLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLEVBQUU7Z0JBQ3hELE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDbkQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbEQsYUFBQTtBQUNGLFNBQUE7O1FBR0QsSUFBSSxRQUFRLENBQUMsZ0JBQWdCLEVBQUU7WUFDN0IsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO2dCQUN6RCxJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7O0FBR2pELGdCQUFBLE1BQU0sV0FBVyxHQUFHO29CQUNsQixVQUFVO29CQUNWLGVBQWU7b0JBQ2YsVUFBVTtvQkFDVix1QkFBdUI7b0JBQ3ZCLHNCQUFzQjtvQkFDdEIsYUFBYTtvQkFDYixZQUFZO29CQUNaLGNBQWM7b0JBQ2Qsc0JBQXNCO29CQUN0QixvQkFBb0I7aUJBQ3JCLENBQUMsSUFBSSxDQUFDLENBQUMsV0FBVyxLQUFLLElBQUksS0FBSyxXQUFXLENBQUMsQ0FBQztBQUM5QyxnQkFBQSxJQUFJLFdBQVcsRUFBRTtvQkFDZixPQUFPLElBQUksS0FBSyxDQUFDO0FBQ2xCLGlCQUFBO0FBRUQsZ0JBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3pFLGFBQUE7QUFDRixTQUFBOzs7UUFJRCxJQUFJLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtZQUN0QyxNQUFNLENBQUMsUUFBUSxHQUFJLGdCQUF3QixDQUFDLFFBQVEsSUFBSSxLQUFLLENBQUM7QUFDL0QsU0FBQTs7O1FBSUQsSUFBSSxRQUFRLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUU7WUFDdEMsTUFBTSxDQUFDLFlBQVksR0FBSSxnQkFBd0IsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDO1lBQ3RFLE1BQU0sQ0FBQyxZQUFZLEdBQUksZ0JBQXdCLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztBQUN2RSxTQUFBO0FBRUQsUUFBQSxPQUFPLE9BQU8sQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sTUFBTSxDQUFDLENBQUM7S0FDakQ7QUFDRjs7QUM1VkQ7O0FBRUc7TUFDVSxlQUFlLENBQUE7QUFNMUIsSUFBQSxXQUFBLENBQVksT0FBZ0MsRUFBQTs7QUFDMUMsUUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLENBQUEsRUFBQSxHQUFBLE9BQU8sS0FBQSxJQUFBLElBQVAsT0FBTyxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFQLE9BQU8sQ0FBRSxhQUFhLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUksS0FBSyxDQUFDO0tBQ3REO0FBRVksSUFBQSxNQUFNLENBQUMsSUFBVSxFQUFBOzs7QUFDNUIsWUFBQSxNQUFNLE1BQU0sR0FBOEIsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEdBQUcsQ0FBQztZQUMzRSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ1gsZ0JBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixhQUFBO0FBRUQsWUFBQSxNQUFNLFVBQVUsR0FBK0IsTUFBTSxDQUFDLElBQUksQ0FBQztZQUMzRCxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ2YsZ0JBQUEsT0FBTyxJQUFJLENBQUM7QUFDYixhQUFBO0FBRUQsWUFBQSxJQUFJLE9BQXlDLENBQUM7QUFDOUMsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsSUFBSSxVQUFVLENBQUMsT0FBTyxJQUFJLElBQUksSUFBSSxVQUFVLENBQUMsT0FBTyxLQUFLLENBQUMsQ0FBQyxFQUFFO0FBQ2xGLGdCQUFBLE9BQU8sR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDMUUsYUFBQTtZQUVELE9BQU87Z0JBQ0wsZUFBZSxFQUFFLFVBQVUsQ0FBQyxlQUFlO2dCQUMzQyxNQUFNLEVBQUUsVUFBVSxDQUFDLE1BQU07Z0JBQ3pCLG9CQUFvQixFQUFFLFVBQVUsQ0FBQyxvQkFBb0I7Z0JBQ3JELGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0I7Z0JBQ2pELFdBQVcsRUFBRSxVQUFVLENBQUMsV0FBVztnQkFDbkMsZUFBZSxFQUFFLFVBQVUsQ0FBQyxlQUFlO2dCQUMzQyxrQkFBa0IsRUFBRSxVQUFVLENBQUMsa0JBQWtCO2dCQUNqRCxTQUFTLEVBQUUsVUFBVSxDQUFDLFNBQVM7Z0JBQy9CLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxnQkFBZ0I7QUFDN0MsZ0JBQUEsT0FBTyxFQUFFLE9BQU8sS0FBQSxJQUFBLElBQVAsT0FBTyxLQUFQLEtBQUEsQ0FBQSxHQUFBLE9BQU8sR0FBSSxTQUFTO2dCQUM3QixLQUFLLEVBQUUsVUFBVSxDQUFDLEtBQUs7Z0JBQ3ZCLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTztnQkFDM0IsaUJBQWlCLEVBQUUsVUFBVSxDQUFDLGlCQUFpQjthQUNoRCxDQUFDOztBQUNILEtBQUE7QUFDRjs7QUNqREQsTUFBTUMsT0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBRWxDOzs7OztBQUtHO0FBQ0csU0FBVSxnQkFBZ0IsQ0FBMEIsTUFBUyxFQUFBO0lBQ2pFLElBQUssTUFBYyxDQUFDLE1BQU0sRUFBRTtRQUMxQixNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDakIsS0FBQTtBQUFNLFNBQUE7UUFDSixNQUFjLENBQUMsVUFBVSxDQUFDQSxPQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7QUFDaEQsS0FBQTtBQUVELElBQUEsT0FBTyxNQUFNLENBQUM7QUFDaEI7O01DZmEsbUJBQW1CLENBQUE7QUFvQzlCLElBQUEsV0FBQSxDQUFtQixNQUFxQixFQUFBO0FBOUJ4Qzs7QUFFRztBQUNjLFFBQUEsSUFBQSxDQUFBLGFBQWEsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUVyRDs7O0FBR0c7UUFDSyxJQUFvQixDQUFBLG9CQUFBLEdBQUcsSUFBSSxDQUFDO0FBc0JsQyxRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO0FBRXJCLFFBQUEsTUFBTSxPQUFPLEdBQTJCO1lBQ3RDLEdBQUcsRUFBRSxDQUFDLEdBQUcsRUFBRSxJQUFTLEVBQUUsTUFBTSxLQUFJO0FBQzlCLGdCQUFBLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUM7QUFDakMsZ0JBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQztBQUVuQixnQkFBQSxPQUFPLElBQUksQ0FBQzthQUNiO1NBQ0YsQ0FBQztBQUVGLFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7QUFDekMsUUFBQSxNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7S0FDdkQ7QUE1QkQ7Ozs7QUFJRztBQUNILElBQUEsSUFBVyxPQUFPLEdBQUE7UUFDaEIsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUU7QUFDN0IsWUFBQSxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUN2RCxZQUFBLElBQUksQ0FBQyxvQkFBb0IsR0FBRyxLQUFLLENBQUM7QUFDbkMsU0FBQTtRQUVELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQztLQUMzQjtJQWtCTSxNQUFNLEdBQUE7UUFDWCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUM7S0FDL0M7QUFDRjs7QUNwREQ7QUFDQTtBQUNBO0FBRUEsTUFBTSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDNUQsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFFbEU7QUFDQSxNQUFNTixNQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakMsTUFBTSxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakMsTUFBTSxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDakMsTUFBTSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7QUFDdEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDbEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFbEM7OztBQUdHO01BQ1UsYUFBYSxDQUFBO0FBZ0p4Qjs7Ozs7QUFLRztJQUNILFdBQVksQ0FBQSxJQUFvQixFQUFFLE1BQUEsR0FBa0MsRUFBRSxFQUFBOztBQTlHdEU7O0FBRUc7QUFDTyxRQUFBLElBQUEsQ0FBQSxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFN0M7O0FBRUc7QUFDTyxRQUFBLElBQUEsQ0FBQSxTQUFTLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFMUM7OztBQUdHO0FBQ08sUUFBQSxJQUFBLENBQUEsU0FBUyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBRTFDOztBQUVHO0FBQ08sUUFBQSxJQUFBLENBQUEsU0FBUyxHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBUTFDOztBQUVHO0FBQ08sUUFBQSxJQUFBLENBQUEsb0JBQW9CLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFckQ7OztBQUdHO1FBQ08sSUFBTyxDQUFBLE9BQUEsR0FBMEIsSUFBSSxDQUFDO0FBK0NoRDs7O0FBR0c7QUFDSyxRQUFBLElBQUEsQ0FBQSxvQkFBb0IsR0FBRyxJQUFJLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztBQUV0RDs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLG1CQUFtQixHQUFHLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBRWxEOztBQUVHO0FBQ0ssUUFBQSxJQUFBLENBQUEscUJBQXFCLEdBQUcsSUFBSSxLQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7QUFFdkQ7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSwwQkFBMEIsR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQVN2RCxRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO1FBRW5DLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQSxFQUFBLEdBQUEsTUFBTSxDQUFDLE1BQU0sTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxJQUFJLENBQUM7UUFDcEMsSUFBSSxDQUFDLGNBQWMsR0FBRyxDQUFBLEVBQUEsR0FBQSxNQUFNLENBQUMsY0FBYyxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEdBQUcsQ0FBQztBQUNuRCxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVU7QUFDakMsY0FBRSxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztBQUM3QyxjQUFFLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDNUMsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUFBLEVBQUEsR0FBQSxNQUFNLENBQUMsWUFBWSxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEdBQUcsQ0FBQztRQUMvQyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUEsRUFBQSxHQUFBLE1BQU0sQ0FBQyxTQUFTLE1BQUksSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsR0FBRyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQSxFQUFBLEdBQUEsTUFBTSxDQUFDLFNBQVMsTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxFQUFFLENBQUM7UUFFeEMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7UUFFdkUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ2hELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUV0RCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7OztZQUduQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNGLFNBQUE7QUFBTSxhQUFBO1lBQ0wsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekMsSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDM0QsU0FBQTs7QUFHRCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV2QyxRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ2pFLElBQUksQ0FBQyxzQkFBc0IsR0FBR0EsTUFBSTtBQUMvQixhQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUM7QUFDckMsYUFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7QUFDbkMsYUFBQSxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDO0FBQzlCLGFBQUEsTUFBTSxFQUFFLENBQUM7UUFFWixJQUFJLENBQUMsTUFBTSxHQUFHLENBQUEsRUFBQSxHQUFBLE1BQU0sQ0FBQyxNQUFNLE1BQUksSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDO0tBQ3JDO0FBakhELElBQUEsSUFBVyxNQUFNLEdBQUE7UUFDZixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7S0FDckI7SUFDRCxJQUFXLE1BQU0sQ0FBQyxNQUE2QixFQUFBOzs7QUFFN0MsUUFBQSxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7QUFFcEMsUUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN0QyxRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ25DLFFBQUEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7O1FBR25DLElBQUksQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLE9BQU8sMENBQUUsUUFBUSxDQUFDLGlCQUFpQixFQUFFO1lBQzNDLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLGlCQUF5QyxDQUFDLE1BQU0sRUFBRSxDQUFDO0FBQzFFLFlBQUEsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQztBQUNoRCxTQUFBOztBQUdELFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7O1FBR3RCLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUNoQixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEVBQUU7QUFDNUMsZ0JBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQzdGLGFBQUE7QUFDRixTQUFBOztBQUdELFFBQUEsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRXBDLFFBQUEsSUFBSSxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDdEMsUUFBQSxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNuQyxRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDOztRQUduQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7QUFFdEMsUUFBQSxJQUFJLENBQUMsb0JBQW9CLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFdkQsSUFBSSxDQUFDLHNCQUFzQixHQUFHQSxNQUFJO0FBQy9CLGFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQzthQUNyQyxZQUFZLENBQUMsS0FBSyxDQUFDO0FBQ25CLGFBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztBQUM5QixhQUFBLE1BQU0sRUFBRSxDQUFDO0tBQ2I7QUF1RUQ7OztBQUdHO0lBQ0ksS0FBSyxHQUFBO1FBQ1YsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDOztBQUd0RCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7QUFDekIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZGLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDOztBQUd2RSxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztLQUN4QztBQUVEOzs7OztBQUtHO0FBQ0ksSUFBQSxNQUFNLENBQUMsS0FBYSxFQUFBO1FBQ3pCLElBQUksS0FBSyxJQUFJLENBQUM7WUFBRSxPQUFPO0FBRXZCLFFBQUEsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTs7OztZQUlwQixzQkFBc0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUNyRSxTQUFBO0FBQU0sYUFBQTtBQUNMLFlBQUEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO0FBQ3JELFNBQUE7O0FBR0QsUUFBQSxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDcEMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3RDLFFBQUEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDOztBQUd2RCxRQUFBLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUNwQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDLENBQUM7O0FBRzdDLFFBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUM7QUFDOUMsUUFBQSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsQ0FBQzs7QUFHdEYsUUFBQSxJQUFJLENBQUMsU0FBUztBQUNYLGFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7QUFDdkIsYUFBQSxHQUFHLENBQ0ZBLE1BQUk7QUFDRCxhQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDO0FBQ3ZCLGFBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7YUFDbkIsY0FBYyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQ3RDO0FBQ0EsYUFBQSxHQUFHLENBQ0ZBLE1BQUk7QUFDRCxhQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQ3BCLGFBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQzthQUN0QyxZQUFZLENBQUMsS0FBSyxDQUFDO0FBQ25CLGFBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztBQUM5QixhQUFBLFNBQVMsRUFBRTtBQUNYLGFBQUEsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUM3QjtBQUNBLGFBQUEsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDOztBQUdqQixRQUFBLElBQUksQ0FBQyxTQUFTO0FBQ1gsYUFBQSxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDO0FBQzlCLGFBQUEsU0FBUyxFQUFFO0FBQ1gsYUFBQSxjQUFjLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDO0FBQzNDLGFBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDOztBQUdsQyxRQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRWhDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUN2QyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Ozs7QUFLdkMsUUFBQSxNQUFNLDJCQUEyQixHQUFHLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0csTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLGtCQUFrQixDQUM3QyxJQUFJLENBQUMsU0FBUyxFQUNkQSxNQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxZQUFZLENBQUMsMkJBQTJCLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FDaEYsQ0FBQztBQUVGLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQzs7QUFHOUUsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQ3pCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUN4RjtBQUVEOzs7O0FBSUc7QUFDSyxJQUFBLFVBQVUsQ0FBQyxJQUFtQixFQUFBO1FBQ3BDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBUSxLQUFJO0FBQ2xDLFlBQUEsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3BDLFlBQUEsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDckMsTUFBTSwyQkFBMkIsR0FBR0EsTUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3RFLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsY0FBZSxDQUFDLE1BQU0sQ0FBQztBQUNoRSxZQUFBLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDO1lBRXZDLElBQUksSUFBSSxDQUFDLGlCQUFpQixDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRTs7QUFFaEUsZ0JBQUEsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsMkJBQTJCLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUM5RSxnQkFBQSxNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLDJCQUEyQixFQUFFLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs7Z0JBRy9GLElBQUksQ0FBQyxJQUFJLENBQ1AsZUFBZTtBQUNaLHFCQUFBLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUM7QUFDOUIscUJBQUEsU0FBUyxFQUFFO0FBQ1gscUJBQUEsY0FBYyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztBQUMzQyxxQkFBQSxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQ2xDLENBQUM7QUFDSCxhQUFBO0FBQ0gsU0FBQyxDQUFDLENBQUM7S0FDSjtBQUVEOzs7QUFHRztBQUNLLElBQUEsdUJBQXVCLENBQUMsTUFBcUIsRUFBQTtRQUNuRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDaEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3ZDLFNBQUE7QUFBTSxhQUFBO1lBQ0wsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ25CLFNBQUE7QUFFRCxRQUFBLE9BQU8sTUFBTSxDQUFDO0tBQ2Y7QUFFRDs7O0FBR0c7QUFDSyxJQUFBLHVCQUF1QixDQUFDLE1BQXFCLEVBQUE7UUFDbkQsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ2hCLFlBQUEsTUFBTSxDQUFDLElBQUksQ0FBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxpQkFBeUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUN2RixTQUFBO0FBQU0sYUFBQTtZQUNMLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUNuQixTQUFBO0FBRUQsUUFBQSxPQUFPLE1BQU0sQ0FBQztLQUNmO0FBRUQ7O0FBRUc7SUFDSyxxQkFBcUIsR0FBQTtBQUMzQixRQUFBLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxHQUFHLGdCQUFnQixDQUFDO0tBQzNFO0FBQ0Y7O0FDblhEOztBQUVHO01BQ1Usb0JBQW9CLENBQUE7QUFJL0I7Ozs7QUFJRztJQUNILFdBQW1CLENBQUEsY0FBNEMsRUFBRSxtQkFBeUMsRUFBQTtRQVIxRixJQUFjLENBQUEsY0FBQSxHQUFpQyxFQUFFLENBQUM7UUFDbEQsSUFBbUIsQ0FBQSxtQkFBQSxHQUF5QixFQUFFLENBQUM7QUFRN0QsUUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQztBQUNyQyxRQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxtQkFBbUIsQ0FBQztLQUNoRDtBQUVEOzs7O0FBSUc7QUFDSSxJQUFBLFNBQVMsQ0FBQyxJQUEyQixFQUFBO1FBQzFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxlQUFlLEtBQUk7QUFDbkQsWUFBQSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxLQUFJO0FBQ3JDLGdCQUFBLFVBQVUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO0FBQzNCLGFBQUMsQ0FBQyxDQUFDO0FBQ0wsU0FBQyxDQUFDLENBQUM7S0FDSjtBQUVEOzs7O0FBSUc7QUFDSSxJQUFBLFVBQVUsQ0FBQyxLQUFhLEVBQUE7QUFDN0IsUUFBQSxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1FBRW5ELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxlQUFlLEtBQUk7QUFDbkQsWUFBQSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxLQUFJO2dCQUNyQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNELGdCQUFBLFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsYUFBQyxDQUFDLENBQUM7QUFDTCxTQUFDLENBQUMsQ0FBQztLQUNKO0FBRUQ7O0FBRUc7SUFDSSxLQUFLLEdBQUE7QUFDVixRQUFBLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxHQUFHLEVBQWtCLENBQUM7UUFFbkQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDLGVBQWUsS0FBSTtBQUNuRCxZQUFBLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxVQUFVLEtBQUk7Z0JBQ3JDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzNELFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUNyQixhQUFDLENBQUMsQ0FBQztBQUNMLFNBQUMsQ0FBQyxDQUFDO0tBQ0o7QUFFRDs7Ozs7QUFLRztJQUNLLGtCQUFrQixDQUFDLGdCQUFxQyxFQUFFLElBQW9CLEVBQUE7QUFDcEYsUUFBQSxJQUFJLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPO1FBRXZDLElBQUksSUFBSSxDQUFDLE1BQU07WUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3hFLFFBQUEsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztBQUVyQyxRQUFBLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUM1QjtBQUNGOztBQzFFRCxNQUFNQSxNQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFakMsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBRTFFOztBQUVHO01BQ1UscUJBQXFCLENBQUE7QUFDaEM7Ozs7QUFJRztBQUNVLElBQUEsTUFBTSxDQUFDLElBQVUsRUFBQTs7O0FBQzVCLFlBQUEsTUFBTSxNQUFNLEdBQThCLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBRSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxHQUFHLENBQUM7QUFDM0UsWUFBQSxJQUFJLENBQUMsTUFBTTtBQUFFLGdCQUFBLE9BQU8sSUFBSSxDQUFDO0FBRXpCLFlBQUEsTUFBTSx3QkFBd0IsR0FBNkMsTUFBTSxDQUFDLGtCQUFrQixDQUFDO0FBQ3JHLFlBQUEsSUFBSSxDQUFDLHdCQUF3QjtBQUFFLGdCQUFBLE9BQU8sSUFBSSxDQUFDOztZQUczQyxNQUFNLGNBQWMsR0FBRyxNQUFNLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLENBQUMsQ0FBQzs7O0FBSTVGLFlBQUEsTUFBTSxtQkFBbUIsR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFFbEgsWUFBQSxPQUFPLElBQUksb0JBQW9CLENBQUMsY0FBYyxFQUFFLG1CQUFtQixDQUFDLENBQUM7O0FBQ3RFLEtBQUE7QUFFUyxJQUFBLGlCQUFpQixDQUFDLElBQW9CLEVBQUUsTUFBQSxHQUFrQyxFQUFFLEVBQUE7QUFDcEYsUUFBQSxPQUFPLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztLQUN4QztBQUVlLElBQUEsMEJBQTBCLENBQ3hDLElBQVUsRUFDVix3QkFBc0QsRUFDdEQsY0FBNEMsRUFBQTs7QUFFNUMsWUFBQSxNQUFNLGdCQUFnQixHQUF5Qyx3QkFBd0IsQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDO1lBRXpHLE1BQU0sbUJBQW1CLEdBQXlCLEVBQUUsQ0FBQztZQUVyRCxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQ2YsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLENBQU8sWUFBWSxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTtBQUMxQyxnQkFBQSxJQUNFLFlBQVksQ0FBQyxVQUFVLEtBQUssU0FBUztvQkFDckMsWUFBWSxDQUFDLFVBQVUsS0FBSyxTQUFTO0FBQ3JDLG9CQUFBLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLFNBQVM7QUFDdkMsb0JBQUEsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssU0FBUztBQUN2QyxvQkFBQSxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxTQUFTO29CQUN2QyxZQUFZLENBQUMsWUFBWSxLQUFLLFNBQVM7b0JBQ3ZDLFlBQVksQ0FBQyxTQUFTLEtBQUssU0FBUztvQkFDcEMsWUFBWSxDQUFDLFNBQVMsS0FBSyxTQUFTO29CQUNwQyxZQUFZLENBQUMsY0FBYyxLQUFLLFNBQVM7b0JBQ3pDLFlBQVksQ0FBQyxLQUFLLEtBQUssU0FBUztBQUNoQyxvQkFBQSxZQUFZLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFDakM7b0JBQ0EsT0FBTztBQUNSLGlCQUFBO0FBRUQsZ0JBQUEsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLFVBQVUsQ0FBQztnQkFDL0MsTUFBTSxVQUFVLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUNsQyxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsRUFDekIsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEVBQ3pCLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQzNCLENBQUM7QUFDRixnQkFBQSxNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsWUFBWSxDQUFDO0FBQy9DLGdCQUFBLE1BQU0sU0FBUyxHQUFHLFlBQVksQ0FBQyxTQUFTLENBQUM7QUFDekMsZ0JBQUEsTUFBTSxNQUFNLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQztnQkFFdEMsTUFBTSxTQUFTLEdBQWdDLEVBQUUsQ0FBQztnQkFDbEQsWUFBWSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxhQUFhLEtBQUk7b0JBQ3BELFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxjQUFjLENBQUMsYUFBYSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDN0QsaUJBQUMsQ0FBQyxDQUFDO2dCQUVILE1BQU0sZUFBZSxHQUF1QixFQUFFLENBQUM7QUFDL0MsZ0JBQUEsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQU8sU0FBUyxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsS0FBQSxDQUFBLEVBQUEsYUFBQTs7QUFFekMsb0JBQUEsTUFBTSxjQUFjLEdBQWEsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFFcEYsb0JBQUEsTUFBTSxNQUFNLEdBQ1YsWUFBWSxDQUFDLE1BQU8sS0FBSyxDQUFDLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxZQUFZLENBQUMsTUFBTyxDQUFDLEdBQUcsSUFBSSxDQUFDOztvQkFHckcsSUFBSSxDQUFDLGNBQWMsRUFBRTt3QkFDbkIsT0FBTztBQUNSLHFCQUFBO0FBRUQsb0JBQUEsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksS0FBSTtBQUMvQix3QkFBQSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFOzRCQUM5QyxNQUFNOzRCQUNOLGNBQWM7NEJBQ2QsVUFBVTs0QkFDVixZQUFZOzRCQUNaLFNBQVM7NEJBQ1QsU0FBUzs0QkFDVCxNQUFNO0FBQ1AseUJBQUEsQ0FBQyxDQUFDO0FBQ0gsd0JBQUEsZUFBZSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUNuQyxxQkFBQyxDQUFDLENBQUM7aUJBQ0osQ0FBQSxDQUFDLENBQ0gsQ0FBQztBQUVGLGdCQUFBLG1CQUFtQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQzthQUMzQyxDQUFBLENBQUMsQ0FDSCxDQUFDO0FBRUYsWUFBQSxPQUFPLG1CQUFtQixDQUFDO1NBQzVCLENBQUEsQ0FBQTtBQUFBLEtBQUE7QUFFRDs7Ozs7QUFLRztJQUNhLHlCQUF5QixDQUN2QyxJQUFVLEVBQ1Ysd0JBQXNELEVBQUE7O0FBRXRELFlBQUEsTUFBTSxpQkFBaUIsR0FBRyx3QkFBd0IsQ0FBQyxjQUFjLENBQUM7WUFDbEUsSUFBSSxpQkFBaUIsS0FBSyxTQUFTO0FBQUUsZ0JBQUEsT0FBTyxFQUFFLENBQUM7WUFFL0MsTUFBTSxjQUFjLEdBQWlDLEVBQUUsQ0FBQztBQUN4RCxZQUFBLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFPLGFBQWEsS0FBSSxTQUFBLENBQUEsSUFBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLGFBQUE7Z0JBQ2hELElBQUksYUFBYSxDQUFDLElBQUksS0FBSyxTQUFTLElBQUksYUFBYSxDQUFDLFNBQVMsS0FBSyxTQUFTLEVBQUU7b0JBQzdFLE9BQU87QUFDUixpQkFBQTtBQUVELGdCQUFBLE1BQU0sSUFBSSxHQUFHLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDekUsTUFBTSxTQUFTLEdBQWdDLEVBQUUsQ0FBQztnQkFDbEQsYUFBYSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLEtBQUk7QUFDM0Msb0JBQUEsSUFDRSxRQUFRLENBQUMsTUFBTSxLQUFLLFNBQVM7QUFDN0Isd0JBQUEsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssU0FBUztBQUMvQix3QkFBQSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxTQUFTO0FBQy9CLHdCQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVM7QUFDL0Isd0JBQUEsUUFBUSxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQzdCO3dCQUNBLE9BQU87QUFDUixxQkFBQTtvQkFFRCxNQUFNLE1BQU0sR0FBR0EsTUFBSSxDQUFDLEdBQUcsQ0FDckIsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQ2pCLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUNqQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUNuQixDQUFDO0FBQ0Ysb0JBQUEsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7QUFFdkUsb0JBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUN2QixvQkFBQSxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQy9CLGlCQUFDLENBQUMsQ0FBQztBQUVILGdCQUFBLE1BQU0saUJBQWlCLEdBQUc7b0JBQ3hCLElBQUksRUFBRSxhQUFhLENBQUMsSUFBSTtvQkFDeEIsU0FBUztpQkFDVixDQUFDO0FBQ0YsZ0JBQUEsY0FBYyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO2FBQ3hDLENBQUEsQ0FBQyxDQUFDO0FBRUgsWUFBQSxPQUFPLGNBQWMsQ0FBQztTQUN2QixDQUFBLENBQUE7QUFBQSxLQUFBO0FBRUQ7Ozs7O0FBS0c7SUFDTyxtQkFBbUIsQ0FBQyxNQUFjLEVBQUUsTUFBcUIsRUFBQTtRQUNqRSxNQUFNLFlBQVksR0FBRyxJQUFJLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0FBRXJHLFFBQUEsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7OztBQUluQyxRQUFBLFlBQVksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7OztBQUl4QyxRQUFBLFlBQVksQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsQ0FBQztBQUU5QyxRQUFBLE9BQU8sWUFBWSxDQUFDO0tBQ3JCO0FBQ0Y7O0FDOUtEOztBQUVHO01BQ1UsV0FBVyxDQUFBO0FBU3RCOzs7O0FBSUc7QUFDSCxJQUFBLFdBQUEsQ0FBbUIsVUFBOEIsRUFBRSxFQUFBO1FBQ2pELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxJQUFJLGVBQWUsRUFBRSxDQUFDO1FBQ25FLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsa0JBQWtCLElBQUksSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1FBQ3JGLElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxJQUFJLGlCQUFpQixFQUFFLENBQUM7UUFDekUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixFQUFFLENBQUM7UUFDL0UsSUFBSSxDQUFDLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsSUFBSSxJQUFJLHNCQUFzQixFQUFFLENBQUM7UUFDeEYsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixFQUFFLENBQUM7UUFDL0UsSUFBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsSUFBSSxJQUFJLHFCQUFxQixFQUFFLENBQUM7S0FDdEY7QUFFRDs7OztBQUlHO0FBQ1UsSUFBQSxNQUFNLENBQUMsSUFBVSxFQUFBOztZQUM1QixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsS0FBSyxTQUFTLEVBQUU7QUFDOUYsZ0JBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQzdELGFBQUE7QUFDRCxZQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFFekIsWUFBQSxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7OztBQUkvQixZQUFBLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEtBQUk7Z0JBQzFCLElBQUssUUFBZ0IsQ0FBQyxNQUFNLEVBQUU7QUFDNUIsb0JBQUEsUUFBUSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFDaEMsaUJBQUE7QUFDSCxhQUFDLENBQUMsQ0FBQztBQUVILFlBQUEsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztBQUVsRSxZQUFBLE1BQU0sU0FBUyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO0FBRXpGLFlBQUEsTUFBTSxRQUFRLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO1lBRTFFLE1BQU0sV0FBVyxHQUFHLFFBQVEsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUVqSCxZQUFBLE1BQU0sZUFBZSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztBQUVuRixZQUFBLE1BQU0sTUFBTSxHQUNWLFdBQVcsSUFBSSxlQUFlLElBQUksUUFBUTtBQUN4QyxrQkFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDLEtBQUssU0FBUztrQkFDOUYsU0FBUyxDQUFDO0FBRWhCLFlBQUEsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7WUFFckYsT0FBTyxJQUFJLEdBQUcsQ0FBQztnQkFDYixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7Z0JBQ2pCLElBQUk7Z0JBQ0osU0FBUztnQkFDVCxRQUFRO2dCQUNSLFdBQVc7Z0JBQ1gsZUFBZTtnQkFDZixNQUFNO2dCQUNOLGlCQUFpQjtBQUNsQixhQUFBLENBQUMsQ0FBQztTQUNKLENBQUEsQ0FBQTtBQUFBLEtBQUE7QUFDRjs7QUN2RUQ7OztBQUdHO01BQ1UsR0FBRyxDQUFBO0FBNEVkOzs7O0FBSUc7QUFDSCxJQUFBLFdBQUEsQ0FBbUIsTUFBcUIsRUFBQTtBQUN0QyxRQUFBLElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztBQUMxQixRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztBQUNoQyxRQUFBLElBQUksQ0FBQyxlQUFlLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQztBQUM5QyxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztBQUN0QyxRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUM1QixRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUNsQyxRQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUM7QUFDbEQsUUFBQSxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7S0FDekI7QUF6RkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXFCRztBQUNJLElBQUEsT0FBYSxJQUFJLENBQUMsSUFBVSxFQUFFLFVBQThCLEVBQUUsRUFBQTs7QUFDbkUsWUFBQSxNQUFNLFFBQVEsR0FBRyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUMxQyxZQUFBLE9BQU8sTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ3BDLENBQUEsQ0FBQTtBQUFBLEtBQUE7QUFrRUQ7Ozs7OztBQU1HO0FBQ0ksSUFBQSxNQUFNLENBQUMsS0FBYSxFQUFBO1FBQ3pCLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNmLFlBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsU0FBQTtRQUVELElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtBQUN4QixZQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUM7QUFDL0IsU0FBQTtRQUVELElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO0FBQzFCLFlBQUEsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMxQyxTQUFBO1FBRUQsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ2xCLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBYSxLQUFJO2dCQUN2QyxJQUFJLFFBQVEsQ0FBQyxrQkFBa0IsRUFBRTtBQUMvQixvQkFBQSxRQUFRLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDcEMsaUJBQUE7QUFDSCxhQUFDLENBQUMsQ0FBQztBQUNKLFNBQUE7S0FDRjtBQUVEOztBQUVHO0lBQ0ksT0FBTyxHQUFBOztBQUNaLFFBQUEsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUN6QixRQUFBLElBQUksS0FBSyxFQUFFO1lBQ1QsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3BCLFNBQUE7UUFFRCxDQUFBLEVBQUEsR0FBQSxDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsSUFBSSwwQ0FBRSxPQUFPLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUUsT0FBTyxFQUFFLENBQUM7S0FDL0I7QUFDRjs7QUM5SkQsTUFBTSxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFakMsTUFBTSxPQUFPLEdBQUcsSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUNsRSxNQUFNLFNBQVMsR0FBRyxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQzNGLE1BQU0sTUFBTSxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFDOUUsTUFBTSxNQUFNLEdBQUcsSUFBSSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUM7QUFDakMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUVuQjs7Ozs7O0FBTUc7QUFDRyxTQUFVLG9CQUFvQixDQUFDLFFBQTZCLEVBQUUsR0FBUSxFQUFFLElBQUksR0FBRyxHQUFHLEVBQUE7OztJQUV0RixNQUFNLE9BQU8sR0FBRyxDQUFBLEVBQUEsR0FBQSxHQUFHLENBQUMsSUFBSSxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFFLE9BQU8sQ0FBQztJQUNsQyxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ1osUUFBQSxNQUFNLElBQUksS0FBSyxDQUFDLDBEQUEwRCxDQUFDLENBQUM7QUFDN0UsS0FBQTtJQUVELE1BQU0sTUFBTSxHQUFHLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxNQUFNLENBQUM7O0FBRzVDLElBQUEsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUN2QixJQUFBLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDekIsSUFBQSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDOztJQUcxQixRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7O0FBR3BDLElBQUEsU0FBUyxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUM7O0FBR3hCLElBQUEsUUFBUSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsT0FBTyxDQUFDLENBQUM7O0FBR2pDLElBQUEsU0FBUyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUM7O0lBR3JCLElBQUksTUFBTSxZQUFZLGVBQWUsRUFBRTtRQUNyQyxPQUFPLE1BQU0sQ0FBQyxhQUFhLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBSzs7WUFFekMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ2pELFNBQUMsQ0FBQyxDQUFDO0FBQ0osS0FBQTtJQUVELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxLQUFJO0FBQ3JDLFFBQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSTs7WUFFckIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBRS9DLElBQUksSUFBSSxJQUFJLElBQUksRUFBRTtnQkFDaEIsTUFBTSxDQUFDLCtDQUErQyxDQUFDLENBQUM7QUFDekQsYUFBQTtBQUFNLGlCQUFBO2dCQUNMLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNmLGFBQUE7QUFDSCxTQUFDLENBQUMsQ0FBQztBQUNMLEtBQUMsQ0FBQyxDQUFDO0FBQ0w7O0FDOURBOzs7Ozs7QUFNRztBQUNHLFNBQVUsdUJBQXVCLENBQUMsSUFBb0IsRUFBQTs7QUFFMUQsSUFBQSxNQUFNLFlBQVksR0FBK0MsSUFBSSxHQUFHLEVBQUUsQ0FBQzs7QUFHM0UsSUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxLQUFJO0FBQ3BCLFFBQUEsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLGFBQWEsRUFBRTtZQUM5QixPQUFPO0FBQ1IsU0FBQTtRQUVELE1BQU0sSUFBSSxHQUFHLEdBQXdCLENBQUM7QUFDdEMsUUFBQSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQy9CLE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUEwQixDQUFDOztRQUc5RSxJQUFJLFFBQVEsR0FBRyxZQUFZLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxRQUFRLEVBQUU7O0FBRWIsWUFBQSxNQUFNLEtBQUssR0FBaUIsRUFBRSxDQUFDO0FBQy9CLFlBQUEsTUFBTSxZQUFZLEdBQW9CLEVBQUUsQ0FBQztBQUN6QyxZQUFBLE1BQU0sWUFBWSxHQUFnQyxFQUFFLENBQUM7O0FBR3JELFlBQUEsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLEtBQWlCLENBQUM7QUFDMUMsWUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUNyQyxnQkFBQSxNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7O0FBR3ZCLGdCQUFBLElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQyxLQUFLLFNBQVMsRUFBRTtBQUNyQyxvQkFBQSxZQUFZLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUNuQyxvQkFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDdkMsb0JBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3RELGlCQUFBO2dCQUVELEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDaEMsYUFBQTs7QUFHRCxZQUFBLFNBQVMsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsWUFBQSxTQUFTLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQzs7WUFHN0IsUUFBUSxHQUFHLElBQUksS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDbkQsWUFBQSxZQUFZLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN2QyxTQUFBO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQzs7O0FBRzNDLEtBQUMsQ0FBQyxDQUFDO0FBQ0w7O0FDekRBOzs7Ozs7Ozs7QUFTRztBQUNHLFNBQVUseUJBQXlCLENBQUMsSUFBb0IsRUFBQTtBQUM1RCxJQUFBLE1BQU0sV0FBVyxHQUFHLElBQUksR0FBRyxFQUE4QyxDQUFDOztBQUcxRSxJQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLEtBQUk7O0FBQ3BCLFFBQUEsSUFBSSxDQUFFLEdBQVcsQ0FBQyxNQUFNLEVBQUU7WUFDeEIsT0FBTztBQUNSLFNBQUE7UUFFRCxNQUFNLElBQUksR0FBRyxHQUFpQixDQUFDO0FBQy9CLFFBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQzs7QUFHL0IsUUFBQSxNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDO1FBQ3JDLElBQUksYUFBYSxJQUFJLElBQUksRUFBRTtZQUN6QixPQUFPO0FBQ1IsU0FBQTs7UUFHRCxNQUFNLHlCQUF5QixHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDNUQsSUFBSSx5QkFBeUIsSUFBSSxJQUFJLEVBQUU7QUFDckMsWUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLHlCQUF5QixDQUFDO1lBQzFDLE9BQU87QUFDUixTQUFBO0FBRUQsUUFBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLEtBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQzs7O0FBSS9DLFFBQUEsV0FBVyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0FBRWpDLFFBQUEsV0FBVyxDQUFDLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQztRQUVqRSxRQUFRLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssS0FBSTtBQUNoQyxZQUFBLFdBQVcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN0RSxTQUFDLENBQUMsQ0FBQztBQUVILFFBQUEsV0FBVyxDQUFDLFdBQVcsR0FBRyxDQUFBLEVBQUEsR0FBQSxDQUFBLEVBQUEsR0FBQSxRQUFRLENBQUMsV0FBVyxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEtBQUssRUFBRSxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFJLElBQUksQ0FBQztBQUNoRSxRQUFBLFdBQVcsQ0FBQyxjQUFjLEdBQUcsQ0FBQSxFQUFBLEdBQUEsQ0FBQSxFQUFBLEdBQUEsUUFBUSxDQUFDLGNBQWMsTUFBRSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxLQUFLLEVBQUUsTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBSSxJQUFJLENBQUM7QUFFdEUsUUFBQSxXQUFXLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7QUFFN0UsUUFBQSxXQUFXLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUM7O0FBR3pDLFFBQUEsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7O1FBR3ZDLE1BQU0sd0JBQXdCLEdBQWEsRUFBRSxDQUFDOztRQUc5QyxNQUFNLHdCQUF3QixHQUFhLEVBQUUsQ0FBQzs7QUFHOUMsUUFBQTtBQUNFLFlBQUEsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDO1lBQy9DLE1BQU0sYUFBYSxHQUFHLElBQUssa0JBQWtCLENBQUMsV0FBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUU3RixJQUFJLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFFbEIsWUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsa0JBQWtCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2xELGdCQUFBLE1BQU0sYUFBYSxHQUFHLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxDQUFDO0FBRTVDLGdCQUFBLElBQUksUUFBUSxHQUFHLHdCQUF3QixDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUN2RCxJQUFJLFFBQVEsSUFBSSxJQUFJLEVBQUU7QUFDcEIsb0JBQUEsd0JBQXdCLENBQUMsYUFBYSxDQUFDLEdBQUcsU0FBUyxDQUFDO0FBQ3BELG9CQUFBLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxHQUFHLGFBQWEsQ0FBQztvQkFDcEQsUUFBUSxHQUFHLFNBQVMsQ0FBQztBQUNyQixvQkFBQSxTQUFTLEVBQUUsQ0FBQztBQUNiLGlCQUFBO0FBQ0QsZ0JBQUEsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLFFBQVEsQ0FBQztBQUM3QixhQUFBO0FBRUQsWUFBQSxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksZUFBZSxDQUFDLGFBQWEsRUFBRSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNwRSxTQUFBOztBQUdELFFBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsYUFBYSxLQUFJO1lBQ3pELE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQTBCLENBQUM7WUFFdEYsSUFBSyxpQkFBeUIsQ0FBQyw0QkFBNEIsRUFBRTtBQUMzRCxnQkFBQSxNQUFNLElBQUksS0FBSyxDQUFDLHdFQUF3RSxDQUFDLENBQUM7QUFDM0YsYUFBQTtBQUVELFlBQUEsTUFBTSxzQkFBc0IsR0FBRyxpQkFBaUIsQ0FBQyxLQUFLLENBQUM7QUFDdkQsWUFBQSxNQUFNLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxHQUFHLGlCQUFpQixDQUFDO0FBRW5ELFlBQUEsTUFBTSxpQkFBaUIsR0FBRyxJQUFLLHNCQUFzQixDQUFDLFdBQW1CLENBQ3ZFLHdCQUF3QixDQUFDLE1BQU0sR0FBRyxRQUFRLENBQzNDLENBQUM7WUFFRix3QkFBd0IsQ0FBQyxPQUFPLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxLQUFJO2dCQUNwRCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ2pDLG9CQUFBLGlCQUFpQixDQUFDLENBQUMsR0FBRyxRQUFRLEdBQUcsQ0FBQyxDQUFDLEdBQUcsc0JBQXNCLENBQUMsYUFBYSxHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM1RixpQkFBQTtBQUNILGFBQUMsQ0FBQyxDQUFDO0FBRUgsWUFBQSxXQUFXLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxJQUFJLGVBQWUsQ0FBQyxpQkFBaUIsRUFBRSxRQUFRLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztBQUN4RyxTQUFDLENBQUMsQ0FBQzs7O1FBSUgsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBRXZCLFFBQUEsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsYUFBYSxLQUFJO0FBQzlELFlBQUEsV0FBVyxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsR0FBRyxFQUFFLENBQUM7WUFFaEQsTUFBTSxNQUFNLEdBQUcsUUFBUSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsQ0FBQztBQUN2RCxZQUFBLEtBQUssSUFBSSxNQUFNLEdBQUcsQ0FBQyxFQUFFLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxFQUFFO0FBQ3JELGdCQUFBLE1BQU0saUJBQWlCLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBMEIsQ0FBQztnQkFFbEUsSUFBSyxpQkFBeUIsQ0FBQyw0QkFBNEIsRUFBRTtBQUMzRCxvQkFBQSxNQUFNLElBQUksS0FBSyxDQUFDLHdFQUF3RSxDQUFDLENBQUM7QUFDM0YsaUJBQUE7QUFFRCxnQkFBQSxNQUFNLHNCQUFzQixHQUFHLGlCQUFpQixDQUFDLEtBQUssQ0FBQztBQUN2RCxnQkFBQSxNQUFNLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxHQUFHLGlCQUFpQixDQUFDO0FBRW5ELGdCQUFBLE1BQU0saUJBQWlCLEdBQUcsSUFBSyxzQkFBc0IsQ0FBQyxXQUFtQixDQUN2RSx3QkFBd0IsQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUMzQyxDQUFDO2dCQUVGLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLEtBQUk7b0JBQ3BELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDakMsd0JBQUEsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUMsR0FBRyxzQkFBc0IsQ0FBQyxhQUFhLEdBQUcsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzVGLHFCQUFBO0FBQ0gsaUJBQUMsQ0FBQyxDQUFDO0FBRUgsZ0JBQUEsV0FBVyxHQUFHLFdBQVcsSUFBSSxpQkFBaUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFTLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBRTdFLGdCQUFBLFdBQVcsQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxlQUFlLENBQ3RFLGlCQUFpQixFQUNqQixRQUFRLEVBQ1IsVUFBVSxDQUNYLENBQUM7QUFDSCxhQUFBO0FBQ0gsU0FBQyxDQUFDLENBQUM7O0FBR0gsUUFBQSxJQUFJLFdBQVcsRUFBRTtBQUNmLFlBQUEsV0FBVyxDQUFDLGVBQWUsR0FBRyxFQUFFLENBQUM7QUFDbEMsU0FBQTtBQUVELFFBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUM7QUFDOUIsS0FBQyxDQUFDLENBQUM7QUFFSCxJQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsZ0JBQWdCLEtBQUk7UUFDMUQsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDN0IsS0FBQyxDQUFDLENBQUM7QUFDTDs7TUM5SmEsUUFBUSxDQUFBO0FBQ25CLElBQUEsV0FBQSxHQUFBOztLQUVDOztBQUVhLFFBQW9CLENBQUEsb0JBQUEsR0FBRyxvQkFBb0IsQ0FBQztBQUM1QyxRQUF1QixDQUFBLHVCQUFBLEdBQUcsdUJBQXVCLENBQUM7QUFDbEQsUUFBeUIsQ0FBQSx5QkFBQSxHQUFHLHlCQUF5Qjs7QUNQckUsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFMUIsTUFBTyxrQkFBbUIsU0FBUSxhQUFhLENBQUE7SUFHNUMsV0FBVyxDQUFDLEtBQXFCLEVBQUUsV0FBNEIsRUFBQTtBQUNwRSxRQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsMEJBQTBCLEVBQUU7QUFDM0MsWUFBQSxJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxLQUFLLENBQUMsV0FBVyxDQUMvQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUMzQixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFDMUIsR0FBRyxFQUNILFFBQVEsQ0FDVCxDQUFDO0FBQ0YsWUFBQSxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ3RDLFNBQUE7S0FDRjtBQUVNLElBQUEsTUFBTSxDQUFDLEtBQWEsRUFBQTtBQUN6QixRQUFBLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFcEIsSUFBSSxJQUFJLENBQUMsb0JBQW9CLEVBQUU7WUFDN0IsSUFBSSxDQUFDLFdBQVcsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDakYsWUFBQSxJQUFJLENBQUMsb0JBQW9CLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzNFLFNBQUE7S0FDRjtBQUNGOztBQ3BCSyxNQUFPLHNCQUF1QixTQUFRLGlCQUFpQixDQUFBO0FBQ3BELElBQUEsTUFBTSxDQUNYLElBQVUsRUFDVixXQUEyQixFQUMzQixlQUFtQyxFQUNuQyxRQUFxQixFQUFBOztBQUVyQixRQUFBLE1BQU0sTUFBTSxHQUE4QixDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQUUsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsR0FBRyxDQUFDO1FBQzNFLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDWCxZQUFBLE9BQU8sSUFBSSxDQUFDO0FBQ2IsU0FBQTtBQUVELFFBQUEsTUFBTSxpQkFBaUIsR0FBc0MsTUFBTSxDQUFDLFdBQVcsQ0FBQztRQUNoRixJQUFJLENBQUMsaUJBQWlCLEVBQUU7QUFDdEIsWUFBQSxPQUFPLElBQUksQ0FBQztBQUNiLFNBQUE7QUFFRCxRQUFBLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2xGLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxXQUFXLEVBQUUsT0FBTyxJQUFJLFNBQVMsQ0FBQyxDQUFDO0tBQ2xFO0FBQ0Y7O0FDdkJELE1BQU0sc0JBQXNCLEdBQUcsSUFBSSxLQUFLLENBQUMsaUJBQWlCLENBQUM7QUFDekQsSUFBQSxLQUFLLEVBQUUsUUFBUTtBQUNmLElBQUEsU0FBUyxFQUFFLElBQUk7QUFDZixJQUFBLFdBQVcsRUFBRSxJQUFJO0FBQ2pCLElBQUEsU0FBUyxFQUFFLEtBQUs7QUFDakIsQ0FBQSxDQUFDLENBQUM7QUFPRyxNQUFPLHlCQUEwQixTQUFRLG9CQUFvQixDQUFBO0lBQzFELFdBQVcsQ0FBQyxLQUFxQixFQUFFLFdBQTRCLEVBQUE7UUFDcEUsSUFBSSxXQUFXLENBQUMsdUJBQXVCO1lBQUUsT0FBTztRQUVoRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsZUFBZSxLQUFJO0FBQ25ELFlBQUEsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsS0FBSTtnQkFDckMsSUFBSyxVQUFrQixDQUFDLFFBQVEsRUFBRTtBQUNoQyxvQkFBQSxNQUFNLEtBQUssR0FBSSxVQUFpQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQzVELG9CQUFBLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDbEIsaUJBQUE7QUFDSCxhQUFDLENBQUMsQ0FBQztBQUNMLFNBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxhQUFhLEtBQUk7WUFDNUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLEtBQUk7QUFDM0MsZ0JBQUEsUUFBUSxDQUFDLFFBQVEsR0FBRyxzQkFBc0IsQ0FBQztBQUMzQyxnQkFBQSxRQUFRLENBQUMsV0FBVyxHQUFHLHNCQUFzQixDQUFDO0FBQ2hELGFBQUMsQ0FBQyxDQUFDO0FBQ0wsU0FBQyxDQUFDLENBQUM7S0FDSjtBQUNGOztBQ2pDRCxNQUFNLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUUzQixNQUFPLGtCQUFtQixTQUFRLGFBQWEsQ0FBQTtJQUduRCxXQUFZLENBQUEsSUFBb0IsRUFBRSxNQUErQixFQUFBO0FBQy9ELFFBQUEsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztLQUNyQjtBQUVEOzs7QUFHRztJQUNJLFFBQVEsR0FBQTs7UUFFYixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDZixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7QUFDcEIsU0FBQTtBQUVELFFBQUEsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFDbEYsUUFBQSxNQUFNLHNCQUFzQixHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDO0FBRXpELFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLEtBQUssQ0FBQyxXQUFXLENBQ2pDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxFQUM1QixJQUFJLENBQUMsb0JBQW9CLEVBQ3pCLHNCQUFzQixFQUN0QixRQUFRLEVBQ1IsSUFBSSxDQUFDLE1BQU0sRUFDWCxJQUFJLENBQUMsTUFBTSxDQUNaLENBQUM7O1FBR0YsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLHNCQUFzQixDQUFDO1FBQ3RELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsR0FBRyxzQkFBc0IsQ0FBQztRQUNyRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUEyQixDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUM7UUFDL0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBMkIsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ2hFLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQTJCLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUMvRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUEyQixDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFFakUsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO0tBQ3BCO0FBRU0sSUFBQSxNQUFNLENBQUMsS0FBYSxFQUFBO0FBQ3pCLFFBQUEsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQzs7UUFFcEIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0tBQ3JCO0lBRU8sWUFBWSxHQUFBO0FBQ2xCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDaEIsT0FBTztBQUNSLFNBQUE7QUFFRCxRQUFBLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQ3JGLFFBQUEsTUFBTSxzQkFBc0IsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUV6RCxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0FBQ3ZELFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDeEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0tBQ3REO0FBQ0Y7O0FDekRLLE1BQU8sMEJBQTJCLFNBQVEscUJBQXFCLENBQUE7QUFDdEQsSUFBQSxNQUFNLENBQUMsSUFBVSxFQUFBOzs7QUFDNUIsWUFBQSxNQUFNLE1BQU0sR0FBOEIsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEdBQUcsQ0FBQztBQUMzRSxZQUFBLElBQUksQ0FBQyxNQUFNO0FBQUUsZ0JBQUEsT0FBTyxJQUFJLENBQUM7QUFFekIsWUFBQSxNQUFNLHdCQUF3QixHQUE2QyxNQUFNLENBQUMsa0JBQWtCLENBQUM7QUFDckcsWUFBQSxJQUFJLENBQUMsd0JBQXdCO0FBQUUsZ0JBQUEsT0FBTyxJQUFJLENBQUM7O1lBRzNDLE1BQU0sY0FBYyxHQUFHLE1BQU0sSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSx3QkFBd0IsQ0FBQyxDQUFDOzs7QUFJNUYsWUFBQSxNQUFNLG1CQUFtQixHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBRSxjQUFjLENBQUMsQ0FBQztBQUVsSCxZQUFBLE9BQU8sSUFBSSx5QkFBeUIsQ0FBQyxjQUFjLEVBQUUsbUJBQW1CLENBQUMsQ0FBQzs7QUFDM0UsS0FBQTtJQUVTLGlCQUFpQixDQUFDLElBQW9CLEVBQUUsTUFBK0IsRUFBQTtBQUMvRSxRQUFBLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7S0FDN0M7QUFDRjs7QUNwQkQ7O0FBRUc7QUFDRyxNQUFPLGdCQUFpQixTQUFRLFdBQVcsQ0FBQTtBQUMvQyxJQUFBLFdBQUEsQ0FBbUIsVUFBOEIsRUFBRSxFQUFBO1FBQ2pELE9BQU8sQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxJQUFJLHNCQUFzQixFQUFFLENBQUM7UUFDaEYsT0FBTyxDQUFDLGtCQUFrQixHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsSUFBSSxJQUFJLDBCQUEwQixFQUFFLENBQUM7UUFDNUYsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ2hCO0FBRVksSUFBQSxNQUFNLENBQUMsSUFBVSxFQUFFLFlBQUEsR0FBZ0MsRUFBRSxFQUFBOztZQUNoRSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsS0FBSyxTQUFTLEVBQUU7QUFDOUYsZ0JBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0FBQzdELGFBQUE7QUFDRCxZQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7QUFFekIsWUFBQSxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7OztBQUkvQixZQUFBLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEtBQUk7Z0JBQzFCLElBQUssUUFBZ0IsQ0FBQyxNQUFNLEVBQUU7QUFDNUIsb0JBQUEsUUFBUSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7QUFDaEMsaUJBQUE7QUFDSCxhQUFDLENBQUMsQ0FBQztBQUVILFlBQUEsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztBQUVsRSxZQUFBLE1BQU0sU0FBUyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO0FBRXpGLFlBQUEsTUFBTSxRQUFRLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO1lBRTFFLE1BQU0sV0FBVyxHQUFHLFFBQVEsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUssU0FBUyxHQUFHLFNBQVMsQ0FBQztBQUVqSCxZQUFBLE1BQU0sZUFBZSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztBQUVuRixZQUFBLE1BQU0sTUFBTSxHQUNWLFdBQVcsSUFBSSxlQUFlLElBQUksUUFBUTtBQUN4QyxrQkFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDLEtBQUssU0FBUztrQkFDOUYsU0FBUyxDQUFDO1lBQ2hCLElBQUssTUFBYyxDQUFDLFdBQVcsRUFBRTtBQUM5QixnQkFBQSxNQUE2QixDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsWUFBWSxDQUFDLENBQUM7QUFDakUsYUFBQTtBQUVELFlBQUEsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7WUFDckYsSUFBSyxpQkFBeUIsQ0FBQyxXQUFXLEVBQUU7QUFDekMsZ0JBQUEsaUJBQStDLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztBQUNuRixhQUFBO1lBRUQsT0FBTyxJQUFJLFFBQVEsQ0FDakI7Z0JBQ0UsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLO2dCQUNqQixJQUFJO2dCQUNKLFNBQVM7Z0JBQ1QsUUFBUTtnQkFDUixXQUFXO2dCQUNYLGVBQWU7Z0JBQ2YsTUFBTTtnQkFDTixpQkFBaUI7YUFDbEIsRUFDRCxZQUFZLENBQ2IsQ0FBQztTQUNILENBQUEsQ0FBQTtBQUFBLEtBQUE7QUFDRjs7QUNqRU0sTUFBTSxzQkFBc0IsR0FBRyxNQUFNO0FBRTVDOztBQUVHO0FBQ0csTUFBTyxRQUFTLFNBQVEsR0FBRyxDQUFBO0FBQy9COzs7Ozs7OztBQVFHO0lBQ0ksT0FBYSxJQUFJLENBQ3RCLElBQVUsRUFDVixPQUE4QixHQUFBLEVBQUUsRUFDaEMsV0FBQSxHQUErQixFQUFFLEVBQUE7O0FBRWpDLFlBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztZQUMvQyxPQUFPLE1BQU0sUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsV0FBVyxDQUFDLENBQUM7U0FDakQsQ0FBQSxDQUFBO0FBQUEsS0FBQTtBQUVEOzs7OztBQUtHO0lBQ0gsV0FBWSxDQUFBLE1BQXFCLEVBQUUsV0FBQSxHQUErQixFQUFFLEVBQUE7UUFDbEUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDOztBQUdkLFFBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsRUFBRTtBQUNqQyxZQUFBLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNqRCxTQUFBO0FBRUQsUUFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLHFCQUFxQixFQUFFO0FBQ3RDLFlBQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQ3RELFNBQUE7S0FDRjtBQUVNLElBQUEsTUFBTSxDQUFDLEtBQWEsRUFBQTtBQUN6QixRQUFBLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7S0FDckI7QUFDRjs7OzsifQ==
