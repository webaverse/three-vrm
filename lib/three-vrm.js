/*!
 * @pixiv/three-vrm v0.6.11
 * VRM file loader for three.js.
 *
 * Copyright (c) 2019-2021 pixiv Inc.
 * @pixiv/three-vrm is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE_VRM = {}, global.THREE));
})(this, (function (exports, THREE) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var THREE__namespace = /*#__PURE__*/_interopNamespace(THREE);

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
    const _v2 = new THREE__namespace.Vector2();
    const _v3$1 = new THREE__namespace.Vector3();
    const _v4 = new THREE__namespace.Vector4();
    const _color = new THREE__namespace.Color();
    // animationMixer の監視対象は、Scene の中に入っている必要がある。
    // そのため、表示オブジェクトではないけれど、Object3D を継承して Scene に投入できるようにする。
    class VRMBlendShapeGroup extends THREE__namespace.Object3D {
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
                targetValue = new THREE__namespace.Vector2().fromArray(args.targetValue);
                deltaValue = targetValue.clone().sub(defaultValue);
            }
            else if (value.isVector3) {
                type = VRMBlendShapeMaterialValueType.VECTOR3;
                defaultValue = value.clone();
                targetValue = new THREE__namespace.Vector3().fromArray(args.targetValue);
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
                targetValue = new THREE__namespace.Vector4().fromArray([
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
                targetValue = new THREE__namespace.Color().fromArray(args.targetValue);
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
    exports.VRMSchema = void 0;
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
    })(exports.VRMSchema || (exports.VRMSchema = {}));

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
    const _position = new THREE__namespace.Vector3();
    const _scale = new THREE__namespace.Vector3();
    new THREE__namespace.Quaternion();
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
                        schemaGroup.presetName !== exports.VRMSchema.BlendShapePresetName.Unknown &&
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

    const VECTOR3_FRONT$1 = Object.freeze(new THREE__namespace.Vector3(0.0, 0.0, -1.0));
    const _quat$1 = new THREE__namespace.Quaternion();
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
            const v4 = new THREE__namespace.Vector4(offset.x, offset.y, offset.z, 1.0);
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
            const dst = new THREE__namespace.SkinnedMesh(src.geometry.clone(), src.material);
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
            dst.bind(new THREE__namespace.Skeleton(src.skeleton.bones, src.skeleton.boneInverses), new THREE__namespace.Matrix4());
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
                    firstPersonBone = humanoid.getBoneNode(exports.VRMSchema.HumanoidBoneName.Head);
                }
                else {
                    firstPersonBone = yield gltf.parser.getDependency('node', firstPersonBoneIndex);
                }
                if (!firstPersonBone) {
                    console.warn('VRMFirstPersonImporter: Could not find firstPersonBone of the VRM');
                    return null;
                }
                const firstPersonBoneOffset = schemaFirstPerson.firstPersonBoneOffset
                    ? new THREE__namespace.Vector3(schemaFirstPerson.firstPersonBoneOffset.x, schemaFirstPerson.firstPersonBoneOffset.y, -schemaFirstPerson.firstPersonBoneOffset.z)
                    : new THREE__namespace.Vector3(0.0, 0.06, 0.0); // fallback, taken from UniVRM implementation
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

    const _v3A$4 = new THREE__namespace.Vector3();
    const _quatA$1 = new THREE__namespace.Quaternion();
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
            const bones = Object.values(exports.VRMSchema.HumanoidBoneName).reduce((accum, name) => {
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
                                center: bone.center && new THREE__namespace.Vector3(bone.center.x, bone.center.y, bone.center.z),
                                max: bone.max && new THREE__namespace.Vector3(bone.max.x, bone.max.y, bone.max.z),
                                min: bone.min && new THREE__namespace.Vector3(bone.min.x, bone.min.y, bone.min.z),
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
            this.type = exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape;
            this._curveHorizontal = curveHorizontal;
            this._curveVerticalDown = curveVerticalDown;
            this._curveVerticalUp = curveVerticalUp;
            this._blendShapeProxy = blendShapeProxy;
        }
        name() {
            return exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape;
        }
        lookAt(euler) {
            const srcX = euler.x;
            const srcY = euler.y;
            if (srcX < 0.0) {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookup, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookdown, this._curveVerticalDown.map(-srcX));
            }
            else {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookdown, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookup, this._curveVerticalUp.map(srcX));
            }
            if (srcY < 0.0) {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookleft, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookright, this._curveHorizontal.map(-srcY));
            }
            else {
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookright, 0.0);
                this._blendShapeProxy.setValue(exports.VRMSchema.BlendShapePresetName.Lookleft, this._curveHorizontal.map(srcY));
            }
        }
    }

    const VECTOR3_FRONT = Object.freeze(new THREE__namespace.Vector3(0.0, 0.0, -1.0));
    const _v3A$3 = new THREE__namespace.Vector3();
    const _v3B$1 = new THREE__namespace.Vector3();
    const _v3C$1 = new THREE__namespace.Vector3();
    const _quat = new THREE__namespace.Quaternion();
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
            this._euler = new THREE__namespace.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
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

    const _euler = new THREE__namespace.Euler(0.0, 0.0, 0.0, VRMLookAtHead.EULER_ORDER);
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
            this.type = exports.VRMSchema.FirstPersonLookAtTypeName.Bone;
            this._curveHorizontalInner = curveHorizontalInner;
            this._curveHorizontalOuter = curveHorizontalOuter;
            this._curveVerticalDown = curveVerticalDown;
            this._curveVerticalUp = curveVerticalUp;
            this._leftEye = humanoid.getBoneNode(exports.VRMSchema.HumanoidBoneName.LeftEye);
            this._rightEye = humanoid.getBoneNode(exports.VRMSchema.HumanoidBoneName.RightEye);
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
                case exports.VRMSchema.FirstPersonLookAtTypeName.Bone: {
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
                case exports.VRMSchema.FirstPersonLookAtTypeName.BlendShape: {
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
        if (parseInt(THREE__namespace.REVISION, 10) >= 136) {
            switch (encoding) {
                case THREE__namespace.LinearEncoding:
                    return ['Linear', '( value )'];
                case THREE__namespace.sRGBEncoding:
                    return ['sRGB', '( value )'];
                default:
                    console.warn('THREE.WebGLProgram: Unsupported encoding:', encoding);
                    return ['Linear', '( value )'];
            }
        }
        else {
            // COMPAT: pre-r136
            switch (encoding) {
                case THREE__namespace.LinearEncoding:
                    return ['Linear', '( value )'];
                case THREE__namespace.sRGBEncoding:
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
    exports.MToonMaterialCullMode = void 0;
    (function (MToonMaterialCullMode) {
        MToonMaterialCullMode[MToonMaterialCullMode["Off"] = 0] = "Off";
        MToonMaterialCullMode[MToonMaterialCullMode["Front"] = 1] = "Front";
        MToonMaterialCullMode[MToonMaterialCullMode["Back"] = 2] = "Back";
    })(exports.MToonMaterialCullMode || (exports.MToonMaterialCullMode = {}));
    exports.MToonMaterialDebugMode = void 0;
    (function (MToonMaterialDebugMode) {
        MToonMaterialDebugMode[MToonMaterialDebugMode["None"] = 0] = "None";
        MToonMaterialDebugMode[MToonMaterialDebugMode["Normal"] = 1] = "Normal";
        MToonMaterialDebugMode[MToonMaterialDebugMode["LitShadeRate"] = 2] = "LitShadeRate";
        MToonMaterialDebugMode[MToonMaterialDebugMode["UV"] = 3] = "UV";
    })(exports.MToonMaterialDebugMode || (exports.MToonMaterialDebugMode = {}));
    exports.MToonMaterialOutlineColorMode = void 0;
    (function (MToonMaterialOutlineColorMode) {
        MToonMaterialOutlineColorMode[MToonMaterialOutlineColorMode["FixedColor"] = 0] = "FixedColor";
        MToonMaterialOutlineColorMode[MToonMaterialOutlineColorMode["MixedLighting"] = 1] = "MixedLighting";
    })(exports.MToonMaterialOutlineColorMode || (exports.MToonMaterialOutlineColorMode = {}));
    exports.MToonMaterialOutlineWidthMode = void 0;
    (function (MToonMaterialOutlineWidthMode) {
        MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["None"] = 0] = "None";
        MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["WorldCoordinates"] = 1] = "WorldCoordinates";
        MToonMaterialOutlineWidthMode[MToonMaterialOutlineWidthMode["ScreenCoordinates"] = 2] = "ScreenCoordinates";
    })(exports.MToonMaterialOutlineWidthMode || (exports.MToonMaterialOutlineWidthMode = {}));
    exports.MToonMaterialRenderMode = void 0;
    (function (MToonMaterialRenderMode) {
        MToonMaterialRenderMode[MToonMaterialRenderMode["Opaque"] = 0] = "Opaque";
        MToonMaterialRenderMode[MToonMaterialRenderMode["Cutout"] = 1] = "Cutout";
        MToonMaterialRenderMode[MToonMaterialRenderMode["Transparent"] = 2] = "Transparent";
        MToonMaterialRenderMode[MToonMaterialRenderMode["TransparentWithZWrite"] = 3] = "TransparentWithZWrite";
    })(exports.MToonMaterialRenderMode || (exports.MToonMaterialRenderMode = {}));
    /**
     * MToon is a material specification that has various features.
     * The spec and implementation are originally founded for Unity engine and this is a port of the material.
     *
     * See: https://github.com/Santarh/MToon
     */
    class MToonMaterial extends THREE__namespace.ShaderMaterial {
        constructor(parameters = {}) {
            super();
            /**
             * Readonly boolean that indicates this is a [[MToonMaterial]].
             */
            this.isMToonMaterial = true;
            this.cutoff = 0.5; // _Cutoff
            this.color = new THREE__namespace.Vector4(1.0, 1.0, 1.0, 1.0); // _Color
            this.shadeColor = new THREE__namespace.Vector4(0.97, 0.81, 0.86, 1.0); // _ShadeColor
            this.map = null; // _MainTex
            // eslint-disable-next-line @typescript-eslint/naming-convention
            this.mainTex_ST = new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
            this.shadeTexture = null; // _ShadeTexture
            // public shadeTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _ShadeTexture_ST (unused)
            this.normalMap = null; // _BumpMap. again, THIS IS _BumpMap
            this.normalMapType = THREE__namespace.TangentSpaceNormalMap; // Three.js requires this
            this.normalScale = new THREE__namespace.Vector2(1.0, 1.0); // _BumpScale, in Vector2
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
            this.rimColor = new THREE__namespace.Vector4(0.0, 0.0, 0.0, 1.0); // _RimColor
            this.rimLightingMix = 0.0; // _RimLightingMix
            this.rimFresnelPower = 1.0; // _RimFresnelPower
            this.rimLift = 0.0; // _RimLift
            this.sphereAdd = null; // _SphereAdd
            // public sphereAdd_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _SphereAdd_ST (unused)
            this.emissionColor = new THREE__namespace.Vector4(0.0, 0.0, 0.0, 1.0); // _EmissionColor
            this.emissiveMap = null; // _EmissionMap
            // public emissionMap_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _EmissionMap_ST (unused)
            this.outlineWidthTexture = null; // _OutlineWidthTexture
            // public outlineWidthTexture_ST = new THREE.Vector4(0.0, 0.0, 1.0, 1.0); // _OutlineWidthTexture_ST (unused)
            this.outlineWidth = 0.5; // _OutlineWidth
            this.outlineScaledMaxDistance = 1.0; // _OutlineScaledMaxDistance
            this.outlineColor = new THREE__namespace.Vector4(0.0, 0.0, 0.0, 1.0); // _OutlineColor
            this.outlineLightingMix = 1.0; // _OutlineLightingMix
            this.uvAnimMaskTexture = null; // _UvAnimMaskTexture
            this.uvAnimScrollX = 0.0; // _UvAnimScrollX
            this.uvAnimScrollY = 0.0; // _UvAnimScrollY
            this.uvAnimRotation = 0.0; // _uvAnimRotation
            this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
            this._debugMode = exports.MToonMaterialDebugMode.None; // _DebugMode
            this._blendMode = exports.MToonMaterialRenderMode.Opaque; // _BlendMode
            this._outlineWidthMode = exports.MToonMaterialOutlineWidthMode.None; // _OutlineWidthMode
            this._outlineColorMode = exports.MToonMaterialOutlineColorMode.FixedColor; // _OutlineColorMode
            this._cullMode = exports.MToonMaterialCullMode.Back; // _CullMode
            this._outlineCullMode = exports.MToonMaterialCullMode.Front; // _OutlineCullMode
            // public srcBlend = 1.0; // _SrcBlend (is not supported)
            // public dstBlend = 0.0; // _DstBlend (is not supported)
            // public zWrite = 1.0; // _ZWrite (will be converted to depthWrite)
            this._isOutline = false;
            this._uvAnimOffsetX = 0.0;
            this._uvAnimOffsetY = 0.0;
            this._uvAnimPhase = 0.0;
            this.encoding = parameters.encoding || THREE__namespace.LinearEncoding;
            if (this.encoding !== THREE__namespace.LinearEncoding && this.encoding !== THREE__namespace.sRGBEncoding) {
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
            if (parseInt(THREE__namespace.REVISION, 10) < 129) {
                parameters.skinning = parameters.skinning || false;
            }
            // COMPAT: pre-r131
            // See: https://github.com/mrdoob/three.js/pull/22169
            if (parseInt(THREE__namespace.REVISION, 10) < 131) {
                parameters.morphTargets = parameters.morphTargets || false;
                parameters.morphNormals = parameters.morphNormals || false;
            }
            // == uniforms =============================================================
            parameters.uniforms = THREE__namespace.UniformsUtils.merge([
                THREE__namespace.UniformsLib.common,
                THREE__namespace.UniformsLib.normalmap,
                THREE__namespace.UniformsLib.emissivemap,
                THREE__namespace.UniformsLib.fog,
                THREE__namespace.UniformsLib.lights,
                {
                    cutoff: { value: 0.5 },
                    color: { value: new THREE__namespace.Color(1.0, 1.0, 1.0) },
                    colorAlpha: { value: 1.0 },
                    shadeColor: { value: new THREE__namespace.Color(0.97, 0.81, 0.86) },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    mainTex_ST: { value: new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0) },
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
                    rimColor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    rimLightingMix: { value: 0.0 },
                    rimFresnelPower: { value: 1.0 },
                    rimLift: { value: 0.0 },
                    sphereAdd: { value: null },
                    emissionColor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    outlineWidthTexture: { value: null },
                    outlineWidth: { value: 0.5 },
                    outlineScaledMaxDistance: { value: 1.0 },
                    outlineColor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
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
            this.depthWrite = this._blendMode !== exports.MToonMaterialRenderMode.Transparent;
            this.transparent =
                this._blendMode === exports.MToonMaterialRenderMode.Transparent ||
                    this._blendMode === exports.MToonMaterialRenderMode.TransparentWithZWrite;
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
            if (this.encoding === THREE__namespace.sRGBEncoding) {
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
                THREE_VRM_THREE_REVISION: parseInt(THREE__namespace.REVISION, 10),
                OUTLINE: this._isOutline,
                BLENDMODE_OPAQUE: this._blendMode === exports.MToonMaterialRenderMode.Opaque,
                BLENDMODE_CUTOUT: this._blendMode === exports.MToonMaterialRenderMode.Cutout,
                BLENDMODE_TRANSPARENT: this._blendMode === exports.MToonMaterialRenderMode.Transparent ||
                    this._blendMode === exports.MToonMaterialRenderMode.TransparentWithZWrite,
                MTOON_USE_UV: useUvInVert || useUvInFrag,
                MTOON_UVS_VERTEX_ONLY: useUvInVert && !useUvInFrag,
                USE_SHADETEXTURE: this.shadeTexture !== null,
                USE_RECEIVESHADOWTEXTURE: this.receiveShadowTexture !== null,
                USE_SHADINGGRADETEXTURE: this.shadingGradeTexture !== null,
                USE_RIMTEXTURE: this.rimTexture !== null,
                USE_SPHEREADD: this.sphereAdd !== null,
                USE_OUTLINEWIDTHTEXTURE: this.outlineWidthTexture !== null,
                USE_UVANIMMASKTEXTURE: this.uvAnimMaskTexture !== null,
                DEBUG_NORMAL: this._debugMode === exports.MToonMaterialDebugMode.Normal,
                DEBUG_LITSHADERATE: this._debugMode === exports.MToonMaterialDebugMode.LitShadeRate,
                DEBUG_UV: this._debugMode === exports.MToonMaterialDebugMode.UV,
                OUTLINE_WIDTH_WORLD: this._outlineWidthMode === exports.MToonMaterialOutlineWidthMode.WorldCoordinates,
                OUTLINE_WIDTH_SCREEN: this._outlineWidthMode === exports.MToonMaterialOutlineWidthMode.ScreenCoordinates,
                OUTLINE_COLOR_FIXED: this._outlineColorMode === exports.MToonMaterialOutlineColorMode.FixedColor,
                OUTLINE_COLOR_MIXED: this._outlineColorMode === exports.MToonMaterialOutlineColorMode.MixedLighting,
            };
            // == generate shader code =================================================
            this.vertexShader = vertexShader$1;
            this.fragmentShader = fragmentShader$1;
            // == texture encodings ====================================================
            // COMPAT: pre-r137
            if (parseInt(THREE__namespace.REVISION, 10) < 137) {
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
                if (this.cullMode === exports.MToonMaterialCullMode.Off) {
                    this.side = THREE__namespace.DoubleSide;
                }
                else if (this.cullMode === exports.MToonMaterialCullMode.Front) {
                    this.side = THREE__namespace.BackSide;
                }
                else if (this.cullMode === exports.MToonMaterialCullMode.Back) {
                    this.side = THREE__namespace.FrontSide;
                }
            }
            else {
                if (this.outlineCullMode === exports.MToonMaterialCullMode.Off) {
                    this.side = THREE__namespace.DoubleSide;
                }
                else if (this.outlineCullMode === exports.MToonMaterialCullMode.Front) {
                    this.side = THREE__namespace.BackSide;
                }
                else if (this.outlineCullMode === exports.MToonMaterialCullMode.Back) {
                    this.side = THREE__namespace.FrontSide;
                }
            }
        }
    }

    var vertexShader = "#include <common>\n\n// #include <uv_pars_vertex>\n#ifdef USE_MAP\n  varying vec2 vUv;\n  uniform vec4 mainTex_ST;\n#endif\n\n#include <uv2_pars_vertex>\n#include <envmap_pars_vertex>\n#include <color_pars_vertex>\n#include <fog_pars_vertex>\n#include <morphtarget_pars_vertex>\n#include <skinning_pars_vertex>\n#include <logdepthbuf_pars_vertex>\n#include <clipping_planes_pars_vertex>\n\nvoid main() {\n\n  // #include <uv_vertex>\n  #ifdef USE_MAP\n    vUv = vec2( mainTex_ST.p * uv.x + mainTex_ST.s, mainTex_ST.q * uv.y + mainTex_ST.t );\n  #endif\n\n  #include <uv2_vertex>\n  #include <color_vertex>\n  #include <skinbase_vertex>\n\n  #ifdef USE_ENVMAP\n\n  #include <beginnormal_vertex>\n  #include <morphnormal_vertex>\n  #include <skinnormal_vertex>\n  #include <defaultnormal_vertex>\n\n  #endif\n\n  #include <begin_vertex>\n  #include <morphtarget_vertex>\n  #include <skinning_vertex>\n  #include <project_vertex>\n  #include <logdepthbuf_vertex>\n\n  #include <worldpos_vertex>\n  #include <clipping_planes_vertex>\n  #include <envmap_vertex>\n  #include <fog_vertex>\n\n}";

    var fragmentShader = "#ifdef RENDERTYPE_CUTOUT\n  uniform float cutoff;\n#endif\n\n#include <common>\n#include <color_pars_fragment>\n#include <uv_pars_fragment>\n#include <uv2_pars_fragment>\n#include <map_pars_fragment>\n// #include <alphamap_pars_fragment>\n// #include <aomap_pars_fragment>\n// #include <lightmap_pars_fragment>\n// #include <envmap_pars_fragment>\n#include <fog_pars_fragment>\n// #include <specularmap_pars_fragment>\n#include <logdepthbuf_pars_fragment>\n#include <clipping_planes_pars_fragment>\n\n// == main procedure ===========================================================\nvoid main() {\n  #include <clipping_planes_fragment>\n\n  vec4 diffuseColor = vec4( 1.0 );\n\n  #include <logdepthbuf_fragment>\n\n  #include <map_fragment>\n  #include <color_fragment>\n  // #include <alphamap_fragment>\n\n  // MToon: alpha\n  // #include <alphatest_fragment>\n  #ifdef RENDERTYPE_CUTOUT\n    if ( diffuseColor.a <= cutoff ) { discard; }\n    diffuseColor.a = 1.0;\n  #endif\n\n  #ifdef RENDERTYPE_OPAQUE\n    diffuseColor.a = 1.0;\n  #endif\n\n  // #include <specularmap_fragment>\n\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\n\n  // accumulation (baked indirect lighting only)\n  #ifdef USE_LIGHTMAP\n    reflectedLight.indirectDiffuse += texture2D( lightMap, vUv2 ).xyz * lightMapIntensity;\n  #else\n    reflectedLight.indirectDiffuse += vec3( 1.0 );\n  #endif\n\n  // modulation\n  // #include <aomap_fragment>\n\n  reflectedLight.indirectDiffuse *= diffuseColor.rgb;\n  vec3 outgoingLight = reflectedLight.indirectDiffuse;\n\n  // #include <envmap_fragment>\n\n  gl_FragColor = vec4( outgoingLight, diffuseColor.a );\n\n  #include <premultiplied_alpha_fragment>\n  #include <tonemapping_fragment>\n  #include <encodings_fragment>\n  #include <fog_fragment>\n}";

    // @ts-nocheck
    exports.VRMUnlitMaterialRenderType = void 0;
    (function (VRMUnlitMaterialRenderType) {
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Opaque"] = 0] = "Opaque";
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Cutout"] = 1] = "Cutout";
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["Transparent"] = 2] = "Transparent";
        VRMUnlitMaterialRenderType[VRMUnlitMaterialRenderType["TransparentWithZWrite"] = 3] = "TransparentWithZWrite";
    })(exports.VRMUnlitMaterialRenderType || (exports.VRMUnlitMaterialRenderType = {}));
    /**
     * This is a material that is an equivalent of "VRM/Unlit***" on VRM spec, those materials are already kinda deprecated though...
     */
    class VRMUnlitMaterial extends THREE__namespace.ShaderMaterial {
        constructor(parameters) {
            super();
            /**
             * Readonly boolean that indicates this is a [[VRMUnlitMaterial]].
             */
            this.isVRMUnlitMaterial = true;
            this.cutoff = 0.5;
            this.map = null; // _MainTex
            // eslint-disable-next-line @typescript-eslint/naming-convention
            this.mainTex_ST = new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0); // _MainTex_ST
            this._renderType = exports.VRMUnlitMaterialRenderType.Opaque;
            this.shouldApplyUniforms = true; // when this is true, applyUniforms effects
            if (parameters === undefined) {
                parameters = {};
            }
            // == enabling bunch of stuff ==============================================
            parameters.fog = true;
            parameters.clipping = true;
            // COMPAT: pre-r129
            // See: https://github.com/mrdoob/three.js/pull/21788
            if (parseInt(THREE__namespace.REVISION, 10) < 129) {
                parameters.skinning = parameters.skinning || false;
            }
            // COMPAT: pre-r131
            // See: https://github.com/mrdoob/three.js/pull/22169
            if (parseInt(THREE__namespace.REVISION, 10) < 131) {
                parameters.morphTargets = parameters.morphTargets || false;
                parameters.morphNormals = parameters.morphNormals || false;
            }
            // == uniforms =============================================================
            parameters.uniforms = THREE__namespace.UniformsUtils.merge([
                THREE__namespace.UniformsLib.common,
                THREE__namespace.UniformsLib.fog,
                {
                    cutoff: { value: 0.5 },
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    mainTex_ST: { value: new THREE__namespace.Vector4(0.0, 0.0, 1.0, 1.0) },
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
            this.depthWrite = this._renderType !== exports.VRMUnlitMaterialRenderType.Transparent;
            this.transparent =
                this._renderType === exports.VRMUnlitMaterialRenderType.Transparent ||
                    this._renderType === exports.VRMUnlitMaterialRenderType.TransparentWithZWrite;
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
                RENDERTYPE_OPAQUE: this._renderType === exports.VRMUnlitMaterialRenderType.Opaque,
                RENDERTYPE_CUTOUT: this._renderType === exports.VRMUnlitMaterialRenderType.Cutout,
                RENDERTYPE_TRANSPARENT: this._renderType === exports.VRMUnlitMaterialRenderType.Transparent ||
                    this._renderType === exports.VRMUnlitMaterialRenderType.TransparentWithZWrite,
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
            this._encoding = options.encoding || THREE__namespace.LinearEncoding;
            if (this._encoding !== THREE__namespace.LinearEncoding && this._encoding !== THREE__namespace.sRGBEncoding) {
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
                    if (params.outlineWidthMode !== exports.MToonMaterialOutlineWidthMode.None) {
                        params.isOutline = true;
                        newOutline = new MToonMaterial(params);
                    }
                }
                else if (vrmProps.shader === 'VRM/UnlitTexture') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.Opaque;
                    newSurface = new VRMUnlitMaterial(params);
                }
                else if (vrmProps.shader === 'VRM/UnlitCutout') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.Cutout;
                    newSurface = new VRMUnlitMaterial(params);
                }
                else if (vrmProps.shader === 'VRM/UnlitTransparent') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.Transparent;
                    newSurface = new VRMUnlitMaterial(params);
                }
                else if (vrmProps.shader === 'VRM/UnlitTransparentZWrite') {
                    // this is very legacy
                    const params = yield this._extractMaterialProperties(originalMaterial, vrmProps, gltf);
                    params.renderType = exports.VRMUnlitMaterialRenderType.TransparentWithZWrite;
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
                if (this._encoding === THREE__namespace.LinearEncoding) {
                    mtl.color.convertLinearToSRGB();
                    mtl.emissive.convertLinearToSRGB();
                }
            }
            if (material.isMeshBasicMaterial) {
                const mtl = material;
                if (mtl.map) {
                    mtl.map.encoding = this._encoding;
                }
                if (this._encoding === THREE__namespace.LinearEncoding) {
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
                    params[newName] = new THREE__namespace.Vector4(...vrmProps.vectorProperties[name]);
                }
            }
            // COMPAT: pre-r129
            // See: https://github.com/mrdoob/three.js/pull/21788
            if (parseInt(THREE__namespace.REVISION, 10) < 129) {
                params.skinning = originalMaterial.skinning || false;
            }
            // COMPAT: pre-r131
            // See: https://github.com/mrdoob/three.js/pull/22169
            if (parseInt(THREE__namespace.REVISION, 10) < 131) {
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

    const _matA$1 = new THREE__namespace.Matrix4();
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

    // @ts-nocheck
    // based on
    // http://rocketjump.skr.jp/unity3d/109/
    // https://github.com/dwango/UniVRM/blob/master/Scripts/SpringBone/VRMSpringBone.cs
    const IDENTITY_MATRIX4 = Object.freeze(new THREE__namespace.Matrix4());
    const IDENTITY_QUATERNION = Object.freeze(new THREE__namespace.Quaternion());
    // 計算中の一時保存用変数（一度インスタンスを作ったらあとは使い回す）
    const _v3A$2 = new THREE__namespace.Vector3();
    const _v3B = new THREE__namespace.Vector3();
    const _v3C = new THREE__namespace.Vector3();
    const _quatA = new THREE__namespace.Quaternion();
    const _matA = new THREE__namespace.Matrix4();
    const _matB = new THREE__namespace.Matrix4();
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
            this._currentTail = new THREE__namespace.Vector3();
            /**
             * Previous position of child tail, in world unit. Will be used for verlet integration.
             */
            this._prevTail = new THREE__namespace.Vector3();
            /**
             * Next position of child tail, in world unit. Will be used for verlet integration.
             * Actually used only in [[update]] and it's kind of temporary variable.
             */
            this._nextTail = new THREE__namespace.Vector3();
            /**
             * Initial axis of the bone, in local unit.
             */
            this._boneAxis = new THREE__namespace.Vector3();
            /**
             * Position of this bone in relative space, kind of a temporary variable.
             */
            this._centerSpacePosition = new THREE__namespace.Vector3();
            /**
             * This springbone will be calculated based on the space relative from this object.
             * If this is `null`, springbone will be calculated in world space.
             */
            this._center = null;
            /**
             * Rotation of parent bone, in world unit.
             * We should update this constantly in [[update]].
             */
            this._parentWorldRotation = new THREE__namespace.Quaternion();
            /**
             * Initial state of the local matrix of the bone.
             */
            this._initialLocalMatrix = new THREE__namespace.Matrix4();
            /**
             * Initial state of the rotation of the bone.
             */
            this._initialLocalRotation = new THREE__namespace.Quaternion();
            /**
             * Initial state of the position of its child.
             */
            this._initialLocalChildPosition = new THREE__namespace.Vector3();
            this.bone = bone; // uniVRMでの parent
            this.bone.matrixAutoUpdate = false; // updateにより計算されるのでthree.js内での自動処理は不要
            this.radius = (_a = params.radius) !== null && _a !== void 0 ? _a : 0.02;
            this.stiffnessForce = (_b = params.stiffnessForce) !== null && _b !== void 0 ? _b : 1.0;
            this.gravityDir = params.gravityDir
                ? new THREE__namespace.Vector3().copy(params.gravityDir)
                : new THREE__namespace.Vector3().set(0.0, -1.0, 0.0);
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
            // convert tails to world space
            this._getMatrixCenterToWorld(_matA);
            this._currentTail.applyMatrix4(_matA);
            this._prevTail.applyMatrix4(_matA);
            this._nextTail.applyMatrix4(_matA);
            // uninstall inverse cache
            /* if (this._center?.userData.inverseCacheProxy) {
              (this._center.userData.inverseCacheProxy as Matrix4InverseCache).revert();
              delete this._center.userData.inverseCacheProxy;
            } */
            // change the center
            this._center = center;
            // install inverse cache
            if (this._center) {
                const matrixWorldInverse = new THREE__namespace.Matrix4();
                let matrixWorldInverseNeedsUpdate = true;
                this._center.updateMatrixWorld = (_updateMatrixWorld => () => {
                    matrixWorldInverseNeedsUpdate = true;
                    return _updateMatrixWorld.apply(this, arguments);
                })(this._center.updateMatrixWorld);
                this._center.getMatrixWorldInverse = () => {
                    if (matrixWorldInverseNeedsUpdate) {
                        matrixWorldInverse.copy(this._center.matrixWorld).invert();
                        matrixWorldInverseNeedsUpdate = false;
                    }
                    return matrixWorldInverse;
                };
                // if (!this._center.userData.inverseCacheProxy) {
                //   this._center.userData.inverseCacheProxy = new Matrix4InverseCache(this._center.matrixWorld);
                // }
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
                // target.copy((this._center.userData.inverseCacheProxy as Matrix4InverseCache).inverse);
                target.copy(this._center.getMatrixWorldInverse());
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

    const _v3A$1 = new THREE__namespace.Vector3();
    const _colliderMaterial = new THREE__namespace.MeshBasicMaterial({ visible: false });
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
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt)
                return null;
            const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
            if (!schemaSecondaryAnimation)
                return null;
            // 衝突判定球体メッシュ。
            const colliderGroups = this._importColliderMeshGroups(gltf, schemaSecondaryAnimation);
            // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
            // 一列だけではないことに注意。
            const springBoneGroupList = this._importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups);
            return new VRMSpringBoneManager(colliderGroups, springBoneGroupList);
        }
        _createSpringBone(bone, params = {}) {
            return new VRMSpringBone(bone, params);
        }
        _importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups) {
            const springBoneGroups = schemaSecondaryAnimation.boneGroups || [];
            const springBoneGroupList = [];
            springBoneGroups.forEach((vrmBoneGroup) => {
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
                const gravityDir = new THREE__namespace.Vector3(vrmBoneGroup.gravityDir.x, vrmBoneGroup.gravityDir.y, -vrmBoneGroup.gravityDir.z);
                const gravityPower = vrmBoneGroup.gravityPower;
                const dragForce = vrmBoneGroup.dragForce;
                const radius = vrmBoneGroup.hitRadius;
                const colliders = [];
                vrmBoneGroup.colliderGroups.forEach((colliderIndex) => {
                    colliders.push(...colliderGroups[colliderIndex].colliders);
                });
                const springBoneGroup = [];
                vrmBoneGroup.bones.forEach((nodeIndex) => {
                    // VRMの情報から「揺れモノ」ボーンのルートが取れる
                    function nodeLookup(nodeIndex) {
                        let name = gltf.parser.json.nodes[nodeIndex].name;
                        name = THREE__namespace.PropertyBinding.sanitizeNodeName(name);
                        // gltf.parser.nodeNamesUsed[name] = false;
                        // name = gltf.parser.createUniqueName(name);
                        const node = gltf.scene.getObjectByName(name);
                        return node;
                    }
                    const springRootBone = nodeLookup(nodeIndex);
                    const center = vrmBoneGroup.center !== -1 ? nodeLookup(vrmBoneGroup.center) : null;
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
                });
                springBoneGroupList.push(springBoneGroup);
            });
            return springBoneGroupList;
        }
        /**
         * Create an array of [[VRMSpringBoneColliderGroup]].
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         * @param schemaSecondaryAnimation A `secondaryAnimation` field of VRM
         */
        _importColliderMeshGroups(gltf, schemaSecondaryAnimation) {
            const vrmColliderGroups = schemaSecondaryAnimation.colliderGroups;
            if (vrmColliderGroups === undefined)
                return [];
            const colliderGroups = [];
            vrmColliderGroups.forEach((colliderGroup) => {
                if (colliderGroup.node === undefined || colliderGroup.colliders === undefined) {
                    return;
                }
                function nodeLookup(nodeIndex) {
                    let name = gltf.parser.json.nodes[nodeIndex].name;
                    name = THREE__namespace.PropertyBinding.sanitizeNodeName(name);
                    // gltf.parser.nodeNamesUsed[name] = false;
                    // name = gltf.parser.createUniqueName(name);
                    const node = gltf.scene.getObjectByName(name);
                    return node;
                }
                const bone = nodeLookup(colliderGroup.node);
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
            });
            return colliderGroups;
        }
        /**
         * Create a collider mesh.
         *
         * @param radius Radius of the new collider mesh
         * @param offset Offest of the new collider mesh
         */
        _createColliderMesh(radius, offset) {
            const colliderMesh = new THREE__namespace.Mesh(new THREE__namespace.SphereBufferGeometry(radius, 8, 4), _colliderMaterial);
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

    const _v2A = new THREE__namespace.Vector2();
    const _camera = new THREE__namespace.OrthographicCamera(-1, 1, -1, 1, -1, 1);
    const _material = new THREE__namespace.MeshBasicMaterial({ color: 0xffffff, side: THREE__namespace.DoubleSide });
    const _plane = new THREE__namespace.Mesh(new THREE__namespace.PlaneBufferGeometry(2, 2), _material);
    const _scene = new THREE__namespace.Scene();
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
                skeleton = new THREE__namespace.Skeleton(bones, boneInverses);
                skeletonList.set(attribute, skeleton);
            }
            mesh.bind(skeleton, new THREE__namespace.Matrix4());
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
            const newGeometry = new THREE__namespace.BufferGeometry();
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
                newGeometry.setIndex(new THREE.BufferAttribute(newIndexArray, 1, false));
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
                newGeometry.setAttribute(attributeName, new THREE.BufferAttribute(newAttributeArray, itemSize, normalized));
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
                    newGeometry.morphAttributes[attributeName][iMorph] = new THREE.BufferAttribute(newAttributeArray, itemSize, normalized);
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

    const _v3 = new THREE__namespace.Vector3();
    class VRMLookAtHeadDebug extends VRMLookAtHead {
        setupHelper(scene, debugOption) {
            if (!debugOption.disableFaceDirectionHelper) {
                this._faceDirectionHelper = new THREE__namespace.ArrowHelper(new THREE__namespace.Vector3(0, 0, -1), new THREE__namespace.Vector3(0, 0, 0), 0.5, 0xff00ff);
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

    const _colliderGizmoMaterial = new THREE__namespace.MeshBasicMaterial({
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

    const _v3A = new THREE__namespace.Vector3();
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
            this._gizmo = new THREE__namespace.ArrowHelper(nextTailRelative.normalize(), this._centerSpacePosition, nextTailRelativeLength, 0xffff00, this.radius, this.radius);
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
            const vrmExt = (_a = gltf.parser.json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt)
                return null;
            const schemaSecondaryAnimation = vrmExt.secondaryAnimation;
            if (!schemaSecondaryAnimation)
                return null;
            // 衝突判定球体メッシュ。
            const colliderGroups = this._importColliderMeshGroups(gltf, schemaSecondaryAnimation);
            // 同じ属性（stiffinessやdragForceが同じ）のボーンはboneGroupにまとめられている。
            // 一列だけではないことに注意。
            const springBoneGroupList = this._importSpringBoneGroupList(gltf, schemaSecondaryAnimation, colliderGroups);
            return new VRMSpringBoneManagerDebug(colliderGroups, springBoneGroupList);
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
                return importer.import(gltf, debugOption);
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
                this.scene.add(new THREE__namespace.BoxHelper(this.scene));
            }
            if (!debugOption.disableSkeletonHelper) {
                this.scene.add(new THREE__namespace.SkeletonHelper(this.scene));
            }
        }
        update(delta) {
            super.update(delta);
        }
    }

    exports.MToonMaterial = MToonMaterial;
    exports.VRM = VRM;
    exports.VRMBlendShapeGroup = VRMBlendShapeGroup;
    exports.VRMBlendShapeImporter = VRMBlendShapeImporter;
    exports.VRMBlendShapeProxy = VRMBlendShapeProxy;
    exports.VRMCurveMapper = VRMCurveMapper;
    exports.VRMDebug = VRMDebug;
    exports.VRMFirstPerson = VRMFirstPerson;
    exports.VRMFirstPersonImporter = VRMFirstPersonImporter;
    exports.VRMHumanBone = VRMHumanBone;
    exports.VRMHumanoid = VRMHumanoid;
    exports.VRMHumanoidImporter = VRMHumanoidImporter;
    exports.VRMImporter = VRMImporter;
    exports.VRMLookAtApplyer = VRMLookAtApplyer;
    exports.VRMLookAtBlendShapeApplyer = VRMLookAtBlendShapeApplyer;
    exports.VRMLookAtBoneApplyer = VRMLookAtBoneApplyer;
    exports.VRMLookAtHead = VRMLookAtHead;
    exports.VRMLookAtImporter = VRMLookAtImporter;
    exports.VRMMaterialImporter = VRMMaterialImporter;
    exports.VRMMetaImporter = VRMMetaImporter;
    exports.VRMRendererFirstPersonFlags = VRMRendererFirstPersonFlags;
    exports.VRMSpringBone = VRMSpringBone;
    exports.VRMSpringBoneDebug = VRMSpringBoneDebug;
    exports.VRMSpringBoneImporter = VRMSpringBoneImporter;
    exports.VRMSpringBoneImporterDebug = VRMSpringBoneImporterDebug;
    exports.VRMSpringBoneManager = VRMSpringBoneManager;
    exports.VRMUnlitMaterial = VRMUnlitMaterial;
    exports.VRMUtils = VRMUtils;
    exports.VRM_GIZMO_RENDER_ORDER = VRM_GIZMO_RENDER_ORDER;

    Object.defineProperty(exports, '__esModule', { value: true });

    Object.assign(THREE, exports);

}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvdHNsaWIvdHNsaWIuZXM2LmpzIiwiLi4vc3JjL3V0aWxzL2Rpc3Bvc2VyLnRzIiwiLi4vc3JjL2JsZW5kc2hhcGUvVlJNQmxlbmRTaGFwZUdyb3VwLnRzIiwiLi4vc3JjL3R5cGVzL1ZSTVNjaGVtYS50cyIsIi4uL3NyYy91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZS50cyIsIi4uL3NyYy91dGlscy9yZW5hbWVNYXRlcmlhbFByb3BlcnR5LnRzIiwiLi4vc3JjL3V0aWxzL21hdGgudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlUHJveHkudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlSW1wb3J0ZXIudHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb24udHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb25JbXBvcnRlci50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmUudHMiLCIuLi9zcmMvdXRpbHMvcXVhdEludmVydENvbXBhdC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZEltcG9ydGVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1DdXJ2ZU1hcHBlci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QXBwbHllci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEhlYWQudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEJvbmVBcHBseWVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlci50cyIsIi4uL3NyYy9tYXRlcmlhbC9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24udHMiLCIuLi9zcmMvbWF0ZXJpYWwvTVRvb25NYXRlcmlhbC50cyIsIi4uL3NyYy9tYXRlcmlhbC9WUk1VbmxpdE1hdGVyaWFsLnRzIiwiLi4vc3JjL21hdGVyaWFsL1ZSTU1hdGVyaWFsSW1wb3J0ZXIudHMiLCIuLi9zcmMvbWV0YS9WUk1NZXRhSW1wb3J0ZXIudHMiLCIuLi9zcmMvdXRpbHMvbWF0NEludmVydENvbXBhdC50cyIsIi4uL3NyYy9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmUudHMiLCIuLi9zcmMvc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lTWFuYWdlci50cyIsIi4uL3NyYy9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVJbXBvcnRlci50cyIsIi4uL3NyYy9WUk1JbXBvcnRlci50cyIsIi4uL3NyYy9WUk0udHMiLCIuLi9zcmMvVlJNVXRpbHMvZXh0cmFjdFRodW1ibmFpbEJsb2IudHMiLCIuLi9zcmMvVlJNVXRpbHMvcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMudHMiLCIuLi9zcmMvVlJNVXRpbHMvcmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlcy50cyIsIi4uL3NyYy9WUk1VdGlscy9pbmRleC50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1Mb29rQXRIZWFkRGVidWcudHMiLCIuLi9zcmMvZGVidWcvVlJNTG9va0F0SW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTVNwcmluZ0JvbmVEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1JbXBvcnRlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTURlYnVnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG0sIGspO1xyXG4gICAgaWYgKCFkZXNjIHx8IChcImdldFwiIGluIGRlc2MgPyAhbS5fX2VzTW9kdWxlIDogZGVzYy53cml0YWJsZSB8fCBkZXNjLmNvbmZpZ3VyYWJsZSkpIHtcclxuICAgICAgICBkZXNjID0geyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbVtrXTsgfSB9O1xyXG4gICAgfVxyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCBkZXNjKTtcclxufSkgOiAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBvW2syXSA9IG1ba107XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXhwb3J0U3RhcihtLCBvKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmIChwICE9PSBcImRlZmF1bHRcIiAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIHApKSBfX2NyZWF0ZUJpbmRpbmcobywgbSwgcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3ZhbHVlcyhvKSB7XHJcbiAgICB2YXIgcyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IsIG0gPSBzICYmIG9bc10sIGkgPSAwO1xyXG4gICAgaWYgKG0pIHJldHVybiBtLmNhbGwobyk7XHJcbiAgICBpZiAobyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobyAmJiBpID49IG8ubGVuZ3RoKSBvID0gdm9pZCAwO1xyXG4gICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogbyAmJiBvW2krK10sIGRvbmU6ICFvIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IocyA/IFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZS5cIiA6IFwiU3ltYm9sLml0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVhZChvLCBuKSB7XHJcbiAgICB2YXIgbSA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvW1N5bWJvbC5pdGVyYXRvcl07XHJcbiAgICBpZiAoIW0pIHJldHVybiBvO1xyXG4gICAgdmFyIGkgPSBtLmNhbGwobyksIHIsIGFyID0gW10sIGU7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHdoaWxlICgobiA9PT0gdm9pZCAwIHx8IG4tLSA+IDApICYmICEociA9IGkubmV4dCgpKS5kb25lKSBhci5wdXNoKHIudmFsdWUpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycm9yKSB7IGUgPSB7IGVycm9yOiBlcnJvciB9OyB9XHJcbiAgICBmaW5hbGx5IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAociAmJiAhci5kb25lICYmIChtID0gaVtcInJldHVyblwiXSkpIG0uY2FsbChpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7IGlmIChlKSB0aHJvdyBlLmVycm9yOyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheXMoKSB7XHJcbiAgICBmb3IgKHZhciBzID0gMCwgaSA9IDAsIGlsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHMgKz0gYXJndW1lbnRzW2ldLmxlbmd0aDtcclxuICAgIGZvciAodmFyIHIgPSBBcnJheShzKSwgayA9IDAsIGkgPSAwOyBpIDwgaWw7IGkrKylcclxuICAgICAgICBmb3IgKHZhciBhID0gYXJndW1lbnRzW2ldLCBqID0gMCwgamwgPSBhLmxlbmd0aDsgaiA8IGpsOyBqKyssIGsrKylcclxuICAgICAgICAgICAgcltrXSA9IGFbal07XHJcbiAgICByZXR1cm4gcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXkodG8sIGZyb20sIHBhY2spIHtcclxuICAgIGlmIChwYWNrIHx8IGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIGZvciAodmFyIGkgPSAwLCBsID0gZnJvbS5sZW5ndGgsIGFyOyBpIDwgbDsgaSsrKSB7XHJcbiAgICAgICAgaWYgKGFyIHx8ICEoaSBpbiBmcm9tKSkge1xyXG4gICAgICAgICAgICBpZiAoIWFyKSBhciA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20sIDAsIGkpO1xyXG4gICAgICAgICAgICBhcltpXSA9IGZyb21baV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHRvLmNvbmNhdChhciB8fCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChmcm9tKSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG4iLCIvLyBTZWU6IGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jbWFudWFsL2VuL2ludHJvZHVjdGlvbi9Ib3ctdG8tZGlzcG9zZS1vZi1vYmplY3RzXG5cbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuZnVuY3Rpb24gZGlzcG9zZU1hdGVyaWFsKG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCk6IHZvaWQge1xuICBPYmplY3Qua2V5cyhtYXRlcmlhbCkuZm9yRWFjaCgocHJvcGVydHlOYW1lKSA9PiB7XG4gICAgY29uc3QgdmFsdWUgPSAobWF0ZXJpYWwgYXMgYW55KVtwcm9wZXJ0eU5hbWVdO1xuICAgIGlmICh2YWx1ZT8uaXNUZXh0dXJlKSB7XG4gICAgICBjb25zdCB0ZXh0dXJlID0gdmFsdWUgYXMgVEhSRUUuVGV4dHVyZTtcbiAgICAgIHRleHR1cmUuZGlzcG9zZSgpO1xuICAgIH1cbiAgfSk7XG5cbiAgbWF0ZXJpYWwuZGlzcG9zZSgpO1xufVxuXG5mdW5jdGlvbiBkaXNwb3NlKG9iamVjdDNEOiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xuICBjb25zdCBnZW9tZXRyeTogVEhSRUUuQnVmZmVyR2VvbWV0cnkgfCB1bmRlZmluZWQgPSAob2JqZWN0M0QgYXMgYW55KS5nZW9tZXRyeTtcbiAgaWYgKGdlb21ldHJ5KSB7XG4gICAgZ2VvbWV0cnkuZGlzcG9zZSgpO1xuICB9XG5cbiAgY29uc3QgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsIHwgVEhSRUUuTWF0ZXJpYWxbXSA9IChvYmplY3QzRCBhcyBhbnkpLm1hdGVyaWFsO1xuICBpZiAobWF0ZXJpYWwpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRlcmlhbCkpIHtcbiAgICAgIG1hdGVyaWFsLmZvckVhY2goKG1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCkgPT4gZGlzcG9zZU1hdGVyaWFsKG1hdGVyaWFsKSk7XG4gICAgfSBlbHNlIGlmIChtYXRlcmlhbCkge1xuICAgICAgZGlzcG9zZU1hdGVyaWFsKG1hdGVyaWFsKTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlZXBEaXNwb3NlKG9iamVjdDNEOiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xuICBvYmplY3QzRC50cmF2ZXJzZShkaXNwb3NlKTtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEZQcmltaXRpdmUgfSBmcm9tICcuLi90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVlJNQmxlbmRTaGFwZUJpbmQge1xuICBtZXNoZXM6IEdMVEZQcmltaXRpdmVbXTtcbiAgbW9ycGhUYXJnZXRJbmRleDogbnVtYmVyO1xuICB3ZWlnaHQ6IG51bWJlcjtcbn1cblxuZW51bSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUge1xuICBOVU1CRVIsXG4gIFZFQ1RPUjIsXG4gIFZFQ1RPUjMsXG4gIFZFQ1RPUjQsXG4gIENPTE9SLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlIHtcbiAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xuICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcbiAgZGVmYXVsdFZhbHVlOiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjtcbiAgdGFyZ2V0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICBkZWx0YVZhbHVlOiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjsgLy8gdGFyZ2V0VmFsdWUgLSBkZWZhdWx0VmFsdWVcbiAgdHlwZTogVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlO1xufVxuXG5jb25zdCBfdjIgPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xuY29uc3QgX3YzID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF92NCA9IG5ldyBUSFJFRS5WZWN0b3I0KCk7XG5jb25zdCBfY29sb3IgPSBuZXcgVEhSRUUuQ29sb3IoKTtcblxuLy8gYW5pbWF0aW9uTWl4ZXIg44Gu55uj6KaW5a++6LGh44Gv44CBU2NlbmUg44Gu5Lit44Gr5YWl44Gj44Gm44GE44KL5b+F6KaB44GM44GC44KL44CCXG4vLyDjgZ3jga7jgZ/jgoHjgIHooajnpLrjgqrjg5bjgrjjgqfjgq/jg4jjgafjga/jgarjgYTjgZHjgozjganjgIFPYmplY3QzRCDjgpLntpnmib/jgZfjgaYgU2NlbmUg44Gr5oqV5YWl44Gn44GN44KL44KI44GG44Gr44GZ44KL44CCXG5leHBvcnQgY2xhc3MgVlJNQmxlbmRTaGFwZUdyb3VwIGV4dGVuZHMgVEhSRUUuT2JqZWN0M0Qge1xuICBwdWJsaWMgd2VpZ2h0ID0gMC4wO1xuICBwdWJsaWMgaXNCaW5hcnkgPSBmYWxzZTtcblxuICBwcml2YXRlIF9iaW5kczogVlJNQmxlbmRTaGFwZUJpbmRbXSA9IFtdO1xuICBwcml2YXRlIF9tYXRlcmlhbFZhbHVlczogVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVbXSA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKGV4cHJlc3Npb25OYW1lOiBzdHJpbmcpIHtcbiAgICBzdXBlcigpO1xuICAgIHRoaXMubmFtZSA9IGBCbGVuZFNoYXBlQ29udHJvbGxlcl8ke2V4cHJlc3Npb25OYW1lfWA7XG5cbiAgICAvLyB0cmF2ZXJzZSDmmYLjga7mlZHmuIjmiYvmrrXjgajjgZfjgaYgT2JqZWN0M0Qg44Gn44Gv44Gq44GE44GT44Go44KS5piO56S644GX44Gm44GK44GPXG4gICAgdGhpcy50eXBlID0gJ0JsZW5kU2hhcGVDb250cm9sbGVyJztcbiAgICAvLyDooajnpLrnm67nmoTjga7jgqrjg5bjgrjjgqfjgq/jg4jjgafjga/jgarjgYTjga7jgafjgIHosqDojbfou73muJvjga7jgZ/jgoHjgasgdmlzaWJsZSDjgpIgZmFsc2Ug44Gr44GX44Gm44GK44GP44CCXG4gICAgLy8g44GT44KM44Gr44KI44KK44CB44GT44Gu44Kk44Oz44K544K/44Oz44K544Gr5a++44GZ44KL5q+O44OV44Os44O844Og44GuIG1hdHJpeCDoh6rli5XoqIjnrpfjgpLnnIHnlaXjgafjgY3jgovjgIJcbiAgICB0aGlzLnZpc2libGUgPSBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRCaW5kKGFyZ3M6IHsgbWVzaGVzOiBHTFRGUHJpbWl0aXZlW107IG1vcnBoVGFyZ2V0SW5kZXg6IG51bWJlcjsgd2VpZ2h0OiBudW1iZXIgfSk6IHZvaWQge1xuICAgIC8vIG9yaWdpbmFsIHdlaWdodCBpcyAwLTEwMCBidXQgd2Ugd2FudCB0byBkZWFsIHdpdGggdGhpcyB2YWx1ZSB3aXRoaW4gMC0xXG4gICAgY29uc3Qgd2VpZ2h0ID0gYXJncy53ZWlnaHQgLyAxMDA7XG5cbiAgICB0aGlzLl9iaW5kcy5wdXNoKHtcbiAgICAgIG1lc2hlczogYXJncy5tZXNoZXMsXG4gICAgICBtb3JwaFRhcmdldEluZGV4OiBhcmdzLm1vcnBoVGFyZ2V0SW5kZXgsXG4gICAgICB3ZWlnaHQsXG4gICAgfSk7XG4gIH1cblxuICBwdWJsaWMgYWRkTWF0ZXJpYWxWYWx1ZShhcmdzOiB7XG4gICAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xuICAgIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICAgIHRhcmdldFZhbHVlOiBudW1iZXJbXTtcbiAgICBkZWZhdWx0VmFsdWU/OiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjtcbiAgfSk6IHZvaWQge1xuICAgIGNvbnN0IG1hdGVyaWFsID0gYXJncy5tYXRlcmlhbDtcbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBhcmdzLnByb3BlcnR5TmFtZTtcblxuICAgIGxldCB2YWx1ZSA9IChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV07XG4gICAgaWYgKCF2YWx1ZSkge1xuICAgICAgLy8gcHJvcGVydHkgaGFzIG5vdCBiZWVuIGZvdW5kXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhbHVlID0gYXJncy5kZWZhdWx0VmFsdWUgfHwgdmFsdWU7XG5cbiAgICBsZXQgdHlwZTogVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlO1xuICAgIGxldCBkZWZhdWx0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICAgIGxldCB0YXJnZXRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG4gICAgbGV0IGRlbHRhVmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuXG4gICAgaWYgKHZhbHVlLmlzVmVjdG9yMikge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IyO1xuICAgICAgZGVmYXVsdFZhbHVlID0gKHZhbHVlIGFzIFRIUkVFLlZlY3RvcjIpLmNsb25lKCk7XG4gICAgICB0YXJnZXRWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IyKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5pc1ZlY3RvcjMpIHtcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMztcbiAgICAgIGRlZmF1bHRWYWx1ZSA9ICh2YWx1ZSBhcyBUSFJFRS5WZWN0b3IzKS5jbG9uZSgpO1xuICAgICAgdGFyZ2V0VmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yMygpLmZyb21BcnJheShhcmdzLnRhcmdldFZhbHVlKTtcbiAgICAgIGRlbHRhVmFsdWUgPSB0YXJnZXRWYWx1ZS5jbG9uZSgpLnN1YihkZWZhdWx0VmFsdWUpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuaXNWZWN0b3I0KSB7XG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjQ7XG4gICAgICBkZWZhdWx0VmFsdWUgPSAodmFsdWUgYXMgVEhSRUUuVmVjdG9yNCkuY2xvbmUoKTtcblxuICAgICAgLy8gdmVjdG9yUHJvcGVydHkgYW5kIHRhcmdldFZhbHVlIGluZGV4IGlzIGRpZmZlcmVudCBmcm9tIGVhY2ggb3RoZXJcbiAgICAgIC8vIGV4cG9ydGVkIHZybSBieSBVbmlWUk0gZmlsZSBpc1xuICAgICAgLy9cbiAgICAgIC8vIHZlY3RvclByb3BlcnR5XG4gICAgICAvLyBvZmZzZXQgPSB0YXJnZXRWYWx1ZVswXSwgdGFyZ2V0VmFsdWVbMV1cbiAgICAgIC8vIHRpbGluZyA9IHRhcmdldFZhbHVlWzJdLCB0YXJnZXRWYWx1ZVszXVxuICAgICAgLy9cbiAgICAgIC8vIHRhcmdldFZhbHVlXG4gICAgICAvLyBvZmZzZXQgPSB0YXJnZXRWYWx1ZVsyXSwgdGFyZ2V0VmFsdWVbM11cbiAgICAgIC8vIHRpbGluZyA9IHRhcmdldFZhbHVlWzBdLCB0YXJnZXRWYWx1ZVsxXVxuICAgICAgdGFyZ2V0VmFsdWUgPSBuZXcgVEhSRUUuVmVjdG9yNCgpLmZyb21BcnJheShbXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMl0sXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbM10sXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMF0sXG4gICAgICAgIGFyZ3MudGFyZ2V0VmFsdWVbMV0sXG4gICAgICBdKTtcbiAgICAgIGRlbHRhVmFsdWUgPSB0YXJnZXRWYWx1ZS5jbG9uZSgpLnN1YihkZWZhdWx0VmFsdWUpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUuaXNDb2xvcikge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5DT0xPUjtcbiAgICAgIGRlZmF1bHRWYWx1ZSA9ICh2YWx1ZSBhcyBUSFJFRS5Db2xvcikuY2xvbmUoKTtcbiAgICAgIHRhcmdldFZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuTlVNQkVSO1xuICAgICAgZGVmYXVsdFZhbHVlID0gdmFsdWUgYXMgbnVtYmVyO1xuICAgICAgdGFyZ2V0VmFsdWUgPSBhcmdzLnRhcmdldFZhbHVlWzBdO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlIC0gZGVmYXVsdFZhbHVlO1xuICAgIH1cblxuICAgIHRoaXMuX21hdGVyaWFsVmFsdWVzLnB1c2goe1xuICAgICAgbWF0ZXJpYWwsXG4gICAgICBwcm9wZXJ0eU5hbWUsXG4gICAgICBkZWZhdWx0VmFsdWUsXG4gICAgICB0YXJnZXRWYWx1ZSxcbiAgICAgIGRlbHRhVmFsdWUsXG4gICAgICB0eXBlLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGx5IHdlaWdodCB0byBldmVyeSBhc3NpZ25lZCBibGVuZCBzaGFwZXMuXG4gICAqIFNob3VsZCBiZSBjYWxsZWQgdmlhIHtAbGluayBCbGVuZFNoYXBlTWFzdGVyI3VwZGF0ZX0uXG4gICAqL1xuICBwdWJsaWMgYXBwbHlXZWlnaHQoKTogdm9pZCB7XG4gICAgY29uc3QgdyA9IHRoaXMuaXNCaW5hcnkgPyAodGhpcy53ZWlnaHQgPCAwLjUgPyAwLjAgOiAxLjApIDogdGhpcy53ZWlnaHQ7XG5cbiAgICB0aGlzLl9iaW5kcy5mb3JFYWNoKChiaW5kKSA9PiB7XG4gICAgICBiaW5kLm1lc2hlcy5mb3JFYWNoKChtZXNoKSA9PiB7XG4gICAgICAgIGlmICghbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkQmluZGBcbiAgICAgICAgbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXNbYmluZC5tb3JwaFRhcmdldEluZGV4XSArPSB3ICogYmluZC53ZWlnaHQ7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuX21hdGVyaWFsVmFsdWVzLmZvckVhY2goKG1hdGVyaWFsVmFsdWUpID0+IHtcbiAgICAgIGNvbnN0IHByb3AgPSAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXTtcbiAgICAgIGlmIChwcm9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRNYXRlcmlhbFZhbHVlYFxuXG4gICAgICBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuTlVNQkVSKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgbnVtYmVyO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXSArPSBkZWx0YVZhbHVlICogdztcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMikge1xuICAgICAgICBjb25zdCBkZWx0YVZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWx0YVZhbHVlIGFzIFRIUkVFLlZlY3RvcjI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmFkZChfdjIuY29weShkZWx0YVZhbHVlKS5tdWx0aXBseVNjYWxhcih3KSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjMpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5WZWN0b3IzO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX3YzLmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1I0KSB7XG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgVEhSRUUuVmVjdG9yNDtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uYWRkKF92NC5jb3B5KGRlbHRhVmFsdWUpLm11bHRpcGx5U2NhbGFyKHcpKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuQ09MT1IpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5Db2xvcjtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uYWRkKF9jb2xvci5jb3B5KGRlbHRhVmFsdWUpLm11bHRpcGx5U2NhbGFyKHcpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPT09ICdib29sZWFuJykge1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENsZWFyIHByZXZpb3VzbHkgYXNzaWduZWQgYmxlbmQgc2hhcGVzLlxuICAgKi9cbiAgcHVibGljIGNsZWFyQXBwbGllZFdlaWdodCgpOiB2b2lkIHtcbiAgICB0aGlzLl9iaW5kcy5mb3JFYWNoKChiaW5kKSA9PiB7XG4gICAgICBiaW5kLm1lc2hlcy5mb3JFYWNoKChtZXNoKSA9PiB7XG4gICAgICAgIGlmICghbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkQmluZGBcbiAgICAgICAgbWVzaC5tb3JwaFRhcmdldEluZmx1ZW5jZXNbYmluZC5tb3JwaFRhcmdldEluZGV4XSA9IDAuMDtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fbWF0ZXJpYWxWYWx1ZXMuZm9yRWFjaCgobWF0ZXJpYWxWYWx1ZSkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdO1xuICAgICAgaWYgKHByb3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXG5cbiAgICAgIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5OVU1CRVIpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgbnVtYmVyO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXSA9IGRlZmF1bHRWYWx1ZTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMikge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBUSFJFRS5WZWN0b3IyO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5jb3B5KGRlZmF1bHRWYWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjMpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuVmVjdG9yMztcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1I0KSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVmYXVsdFZhbHVlIGFzIFRIUkVFLlZlY3RvcjQ7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmNvcHkoZGVmYXVsdFZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuQ09MT1IpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuQ29sb3I7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmNvcHkoZGVmYXVsdFZhbHVlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPT09ICdib29sZWFuJykge1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpLnNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59XG4iLCIvLyBUeXBlZG9jIGRvZXMgbm90IHN1cHBvcnQgZXhwb3J0IGRlY2xhcmF0aW9ucyB5ZXRcbi8vIHRoZW4gd2UgaGF2ZSB0byB1c2UgYG5hbWVzcGFjZWAgaW5zdGVhZCBvZiBleHBvcnQgZGVjbGFyYXRpb25zIGZvciBub3cuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9UeXBlU3Ryb25nL3R5cGVkb2MvcHVsbC84MDFcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uby1uYW1lc3BhY2VcbmV4cG9ydCBuYW1lc3BhY2UgVlJNU2NoZW1hIHtcbiAgLyoqXG4gICAqIFZSTSBleHRlbnNpb24gaXMgZm9yIDNkIGh1bWFub2lkIGF2YXRhcnMgKGFuZCBtb2RlbHMpIGluIFZSIGFwcGxpY2F0aW9ucy5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgVlJNIHtcbiAgICBibGVuZFNoYXBlTWFzdGVyPzogQmxlbmRTaGFwZTtcbiAgICAvKipcbiAgICAgKiBWZXJzaW9uIG9mIGV4cG9ydGVyIHRoYXQgdnJtIGNyZWF0ZWQuIFVuaVZSTS0wLjUzLjBcbiAgICAgKi9cbiAgICBleHBvcnRlclZlcnNpb24/OiBzdHJpbmc7XG4gICAgZmlyc3RQZXJzb24/OiBGaXJzdFBlcnNvbjtcbiAgICBodW1hbm9pZD86IEh1bWFub2lkO1xuICAgIG1hdGVyaWFsUHJvcGVydGllcz86IE1hdGVyaWFsW107XG4gICAgbWV0YT86IE1ldGE7XG4gICAgc2Vjb25kYXJ5QW5pbWF0aW9uPzogU2Vjb25kYXJ5QW5pbWF0aW9uO1xuICAgIC8qKlxuICAgICAqIFZlcnNpb24gb2YgVlJNIHNwZWNpZmljYXRpb24uIDAuMFxuICAgICAqL1xuICAgIHNwZWNWZXJzaW9uPzogc3RyaW5nO1xuICB9XG5cbiAgLyoqXG4gICAqIEJsZW5kU2hhcGVBdmF0YXIgb2YgVW5pVlJNXG4gICAqL1xuICBleHBvcnQgaW50ZXJmYWNlIEJsZW5kU2hhcGUge1xuICAgIGJsZW5kU2hhcGVHcm91cHM/OiBCbGVuZFNoYXBlR3JvdXBbXTtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZUdyb3VwIHtcbiAgICAvKipcbiAgICAgKiBMb3cgbGV2ZWwgYmxlbmRzaGFwZSByZWZlcmVuY2VzLlxuICAgICAqL1xuICAgIGJpbmRzPzogQmxlbmRTaGFwZUJpbmRbXTtcbiAgICAvKipcbiAgICAgKiAwIG9yIDEuIERvIG5vdCBhbGxvdyBhbiBpbnRlcm1lZGlhdGUgdmFsdWUuIFZhbHVlIHNob3VsZCByb3VuZGVkXG4gICAgICovXG4gICAgaXNCaW5hcnk/OiBib29sZWFuO1xuICAgIC8qKlxuICAgICAqIE1hdGVyaWFsIGFuaW1hdGlvbiByZWZlcmVuY2VzLlxuICAgICAqL1xuICAgIG1hdGVyaWFsVmFsdWVzPzogQmxlbmRTaGFwZU1hdGVyaWFsYmluZFtdO1xuICAgIC8qKlxuICAgICAqIEV4cHJlc3Npb24gbmFtZVxuICAgICAqL1xuICAgIG5hbWU/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUHJlZGVmaW5lZCBFeHByZXNzaW9uIG5hbWVcbiAgICAgKi9cbiAgICBwcmVzZXROYW1lPzogQmxlbmRTaGFwZVByZXNldE5hbWU7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIEJsZW5kU2hhcGVCaW5kIHtcbiAgICBpbmRleD86IG51bWJlcjtcbiAgICBtZXNoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFNraW5uZWRNZXNoUmVuZGVyZXIuU2V0QmxlbmRTaGFwZVdlaWdodFxuICAgICAqL1xuICAgIHdlaWdodD86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZU1hdGVyaWFsYmluZCB7XG4gICAgbWF0ZXJpYWxOYW1lPzogc3RyaW5nO1xuICAgIHByb3BlcnR5TmFtZT86IHN0cmluZztcbiAgICB0YXJnZXRWYWx1ZT86IG51bWJlcltdO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZWRlZmluZWQgRXhwcmVzc2lvbiBuYW1lXG4gICAqL1xuICBleHBvcnQgZW51bSBCbGVuZFNoYXBlUHJlc2V0TmFtZSB7XG4gICAgQSA9ICdhJyxcbiAgICBBbmdyeSA9ICdhbmdyeScsXG4gICAgQmxpbmsgPSAnYmxpbmsnLFxuICAgIEJsaW5rTCA9ICdibGlua19sJyxcbiAgICBCbGlua1IgPSAnYmxpbmtfcicsXG4gICAgRSA9ICdlJyxcbiAgICBGdW4gPSAnZnVuJyxcbiAgICBJID0gJ2knLFxuICAgIEpveSA9ICdqb3knLFxuICAgIExvb2tkb3duID0gJ2xvb2tkb3duJyxcbiAgICBMb29rbGVmdCA9ICdsb29rbGVmdCcsXG4gICAgTG9va3JpZ2h0ID0gJ2xvb2tyaWdodCcsXG4gICAgTG9va3VwID0gJ2xvb2t1cCcsXG4gICAgTmV1dHJhbCA9ICduZXV0cmFsJyxcbiAgICBPID0gJ28nLFxuICAgIFNvcnJvdyA9ICdzb3Jyb3cnLFxuICAgIFUgPSAndScsXG4gICAgVW5rbm93biA9ICd1bmtub3duJyxcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgRmlyc3RQZXJzb24ge1xuICAgIC8qKlxuICAgICAqIFRoZSBib25lIHdob3NlIHJlbmRlcmluZyBzaG91bGQgYmUgdHVybmVkIG9mZiBpbiBmaXJzdC1wZXJzb24gdmlldy4gVXN1YWxseSBIZWFkIGlzXG4gICAgICogc3BlY2lmaWVkLlxuICAgICAqL1xuICAgIGZpcnN0UGVyc29uQm9uZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaGUgdGFyZ2V0IHBvc2l0aW9uIG9mIHRoZSBWUiBoZWFkc2V0IGluIGZpcnN0LXBlcnNvbiB2aWV3LiBJdCBpcyBhc3N1bWVkIHRoYXQgYW4gb2Zmc2V0XG4gICAgICogZnJvbSB0aGUgaGVhZCBib25lIHRvIHRoZSBWUiBoZWFkc2V0IGlzIGFkZGVkLlxuICAgICAqL1xuICAgIGZpcnN0UGVyc29uQm9uZU9mZnNldD86IFZlY3RvcjM7XG4gICAgbG9va0F0SG9yaXpvbnRhbElubmVyPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgbG9va0F0SG9yaXpvbnRhbE91dGVyPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgLyoqXG4gICAgICogRXllIGNvbnRyb2xsZXIgbW9kZS5cbiAgICAgKi9cbiAgICBsb29rQXRUeXBlTmFtZT86IEZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWU7XG4gICAgbG9va0F0VmVydGljYWxEb3duPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgbG9va0F0VmVydGljYWxVcD86IEZpcnN0UGVyc29uRGVncmVlTWFwO1xuICAgIC8qKlxuICAgICAqIFN3aXRjaCBkaXNwbGF5IC8gdW5kaXNwbGF5IGZvciBlYWNoIG1lc2ggaW4gZmlyc3QtcGVyc29uIHZpZXcgb3IgdGhlIG90aGVycy5cbiAgICAgKi9cbiAgICBtZXNoQW5ub3RhdGlvbnM/OiBGaXJzdFBlcnNvbk1lc2hhbm5vdGF0aW9uW107XG4gIH1cblxuICAvKipcbiAgICogRXllIGNvbnRyb2xsZXIgc2V0dGluZy5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgRmlyc3RQZXJzb25EZWdyZWVNYXAge1xuICAgIC8qKlxuICAgICAqIE5vbmUgbGluZWFyIG1hcHBpbmcgcGFyYW1zLiB0aW1lLCB2YWx1ZSwgaW5UYW5nZW50LCBvdXRUYW5nZW50XG4gICAgICovXG4gICAgY3VydmU/OiBudW1iZXJbXTtcbiAgICAvKipcbiAgICAgKiBMb29rIGF0IGlucHV0IGNsYW1wIHJhbmdlIGRlZ3JlZS5cbiAgICAgKi9cbiAgICB4UmFuZ2U/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogTG9vayBhdCBtYXAgcmFuZ2UgZGVncmVlIGZyb20geFJhbmdlLlxuICAgICAqL1xuICAgIHlSYW5nZT86IG51bWJlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeWUgY29udHJvbGxlciBtb2RlLlxuICAgKi9cbiAgZXhwb3J0IGVudW0gRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZSB7XG4gICAgQmxlbmRTaGFwZSA9ICdCbGVuZFNoYXBlJyxcbiAgICBCb25lID0gJ0JvbmUnLFxuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbk1lc2hhbm5vdGF0aW9uIHtcbiAgICBmaXJzdFBlcnNvbkZsYWc/OiBzdHJpbmc7XG4gICAgbWVzaD86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgSHVtYW5vaWQge1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5hcm1TdHJldGNoXG4gICAgICovXG4gICAgYXJtU3RyZXRjaD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24uZmVldFNwYWNpbmdcbiAgICAgKi9cbiAgICBmZWV0U3BhY2luZz86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24uaGFzVHJhbnNsYXRpb25Eb0ZcbiAgICAgKi9cbiAgICBoYXNUcmFuc2xhdGlvbkRvRj86IGJvb2xlYW47XG4gICAgaHVtYW5Cb25lcz86IEh1bWFub2lkQm9uZVtdO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5sZWdTdHJldGNoXG4gICAgICovXG4gICAgbGVnU3RyZXRjaD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24ubG93ZXJBcm1Ud2lzdFxuICAgICAqL1xuICAgIGxvd2VyQXJtVHdpc3Q/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmxvd2VyTGVnVHdpc3RcbiAgICAgKi9cbiAgICBsb3dlckxlZ1R3aXN0PzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi51cHBlckFybVR3aXN0XG4gICAgICovXG4gICAgdXBwZXJBcm1Ud2lzdD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24udXBwZXJMZWdUd2lzdFxuICAgICAqL1xuICAgIHVwcGVyTGVnVHdpc3Q/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIEh1bWFub2lkQm9uZSB7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkxpbWl0LmF4aXNMZW5ndGhcbiAgICAgKi9cbiAgICBheGlzTGVuZ3RoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIEh1bWFuIGJvbmUgbmFtZS5cbiAgICAgKi9cbiAgICBib25lPzogSHVtYW5vaWRCb25lTmFtZTtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQuY2VudGVyXG4gICAgICovXG4gICAgY2VudGVyPzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQubWF4XG4gICAgICovXG4gICAgbWF4PzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQubWluXG4gICAgICovXG4gICAgbWluPzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2Ugbm9kZSBpbmRleFxuICAgICAqL1xuICAgIG5vZGU/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkxpbWl0LnVzZURlZmF1bHRWYWx1ZXNcbiAgICAgKi9cbiAgICB1c2VEZWZhdWx0VmFsdWVzPzogYm9vbGVhbjtcbiAgfVxuXG4gIC8qKlxuICAgKiBIdW1hbiBib25lIG5hbWUuXG4gICAqL1xuICBleHBvcnQgZW51bSBIdW1hbm9pZEJvbmVOYW1lIHtcbiAgICBDaGVzdCA9ICdjaGVzdCcsXG4gICAgSGVhZCA9ICdoZWFkJyxcbiAgICBIaXBzID0gJ2hpcHMnLFxuICAgIEphdyA9ICdqYXcnLFxuICAgIExlZnRFeWUgPSAnbGVmdEV5ZScsXG4gICAgTGVmdEZvb3QgPSAnbGVmdEZvb3QnLFxuICAgIExlZnRIYW5kID0gJ2xlZnRIYW5kJyxcbiAgICBMZWZ0SW5kZXhEaXN0YWwgPSAnbGVmdEluZGV4RGlzdGFsJyxcbiAgICBMZWZ0SW5kZXhJbnRlcm1lZGlhdGUgPSAnbGVmdEluZGV4SW50ZXJtZWRpYXRlJyxcbiAgICBMZWZ0SW5kZXhQcm94aW1hbCA9ICdsZWZ0SW5kZXhQcm94aW1hbCcsXG4gICAgTGVmdExpdHRsZURpc3RhbCA9ICdsZWZ0TGl0dGxlRGlzdGFsJyxcbiAgICBMZWZ0TGl0dGxlSW50ZXJtZWRpYXRlID0gJ2xlZnRMaXR0bGVJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRMaXR0bGVQcm94aW1hbCA9ICdsZWZ0TGl0dGxlUHJveGltYWwnLFxuICAgIExlZnRMb3dlckFybSA9ICdsZWZ0TG93ZXJBcm0nLFxuICAgIExlZnRMb3dlckxlZyA9ICdsZWZ0TG93ZXJMZWcnLFxuICAgIExlZnRNaWRkbGVEaXN0YWwgPSAnbGVmdE1pZGRsZURpc3RhbCcsXG4gICAgTGVmdE1pZGRsZUludGVybWVkaWF0ZSA9ICdsZWZ0TWlkZGxlSW50ZXJtZWRpYXRlJyxcbiAgICBMZWZ0TWlkZGxlUHJveGltYWwgPSAnbGVmdE1pZGRsZVByb3hpbWFsJyxcbiAgICBMZWZ0UmluZ0Rpc3RhbCA9ICdsZWZ0UmluZ0Rpc3RhbCcsXG4gICAgTGVmdFJpbmdJbnRlcm1lZGlhdGUgPSAnbGVmdFJpbmdJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRSaW5nUHJveGltYWwgPSAnbGVmdFJpbmdQcm94aW1hbCcsXG4gICAgTGVmdFNob3VsZGVyID0gJ2xlZnRTaG91bGRlcicsXG4gICAgTGVmdFRodW1iRGlzdGFsID0gJ2xlZnRUaHVtYkRpc3RhbCcsXG4gICAgTGVmdFRodW1iSW50ZXJtZWRpYXRlID0gJ2xlZnRUaHVtYkludGVybWVkaWF0ZScsXG4gICAgTGVmdFRodW1iUHJveGltYWwgPSAnbGVmdFRodW1iUHJveGltYWwnLFxuICAgIExlZnRUb2VzID0gJ2xlZnRUb2VzJyxcbiAgICBMZWZ0VXBwZXJBcm0gPSAnbGVmdFVwcGVyQXJtJyxcbiAgICBMZWZ0VXBwZXJMZWcgPSAnbGVmdFVwcGVyTGVnJyxcbiAgICBOZWNrID0gJ25lY2snLFxuICAgIFJpZ2h0RXllID0gJ3JpZ2h0RXllJyxcbiAgICBSaWdodEZvb3QgPSAncmlnaHRGb290JyxcbiAgICBSaWdodEhhbmQgPSAncmlnaHRIYW5kJyxcbiAgICBSaWdodEluZGV4RGlzdGFsID0gJ3JpZ2h0SW5kZXhEaXN0YWwnLFxuICAgIFJpZ2h0SW5kZXhJbnRlcm1lZGlhdGUgPSAncmlnaHRJbmRleEludGVybWVkaWF0ZScsXG4gICAgUmlnaHRJbmRleFByb3hpbWFsID0gJ3JpZ2h0SW5kZXhQcm94aW1hbCcsXG4gICAgUmlnaHRMaXR0bGVEaXN0YWwgPSAncmlnaHRMaXR0bGVEaXN0YWwnLFxuICAgIFJpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlID0gJ3JpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlJyxcbiAgICBSaWdodExpdHRsZVByb3hpbWFsID0gJ3JpZ2h0TGl0dGxlUHJveGltYWwnLFxuICAgIFJpZ2h0TG93ZXJBcm0gPSAncmlnaHRMb3dlckFybScsXG4gICAgUmlnaHRMb3dlckxlZyA9ICdyaWdodExvd2VyTGVnJyxcbiAgICBSaWdodE1pZGRsZURpc3RhbCA9ICdyaWdodE1pZGRsZURpc3RhbCcsXG4gICAgUmlnaHRNaWRkbGVJbnRlcm1lZGlhdGUgPSAncmlnaHRNaWRkbGVJbnRlcm1lZGlhdGUnLFxuICAgIFJpZ2h0TWlkZGxlUHJveGltYWwgPSAncmlnaHRNaWRkbGVQcm94aW1hbCcsXG4gICAgUmlnaHRSaW5nRGlzdGFsID0gJ3JpZ2h0UmluZ0Rpc3RhbCcsXG4gICAgUmlnaHRSaW5nSW50ZXJtZWRpYXRlID0gJ3JpZ2h0UmluZ0ludGVybWVkaWF0ZScsXG4gICAgUmlnaHRSaW5nUHJveGltYWwgPSAncmlnaHRSaW5nUHJveGltYWwnLFxuICAgIFJpZ2h0U2hvdWxkZXIgPSAncmlnaHRTaG91bGRlcicsXG4gICAgUmlnaHRUaHVtYkRpc3RhbCA9ICdyaWdodFRodW1iRGlzdGFsJyxcbiAgICBSaWdodFRodW1iSW50ZXJtZWRpYXRlID0gJ3JpZ2h0VGh1bWJJbnRlcm1lZGlhdGUnLFxuICAgIFJpZ2h0VGh1bWJQcm94aW1hbCA9ICdyaWdodFRodW1iUHJveGltYWwnLFxuICAgIFJpZ2h0VG9lcyA9ICdyaWdodFRvZXMnLFxuICAgIFJpZ2h0VXBwZXJBcm0gPSAncmlnaHRVcHBlckFybScsXG4gICAgUmlnaHRVcHBlckxlZyA9ICdyaWdodFVwcGVyTGVnJyxcbiAgICBTcGluZSA9ICdzcGluZScsXG4gICAgVXBwZXJDaGVzdCA9ICd1cHBlckNoZXN0JyxcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgTWF0ZXJpYWwge1xuICAgIGZsb2F0UHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gICAga2V5d29yZE1hcD86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gICAgbmFtZT86IHN0cmluZztcbiAgICByZW5kZXJRdWV1ZT86IG51bWJlcjtcbiAgICBzaGFkZXI/OiBzdHJpbmc7XG4gICAgdGFnTWFwPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICB0ZXh0dXJlUHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gICAgdmVjdG9yUHJvcGVydGllcz86IHsgW2tleTogc3RyaW5nXTogYW55IH07XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIE1ldGEge1xuICAgIC8qKlxuICAgICAqIEEgcGVyc29uIHdobyBjYW4gcGVyZm9ybSB3aXRoIHRoaXMgYXZhdGFyXG4gICAgICovXG4gICAgYWxsb3dlZFVzZXJOYW1lPzogTWV0YUFsbG93ZWRVc2VyTmFtZTtcbiAgICAvKipcbiAgICAgKiBBdXRob3Igb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgYXV0aG9yPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIEZvciBjb21tZXJjaWFsIHVzZVxuICAgICAqL1xuICAgIGNvbW1lcmNpYWxVc3NhZ2VOYW1lPzogTWV0YVVzc2FnZU5hbWU7XG4gICAgLyoqXG4gICAgICogQ29udGFjdCBJbmZvcm1hdGlvbiBvZiBWUk0gbW9kZWwgYXV0aG9yXG4gICAgICovXG4gICAgY29udGFjdEluZm9ybWF0aW9uPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIExpY2Vuc2UgdHlwZVxuICAgICAqL1xuICAgIGxpY2Vuc2VOYW1lPzogTWV0YUxpY2Vuc2VOYW1lO1xuICAgIC8qKlxuICAgICAqIElmIOKAnE90aGVy4oCdIGlzIHNlbGVjdGVkLCBwdXQgdGhlIFVSTCBsaW5rIG9mIHRoZSBsaWNlbnNlIGRvY3VtZW50IGhlcmUuXG4gICAgICovXG4gICAgb3RoZXJMaWNlbnNlVXJsPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIElmIHRoZXJlIGFyZSBhbnkgY29uZGl0aW9ucyBub3QgbWVudGlvbmVkIGFib3ZlLCBwdXQgdGhlIFVSTCBsaW5rIG9mIHRoZSBsaWNlbnNlIGRvY3VtZW50XG4gICAgICogaGVyZS5cbiAgICAgKi9cbiAgICBvdGhlclBlcm1pc3Npb25Vcmw/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUmVmZXJlbmNlIG9mIFZSTSBtb2RlbFxuICAgICAqL1xuICAgIHJlZmVyZW5jZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQZXJtaXNzaW9uIHRvIHBlcmZvcm0gc2V4dWFsIGFjdHMgd2l0aCB0aGlzIGF2YXRhclxuICAgICAqL1xuICAgIHNleHVhbFVzc2FnZU5hbWU/OiBNZXRhVXNzYWdlTmFtZTtcbiAgICAvKipcbiAgICAgKiBUaHVtYm5haWwgb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgdGV4dHVyZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaXRsZSBvZiBWUk0gbW9kZWxcbiAgICAgKi9cbiAgICB0aXRsZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBWZXJzaW9uIG9mIFZSTSBtb2RlbFxuICAgICAqL1xuICAgIHZlcnNpb24/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHZpb2xlbnQgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAgICovXG4gICAgdmlvbGVudFVzc2FnZU5hbWU/OiBNZXRhVXNzYWdlTmFtZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIHBlcnNvbiB3aG8gY2FuIHBlcmZvcm0gd2l0aCB0aGlzIGF2YXRhclxuICAgKi9cbiAgZXhwb3J0IGVudW0gTWV0YUFsbG93ZWRVc2VyTmFtZSB7XG4gICAgRXZlcnlvbmUgPSAnRXZlcnlvbmUnLFxuICAgIEV4cGxpY2l0bHlMaWNlbnNlZFBlcnNvbiA9ICdFeHBsaWNpdGx5TGljZW5zZWRQZXJzb24nLFxuICAgIE9ubHlBdXRob3IgPSAnT25seUF1dGhvcicsXG4gIH1cblxuICAvKipcbiAgICogRm9yIGNvbW1lcmNpYWwgdXNlXG4gICAqXG4gICAqIFBlcm1pc3Npb24gdG8gcGVyZm9ybSBzZXh1YWwgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAqXG4gICAqIFBlcm1pc3Npb24gdG8gcGVyZm9ybSB2aW9sZW50IGFjdHMgd2l0aCB0aGlzIGF2YXRhclxuICAgKi9cbiAgZXhwb3J0IGVudW0gTWV0YVVzc2FnZU5hbWUge1xuICAgIEFsbG93ID0gJ0FsbG93JyxcbiAgICBEaXNhbGxvdyA9ICdEaXNhbGxvdycsXG4gIH1cblxuICAvKipcbiAgICogTGljZW5zZSB0eXBlXG4gICAqL1xuICBleHBvcnQgZW51bSBNZXRhTGljZW5zZU5hbWUge1xuICAgIENjMCA9ICdDQzAnLFxuICAgIENjQnkgPSAnQ0NfQlknLFxuICAgIENjQnlOYyA9ICdDQ19CWV9OQycsXG4gICAgQ2NCeU5jTmQgPSAnQ0NfQllfTkNfTkQnLFxuICAgIENjQnlOY1NhID0gJ0NDX0JZX05DX1NBJyxcbiAgICBDY0J5TmQgPSAnQ0NfQllfTkQnLFxuICAgIENjQnlTYSA9ICdDQ19CWV9TQScsXG4gICAgT3RoZXIgPSAnT3RoZXInLFxuICAgIFJlZGlzdHJpYnV0aW9uUHJvaGliaXRlZCA9ICdSZWRpc3RyaWJ1dGlvbl9Qcm9oaWJpdGVkJyxcbiAgfVxuXG4gIC8qKlxuICAgKiBUaGUgc2V0dGluZyBvZiBhdXRvbWF0aWMgYW5pbWF0aW9uIG9mIHN0cmluZy1saWtlIG9iamVjdHMgc3VjaCBhcyB0YWlscyBhbmQgaGFpcnMuXG4gICAqL1xuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvbiB7XG4gICAgYm9uZUdyb3Vwcz86IFNlY29uZGFyeUFuaW1hdGlvblNwcmluZ1tdO1xuICAgIGNvbGxpZGVyR3JvdXBzPzogU2Vjb25kYXJ5QW5pbWF0aW9uQ29sbGlkZXJncm91cFtdO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb25TcHJpbmcge1xuICAgIC8qKlxuICAgICAqIFNwZWNpZnkgdGhlIG5vZGUgaW5kZXggb2YgdGhlIHJvb3QgYm9uZSBvZiB0aGUgc3dheWluZyBvYmplY3QuXG4gICAgICovXG4gICAgYm9uZXM/OiBudW1iZXJbXTtcbiAgICAvKipcbiAgICAgKiBUaGUgcmVmZXJlbmNlIHBvaW50IG9mIGEgc3dheWluZyBvYmplY3QgY2FuIGJlIHNldCBhdCBhbnkgbG9jYXRpb24gZXhjZXB0IHRoZSBvcmlnaW4uXG4gICAgICogV2hlbiBpbXBsZW1lbnRpbmcgVUkgbW92aW5nIHdpdGggd2FycCwgdGhlIHBhcmVudCBub2RlIHRvIG1vdmUgd2l0aCB3YXJwIGNhbiBiZSBzcGVjaWZpZWRcbiAgICAgKiBpZiB5b3UgZG9uJ3Qgd2FudCB0byBtYWtlIHRoZSBvYmplY3Qgc3dheWluZyB3aXRoIHdhcnAgbW92ZW1lbnQuXG4gICAgICovXG4gICAgY2VudGVyPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFNwZWNpZnkgdGhlIGluZGV4IG9mIHRoZSBjb2xsaWRlciBncm91cCBmb3IgY29sbGlzaW9ucyB3aXRoIHN3YXlpbmcgb2JqZWN0cy5cbiAgICAgKi9cbiAgICBjb2xsaWRlckdyb3Vwcz86IG51bWJlcltdO1xuICAgIC8qKlxuICAgICAqIEFubm90YXRpb24gY29tbWVudFxuICAgICAqL1xuICAgIGNvbW1lbnQ/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogVGhlIHJlc2lzdGFuY2UgKGRlY2VsZXJhdGlvbikgb2YgYXV0b21hdGljIGFuaW1hdGlvbi5cbiAgICAgKi9cbiAgICBkcmFnRm9yY2U/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVGhlIGRpcmVjdGlvbiBvZiBncmF2aXR5LiBTZXQgKDAsIC0xLCAwKSBmb3Igc2ltdWxhdGluZyB0aGUgZ3Jhdml0eS4gU2V0ICgxLCAwLCAwKSBmb3JcbiAgICAgKiBzaW11bGF0aW5nIHRoZSB3aW5kLlxuICAgICAqL1xuICAgIGdyYXZpdHlEaXI/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFRoZSBzdHJlbmd0aCBvZiBncmF2aXR5LlxuICAgICAqL1xuICAgIGdyYXZpdHlQb3dlcj86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaGUgcmFkaXVzIG9mIHRoZSBzcGhlcmUgdXNlZCBmb3IgdGhlIGNvbGxpc2lvbiBkZXRlY3Rpb24gd2l0aCBjb2xsaWRlcnMuXG4gICAgICovXG4gICAgaGl0UmFkaXVzPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSByZXNpbGllbmNlIG9mIHRoZSBzd2F5aW5nIG9iamVjdCAodGhlIHBvd2VyIG9mIHJldHVybmluZyB0byB0aGUgaW5pdGlhbCBwb3NlKS5cbiAgICAgKi9cbiAgICBzdGlmZmluZXNzPzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlcmdyb3VwIHtcbiAgICBjb2xsaWRlcnM/OiBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlcltdO1xuICAgIC8qKlxuICAgICAqIFRoZSBub2RlIG9mIHRoZSBjb2xsaWRlciBncm91cCBmb3Igc2V0dGluZyB1cCBjb2xsaXNpb24gZGV0ZWN0aW9ucy5cbiAgICAgKi9cbiAgICBub2RlPzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlciB7XG4gICAgLyoqXG4gICAgICogVGhlIGxvY2FsIGNvb3JkaW5hdGUgZnJvbSB0aGUgbm9kZSBvZiB0aGUgY29sbGlkZXIgZ3JvdXAuXG4gICAgICovXG4gICAgb2Zmc2V0PzogVmVjdG9yMztcbiAgICAvKipcbiAgICAgKiBUaGUgcmFkaXVzIG9mIHRoZSBjb2xsaWRlci5cbiAgICAgKi9cbiAgICByYWRpdXM/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFZlY3RvcjMge1xuICAgIHg/OiBudW1iZXI7XG4gICAgeT86IG51bWJlcjtcbiAgICB6PzogbnVtYmVyO1xuICB9XG59XG4iLCJpbXBvcnQgdHlwZSB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB0eXBlIHsgR0xURlByaW1pdGl2ZSwgR0xURlNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcblxuZnVuY3Rpb24gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmOiBHTFRGLCBub2RlSW5kZXg6IG51bWJlciwgbm9kZTogVEhSRUUuT2JqZWN0M0QpOiBHTFRGUHJpbWl0aXZlW10gfCBudWxsIHtcbiAgLyoqXG4gICAqIExldCdzIGxpc3QgdXAgZXZlcnkgcG9zc2libGUgcGF0dGVybnMgdGhhdCBwYXJzZWQgZ2x0ZiBub2RlcyB3aXRoIGEgbWVzaCBjYW4gaGF2ZSwsLFxuICAgKlxuICAgKiBcIipcIiBpbmRpY2F0ZXMgdGhhdCB0aG9zZSBtZXNoZXMgc2hvdWxkIGJlIGxpc3RlZCB1cCB1c2luZyB0aGlzIGZ1bmN0aW9uXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBhIHNpZ25sZSBwcmltaXRpdmUpXG4gICAqXG4gICAqIC0gYFRIUkVFLk1lc2hgOiBUaGUgb25seSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKlxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcylcbiAgICpcbiAgICogLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBBTkQgKGEgY2hpbGQgd2l0aCBhIG1lc2gsIGEgc2luZ2xlIHByaW1pdGl2ZSlcbiAgICpcbiAgICogLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIGEgTUVTSCBPRiBUSEUgQ0hJTERcbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcylcbiAgICpcbiAgICogLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiBhIE1FU0ggT0YgVEhFIENISUxEXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggb2YgdGhlIGNoaWxkXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggb2YgdGhlIGNoaWxkICgyKVxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQlVUIHRoZSBub2RlIGlzIGEgYm9uZVxuICAgKlxuICAgKiAtIGBUSFJFRS5Cb25lYDogVGhlIHJvb3Qgb2YgdGhlIG5vZGUsIGFzIGEgYm9uZVxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQlVUIHRoZSBub2RlIGlzIGEgYm9uZVxuICAgKlxuICAgKiAtIGBUSFJFRS5Cb25lYDogVGhlIHJvb3Qgb2YgdGhlIG5vZGUsIGFzIGEgYm9uZVxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIGEgTUVTSCBPRiBUSEUgQ0hJTERcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGRcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGQgKDIpXG4gICAqXG4gICAqIC4uLkkgd2lsbCB0YWtlIGEgc3RyYXRlZ3kgdGhhdCB0cmF2ZXJzZXMgdGhlIHJvb3Qgb2YgdGhlIG5vZGUgYW5kIHRha2UgZmlyc3QgKHByaW1pdGl2ZUNvdW50KSBtZXNoZXMuXG4gICAqL1xuXG4gIC8vIE1ha2Ugc3VyZSB0aGF0IHRoZSBub2RlIGhhcyBhIG1lc2hcbiAgY29uc3Qgc2NoZW1hTm9kZTogR0xURlNjaGVtYS5Ob2RlID0gZ2x0Zi5wYXJzZXIuanNvbi5ub2Rlc1tub2RlSW5kZXhdO1xuICBjb25zdCBtZXNoSW5kZXggPSBzY2hlbWFOb2RlLm1lc2g7XG4gIGlmIChtZXNoSW5kZXggPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gSG93IG1hbnkgcHJpbWl0aXZlcyB0aGUgbWVzaCBoYXM/XG4gIGNvbnN0IHNjaGVtYU1lc2g6IEdMVEZTY2hlbWEuTWVzaCA9IGdsdGYucGFyc2VyLmpzb24ubWVzaGVzW21lc2hJbmRleF07XG4gIGNvbnN0IHByaW1pdGl2ZUNvdW50ID0gc2NoZW1hTWVzaC5wcmltaXRpdmVzLmxlbmd0aDtcblxuICAvLyBUcmF2ZXJzZSB0aGUgbm9kZSBhbmQgdGFrZSBmaXJzdCAocHJpbWl0aXZlQ291bnQpIG1lc2hlc1xuICBjb25zdCBwcmltaXRpdmVzOiBHTFRGUHJpbWl0aXZlW10gPSBbXTtcbiAgbm9kZS50cmF2ZXJzZSgob2JqZWN0KSA9PiB7XG4gICAgaWYgKHByaW1pdGl2ZXMubGVuZ3RoIDwgcHJpbWl0aXZlQ291bnQpIHtcbiAgICAgIGlmICgob2JqZWN0IGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICAgIHByaW1pdGl2ZXMucHVzaChvYmplY3QgYXMgR0xURlByaW1pdGl2ZSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcHJpbWl0aXZlcztcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHByaW1pdGl2ZXMgKCBgVEhSRUUuTWVzaFtdYCApIG9mIGEgbm9kZSBmcm9tIGEgbG9hZGVkIEdMVEYuXG4gKiBUaGUgbWFpbiBwdXJwb3NlIG9mIHRoaXMgZnVuY3Rpb24gaXMgdG8gZGlzdGluZ3Vpc2ggcHJpbWl0aXZlcyBhbmQgY2hpbGRyZW4gZnJvbSBhIG5vZGUgdGhhdCBoYXMgYm90aCBtZXNoZXMgYW5kIGNoaWxkcmVuLlxuICpcbiAqIEl0IHV0aWxpemVzIHRoZSBiZWhhdmlvciB0aGF0IEdMVEZMb2FkZXIgYWRkcyBtZXNoIHByaW1pdGl2ZXMgdG8gdGhlIG5vZGUgb2JqZWN0ICggYFRIUkVFLkdyb3VwYCApIGZpcnN0IHRoZW4gYWRkcyBpdHMgY2hpbGRyZW4uXG4gKlxuICogQHBhcmFtIGdsdGYgQSBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAqIEBwYXJhbSBub2RlSW5kZXggVGhlIGluZGV4IG9mIHRoZSBub2RlXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZShnbHRmOiBHTFRGLCBub2RlSW5kZXg6IG51bWJlcik6IFByb21pc2U8R0xURlByaW1pdGl2ZVtdIHwgbnVsbD4ge1xuICBjb25zdCBub2RlOiBUSFJFRS5PYmplY3QzRCA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBub2RlSW5kZXgpO1xuICByZXR1cm4gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmLCBub2RlSW5kZXgsIG5vZGUpO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgcHJpbWl0aXZlcyAoIGBUSFJFRS5NZXNoW11gICkgb2Ygbm9kZXMgZnJvbSBhIGxvYWRlZCBHTFRGLlxuICogU2VlIHtAbGluayBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZX0gZm9yIG1vcmUgZGV0YWlscy5cbiAqXG4gKiBJdCByZXR1cm5zIGEgbWFwIGZyb20gbm9kZSBpbmRleCB0byBleHRyYWN0aW9uIHJlc3VsdC5cbiAqIElmIGEgbm9kZSBkb2VzIG5vdCBoYXZlIGEgbWVzaCwgdGhlIGVudHJ5IGZvciB0aGUgbm9kZSB3aWxsIG5vdCBiZSBwdXQgaW4gdGhlIHJldHVybmluZyBtYXAuXG4gKlxuICogQHBhcmFtIGdsdGYgQSBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyhnbHRmOiBHTFRGKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBHTFRGUHJpbWl0aXZlW10+PiB7XG4gIGNvbnN0IG5vZGVzOiBUSFJFRS5PYmplY3QzRFtdID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jaWVzKCdub2RlJyk7XG4gIGNvbnN0IG1hcCA9IG5ldyBNYXA8bnVtYmVyLCBHTFRGUHJpbWl0aXZlW10+KCk7XG5cbiAgbm9kZXMuZm9yRWFjaCgobm9kZSwgaW5kZXgpID0+IHtcbiAgICBjb25zdCByZXN1bHQgPSBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsKGdsdGYsIGluZGV4LCBub2RlKTtcbiAgICBpZiAocmVzdWx0ICE9IG51bGwpIHtcbiAgICAgIG1hcC5zZXQoaW5kZXgsIHJlc3VsdCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gbWFwO1xufVxuIiwiZXhwb3J0IGZ1bmN0aW9uIHJlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKG5hbWVbMF0gIT09ICdfJykge1xuICAgIGNvbnNvbGUud2FybihgcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eTogR2l2ZW4gcHJvcGVydHkgbmFtZSBcIiR7bmFtZX1cIiBtaWdodCBiZSBpbnZhbGlkYCk7XG4gICAgcmV0dXJuIG5hbWU7XG4gIH1cbiAgbmFtZSA9IG5hbWUuc3Vic3RyaW5nKDEpO1xuXG4gIGlmICghL1tBLVpdLy50ZXN0KG5hbWVbMF0pKSB7XG4gICAgY29uc29sZS53YXJuKGByZW5hbWVNYXRlcmlhbFByb3BlcnR5OiBHaXZlbiBwcm9wZXJ0eSBuYW1lIFwiJHtuYW1lfVwiIG1pZ2h0IGJlIGludmFsaWRgKTtcbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuICByZXR1cm4gbmFtZVswXS50b0xvd2VyQ2FzZSgpICsgbmFtZS5zdWJzdHJpbmcoMSk7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogQ2xhbXAgYW4gaW5wdXQgbnVtYmVyIHdpdGhpbiBbIGAwLjBgIC0gYDEuMGAgXS5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGlucHV0IHZhbHVlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYXR1cmF0ZSh2YWx1ZTogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIE1hdGgubWF4KE1hdGgubWluKHZhbHVlLCAxLjApLCAwLjApO1xufVxuXG4vKipcbiAqIE1hcCB0aGUgcmFuZ2Ugb2YgYW4gaW5wdXQgdmFsdWUgZnJvbSBbIGBtaW5gIC0gYG1heGAgXSB0byBbIGAwLjBgIC0gYDEuMGAgXS5cbiAqIElmIGlucHV0IHZhbHVlIGlzIGxlc3MgdGhhbiBgbWluYCAsIGl0IHJldHVybnMgYDAuMGAuXG4gKiBJZiBpbnB1dCB2YWx1ZSBpcyBncmVhdGVyIHRoYW4gYG1heGAgLCBpdCByZXR1cm5zIGAxLjBgLlxuICpcbiAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9tYXRoL01hdGguc21vb3Roc3RlcFxuICpcbiAqIEBwYXJhbSB4IFRoZSB2YWx1ZSB0aGF0IHdpbGwgYmUgbWFwcGVkIGludG8gdGhlIHNwZWNpZmllZCByYW5nZVxuICogQHBhcmFtIG1pbiBNaW5pbXVtIHZhbHVlIG9mIHRoZSByYW5nZVxuICogQHBhcmFtIG1heCBNYXhpbXVtIHZhbHVlIG9mIHRoZSByYW5nZVxuICovXG5leHBvcnQgZnVuY3Rpb24gbGluc3RlcCh4OiBudW1iZXIsIG1pbjogbnVtYmVyLCBtYXg6IG51bWJlcik6IG51bWJlciB7XG4gIGlmICh4IDw9IG1pbikgcmV0dXJuIDA7XG4gIGlmICh4ID49IG1heCkgcmV0dXJuIDE7XG5cbiAgcmV0dXJuICh4IC0gbWluKSAvIChtYXggLSBtaW4pO1xufVxuXG5jb25zdCBfcG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3NjYWxlID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF9yb3RhdGlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5cbi8qKlxuICogRXh0cmFjdCB3b3JsZCBwb3NpdGlvbiBvZiBhbiBvYmplY3QgZnJvbSBpdHMgd29ybGQgc3BhY2UgbWF0cml4LCBpbiBjaGVhcGVyIHdheS5cbiAqXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcbiAqIEBwYXJhbSBvdXQgVGFyZ2V0IHZlY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRQb3NpdGlvbkxpdGUob2JqZWN0OiBUSFJFRS5PYmplY3QzRCwgb3V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gIG9iamVjdC5tYXRyaXhXb3JsZC5kZWNvbXBvc2Uob3V0LCBfcm90YXRpb24sIF9zY2FsZSk7XG4gIHJldHVybiBvdXQ7XG59XG5cbi8qKlxuICogRXh0cmFjdCB3b3JsZCBzY2FsZSBvZiBhbiBvYmplY3QgZnJvbSBpdHMgd29ybGQgc3BhY2UgbWF0cml4LCBpbiBjaGVhcGVyIHdheS5cbiAqXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcbiAqIEBwYXJhbSBvdXQgVGFyZ2V0IHZlY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRTY2FsZUxpdGUob2JqZWN0OiBUSFJFRS5PYmplY3QzRCwgb3V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gIG9iamVjdC5tYXRyaXhXb3JsZC5kZWNvbXBvc2UoX3Bvc2l0aW9uLCBfcm90YXRpb24sIG91dCk7XG4gIHJldHVybiBvdXQ7XG59XG5cbi8qKlxuICogRXh0cmFjdCB3b3JsZCByb3RhdGlvbiBvZiBhbiBvYmplY3QgZnJvbSBpdHMgd29ybGQgc3BhY2UgbWF0cml4LCBpbiBjaGVhcGVyIHdheS5cbiAqXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcbiAqIEBwYXJhbSBvdXQgVGFyZ2V0IHZlY3RvclxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlF1YXRlcm5pb24pOiBUSFJFRS5RdWF0ZXJuaW9uIHtcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShfcG9zaXRpb24sIG91dCwgX3NjYWxlKTtcbiAgcmV0dXJuIG91dDtcbn1cbiIsImltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHNhdHVyYXRlIH0gZnJvbSAnLi4vdXRpbHMvbWF0aCc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlR3JvdXAgfSBmcm9tICcuL1ZSTUJsZW5kU2hhcGVHcm91cCc7XG5cbmV4cG9ydCBjbGFzcyBWUk1CbGVuZFNoYXBlUHJveHkge1xuICAvKipcbiAgICogTGlzdCBvZiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZUdyb3VwczogeyBbbmFtZTogc3RyaW5nXTogVlJNQmxlbmRTaGFwZUdyb3VwIH0gPSB7fTtcblxuICAvKipcbiAgICogQSBtYXAgZnJvbSBbW1ZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV1dIHRvIGl0cyBhY3R1YWwgYmxlbmQgc2hhcGUgbmFtZS5cbiAgICovXG4gIHByaXZhdGUgcmVhZG9ubHkgX2JsZW5kU2hhcGVQcmVzZXRNYXA6IHsgW3ByZXNldE5hbWUgaW4gVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXT86IHN0cmluZyB9ID0ge307XG5cbiAgLyoqXG4gICAqIEEgbGlzdCBvZiBuYW1lIG9mIHVua25vd24gYmxlbmQgc2hhcGVzLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfdW5rbm93bkdyb3VwTmFtZXM6IHN0cmluZ1tdID0gW107XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1CbGVuZFNoYXBlLlxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIGRvIG5vdGhpbmdcbiAgfVxuXG4gIC8qKlxuICAgKiBMaXN0IG9mIG5hbWUgb2YgcmVnaXN0ZXJlZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICovXG4gIHB1YmxpYyBnZXQgZXhwcmVzc2lvbnMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiBPYmplY3Qua2V5cyh0aGlzLl9ibGVuZFNoYXBlR3JvdXBzKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIG1hcCBmcm9tIFtbVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXV0gdG8gaXRzIGFjdHVhbCBibGVuZCBzaGFwZSBuYW1lLlxuICAgKi9cbiAgcHVibGljIGdldCBibGVuZFNoYXBlUHJlc2V0TWFwKCk6IHsgW3ByZXNldE5hbWUgaW4gVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXT86IHN0cmluZyB9IHtcbiAgICByZXR1cm4gdGhpcy5fYmxlbmRTaGFwZVByZXNldE1hcDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGxpc3Qgb2YgbmFtZSBvZiB1bmtub3duIGJsZW5kIHNoYXBlcy5cbiAgICovXG4gIHB1YmxpYyBnZXQgdW5rbm93bkdyb3VwTmFtZXMoKTogc3RyaW5nW10ge1xuICAgIHJldHVybiB0aGlzLl91bmtub3duR3JvdXBOYW1lcztcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gcmVnaXN0ZXJlZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICovXG4gIHB1YmxpYyBnZXRCbGVuZFNoYXBlR3JvdXAobmFtZTogc3RyaW5nIHwgVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lKTogVlJNQmxlbmRTaGFwZUdyb3VwIHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBwcmVzZXROYW1lID0gdGhpcy5fYmxlbmRTaGFwZVByZXNldE1hcFtuYW1lIGFzIFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV07XG4gICAgY29uc3QgY29udHJvbGxlciA9IHByZXNldE5hbWUgPyB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW3ByZXNldE5hbWVdIDogdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXTtcbiAgICBpZiAoIWNvbnRyb2xsZXIpIHtcbiAgICAgIGNvbnNvbGUud2Fybihgbm8gYmxlbmQgc2hhcGUgZm91bmQgYnkgJHtuYW1lfWApO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGNvbnRyb2xsZXI7XG4gIH1cblxuICAvKipcbiAgICogUmVnaXN0ZXIgYSBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ29ydXBcbiAgICogQHBhcmFtIGNvbnRyb2xsZXIgVlJNQmxlbmRTaGFwZUNvbnRyb2xsZXIgdGhhdCBkZXNjcmliZXMgdGhlIGJsZW5kIHNoYXBlIGdyb3VwXG4gICAqL1xuICBwdWJsaWMgcmVnaXN0ZXJCbGVuZFNoYXBlR3JvdXAoXG4gICAgbmFtZTogc3RyaW5nLFxuICAgIHByZXNldE5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHVuZGVmaW5lZCxcbiAgICBjb250cm9sbGVyOiBWUk1CbGVuZFNoYXBlR3JvdXAsXG4gICk6IHZvaWQge1xuICAgIHRoaXMuX2JsZW5kU2hhcGVHcm91cHNbbmFtZV0gPSBjb250cm9sbGVyO1xuICAgIGlmIChwcmVzZXROYW1lKSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJlc2V0TWFwW3ByZXNldE5hbWVdID0gbmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fdW5rbm93bkdyb3VwTmFtZXMucHVzaChuYW1lKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgd2VpZ2h0IG9mIHNwZWNpZmllZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICovXG4gIHB1YmxpYyBnZXRWYWx1ZShuYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5nZXRCbGVuZFNoYXBlR3JvdXAobmFtZSk7XG4gICAgcmV0dXJuIGNvbnRyb2xsZXI/LndlaWdodCA/PyBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhIHdlaWdodCB0byBzcGVjaWZpZWQgYmxlbmQgc2hhcGUgZ3JvdXAuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJsZW5kIHNoYXBlIGdyb3VwXG4gICAqIEBwYXJhbSB3ZWlnaHQgV2VpZ2h0XG4gICAqL1xuICBwdWJsaWMgc2V0VmFsdWUobmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgc3RyaW5nLCB3ZWlnaHQ6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmdldEJsZW5kU2hhcGVHcm91cChuYW1lKTtcbiAgICBpZiAoY29udHJvbGxlcikge1xuICAgICAgY29udHJvbGxlci53ZWlnaHQgPSBzYXR1cmF0ZSh3ZWlnaHQpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgYSB0cmFjayBuYW1lIG9mIHNwZWNpZmllZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICogVGhpcyB0cmFjayBuYW1lIGlzIG5lZWRlZCB0byBtYW5pcHVsYXRlIGl0cyBibGVuZCBzaGFwZSBncm91cCB2aWEga2V5ZnJhbWUgYW5pbWF0aW9ucy5cbiAgICpcbiAgICogQGV4YW1wbGUgTWFuaXB1bGF0ZSBhIGJsZW5kIHNoYXBlIGdyb3VwIHVzaW5nIGtleWZyYW1lIGFuaW1hdGlvblxuICAgKiBgYGBqc1xuICAgKiBjb25zdCB0cmFja05hbWUgPSB2cm0uYmxlbmRTaGFwZVByb3h5LmdldEJsZW5kU2hhcGVUcmFja05hbWUoIFRIUkVFLlZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5CbGluayApO1xuICAgKiBjb25zdCB0cmFjayA9IG5ldyBUSFJFRS5OdW1iZXJLZXlmcmFtZVRyYWNrKFxuICAgKiAgIG5hbWUsXG4gICAqICAgWyAwLjAsIDAuNSwgMS4wIF0sIC8vIHRpbWVzXG4gICAqICAgWyAwLjAsIDEuMCwgMC4wIF0gLy8gdmFsdWVzXG4gICAqICk7XG4gICAqXG4gICAqIGNvbnN0IGNsaXAgPSBuZXcgVEhSRUUuQW5pbWF0aW9uQ2xpcChcbiAgICogICAnYmxpbmsnLCAvLyBuYW1lXG4gICAqICAgMS4wLCAvLyBkdXJhdGlvblxuICAgKiAgIFsgdHJhY2sgXSAvLyB0cmFja3NcbiAgICogKTtcbiAgICpcbiAgICogY29uc3QgbWl4ZXIgPSBuZXcgVEhSRUUuQW5pbWF0aW9uTWl4ZXIoIHZybS5zY2VuZSApO1xuICAgKiBjb25zdCBhY3Rpb24gPSBtaXhlci5jbGlwQWN0aW9uKCBjbGlwICk7XG4gICAqIGFjdGlvbi5wbGF5KCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxuICAgKi9cbiAgcHVibGljIGdldEJsZW5kU2hhcGVUcmFja05hbWUobmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgY29udHJvbGxlciA9IHRoaXMuZ2V0QmxlbmRTaGFwZUdyb3VwKG5hbWUpO1xuICAgIHJldHVybiBjb250cm9sbGVyID8gYCR7Y29udHJvbGxlci5uYW1lfS53ZWlnaHRgIDogbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgZXZlcnkgYmxlbmQgc2hhcGUgZ3JvdXBzLlxuICAgKi9cbiAgcHVibGljIHVwZGF0ZSgpOiB2b2lkIHtcbiAgICBPYmplY3Qua2V5cyh0aGlzLl9ibGVuZFNoYXBlR3JvdXBzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXTtcbiAgICAgIGNvbnRyb2xsZXIuY2xlYXJBcHBsaWVkV2VpZ2h0KCk7XG4gICAgfSk7XG5cbiAgICBPYmplY3Qua2V5cyh0aGlzLl9ibGVuZFNoYXBlR3JvdXBzKS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXTtcbiAgICAgIGNvbnRyb2xsZXIuYXBwbHlXZWlnaHQoKTtcbiAgICB9KTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgR0xURlNjaGVtYSwgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyByZW5hbWVNYXRlcmlhbFByb3BlcnR5IH0gZnJvbSAnLi4vdXRpbHMvcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eSc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlR3JvdXAgfSBmcm9tICcuL1ZSTUJsZW5kU2hhcGVHcm91cCc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuL1ZSTUJsZW5kU2hhcGVQcm94eSc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1CbGVuZFNoYXBlXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNQmxlbmRTaGFwZUltcG9ydGVyIHtcbiAgLyoqXG4gICAqIEltcG9ydCBhIFtbVlJNQmxlbmRTaGFwZV1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1CbGVuZFNoYXBlUHJveHkgfCBudWxsPiB7XG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XG4gICAgaWYgKCF2cm1FeHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHNjaGVtYUJsZW5kU2hhcGU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlIHwgdW5kZWZpbmVkID0gdnJtRXh0LmJsZW5kU2hhcGVNYXN0ZXI7XG4gICAgaWYgKCFzY2hlbWFCbGVuZFNoYXBlKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBibGVuZFNoYXBlID0gbmV3IFZSTUJsZW5kU2hhcGVQcm94eSgpO1xuXG4gICAgY29uc3QgYmxlbmRTaGFwZUdyb3VwczogVlJNU2NoZW1hLkJsZW5kU2hhcGVHcm91cFtdIHwgdW5kZWZpbmVkID0gc2NoZW1hQmxlbmRTaGFwZS5ibGVuZFNoYXBlR3JvdXBzO1xuICAgIGlmICghYmxlbmRTaGFwZUdyb3Vwcykge1xuICAgICAgcmV0dXJuIGJsZW5kU2hhcGU7XG4gICAgfVxuXG4gICAgY29uc3QgYmxlbmRTaGFwZVByZXNldE1hcDogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0gPSB7fTtcblxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgYmxlbmRTaGFwZUdyb3Vwcy5tYXAoYXN5bmMgKHNjaGVtYUdyb3VwKSA9PiB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBzY2hlbWFHcm91cC5uYW1lO1xuICAgICAgICBpZiAobmFtZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdWUk1CbGVuZFNoYXBlSW1wb3J0ZXI6IE9uZSBvZiBibGVuZFNoYXBlR3JvdXBzIGhhcyBubyBuYW1lJyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHByZXNldE5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHNjaGVtYUdyb3VwLnByZXNldE5hbWUgJiZcbiAgICAgICAgICBzY2hlbWFHcm91cC5wcmVzZXROYW1lICE9PSBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuVW5rbm93biAmJlxuICAgICAgICAgICFibGVuZFNoYXBlUHJlc2V0TWFwW3NjaGVtYUdyb3VwLnByZXNldE5hbWVdXG4gICAgICAgICkge1xuICAgICAgICAgIHByZXNldE5hbWUgPSBzY2hlbWFHcm91cC5wcmVzZXROYW1lO1xuICAgICAgICAgIGJsZW5kU2hhcGVQcmVzZXRNYXBbc2NoZW1hR3JvdXAucHJlc2V0TmFtZV0gPSBuYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZ3JvdXAgPSBuZXcgVlJNQmxlbmRTaGFwZUdyb3VwKG5hbWUpO1xuICAgICAgICBnbHRmLnNjZW5lLmFkZChncm91cCk7XG5cbiAgICAgICAgZ3JvdXAuaXNCaW5hcnkgPSBzY2hlbWFHcm91cC5pc0JpbmFyeSB8fCBmYWxzZTtcblxuICAgICAgICBpZiAoc2NoZW1hR3JvdXAuYmluZHMpIHtcbiAgICAgICAgICBzY2hlbWFHcm91cC5iaW5kcy5mb3JFYWNoKGFzeW5jIChiaW5kKSA9PiB7XG4gICAgICAgICAgICBpZiAoYmluZC5tZXNoID09PSB1bmRlZmluZWQgfHwgYmluZC5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgbm9kZXNVc2luZ01lc2g6IG51bWJlcltdID0gW107XG4gICAgICAgICAgICAoZ2x0Zi5wYXJzZXIuanNvbi5ub2RlcyBhcyBHTFRGU2NoZW1hLk5vZGVbXSkuZm9yRWFjaCgobm9kZSwgaSkgPT4ge1xuICAgICAgICAgICAgICBpZiAobm9kZS5tZXNoID09PSBiaW5kLm1lc2gpIHtcbiAgICAgICAgICAgICAgICBub2Rlc1VzaW5nTWVzaC5wdXNoKGkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgY29uc3QgbW9ycGhUYXJnZXRJbmRleCA9IGJpbmQuaW5kZXg7XG5cbiAgICAgICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgICAgICBub2Rlc1VzaW5nTWVzaC5tYXAoYXN5bmMgKG5vZGVJbmRleCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZXMgPSAoYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUoZ2x0Ziwgbm9kZUluZGV4KSkhO1xuXG4gICAgICAgICAgICAgICAgLy8gY2hlY2sgaWYgdGhlIG1lc2ggaGFzIHRoZSB0YXJnZXQgbW9ycGggdGFyZ2V0XG4gICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgIXByaW1pdGl2ZXMuZXZlcnkoXG4gICAgICAgICAgICAgICAgICAgIChwcmltaXRpdmUpID0+XG4gICAgICAgICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheShwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzKSAmJlxuICAgICAgICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0SW5kZXggPCBwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzLmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgICAgICAgYFZSTUJsZW5kU2hhcGVJbXBvcnRlcjogJHtzY2hlbWFHcm91cC5uYW1lfSBhdHRlbXB0cyB0byBpbmRleCAke21vcnBoVGFyZ2V0SW5kZXh9dGggbW9ycGggYnV0IG5vdCBmb3VuZC5gLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBncm91cC5hZGRCaW5kKHtcbiAgICAgICAgICAgICAgICAgIG1lc2hlczogcHJpbWl0aXZlcyxcbiAgICAgICAgICAgICAgICAgIG1vcnBoVGFyZ2V0SW5kZXgsXG4gICAgICAgICAgICAgICAgICB3ZWlnaHQ6IGJpbmQud2VpZ2h0ID8/IDEwMCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbWF0ZXJpYWxWYWx1ZXMgPSBzY2hlbWFHcm91cC5tYXRlcmlhbFZhbHVlcztcbiAgICAgICAgaWYgKG1hdGVyaWFsVmFsdWVzKSB7XG4gICAgICAgICAgbWF0ZXJpYWxWYWx1ZXMuZm9yRWFjaCgobWF0ZXJpYWxWYWx1ZSkgPT4ge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAgIG1hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICAgbWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSA9PT0gdW5kZWZpbmVkXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBtYXRlcmlhbHM6IFRIUkVFLk1hdGVyaWFsW10gPSBbXTtcbiAgICAgICAgICAgIGdsdGYuc2NlbmUudHJhdmVyc2UoKG9iamVjdCkgPT4ge1xuICAgICAgICAgICAgICBpZiAoKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsW10gfCBUSFJFRS5NYXRlcmlhbCA9IChvYmplY3QgYXMgYW55KS5tYXRlcmlhbDtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRlcmlhbCkpIHtcbiAgICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKFxuICAgICAgICAgICAgICAgICAgICAuLi5tYXRlcmlhbC5maWx0ZXIoXG4gICAgICAgICAgICAgICAgICAgICAgKG10bCkgPT4gbXRsLm5hbWUgPT09IG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lISAmJiBtYXRlcmlhbHMuaW5kZXhPZihtdGwpID09PSAtMSxcbiAgICAgICAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbC5uYW1lID09PSBtYXRlcmlhbFZhbHVlLm1hdGVyaWFsTmFtZSAmJiBtYXRlcmlhbHMuaW5kZXhPZihtYXRlcmlhbCkgPT09IC0xKSB7XG4gICAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgbWF0ZXJpYWxzLmZvckVhY2goKG1hdGVyaWFsKSA9PiB7XG4gICAgICAgICAgICAgIGdyb3VwLmFkZE1hdGVyaWFsVmFsdWUoe1xuICAgICAgICAgICAgICAgIG1hdGVyaWFsLFxuICAgICAgICAgICAgICAgIHByb3BlcnR5TmFtZTogcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShtYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZSEpLFxuICAgICAgICAgICAgICAgIHRhcmdldFZhbHVlOiBtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlISxcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJsZW5kU2hhcGUucmVnaXN0ZXJCbGVuZFNoYXBlR3JvdXAobmFtZSwgcHJlc2V0TmFtZSwgZ3JvdXApO1xuICAgICAgfSksXG4gICAgKTtcblxuICAgIHJldHVybiBibGVuZFNoYXBlO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGTm9kZSwgR0xURlByaW1pdGl2ZSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdldFdvcmxkUXVhdGVybmlvbkxpdGUgfSBmcm9tICcuLi91dGlscy9tYXRoJztcblxuY29uc3QgVkVDVE9SM19GUk9OVCA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLlZlY3RvcjMoMC4wLCAwLjAsIC0xLjApKTtcblxuY29uc3QgX3F1YXQgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG5lbnVtIEZpcnN0UGVyc29uRmxhZyB7XG4gIEF1dG8sXG4gIEJvdGgsXG4gIFRoaXJkUGVyc29uT25seSxcbiAgRmlyc3RQZXJzb25Pbmx5LFxufVxuXG4vKipcbiAqIFRoaXMgY2xhc3MgcmVwcmVzZW50cyBhIHNpbmdsZSBbYG1lc2hBbm5vdGF0aW9uYF0oaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iL21hc3Rlci9zcGVjaWZpY2F0aW9uLzAuMC9zY2hlbWEvdnJtLmZpcnN0cGVyc29uLm1lc2hhbm5vdGF0aW9uLnNjaGVtYS5qc29uKSBlbnRyeS5cbiAqIEVhY2ggbWVzaCB3aWxsIGJlIGFzc2lnbmVkIHRvIHNwZWNpZmllZCBsYXllciB3aGVuIHlvdSBjYWxsIFtbVlJNRmlyc3RQZXJzb24uc2V0dXBdXS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFncyB7XG4gIHByaXZhdGUgc3RhdGljIF9wYXJzZUZpcnN0UGVyc29uRmxhZyhmaXJzdFBlcnNvbkZsYWc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IEZpcnN0UGVyc29uRmxhZyB7XG4gICAgc3dpdGNoIChmaXJzdFBlcnNvbkZsYWcpIHtcbiAgICAgIGNhc2UgJ0JvdGgnOlxuICAgICAgICByZXR1cm4gRmlyc3RQZXJzb25GbGFnLkJvdGg7XG4gICAgICBjYXNlICdUaGlyZFBlcnNvbk9ubHknOlxuICAgICAgICByZXR1cm4gRmlyc3RQZXJzb25GbGFnLlRoaXJkUGVyc29uT25seTtcbiAgICAgIGNhc2UgJ0ZpcnN0UGVyc29uT25seSc6XG4gICAgICAgIHJldHVybiBGaXJzdFBlcnNvbkZsYWcuRmlyc3RQZXJzb25Pbmx5O1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIEZpcnN0UGVyc29uRmxhZy5BdXRvO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBIFtbRmlyc3RQZXJzb25GbGFnXV0gb2YgdGhlIGFubm90YXRpb24gZW50cnkuXG4gICAqL1xuICBwdWJsaWMgZmlyc3RQZXJzb25GbGFnOiBGaXJzdFBlcnNvbkZsYWc7XG5cbiAgLyoqXG4gICAqIEEgbWVzaCBwcmltaXRpdmVzIG9mIHRoZSBhbm5vdGF0aW9uIGVudHJ5LlxuICAgKi9cbiAgcHVibGljIHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IG1lc2ggYW5ub3RhdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIGZpcnN0UGVyc29uRmxhZyBBIFtbRmlyc3RQZXJzb25GbGFnXV0gb2YgdGhlIGFubm90YXRpb24gZW50cnlcbiAgICogQHBhcmFtIG5vZGUgQSBub2RlIG9mIHRoZSBhbm5vdGF0aW9uIGVudHJ5LlxuICAgKi9cbiAgY29uc3RydWN0b3IoZmlyc3RQZXJzb25GbGFnOiBzdHJpbmcgfCB1bmRlZmluZWQsIHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXSkge1xuICAgIHRoaXMuZmlyc3RQZXJzb25GbGFnID0gVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzLl9wYXJzZUZpcnN0UGVyc29uRmxhZyhmaXJzdFBlcnNvbkZsYWcpO1xuICAgIHRoaXMucHJpbWl0aXZlcyA9IHByaW1pdGl2ZXM7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFZSTUZpcnN0UGVyc29uIHtcbiAgLyoqXG4gICAqIEEgZGVmYXVsdCBjYW1lcmEgbGF5ZXIgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKlxuICAgKiBAc2VlIFtbZ2V0Rmlyc3RQZXJzb25Pbmx5TGF5ZXJdXVxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUiA9IDk7XG5cbiAgLyoqXG4gICAqIEEgZGVmYXVsdCBjYW1lcmEgbGF5ZXIgZm9yIGBUaGlyZFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKlxuICAgKiBAc2VlIFtbZ2V0VGhpcmRQZXJzb25Pbmx5TGF5ZXJdXVxuICAgKi9cbiAgcHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX0RFRkFVTFRfVEhJUkRQRVJTT05fT05MWV9MQVlFUiA9IDEwO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX2ZpcnN0UGVyc29uQm9uZTogR0xURk5vZGU7XG4gIHByaXZhdGUgcmVhZG9ubHkgX21lc2hBbm5vdGF0aW9uczogVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzW10gPSBbXTtcbiAgcHJpdmF0ZSByZWFkb25seSBfZmlyc3RQZXJzb25Cb25lT2Zmc2V0OiBUSFJFRS5WZWN0b3IzO1xuXG4gIHByaXZhdGUgX2ZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uX0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUjtcbiAgcHJpdmF0ZSBfdGhpcmRQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5fREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSO1xuXG4gIHByaXZhdGUgX2luaXRpYWxpemVkID0gZmFsc2U7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1GaXJzdFBlcnNvbiBvYmplY3QuXG4gICAqXG4gICAqIEBwYXJhbSBmaXJzdFBlcnNvbkJvbmUgQSBmaXJzdCBwZXJzb24gYm9uZVxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb25Cb25lT2Zmc2V0IEFuIG9mZnNldCBmcm9tIHRoZSBzcGVjaWZpZWQgZmlyc3QgcGVyc29uIGJvbmVcbiAgICogQHBhcmFtIG1lc2hBbm5vdGF0aW9ucyBBIHJlbmRlcmVyIHNldHRpbmdzLiBTZWUgdGhlIGRlc2NyaXB0aW9uIG9mIFtbUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzXV0gZm9yIG1vcmUgaW5mb1xuICAgKi9cbiAgY29uc3RydWN0b3IoXG4gICAgZmlyc3RQZXJzb25Cb25lOiBHTFRGTm9kZSxcbiAgICBmaXJzdFBlcnNvbkJvbmVPZmZzZXQ6IFRIUkVFLlZlY3RvcjMsXG4gICAgbWVzaEFubm90YXRpb25zOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSxcbiAgKSB7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25Cb25lID0gZmlyc3RQZXJzb25Cb25lO1xuICAgIHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldCA9IGZpcnN0UGVyc29uQm9uZU9mZnNldDtcbiAgICB0aGlzLl9tZXNoQW5ub3RhdGlvbnMgPSBtZXNoQW5ub3RhdGlvbnM7XG4gIH1cblxuICBwdWJsaWMgZ2V0IGZpcnN0UGVyc29uQm9uZSgpOiBHTFRGTm9kZSB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0UGVyc29uQm9uZTtcbiAgfVxuXG4gIHB1YmxpYyBnZXQgbWVzaEFubm90YXRpb25zKCk6IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFnc1tdIHtcbiAgICByZXR1cm4gdGhpcy5fbWVzaEFubm90YXRpb25zO1xuICB9XG5cbiAgcHVibGljIGdldEZpcnN0UGVyc29uV29ybGREaXJlY3Rpb24odGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgcmV0dXJuIHRhcmdldC5jb3B5KFZFQ1RPUjNfRlJPTlQpLmFwcGx5UXVhdGVybmlvbihnZXRXb3JsZFF1YXRlcm5pb25MaXRlKHRoaXMuX2ZpcnN0UGVyc29uQm9uZSwgX3F1YXQpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBIGNhbWVyYSBsYXllciByZXByZXNlbnRzIGBGaXJzdFBlcnNvbk9ubHlgIGxheWVyLlxuICAgKiBOb3RlIHRoYXQgKip5b3UgbXVzdCBjYWxsIFtbc2V0dXBdXSBmaXJzdCBiZWZvcmUgeW91IHVzZSB0aGUgbGF5ZXIgZmVhdHVyZSoqIG9yIGl0IGRvZXMgbm90IHdvcmsgcHJvcGVybHkuXG4gICAqXG4gICAqIFRoZSB2YWx1ZSBpcyBbW0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUl1dIGJ5IGRlZmF1bHQgYnV0IHlvdSBjYW4gY2hhbmdlIHRoZSBsYXllciBieSBzcGVjaWZ5aW5nIHZpYSBbW3NldHVwXV0gaWYgeW91IHByZWZlci5cbiAgICpcbiAgICogQHNlZSBodHRwczovL3ZybS5kZXYvZW4vdW5pdnJtL2FwaS91bml2cm1fdXNlX2ZpcnN0cGVyc29uL1xuICAgKiBAc2VlIGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL2NvcmUvTGF5ZXJzXG4gICAqL1xuICBwdWJsaWMgZ2V0IGZpcnN0UGVyc29uT25seUxheWVyKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgY2FtZXJhIGxheWVyIHJlcHJlc2VudHMgYFRoaXJkUGVyc29uT25seWAgbGF5ZXIuXG4gICAqIE5vdGUgdGhhdCAqKnlvdSBtdXN0IGNhbGwgW1tzZXR1cF1dIGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlKiogb3IgaXQgZG9lcyBub3Qgd29yayBwcm9wZXJseS5cbiAgICpcbiAgICogVGhlIHZhbHVlIGlzIFtbREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSXV0gYnkgZGVmYXVsdCBidXQgeW91IGNhbiBjaGFuZ2UgdGhlIGxheWVyIGJ5IHNwZWNpZnlpbmcgdmlhIFtbc2V0dXBdXSBpZiB5b3UgcHJlZmVyLlxuICAgKlxuICAgKiBAc2VlIGh0dHBzOi8vdnJtLmRldi9lbi91bml2cm0vYXBpL3VuaXZybV91c2VfZmlyc3RwZXJzb24vXG4gICAqIEBzZWUgaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vY29yZS9MYXllcnNcbiAgICovXG4gIHB1YmxpYyBnZXQgdGhpcmRQZXJzb25Pbmx5TGF5ZXIoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXI7XG4gIH1cblxuICBwdWJsaWMgZ2V0Rmlyc3RQZXJzb25Cb25lT2Zmc2V0KHRhcmdldDogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xuICAgIHJldHVybiB0YXJnZXQuY29weSh0aGlzLl9maXJzdFBlcnNvbkJvbmVPZmZzZXQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBjdXJyZW50IHdvcmxkIHBvc2l0aW9uIG9mIHRoZSBmaXJzdCBwZXJzb24uXG4gICAqIFRoZSBwb3NpdGlvbiB0YWtlcyBbW0ZpcnN0UGVyc29uQm9uZV1dIGFuZCBbW0ZpcnN0UGVyc29uT2Zmc2V0XV0gaW50byBhY2NvdW50LlxuICAgKlxuICAgKiBAcGFyYW0gdjMgdGFyZ2V0XG4gICAqIEByZXR1cm5zIEN1cnJlbnQgd29ybGQgcG9zaXRpb24gb2YgdGhlIGZpcnN0IHBlcnNvblxuICAgKi9cbiAgcHVibGljIGdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbih2MzogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xuICAgIC8vIFVuaVZSTSNWUk1GaXJzdFBlcnNvbkVkaXRvclxuICAgIC8vIHZhciB3b3JsZE9mZnNldCA9IGhlYWQubG9jYWxUb1dvcmxkTWF0cml4Lk11bHRpcGx5UG9pbnQoY29tcG9uZW50LkZpcnN0UGVyc29uT2Zmc2V0KTtcbiAgICBjb25zdCBvZmZzZXQgPSB0aGlzLl9maXJzdFBlcnNvbkJvbmVPZmZzZXQ7XG4gICAgY29uc3QgdjQgPSBuZXcgVEhSRUUuVmVjdG9yNChvZmZzZXQueCwgb2Zmc2V0LnksIG9mZnNldC56LCAxLjApO1xuICAgIHY0LmFwcGx5TWF0cml4NCh0aGlzLl9maXJzdFBlcnNvbkJvbmUubWF0cml4V29ybGQpO1xuICAgIHJldHVybiB2My5zZXQodjQueCwgdjQueSwgdjQueik7XG4gIH1cblxuICAvKipcbiAgICogSW4gdGhpcyBtZXRob2QsIGl0IGFzc2lnbnMgbGF5ZXJzIGZvciBldmVyeSBtZXNoZXMgYmFzZWQgb24gbWVzaCBhbm5vdGF0aW9ucy5cbiAgICogWW91IG11c3QgY2FsbCB0aGlzIG1ldGhvZCBmaXJzdCBiZWZvcmUgeW91IHVzZSB0aGUgbGF5ZXIgZmVhdHVyZS5cbiAgICpcbiAgICogVGhpcyBpcyBhbiBlcXVpdmFsZW50IG9mIFtWUk1GaXJzdFBlcnNvbi5TZXR1cF0oaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iL21hc3Rlci9Bc3NldHMvVlJNL1VuaVZSTS9TY3JpcHRzL0ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uLmNzKSBvZiB0aGUgVW5pVlJNLlxuICAgKlxuICAgKiBUaGUgYGNhbWVyYUxheWVyYCBwYXJhbWV0ZXIgc3BlY2lmaWVzIHdoaWNoIGxheWVyIHdpbGwgYmUgYXNzaWduZWQgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIC8gYFRoaXJkUGVyc29uT25seWAuXG4gICAqIEluIFVuaVZSTSwgd2Ugc3BlY2lmaWVkIHRob3NlIGJ5IG5hbWluZyBlYWNoIGRlc2lyZWQgbGF5ZXIgYXMgYEZJUlNUUEVSU09OX09OTFlfTEFZRVJgIC8gYFRISVJEUEVSU09OX09OTFlfTEFZRVJgXG4gICAqIGJ1dCB3ZSBhcmUgZ29pbmcgdG8gc3BlY2lmeSB0aGVzZSBsYXllcnMgYXQgaGVyZSBzaW5jZSB3ZSBhcmUgdW5hYmxlIHRvIG5hbWUgbGF5ZXJzIGluIFRocmVlLmpzLlxuICAgKlxuICAgKiBAcGFyYW0gY2FtZXJhTGF5ZXIgU3BlY2lmeSB3aGljaCBsYXllciB3aWxsIGJlIGZvciBgRmlyc3RQZXJzb25Pbmx5YCAvIGBUaGlyZFBlcnNvbk9ubHlgLlxuICAgKi9cbiAgcHVibGljIHNldHVwKHtcbiAgICBmaXJzdFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX0ZJUlNUUEVSU09OX09OTFlfTEFZRVIsXG4gICAgdGhpcmRQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5fREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSLFxuICB9ID0ge30pOiB2b2lkIHtcbiAgICBpZiAodGhpcy5faW5pdGlhbGl6ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuICAgIHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyID0gZmlyc3RQZXJzb25Pbmx5TGF5ZXI7XG4gICAgdGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIgPSB0aGlyZFBlcnNvbk9ubHlMYXllcjtcblxuICAgIHRoaXMuX21lc2hBbm5vdGF0aW9ucy5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICBpZiAoaXRlbS5maXJzdFBlcnNvbkZsYWcgPT09IEZpcnN0UGVyc29uRmxhZy5GaXJzdFBlcnNvbk9ubHkpIHtcbiAgICAgICAgaXRlbS5wcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xuICAgICAgICAgIHByaW1pdGl2ZS5sYXllcnMuc2V0KHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0uZmlyc3RQZXJzb25GbGFnID09PSBGaXJzdFBlcnNvbkZsYWcuVGhpcmRQZXJzb25Pbmx5KSB7XG4gICAgICAgIGl0ZW0ucHJpbWl0aXZlcy5mb3JFYWNoKChwcmltaXRpdmUpID0+IHtcbiAgICAgICAgICBwcmltaXRpdmUubGF5ZXJzLnNldCh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcik7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChpdGVtLmZpcnN0UGVyc29uRmxhZyA9PT0gRmlyc3RQZXJzb25GbGFnLkF1dG8pIHtcbiAgICAgICAgdGhpcy5fY3JlYXRlSGVhZGxlc3NNb2RlbChpdGVtLnByaW1pdGl2ZXMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBfZXhjbHVkZVRyaWFuZ2xlcyh0cmlhbmdsZXM6IG51bWJlcltdLCBid3M6IG51bWJlcltdW10sIHNraW5JbmRleDogbnVtYmVyW11bXSwgZXhjbHVkZTogbnVtYmVyW10pOiBudW1iZXIge1xuICAgIGxldCBjb3VudCA9IDA7XG4gICAgaWYgKGJ3cyAhPSBudWxsICYmIGJ3cy5sZW5ndGggPiAwKSB7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaWFuZ2xlcy5sZW5ndGg7IGkgKz0gMykge1xuICAgICAgICBjb25zdCBhID0gdHJpYW5nbGVzW2ldO1xuICAgICAgICBjb25zdCBiID0gdHJpYW5nbGVzW2kgKyAxXTtcbiAgICAgICAgY29uc3QgYyA9IHRyaWFuZ2xlc1tpICsgMl07XG4gICAgICAgIGNvbnN0IGJ3MCA9IGJ3c1thXTtcbiAgICAgICAgY29uc3Qgc2tpbjAgPSBza2luSW5kZXhbYV07XG5cbiAgICAgICAgaWYgKGJ3MFswXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFswXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncwWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzFdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzBbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbMl0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MFszXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFszXSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IGJ3MSA9IGJ3c1tiXTtcbiAgICAgICAgY29uc3Qgc2tpbjEgPSBza2luSW5kZXhbYl07XG4gICAgICAgIGlmIChidzFbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbMF0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MVsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVsxXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncxWzJdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzJdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzFbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbM10pKSBjb250aW51ZTtcblxuICAgICAgICBjb25zdCBidzIgPSBid3NbY107XG4gICAgICAgIGNvbnN0IHNraW4yID0gc2tpbkluZGV4W2NdO1xuICAgICAgICBpZiAoYncyWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzBdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzJbMV0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbMV0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MlsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMlsyXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncyWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzNdKSkgY29udGludWU7XG5cbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYTtcbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYjtcbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGNvdW50O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlRXJhc2VkTWVzaChzcmM6IFRIUkVFLlNraW5uZWRNZXNoLCBlcmFzaW5nQm9uZXNJbmRleDogbnVtYmVyW10pOiBUSFJFRS5Ta2lubmVkTWVzaCB7XG4gICAgY29uc3QgZHN0ID0gbmV3IFRIUkVFLlNraW5uZWRNZXNoKHNyYy5nZW9tZXRyeS5jbG9uZSgpLCBzcmMubWF0ZXJpYWwpO1xuICAgIGRzdC5uYW1lID0gYCR7c3JjLm5hbWV9KGVyYXNlKWA7XG4gICAgZHN0LmZydXN0dW1DdWxsZWQgPSBzcmMuZnJ1c3R1bUN1bGxlZDtcbiAgICBkc3QubGF5ZXJzLnNldCh0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcik7XG5cbiAgICBjb25zdCBnZW9tZXRyeSA9IGRzdC5nZW9tZXRyeTtcblxuICAgIGNvbnN0IHNraW5JbmRleEF0dHIgPSBnZW9tZXRyeS5nZXRBdHRyaWJ1dGUoJ3NraW5JbmRleCcpLmFycmF5O1xuICAgIGNvbnN0IHNraW5JbmRleCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2tpbkluZGV4QXR0ci5sZW5ndGg7IGkgKz0gNCkge1xuICAgICAgc2tpbkluZGV4LnB1c2goW3NraW5JbmRleEF0dHJbaV0sIHNraW5JbmRleEF0dHJbaSArIDFdLCBza2luSW5kZXhBdHRyW2kgKyAyXSwgc2tpbkluZGV4QXR0cltpICsgM11dKTtcbiAgICB9XG5cbiAgICBjb25zdCBza2luV2VpZ2h0QXR0ciA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbldlaWdodCcpLmFycmF5O1xuICAgIGNvbnN0IHNraW5XZWlnaHQgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNraW5XZWlnaHRBdHRyLmxlbmd0aDsgaSArPSA0KSB7XG4gICAgICBza2luV2VpZ2h0LnB1c2goW3NraW5XZWlnaHRBdHRyW2ldLCBza2luV2VpZ2h0QXR0cltpICsgMV0sIHNraW5XZWlnaHRBdHRyW2kgKyAyXSwgc2tpbldlaWdodEF0dHJbaSArIDNdXSk7XG4gICAgfVxuXG4gICAgY29uc3QgaW5kZXggPSBnZW9tZXRyeS5nZXRJbmRleCgpO1xuICAgIGlmICghaW5kZXgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBnZW9tZXRyeSBkb2Vzbid0IGhhdmUgYW4gaW5kZXggYnVmZmVyXCIpO1xuICAgIH1cbiAgICBjb25zdCBvbGRUcmlhbmdsZXMgPSBBcnJheS5mcm9tKGluZGV4LmFycmF5KTtcblxuICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fZXhjbHVkZVRyaWFuZ2xlcyhvbGRUcmlhbmdsZXMsIHNraW5XZWlnaHQsIHNraW5JbmRleCwgZXJhc2luZ0JvbmVzSW5kZXgpO1xuICAgIGNvbnN0IG5ld1RyaWFuZ2xlOiBudW1iZXJbXSA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY291bnQ7IGkrKykge1xuICAgICAgbmV3VHJpYW5nbGVbaV0gPSBvbGRUcmlhbmdsZXNbaV07XG4gICAgfVxuICAgIGdlb21ldHJ5LnNldEluZGV4KG5ld1RyaWFuZ2xlKTtcblxuICAgIC8vIG10b29uIG1hdGVyaWFsIGluY2x1ZGVzIG9uQmVmb3JlUmVuZGVyLiB0aGlzIGlzIHVuc3VwcG9ydGVkIGF0IFNraW5uZWRNZXNoI2Nsb25lXG4gICAgaWYgKHNyYy5vbkJlZm9yZVJlbmRlcikge1xuICAgICAgZHN0Lm9uQmVmb3JlUmVuZGVyID0gc3JjLm9uQmVmb3JlUmVuZGVyO1xuICAgIH1cbiAgICBkc3QuYmluZChuZXcgVEhSRUUuU2tlbGV0b24oc3JjLnNrZWxldG9uLmJvbmVzLCBzcmMuc2tlbGV0b24uYm9uZUludmVyc2VzKSwgbmV3IFRIUkVFLk1hdHJpeDQoKSk7XG4gICAgcmV0dXJuIGRzdDtcbiAgfVxuXG4gIHByaXZhdGUgX2NyZWF0ZUhlYWRsZXNzTW9kZWxGb3JTa2lubmVkTWVzaChwYXJlbnQ6IFRIUkVFLk9iamVjdDNELCBtZXNoOiBUSFJFRS5Ta2lubmVkTWVzaCk6IHZvaWQge1xuICAgIGNvbnN0IGVyYXNlQm9uZUluZGV4ZXM6IG51bWJlcltdID0gW107XG4gICAgbWVzaC5za2VsZXRvbi5ib25lcy5mb3JFYWNoKChib25lLCBpbmRleCkgPT4ge1xuICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQoYm9uZSkpIGVyYXNlQm9uZUluZGV4ZXMucHVzaChpbmRleCk7XG4gICAgfSk7XG5cbiAgICAvLyBVbmxpa2UgVW5pVlJNIHdlIGRvbid0IGNvcHkgbWVzaCBpZiBubyBpbnZpc2libGUgYm9uZSB3YXMgZm91bmRcbiAgICBpZiAoIWVyYXNlQm9uZUluZGV4ZXMubGVuZ3RoKSB7XG4gICAgICBtZXNoLmxheWVycy5lbmFibGUodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgbWVzaC5sYXllcnMuZW5hYmxlKHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgbWVzaC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICBjb25zdCBuZXdNZXNoID0gdGhpcy5fY3JlYXRlRXJhc2VkTWVzaChtZXNoLCBlcmFzZUJvbmVJbmRleGVzKTtcbiAgICBwYXJlbnQuYWRkKG5ld01lc2gpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlSGVhZGxlc3NNb2RlbChwcmltaXRpdmVzOiBHTFRGUHJpbWl0aXZlW10pOiB2b2lkIHtcbiAgICBwcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xuICAgICAgaWYgKHByaW1pdGl2ZS50eXBlID09PSAnU2tpbm5lZE1lc2gnKSB7XG4gICAgICAgIGNvbnN0IHNraW5uZWRNZXNoID0gcHJpbWl0aXZlIGFzIFRIUkVFLlNraW5uZWRNZXNoO1xuICAgICAgICB0aGlzLl9jcmVhdGVIZWFkbGVzc01vZGVsRm9yU2tpbm5lZE1lc2goc2tpbm5lZE1lc2gucGFyZW50ISwgc2tpbm5lZE1lc2gpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQocHJpbWl0aXZlKSkge1xuICAgICAgICAgIHByaW1pdGl2ZS5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEl0IGp1c3QgY2hlY2tzIHdoZXRoZXIgdGhlIG5vZGUgb3IgaXRzIHBhcmVudCBpcyB0aGUgZmlyc3QgcGVyc29uIGJvbmUgb3Igbm90LlxuICAgKiBAcGFyYW0gYm9uZSBUaGUgdGFyZ2V0IGJvbmVcbiAgICovXG4gIHByaXZhdGUgX2lzRXJhc2VUYXJnZXQoYm9uZTogR0xURk5vZGUpOiBib29sZWFuIHtcbiAgICBpZiAoYm9uZSA9PT0gdGhpcy5fZmlyc3RQZXJzb25Cb25lKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9IGVsc2UgaWYgKCFib25lLnBhcmVudCkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5faXNFcmFzZVRhcmdldChib25lLnBhcmVudCk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IEdMVEZOb2RlLCBHTFRGU2NoZW1hLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XG5pbXBvcnQgeyBWUk1GaXJzdFBlcnNvbiwgVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzIH0gZnJvbSAnLi9WUk1GaXJzdFBlcnNvbic7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1GaXJzdFBlcnNvbl1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUZpcnN0UGVyc29uSW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1GaXJzdFBlcnNvbl1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKiBAcGFyYW0gaHVtYW5vaWQgQSBbW1ZSTUh1bWFub2lkXV0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cbiAgICovXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURiwgaHVtYW5vaWQ6IFZSTUh1bWFub2lkKTogUHJvbWlzZTxWUk1GaXJzdFBlcnNvbiB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5maXJzdFBlcnNvbjtcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbkJvbmVJbmRleCA9IHNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZTtcblxuICAgIGxldCBmaXJzdFBlcnNvbkJvbmU6IEdMVEZOb2RlIHwgbnVsbDtcbiAgICBpZiAoZmlyc3RQZXJzb25Cb25lSW5kZXggPT09IHVuZGVmaW5lZCB8fCBmaXJzdFBlcnNvbkJvbmVJbmRleCA9PT0gLTEpIHtcbiAgICAgIGZpcnN0UGVyc29uQm9uZSA9IGh1bWFub2lkLmdldEJvbmVOb2RlKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lLkhlYWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaXJzdFBlcnNvbkJvbmUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgZmlyc3RQZXJzb25Cb25lSW5kZXgpO1xuICAgIH1cblxuICAgIGlmICghZmlyc3RQZXJzb25Cb25lKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1ZSTUZpcnN0UGVyc29uSW1wb3J0ZXI6IENvdWxkIG5vdCBmaW5kIGZpcnN0UGVyc29uQm9uZSBvZiB0aGUgVlJNJyk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbkJvbmVPZmZzZXQgPSBzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXRcbiAgICAgID8gbmV3IFRIUkVFLlZlY3RvcjMoXG4gICAgICAgICAgc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LngsXG4gICAgICAgICAgc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LnksXG4gICAgICAgICAgLXNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZU9mZnNldC56ISwgLy8gVlJNIDAuMCB1c2VzIGxlZnQtaGFuZGVkIHktdXBcbiAgICAgICAgKVxuICAgICAgOiBuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMDYsIDAuMCk7IC8vIGZhbGxiYWNrLCB0YWtlbiBmcm9tIFVuaVZSTSBpbXBsZW1lbnRhdGlvblxuXG4gICAgY29uc3QgbWVzaEFubm90YXRpb25zOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSA9IFtdO1xuICAgIGNvbnN0IG5vZGVQcmltaXRpdmVzTWFwID0gYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGYpO1xuXG4gICAgQXJyYXkuZnJvbShub2RlUHJpbWl0aXZlc01hcC5lbnRyaWVzKCkpLmZvckVhY2goKFtub2RlSW5kZXgsIHByaW1pdGl2ZXNdKSA9PiB7XG4gICAgICBjb25zdCBzY2hlbWFOb2RlOiBHTFRGU2NoZW1hLk5vZGUgPSBnbHRmLnBhcnNlci5qc29uLm5vZGVzW25vZGVJbmRleF07XG5cbiAgICAgIGNvbnN0IGZsYWcgPSBzY2hlbWFGaXJzdFBlcnNvbi5tZXNoQW5ub3RhdGlvbnNcbiAgICAgICAgPyBzY2hlbWFGaXJzdFBlcnNvbi5tZXNoQW5ub3RhdGlvbnMuZmluZCgoYSkgPT4gYS5tZXNoID09PSBzY2hlbWFOb2RlLm1lc2gpXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgICAgbWVzaEFubm90YXRpb25zLnB1c2gobmV3IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFncyhmbGFnPy5maXJzdFBlcnNvbkZsYWcsIHByaW1pdGl2ZXMpKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBuZXcgVlJNRmlyc3RQZXJzb24oZmlyc3RQZXJzb25Cb25lLCBmaXJzdFBlcnNvbkJvbmVPZmZzZXQsIG1lc2hBbm5vdGF0aW9ucyk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEZOb2RlIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNSHVtYW5MaW1pdCB9IGZyb20gJy4vVlJNSHVtYW5MaW1pdCc7XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRzIGEgc2luZ2xlIGBodW1hbkJvbmVgIG9mIGEgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5Cb25lIHtcbiAgLyoqXG4gICAqIEEgW1tHTFRGTm9kZV1dICh0aGF0IGFjdHVhbGx5IGlzIGEgYFRIUkVFLk9iamVjdDNEYCkgdGhhdCByZXByZXNlbnRzIHRoZSBib25lLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG5vZGU6IEdMVEZOb2RlO1xuXG4gIC8qKlxuICAgKiBBIFtbVlJNSHVtYW5MaW1pdF1dIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgcHJvcGVydGllcyBvZiB0aGUgYm9uZS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbkxpbWl0OiBWUk1IdW1hbkxpbWl0O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNSHVtYW5Cb25lLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZSBBIFtbR0xURk5vZGVdXSB0aGF0IHJlcHJlc2VudHMgdGhlIG5ldyBib25lXG4gICAqIEBwYXJhbSBodW1hbkxpbWl0IEEgW1tWUk1IdW1hbkxpbWl0XV0gb2JqZWN0IHRoYXQgcmVwcmVzZW50cyBwcm9wZXJ0aWVzIG9mIHRoZSBuZXcgYm9uZVxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKG5vZGU6IEdMVEZOb2RlLCBodW1hbkxpbWl0OiBWUk1IdW1hbkxpbWl0KSB7XG4gICAgdGhpcy5ub2RlID0gbm9kZTtcbiAgICB0aGlzLmh1bWFuTGltaXQgPSBodW1hbkxpbWl0O1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogQSBjb21wYXQgZnVuY3Rpb24gZm9yIGBRdWF0ZXJuaW9uLmludmVydCgpYCAvIGBRdWF0ZXJuaW9uLmludmVyc2UoKWAuXG4gKiBgUXVhdGVybmlvbi5pbnZlcnQoKWAgaXMgaW50cm9kdWNlZCBpbiByMTIzIGFuZCBgUXVhdGVybmlvbi5pbnZlcnNlKClgIGVtaXRzIGEgd2FybmluZy5cbiAqIFdlIGFyZSBnb2luZyB0byB1c2UgdGhpcyBjb21wYXQgZm9yIGEgd2hpbGUuXG4gKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IHF1YXRlcm5pb25cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHF1YXRJbnZlcnRDb21wYXQ8VCBleHRlbmRzIFRIUkVFLlF1YXRlcm5pb24+KHRhcmdldDogVCk6IFQge1xuICBpZiAoKHRhcmdldCBhcyBhbnkpLmludmVydCkge1xuICAgIHRhcmdldC5pbnZlcnQoKTtcbiAgfSBlbHNlIHtcbiAgICAodGFyZ2V0IGFzIGFueSkuaW52ZXJzZSgpO1xuICB9XG5cbiAgcmV0dXJuIHRhcmdldDtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEZOb2RlLCBSYXdWZWN0b3IzLCBSYXdWZWN0b3I0LCBWUk1Qb3NlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBxdWF0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvcXVhdEludmVydENvbXBhdCc7XG5pbXBvcnQgeyBWUk1IdW1hbkJvbmUgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZSc7XG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVBcnJheSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lQXJyYXknO1xuaW1wb3J0IHsgVlJNSHVtYW5Cb25lcyB9IGZyb20gJy4vVlJNSHVtYW5Cb25lcyc7XG5pbXBvcnQgeyBWUk1IdW1hbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi9WUk1IdW1hbkRlc2NyaXB0aW9uJztcblxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfcXVhdEEgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50cyBodW1hbm9pZCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUh1bWFub2lkIHtcbiAgLyoqXG4gICAqIEEgW1tWUk1IdW1hbkJvbmVzXV0gdGhhdCBjb250YWlucyBhbGwgdGhlIGh1bWFuIGJvbmVzIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGdldCB0aGVzZSBib25lcyB1c2luZyBbW1ZSTUh1bWFub2lkLmdldEJvbmVdXS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbkJvbmVzOiBWUk1IdW1hbkJvbmVzO1xuXG4gIC8qKlxuICAgKiBBIFtbVlJNSHVtYW5EZXNjcmlwdGlvbl1dIHRoYXQgcmVwcmVzZW50cyBwcm9wZXJ0aWVzIG9mIHRoZSBodW1hbm9pZC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbkRlc2NyaXB0aW9uOiBWUk1IdW1hbkRlc2NyaXB0aW9uO1xuXG4gIC8qKlxuICAgKiBBIFtbVlJNUG9zZV1dIHRoYXQgaXMgaXRzIGRlZmF1bHQgc3RhdGUuXG4gICAqIE5vdGUgdGhhdCBpdCdzIG5vdCBjb21wYXRpYmxlIHdpdGggYHNldFBvc2VgIGFuZCBgZ2V0UG9zZWAsIHNpbmNlIGl0IGNvbnRhaW5zIG5vbi1yZWxhdGl2ZSB2YWx1ZXMgb2YgZWFjaCBsb2NhbCB0cmFuc2Zvcm1zLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHJlc3RQb3NlOiBWUk1Qb3NlID0ge307XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBbW1ZSTUh1bWFub2lkXV0uXG4gICAqIEBwYXJhbSBib25lQXJyYXkgQSBbW1ZSTUh1bWFuQm9uZUFycmF5XV0gY29udGFpbnMgYWxsIHRoZSBib25lcyBvZiB0aGUgbmV3IGh1bWFub2lkXG4gICAqIEBwYXJhbSBodW1hbkRlc2NyaXB0aW9uIEEgW1tWUk1IdW1hbkRlc2NyaXB0aW9uXV0gdGhhdCByZXByZXNlbnRzIHByb3BlcnRpZXMgb2YgdGhlIG5ldyBodW1hbm9pZFxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKGJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXksIGh1bWFuRGVzY3JpcHRpb246IFZSTUh1bWFuRGVzY3JpcHRpb24pIHtcbiAgICB0aGlzLmh1bWFuQm9uZXMgPSB0aGlzLl9jcmVhdGVIdW1hbkJvbmVzKGJvbmVBcnJheSk7XG4gICAgdGhpcy5odW1hbkRlc2NyaXB0aW9uID0gaHVtYW5EZXNjcmlwdGlvbjtcblxuICAgIHRoaXMucmVzdFBvc2UgPSB0aGlzLmdldFBvc2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gdGhlIGN1cnJlbnQgcG9zZSBvZiB0aGlzIGh1bWFub2lkIGFzIGEgW1tWUk1Qb3NlXV0uXG4gICAqXG4gICAqIEVhY2ggdHJhbnNmb3JtIGlzIGEgbG9jYWwgdHJhbnNmb3JtIHJlbGF0aXZlIGZyb20gcmVzdCBwb3NlIChULXBvc2UpLlxuICAgKi9cbiAgcHVibGljIGdldFBvc2UoKTogVlJNUG9zZSB7XG4gICAgY29uc3QgcG9zZTogVlJNUG9zZSA9IHt9O1xuICAgIE9iamVjdC5rZXlzKHRoaXMuaHVtYW5Cb25lcykuZm9yRWFjaCgodnJtQm9uZU5hbWUpID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKHZybUJvbmVOYW1lIGFzIFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKSE7XG5cbiAgICAgIC8vIElnbm9yZSB3aGVuIHRoZXJlIGFyZSBubyBib25lIG9uIHRoZSBWUk1IdW1hbm9pZFxuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gV2hlbiB0aGVyZSBhcmUgdHdvIG9yIG1vcmUgYm9uZXMgaW4gYSBzYW1lIG5hbWUsIHdlIGFyZSBub3QgZ29pbmcgdG8gb3ZlcndyaXRlIGV4aXN0aW5nIG9uZVxuICAgICAgaWYgKHBvc2VbdnJtQm9uZU5hbWVdKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8gVGFrZSBhIGRpZmYgZnJvbSByZXN0UG9zZVxuICAgICAgLy8gbm90ZSB0aGF0IHJlc3RQb3NlIGFsc28gd2lsbCB1c2UgZ2V0UG9zZSB0byBpbml0aWFsaXplIGl0c2VsZlxuICAgICAgX3YzQS5zZXQoMCwgMCwgMCk7XG4gICAgICBfcXVhdEEuaWRlbnRpdHkoKTtcblxuICAgICAgY29uc3QgcmVzdFN0YXRlID0gdGhpcy5yZXN0UG9zZVt2cm1Cb25lTmFtZV07XG4gICAgICBpZiAocmVzdFN0YXRlPy5wb3NpdGlvbikge1xuICAgICAgICBfdjNBLmZyb21BcnJheShyZXN0U3RhdGUucG9zaXRpb24pLm5lZ2F0ZSgpO1xuICAgICAgfVxuICAgICAgaWYgKHJlc3RTdGF0ZT8ucm90YXRpb24pIHtcbiAgICAgICAgcXVhdEludmVydENvbXBhdChfcXVhdEEuZnJvbUFycmF5KHJlc3RTdGF0ZS5yb3RhdGlvbikpO1xuICAgICAgfVxuXG4gICAgICAvLyBHZXQgdGhlIHBvc2l0aW9uIC8gcm90YXRpb24gZnJvbSB0aGUgbm9kZVxuICAgICAgX3YzQS5hZGQobm9kZS5wb3NpdGlvbik7XG4gICAgICBfcXVhdEEucHJlbXVsdGlwbHkobm9kZS5xdWF0ZXJuaW9uKTtcblxuICAgICAgcG9zZVt2cm1Cb25lTmFtZV0gPSB7XG4gICAgICAgIHBvc2l0aW9uOiBfdjNBLnRvQXJyYXkoKSBhcyBSYXdWZWN0b3IzLFxuICAgICAgICByb3RhdGlvbjogX3F1YXRBLnRvQXJyYXkoKSBhcyBSYXdWZWN0b3I0LFxuICAgICAgfTtcbiAgICB9LCB7fSBhcyBWUk1Qb3NlKTtcbiAgICByZXR1cm4gcG9zZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBMZXQgdGhlIGh1bWFub2lkIGRvIGEgc3BlY2lmaWVkIHBvc2UuXG4gICAqXG4gICAqIEVhY2ggdHJhbnNmb3JtIGhhdmUgdG8gYmUgYSBsb2NhbCB0cmFuc2Zvcm0gcmVsYXRpdmUgZnJvbSByZXN0IHBvc2UgKFQtcG9zZSkuXG4gICAqIFlvdSBjYW4gcGFzcyB3aGF0IHlvdSBnb3QgZnJvbSB7QGxpbmsgZ2V0UG9zZX0uXG4gICAqXG4gICAqIEBwYXJhbSBwb3NlT2JqZWN0IEEgW1tWUk1Qb3NlXV0gdGhhdCByZXByZXNlbnRzIGEgc2luZ2xlIHBvc2VcbiAgICovXG4gIHB1YmxpYyBzZXRQb3NlKHBvc2VPYmplY3Q6IFZSTVBvc2UpOiB2b2lkIHtcbiAgICBPYmplY3Qua2V5cyhwb3NlT2JqZWN0KS5mb3JFYWNoKChib25lTmFtZSkgPT4ge1xuICAgICAgY29uc3Qgc3RhdGUgPSBwb3NlT2JqZWN0W2JvbmVOYW1lXSE7XG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXRCb25lTm9kZShib25lTmFtZSBhcyBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk7XG5cbiAgICAgIC8vIElnbm9yZSB3aGVuIHRoZXJlIGFyZSBubyBib25lIHRoYXQgaXMgZGVmaW5lZCBpbiB0aGUgcG9zZSBvbiB0aGUgVlJNSHVtYW5vaWRcbiAgICAgIGlmICghbm9kZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHJlc3RTdGF0ZSA9IHRoaXMucmVzdFBvc2VbYm9uZU5hbWVdO1xuICAgICAgaWYgKCFyZXN0U3RhdGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdGUucG9zaXRpb24pIHtcbiAgICAgICAgbm9kZS5wb3NpdGlvbi5mcm9tQXJyYXkoc3RhdGUucG9zaXRpb24pO1xuXG4gICAgICAgIGlmIChyZXN0U3RhdGUucG9zaXRpb24pIHtcbiAgICAgICAgICBub2RlLnBvc2l0aW9uLmFkZChfdjNBLmZyb21BcnJheShyZXN0U3RhdGUucG9zaXRpb24pKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc3RhdGUucm90YXRpb24pIHtcbiAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLmZyb21BcnJheShzdGF0ZS5yb3RhdGlvbik7XG5cbiAgICAgICAgaWYgKHJlc3RTdGF0ZS5yb3RhdGlvbikge1xuICAgICAgICAgIG5vZGUucXVhdGVybmlvbi5tdWx0aXBseShfcXVhdEEuZnJvbUFycmF5KHJlc3RTdGF0ZS5yb3RhdGlvbikpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgdGhlIGh1bWFub2lkIHRvIGl0cyByZXN0IHBvc2UuXG4gICAqL1xuICBwdWJsaWMgcmVzZXRQb3NlKCk6IHZvaWQge1xuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMucmVzdFBvc2UpLmZvckVhY2goKFtib25lTmFtZSwgcmVzdF0pID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKGJvbmVOYW1lIGFzIFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTtcblxuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlc3Q/LnBvc2l0aW9uKSB7XG4gICAgICAgIG5vZGUucG9zaXRpb24uZnJvbUFycmF5KHJlc3QucG9zaXRpb24pO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdD8ucm90YXRpb24pIHtcbiAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLmZyb21BcnJheShyZXN0LnJvdGF0aW9uKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBib25lIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGEgW1tWUk1IdW1hbkJvbmVdXS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZXNdXVxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XG4gICAqL1xuICBwdWJsaWMgZ2V0Qm9uZShuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IFZSTUh1bWFuQm9uZSB8IHVuZGVmaW5lZCB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXVswXSA/PyB1bmRlZmluZWQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGJvbmVzIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGFuIGFycmF5IG9mIFtbVlJNSHVtYW5Cb25lXV0uXG4gICAqIElmIHRoZXJlIGFyZSBubyBib25lcyBib3VuZCB0byB0aGUgc3BlY2lmaWVkIEh1bWFuQm9uZSwgaXQgd2lsbCByZXR1cm4gYW4gZW1wdHkgYXJyYXkuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBbW1ZSTUh1bWFub2lkLmdldEJvbmVdXVxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XG4gICAqL1xuICBwdWJsaWMgZ2V0Qm9uZXMobmFtZTogVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpOiBWUk1IdW1hbkJvbmVbXSB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXSA/PyBbXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYSBib25lIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGEgVEhSRUUuT2JqZWN0M0QuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBbW1ZSTUh1bWFub2lkLmdldEJvbmVOb2Rlc11dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lTm9kZShuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IEdMVEZOb2RlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXVswXT8ubm9kZSA/PyBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBib25lcyBib3VuZCB0byBhIHNwZWNpZmllZCBbW0h1bWFuQm9uZV1dLCBhcyBhbiBhcnJheSBvZiBUSFJFRS5PYmplY3QzRC5cbiAgICogSWYgdGhlcmUgYXJlIG5vIGJvbmVzIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgSHVtYW5Cb25lLCBpdCB3aWxsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZU5vZGVdXVxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XG4gICAqL1xuICBwdWJsaWMgZ2V0Qm9uZU5vZGVzKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogR0xURk5vZGVbXSB7XG4gICAgcmV0dXJuIHRoaXMuaHVtYW5Cb25lc1tuYW1lXT8ubWFwKChib25lKSA9PiBib25lLm5vZGUpID8/IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBhcmUgYSBbW1ZSTUh1bWFuQm9uZXNdXSBmcm9tIGEgW1tWUk1IdW1hbkJvbmVBcnJheV1dLlxuICAgKi9cbiAgcHJpdmF0ZSBfY3JlYXRlSHVtYW5Cb25lcyhib25lQXJyYXk6IFZSTUh1bWFuQm9uZUFycmF5KTogVlJNSHVtYW5Cb25lcyB7XG4gICAgY29uc3QgYm9uZXM6IFZSTUh1bWFuQm9uZXMgPSBPYmplY3QudmFsdWVzKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKS5yZWR1Y2UoKGFjY3VtLCBuYW1lKSA9PiB7XG4gICAgICBhY2N1bVtuYW1lXSA9IFtdO1xuICAgICAgcmV0dXJuIGFjY3VtO1xuICAgIH0sIHt9IGFzIFBhcnRpYWw8VlJNSHVtYW5Cb25lcz4pIGFzIFZSTUh1bWFuQm9uZXM7XG5cbiAgICBib25lQXJyYXkuZm9yRWFjaCgoYm9uZSkgPT4ge1xuICAgICAgYm9uZXNbYm9uZS5uYW1lXS5wdXNoKGJvbmUuYm9uZSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYm9uZXM7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lJztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZUFycmF5IH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVBcnJheSc7XG5pbXBvcnQgeyBWUk1IdW1hbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi9WUk1IdW1hbkRlc2NyaXB0aW9uJztcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi9WUk1IdW1hbm9pZCc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1IdW1hbm9pZF1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUh1bWFub2lkSW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1IdW1hbm9pZF1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1IdW1hbm9pZCB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hSHVtYW5vaWQ6IFZSTVNjaGVtYS5IdW1hbm9pZCB8IHVuZGVmaW5lZCA9IHZybUV4dC5odW1hbm9pZDtcbiAgICBpZiAoIXNjaGVtYUh1bWFub2lkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBodW1hbkJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXkgPSBbXTtcbiAgICBpZiAoc2NoZW1hSHVtYW5vaWQuaHVtYW5Cb25lcykge1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgIHNjaGVtYUh1bWFub2lkLmh1bWFuQm9uZXMubWFwKGFzeW5jIChib25lKSA9PiB7XG4gICAgICAgICAgaWYgKCFib25lLmJvbmUgfHwgYm9uZS5ub2RlID09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBub2RlID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIGJvbmUubm9kZSk7XG4gICAgICAgICAgaHVtYW5Cb25lQXJyYXkucHVzaCh7XG4gICAgICAgICAgICBuYW1lOiBib25lLmJvbmUsXG4gICAgICAgICAgICBib25lOiBuZXcgVlJNSHVtYW5Cb25lKG5vZGUsIHtcbiAgICAgICAgICAgICAgYXhpc0xlbmd0aDogYm9uZS5heGlzTGVuZ3RoLFxuICAgICAgICAgICAgICBjZW50ZXI6IGJvbmUuY2VudGVyICYmIG5ldyBUSFJFRS5WZWN0b3IzKGJvbmUuY2VudGVyLngsIGJvbmUuY2VudGVyLnksIGJvbmUuY2VudGVyLnopLFxuICAgICAgICAgICAgICBtYXg6IGJvbmUubWF4ICYmIG5ldyBUSFJFRS5WZWN0b3IzKGJvbmUubWF4LngsIGJvbmUubWF4LnksIGJvbmUubWF4LnopLFxuICAgICAgICAgICAgICBtaW46IGJvbmUubWluICYmIG5ldyBUSFJFRS5WZWN0b3IzKGJvbmUubWluLngsIGJvbmUubWluLnksIGJvbmUubWluLnopLFxuICAgICAgICAgICAgICB1c2VEZWZhdWx0VmFsdWVzOiBib25lLnVzZURlZmF1bHRWYWx1ZXMsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIH1cblxuICAgIGNvbnN0IGh1bWFuRGVzY3JpcHRpb246IFZSTUh1bWFuRGVzY3JpcHRpb24gPSB7XG4gICAgICBhcm1TdHJldGNoOiBzY2hlbWFIdW1hbm9pZC5hcm1TdHJldGNoLFxuICAgICAgbGVnU3RyZXRjaDogc2NoZW1hSHVtYW5vaWQubGVnU3RyZXRjaCxcbiAgICAgIHVwcGVyQXJtVHdpc3Q6IHNjaGVtYUh1bWFub2lkLnVwcGVyQXJtVHdpc3QsXG4gICAgICBsb3dlckFybVR3aXN0OiBzY2hlbWFIdW1hbm9pZC5sb3dlckFybVR3aXN0LFxuICAgICAgdXBwZXJMZWdUd2lzdDogc2NoZW1hSHVtYW5vaWQudXBwZXJMZWdUd2lzdCxcbiAgICAgIGxvd2VyTGVnVHdpc3Q6IHNjaGVtYUh1bWFub2lkLmxvd2VyTGVnVHdpc3QsXG4gICAgICBmZWV0U3BhY2luZzogc2NoZW1hSHVtYW5vaWQuZmVldFNwYWNpbmcsXG4gICAgICBoYXNUcmFuc2xhdGlvbkRvRjogc2NoZW1hSHVtYW5vaWQuaGFzVHJhbnNsYXRpb25Eb0YsXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgVlJNSHVtYW5vaWQoaHVtYW5Cb25lQXJyYXksIGh1bWFuRGVzY3JpcHRpb24pO1xuICB9XG59XG4iLCIvKipcbiAqIEV2YWx1YXRlIGEgaGVybWl0ZSBzcGxpbmUuXG4gKlxuICogQHBhcmFtIHkwIHkgb24gc3RhcnRcbiAqIEBwYXJhbSB5MSB5IG9uIGVuZFxuICogQHBhcmFtIHQwIGRlbHRhIHkgb24gc3RhcnRcbiAqIEBwYXJhbSB0MSBkZWx0YSB5IG9uIGVuZFxuICogQHBhcmFtIHggaW5wdXQgdmFsdWVcbiAqL1xuY29uc3QgaGVybWl0ZVNwbGluZSA9ICh5MDogbnVtYmVyLCB5MTogbnVtYmVyLCB0MDogbnVtYmVyLCB0MTogbnVtYmVyLCB4OiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICBjb25zdCB4YyA9IHggKiB4ICogeDtcbiAgY29uc3QgeHMgPSB4ICogeDtcbiAgY29uc3QgZHkgPSB5MSAtIHkwO1xuICBjb25zdCBoMDEgPSAtMi4wICogeGMgKyAzLjAgKiB4cztcbiAgY29uc3QgaDEwID0geGMgLSAyLjAgKiB4cyArIHg7XG4gIGNvbnN0IGgxMSA9IHhjIC0geHM7XG4gIHJldHVybiB5MCArIGR5ICogaDAxICsgdDAgKiBoMTAgKyB0MSAqIGgxMTtcbn07XG5cbi8qKlxuICogRXZhbHVhdGUgYW4gQW5pbWF0aW9uQ3VydmUgYXJyYXkuIFNlZSBBbmltYXRpb25DdXJ2ZSBjbGFzcyBvZiBVbml0eSBmb3IgaXRzIGRldGFpbHMuXG4gKlxuICogU2VlOiBodHRwczovL2RvY3MudW5pdHkzZC5jb20vamEvY3VycmVudC9TY3JpcHRSZWZlcmVuY2UvQW5pbWF0aW9uQ3VydmUuaHRtbFxuICpcbiAqIEBwYXJhbSBhcnIgQW4gYXJyYXkgcmVwcmVzZW50cyBhIGN1cnZlXG4gKiBAcGFyYW0geCBBbiBpbnB1dCB2YWx1ZVxuICovXG5jb25zdCBldmFsdWF0ZUN1cnZlID0gKGFycjogbnVtYmVyW10sIHg6IG51bWJlcik6IG51bWJlciA9PiB7XG4gIC8vIC0tIHNhbml0eSBjaGVjayAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBpZiAoYXJyLmxlbmd0aCA8IDgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2V2YWx1YXRlQ3VydmU6IEludmFsaWQgY3VydmUgZGV0ZWN0ZWQhIChBcnJheSBsZW5ndGggbXVzdCBiZSA4IGF0IGxlYXN0KScpO1xuICB9XG4gIGlmIChhcnIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZXZhbHVhdGVDdXJ2ZTogSW52YWxpZCBjdXJ2ZSBkZXRlY3RlZCEgKEFycmF5IGxlbmd0aCBtdXN0IGJlIG11bHRpcGxlcyBvZiA0Jyk7XG4gIH1cblxuICAvLyAtLSBjaGVjayByYW5nZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgbGV0IG91dE5vZGU7XG4gIGZvciAob3V0Tm9kZSA9IDA7IDsgb3V0Tm9kZSsrKSB7XG4gICAgaWYgKGFyci5sZW5ndGggPD0gNCAqIG91dE5vZGUpIHtcbiAgICAgIHJldHVybiBhcnJbNCAqIG91dE5vZGUgLSAzXTsgLy8gdG9vIGZ1cnRoZXIhISBhc3N1bWUgYXMgXCJDbGFtcFwiXG4gICAgfSBlbHNlIGlmICh4IDw9IGFycls0ICogb3V0Tm9kZV0pIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGluTm9kZSA9IG91dE5vZGUgLSAxO1xuICBpZiAoaW5Ob2RlIDwgMCkge1xuICAgIHJldHVybiBhcnJbNCAqIGluTm9kZSArIDVdOyAvLyB0b28gYmVoaW5kISEgYXNzdW1lIGFzIFwiQ2xhbXBcIlxuICB9XG5cbiAgLy8gLS0gY2FsY3VsYXRlIGxvY2FsIHggLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGNvbnN0IHgwID0gYXJyWzQgKiBpbk5vZGVdO1xuICBjb25zdCB4MSA9IGFycls0ICogb3V0Tm9kZV07XG4gIGNvbnN0IHhIZXJtaXRlID0gKHggLSB4MCkgLyAoeDEgLSB4MCk7XG5cbiAgLy8gLS0gZmluYWxseSBkbyB0aGUgaGVybWl0ZSBzcGxpbmUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGNvbnN0IHkwID0gYXJyWzQgKiBpbk5vZGUgKyAxXTtcbiAgY29uc3QgeTEgPSBhcnJbNCAqIG91dE5vZGUgKyAxXTtcbiAgY29uc3QgdDAgPSBhcnJbNCAqIGluTm9kZSArIDNdO1xuICBjb25zdCB0MSA9IGFycls0ICogb3V0Tm9kZSArIDJdO1xuICByZXR1cm4gaGVybWl0ZVNwbGluZSh5MCwgeTEsIHQwLCB0MSwgeEhlcm1pdGUpO1xufTtcblxuLyoqXG4gKiBUaGlzIGlzIGFuIGVxdWl2YWxlbnQgb2YgQ3VydmVNYXBwZXIgY2xhc3MgZGVmaW5lZCBpbiBVbmlWUk0uXG4gKiBXaWxsIGJlIHVzZWQgZm9yIFtbVlJNTG9va0F0QXBwbHllcl1dcywgdG8gZGVmaW5lIGJlaGF2aW9yIG9mIExvb2tBdC5cbiAqXG4gKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9Mb29rQXQvQ3VydmVNYXBwZXIuY3NcbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUN1cnZlTWFwcGVyIHtcbiAgLyoqXG4gICAqIEFuIGFycmF5IHJlcHJlc2VudHMgdGhlIGN1cnZlLiBTZWUgQW5pbWF0aW9uQ3VydmUgY2xhc3Mgb2YgVW5pdHkgZm9yIGl0cyBkZXRhaWxzLlxuICAgKlxuICAgKiBTZWU6IGh0dHBzOi8vZG9jcy51bml0eTNkLmNvbS9qYS9jdXJyZW50L1NjcmlwdFJlZmVyZW5jZS9BbmltYXRpb25DdXJ2ZS5odG1sXG4gICAqL1xuICBwdWJsaWMgY3VydmU6IG51bWJlcltdID0gWzAuMCwgMC4wLCAwLjAsIDEuMCwgMS4wLCAxLjAsIDEuMCwgMC4wXTtcblxuICAvKipcbiAgICogVGhlIG1heGltdW0gaW5wdXQgcmFuZ2Ugb2YgdGhlIFtbVlJNQ3VydmVNYXBwZXJdXS5cbiAgICovXG4gIHB1YmxpYyBjdXJ2ZVhSYW5nZURlZ3JlZSA9IDkwLjA7XG5cbiAgLyoqXG4gICAqIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZSBvZiB0aGUgW1tWUk1DdXJ2ZU1hcHBlcl1dLlxuICAgKi9cbiAgcHVibGljIGN1cnZlWVJhbmdlRGVncmVlID0gMTAuMDtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNQ3VydmVNYXBwZXJdXS5cbiAgICpcbiAgICogQHBhcmFtIHhSYW5nZSBUaGUgbWF4aW11bSBpbnB1dCByYW5nZVxuICAgKiBAcGFyYW0geVJhbmdlIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZVxuICAgKiBAcGFyYW0gY3VydmUgQW4gYXJyYXkgcmVwcmVzZW50cyB0aGUgY3VydmVcbiAgICovXG4gIGNvbnN0cnVjdG9yKHhSYW5nZT86IG51bWJlciwgeVJhbmdlPzogbnVtYmVyLCBjdXJ2ZT86IG51bWJlcltdKSB7XG4gICAgaWYgKHhSYW5nZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmN1cnZlWFJhbmdlRGVncmVlID0geFJhbmdlO1xuICAgIH1cblxuICAgIGlmICh5UmFuZ2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jdXJ2ZVlSYW5nZURlZ3JlZSA9IHlSYW5nZTtcbiAgICB9XG5cbiAgICBpZiAoY3VydmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jdXJ2ZSA9IGN1cnZlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFdmFsdWF0ZSBhbiBpbnB1dCB2YWx1ZSBhbmQgb3V0cHV0IGEgbWFwcGVkIHZhbHVlLlxuICAgKlxuICAgKiBAcGFyYW0gc3JjIFRoZSBpbnB1dCB2YWx1ZVxuICAgKi9cbiAgcHVibGljIG1hcChzcmM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgY2xhbXBlZFNyYyA9IE1hdGgubWluKE1hdGgubWF4KHNyYywgMC4wKSwgdGhpcy5jdXJ2ZVhSYW5nZURlZ3JlZSk7XG4gICAgY29uc3QgeCA9IGNsYW1wZWRTcmMgLyB0aGlzLmN1cnZlWFJhbmdlRGVncmVlO1xuICAgIHJldHVybiB0aGlzLmN1cnZlWVJhbmdlRGVncmVlICogZXZhbHVhdGVDdXJ2ZSh0aGlzLmN1cnZlLCB4KTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgdXNlZCBieSBbW1ZSTUxvb2tBdEhlYWRdXSwgYXBwbGllcyBsb29rIGF0IGRpcmVjdGlvbi5cbiAqIFRoZXJlIGFyZSBjdXJyZW50bHkgdHdvIHZhcmlhbnQgb2YgYXBwbGllcjogW1tWUk1Mb29rQXRCb25lQXBwbHllcl1dIGFuZCBbW1ZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyXV0uXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBWUk1Mb29rQXRBcHBseWVyIHtcbiAgLyoqXG4gICAqIEl0IHJlcHJlc2VudHMgaXRzIHR5cGUgb2YgYXBwbGllci5cbiAgICovXG4gIHB1YmxpYyBhYnN0cmFjdCByZWFkb25seSB0eXBlOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZTtcblxuICAvKipcbiAgICogQXBwbHkgbG9vayBhdCBkaXJlY3Rpb24gdG8gaXRzIGFzc29jaWF0ZWQgVlJNIG1vZGVsLlxuICAgKlxuICAgKiBAcGFyYW0gZXVsZXIgYFRIUkVFLkV1bGVyYCBvYmplY3QgdGhhdCByZXByZXNlbnRzIHRoZSBsb29rIGF0IGRpcmVjdGlvblxuICAgKi9cbiAgcHVibGljIGFic3RyYWN0IGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkO1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNQmxlbmRTaGFwZVByb3h5IH0gZnJvbSAnLi4vYmxlbmRzaGFwZSc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpcyB1c2VkIGJ5IFtbVlJNTG9va0F0SGVhZF1dLCBhcHBsaWVzIGxvb2sgYXQgZGlyZWN0aW9uIHRvIGV5ZSBibGVuZCBzaGFwZXMgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllciBleHRlbmRzIFZSTUxvb2tBdEFwcGx5ZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJsZW5kU2hhcGU7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVIb3Jpem9udGFsOiBWUk1DdXJ2ZU1hcHBlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbERvd246IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX2JsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5O1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIuXG4gICAqXG4gICAqIEBwYXJhbSBibGVuZFNoYXBlUHJveHkgQSBbW1ZSTUJsZW5kU2hhcGVQcm94eV1dIHVzZWQgYnkgdGhpcyBhcHBsaWVyXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWwgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdHJhbnN2ZXJzZSBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxEb3duIEEgW1tWUk1DdXJ2ZU1hcHBlcl1dIHVzZWQgZm9yIGRvd24gZGlyZWN0aW9uXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsVXAgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdXAgZGlyZWN0aW9uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBjdXJ2ZUhvcml6b250YWw6IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlVmVydGljYWxEb3duOiBWUk1DdXJ2ZU1hcHBlcixcbiAgICBjdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyLFxuICApIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5fY3VydmVIb3Jpem9udGFsID0gY3VydmVIb3Jpem9udGFsO1xuICAgIHRoaXMuX2N1cnZlVmVydGljYWxEb3duID0gY3VydmVWZXJ0aWNhbERvd247XG4gICAgdGhpcy5fY3VydmVWZXJ0aWNhbFVwID0gY3VydmVWZXJ0aWNhbFVwO1xuXG4gICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5ID0gYmxlbmRTaGFwZVByb3h5O1xuICB9XG5cbiAgcHVibGljIG5hbWUoKTogVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUge1xuICAgIHJldHVybiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZS5CbGVuZFNoYXBlO1xuICB9XG5cbiAgcHVibGljIGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkIHtcbiAgICBjb25zdCBzcmNYID0gZXVsZXIueDtcbiAgICBjb25zdCBzcmNZID0gZXVsZXIueTtcblxuICAgIGlmIChzcmNYIDwgMC4wKSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2t1cCwgMC4wKTtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2Rvd24sIHRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tkb3duLCAwLjApO1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rdXAsIHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCkpO1xuICAgIH1cblxuICAgIGlmIChzcmNZIDwgMC4wKSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tsZWZ0LCAwLjApO1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rcmlnaHQsIHRoaXMuX2N1cnZlSG9yaXpvbnRhbC5tYXAoLXNyY1kpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rcmlnaHQsIDAuMCk7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tsZWZ0LCB0aGlzLl9jdXJ2ZUhvcml6b250YWwubWFwKHNyY1kpKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi4vZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb24nO1xuaW1wb3J0IHsgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSB9IGZyb20gJy4uL3V0aWxzL21hdGgnO1xuaW1wb3J0IHsgcXVhdEludmVydENvbXBhdCB9IGZyb20gJy4uL3V0aWxzL3F1YXRJbnZlcnRDb21wYXQnO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5cbmNvbnN0IFZFQ1RPUjNfRlJPTlQgPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAtMS4wKSk7XG5cbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3YzQiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNDID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF9xdWF0ID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgbG9vayBhdCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEhlYWQge1xuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IEVVTEVSX09SREVSID0gJ1lYWic7IC8vIHlhdy1waXRjaC1yb2xsXG5cbiAgLyoqXG4gICAqIEFzc29jaWF0ZWQgW1tWUk1GaXJzdFBlcnNvbl1dLCB3aWxsIGJlIHVzZWQgZm9yIGRpcmVjdGlvbiBjYWxjdWxhdGlvbi5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBmaXJzdFBlcnNvbjogVlJNRmlyc3RQZXJzb247XG5cbiAgLyoqXG4gICAqIEFzc29jaWF0ZWQgW1tWUk1Mb29rQXRBcHBseWVyXV0sIGl0cyBsb29rIGF0IGRpcmVjdGlvbiB3aWxsIGJlIGFwcGxpZWQgdG8gdGhlIG1vZGVsIHVzaW5nIHRoaXMgYXBwbGllci5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBhcHBseWVyPzogVlJNTG9va0F0QXBwbHllcjtcblxuICAvKipcbiAgICogSWYgdGhpcyBpcyB0cnVlLCBpdHMgbG9vayBhdCBkaXJlY3Rpb24gd2lsbCBiZSB1cGRhdGVkIGF1dG9tYXRpY2FsbHkgYnkgY2FsbGluZyBbW1ZSTUxvb2tBdEhlYWQudXBkYXRlXV0gKHdoaWNoIGlzIGNhbGxlZCBmcm9tIFtbVlJNLnVwZGF0ZV1dKS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNTG9va0F0SGVhZC50YXJnZXRdXVxuICAgKi9cbiAgcHVibGljIGF1dG9VcGRhdGUgPSB0cnVlO1xuXG4gIC8qKlxuICAgKiBUaGUgdGFyZ2V0IG9iamVjdCBvZiB0aGUgbG9vayBhdC5cbiAgICogTm90ZSB0aGF0IGl0IGRvZXMgbm90IG1ha2UgYW55IHNlbnNlIGlmIFtbVlJNTG9va0F0SGVhZC5hdXRvVXBkYXRlXV0gaXMgZGlzYWJsZWQuXG4gICAqL1xuICBwdWJsaWMgdGFyZ2V0PzogVEhSRUUuT2JqZWN0M0Q7XG5cbiAgcHJvdGVjdGVkIF9ldWxlcjogVEhSRUUuRXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoMC4wLCAwLjAsIDAuMCwgVlJNTG9va0F0SGVhZC5FVUxFUl9PUkRFUik7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRIZWFkLlxuICAgKlxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb24gQSBbW1ZSTUZpcnN0UGVyc29uXV0gdGhhdCB3aWxsIGJlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG5ldyBWUk1Mb29rQXRIZWFkXG4gICAqIEBwYXJhbSBhcHBseWVyIEEgW1tWUk1Mb29rQXRBcHBseWVyXV0gdGhhdCB3aWxsIGJlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIG5ldyBWUk1Mb29rQXRIZWFkXG4gICAqL1xuICBjb25zdHJ1Y3RvcihmaXJzdFBlcnNvbjogVlJNRmlyc3RQZXJzb24sIGFwcGx5ZXI/OiBWUk1Mb29rQXRBcHBseWVyKSB7XG4gICAgdGhpcy5maXJzdFBlcnNvbiA9IGZpcnN0UGVyc29uO1xuICAgIHRoaXMuYXBwbHllciA9IGFwcGx5ZXI7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGl0cyBsb29rIGF0IGRpcmVjdGlvbiBpbiB3b3JsZCBjb29yZGluYXRlLlxuICAgKlxuICAgKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IGBUSFJFRS5WZWN0b3IzYFxuICAgKi9cbiAgcHVibGljIGdldExvb2tBdFdvcmxkRGlyZWN0aW9uKHRhcmdldDogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLlZlY3RvcjMge1xuICAgIGNvbnN0IHJvdCA9IGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5maXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmUsIF9xdWF0KTtcbiAgICByZXR1cm4gdGFyZ2V0LmNvcHkoVkVDVE9SM19GUk9OVCkuYXBwbHlFdWxlcih0aGlzLl9ldWxlcikuYXBwbHlRdWF0ZXJuaW9uKHJvdCk7XG4gIH1cblxuICAvKipcbiAgICogU2V0IGl0cyBsb29rIGF0IHBvc2l0aW9uLlxuICAgKiBOb3RlIHRoYXQgaXRzIHJlc3VsdCB3aWxsIGJlIGluc3RhbnRseSBvdmVyd3JpdHRlbiBpZiBbW1ZSTUxvb2tBdEhlYWQuYXV0b1VwZGF0ZV1dIGlzIGVuYWJsZWQuXG4gICAqXG4gICAqIEBwYXJhbSBwb3NpdGlvbiBBIHRhcmdldCBwb3NpdGlvblxuICAgKi9cbiAgcHVibGljIGxvb2tBdChwb3NpdGlvbjogVEhSRUUuVmVjdG9yMyk6IHZvaWQge1xuICAgIHRoaXMuX2NhbGNFdWxlcih0aGlzLl9ldWxlciwgcG9zaXRpb24pO1xuXG4gICAgaWYgKHRoaXMuYXBwbHllcikge1xuICAgICAgdGhpcy5hcHBseWVyLmxvb2tBdCh0aGlzLl9ldWxlcik7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgVlJNTG9va0F0SGVhZC5cbiAgICogSWYgW1tWUk1Mb29rQXRIZWFkLmF1dG9VcGRhdGVdXSBpcyBkaXNhYmxlZCwgaXQgd2lsbCBkbyBub3RoaW5nLlxuICAgKlxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAodGhpcy50YXJnZXQgJiYgdGhpcy5hdXRvVXBkYXRlKSB7XG4gICAgICB0aGlzLmxvb2tBdCh0aGlzLnRhcmdldC5nZXRXb3JsZFBvc2l0aW9uKF92M0EpKTtcblxuICAgICAgaWYgKHRoaXMuYXBwbHllcikge1xuICAgICAgICB0aGlzLmFwcGx5ZXIubG9va0F0KHRoaXMuX2V1bGVyKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NhbGNFdWxlcih0YXJnZXQ6IFRIUkVFLkV1bGVyLCBwb3NpdGlvbjogVEhSRUUuVmVjdG9yMyk6IFRIUkVFLkV1bGVyIHtcbiAgICBjb25zdCBoZWFkUG9zaXRpb24gPSB0aGlzLmZpcnN0UGVyc29uLmdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbihfdjNCKTtcblxuICAgIC8vIExvb2sgYXQgZGlyZWN0aW9uIGluIHdvcmxkIGNvb3JkaW5hdGVcbiAgICBjb25zdCBsb29rQXREaXIgPSBfdjNDLmNvcHkocG9zaXRpb24pLnN1YihoZWFkUG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuXG4gICAgLy8gVHJhbnNmb3JtIHRoZSBkaXJlY3Rpb24gaW50byBsb2NhbCBjb29yZGluYXRlIGZyb20gdGhlIGZpcnN0IHBlcnNvbiBib25lXG4gICAgbG9va0F0RGlyLmFwcGx5UXVhdGVybmlvbihxdWF0SW52ZXJ0Q29tcGF0KGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5maXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmUsIF9xdWF0KSkpO1xuXG4gICAgLy8gY29udmVydCB0aGUgZGlyZWN0aW9uIGludG8gZXVsZXJcbiAgICB0YXJnZXQueCA9IE1hdGguYXRhbjIobG9va0F0RGlyLnksIE1hdGguc3FydChsb29rQXREaXIueCAqIGxvb2tBdERpci54ICsgbG9va0F0RGlyLnogKiBsb29rQXREaXIueikpO1xuICAgIHRhcmdldC55ID0gTWF0aC5hdGFuMigtbG9va0F0RGlyLngsIC1sb29rQXREaXIueik7XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IEdMVEZOb2RlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkJztcblxuY29uc3QgX2V1bGVyID0gbmV3IFRIUkVFLkV1bGVyKDAuMCwgMC4wLCAwLjAsIFZSTUxvb2tBdEhlYWQuRVVMRVJfT1JERVIpO1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgdXNlZCBieSBbW1ZSTUxvb2tBdEhlYWRdXSwgYXBwbGllcyBsb29rIGF0IGRpcmVjdGlvbiB0byBleWUgYm9uZXMgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRCb25lQXBwbHllciBleHRlbmRzIFZSTUxvb2tBdEFwcGx5ZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgdHlwZSA9IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJvbmU7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVIb3Jpem9udGFsSW5uZXI6IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZUhvcml6b250YWxPdXRlcjogVlJNQ3VydmVNYXBwZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnZlVmVydGljYWxEb3duOiBWUk1DdXJ2ZU1hcHBlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbFVwOiBWUk1DdXJ2ZU1hcHBlcjtcblxuICBwcml2YXRlIHJlYWRvbmx5IF9sZWZ0RXllOiBHTFRGTm9kZSB8IG51bGw7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3JpZ2h0RXllOiBHTFRGTm9kZSB8IG51bGw7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRCb25lQXBwbHllci5cbiAgICpcbiAgICogQHBhcmFtIGh1bWFub2lkIEEgW1tWUk1IdW1hbm9pZF1dIHVzZWQgYnkgdGhpcyBhcHBsaWVyXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWxJbm5lciBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBpbm5lciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxuICAgKiBAcGFyYW0gY3VydmVIb3Jpem9udGFsT3V0ZXIgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3Igb3V0ZXIgdHJhbnN2ZXJzZSBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxEb3duIEEgW1tWUk1DdXJ2ZU1hcHBlcl1dIHVzZWQgZm9yIGRvd24gZGlyZWN0aW9uXG4gICAqIEBwYXJhbSBjdXJ2ZVZlcnRpY2FsVXAgQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgdXAgZGlyZWN0aW9uXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICAgY3VydmVIb3Jpem9udGFsSW5uZXI6IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlSG9yaXpvbnRhbE91dGVyOiBWUk1DdXJ2ZU1hcHBlcixcbiAgICBjdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXIsXG4gICAgY3VydmVWZXJ0aWNhbFVwOiBWUk1DdXJ2ZU1hcHBlcixcbiAgKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyID0gY3VydmVIb3Jpem9udGFsSW5uZXI7XG4gICAgdGhpcy5fY3VydmVIb3Jpem9udGFsT3V0ZXIgPSBjdXJ2ZUhvcml6b250YWxPdXRlcjtcbiAgICB0aGlzLl9jdXJ2ZVZlcnRpY2FsRG93biA9IGN1cnZlVmVydGljYWxEb3duO1xuICAgIHRoaXMuX2N1cnZlVmVydGljYWxVcCA9IGN1cnZlVmVydGljYWxVcDtcblxuICAgIHRoaXMuX2xlZnRFeWUgPSBodW1hbm9pZC5nZXRCb25lTm9kZShWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZS5MZWZ0RXllKTtcbiAgICB0aGlzLl9yaWdodEV5ZSA9IGh1bWFub2lkLmdldEJvbmVOb2RlKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lLlJpZ2h0RXllKTtcbiAgfVxuXG4gIHB1YmxpYyBsb29rQXQoZXVsZXI6IFRIUkVFLkV1bGVyKTogdm9pZCB7XG4gICAgY29uc3Qgc3JjWCA9IGV1bGVyLng7XG4gICAgY29uc3Qgc3JjWSA9IGV1bGVyLnk7XG5cbiAgICAvLyBsZWZ0XG4gICAgaWYgKHRoaXMuX2xlZnRFeWUpIHtcbiAgICAgIGlmIChzcmNYIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci54ID0gLXRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueCA9IHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzcmNZIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci55ID0gLXRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyLm1hcCgtc3JjWSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueSA9IHRoaXMuX2N1cnZlSG9yaXpvbnRhbE91dGVyLm1hcChzcmNZKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fbGVmdEV5ZS5xdWF0ZXJuaW9uLnNldEZyb21FdWxlcihfZXVsZXIpO1xuICAgIH1cblxuICAgIC8vIHJpZ2h0XG4gICAgaWYgKHRoaXMuX3JpZ2h0RXllKSB7XG4gICAgICBpZiAoc3JjWCA8IDAuMCkge1xuICAgICAgICBfZXVsZXIueCA9IC10aGlzLl9jdXJ2ZVZlcnRpY2FsRG93bi5tYXAoLXNyY1gpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX2V1bGVyLnggPSB0aGlzLl9jdXJ2ZVZlcnRpY2FsVXAubWFwKHNyY1gpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc3JjWSA8IDAuMCkge1xuICAgICAgICBfZXVsZXIueSA9IC10aGlzLl9jdXJ2ZUhvcml6b250YWxPdXRlci5tYXAoLXNyY1kpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgX2V1bGVyLnkgPSB0aGlzLl9jdXJ2ZUhvcml6b250YWxJbm5lci5tYXAoc3JjWSk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuX3JpZ2h0RXllLnF1YXRlcm5pb24uc2V0RnJvbUV1bGVyKF9ldWxlcik7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi4vZmlyc3RwZXJzb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZCc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1DdXJ2ZU1hcHBlciB9IGZyb20gJy4vVlJNQ3VydmVNYXBwZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0QXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbHllcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0Qm9uZUFwcGx5ZXIgfSBmcm9tICcuL1ZSTUxvb2tBdEJvbmVBcHBseWVyJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWQnO1xuXG4vLyBUSFJFRS5NYXRoIGhhcyBiZWVuIHJlbmFtZWQgdG8gVEhSRUUuTWF0aFV0aWxzIHNpbmNlIHIxMTMuXG4vLyBXZSBhcmUgZ29pbmcgdG8gZGVmaW5lIHRoZSBERUcyUkFEIGJ5IG91cnNlbHZlcyBmb3IgYSB3aGlsZVxuLy8gaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzE4MjcwXG5jb25zdCBERUcyUkFEID0gTWF0aC5QSSAvIDE4MDsgLy8gVEhSRUUuTWF0aFV0aWxzLkRFRzJSQUQ7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1Mb29rQXRIZWFkXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1Mb29rQXRIZWFkXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBibGVuZFNoYXBlUHJveHkgQSBbW1ZSTUJsZW5kU2hhcGVQcm94eV1dIGluc3RhbmNlIHRoYXQgcmVwcmVzZW50cyB0aGUgVlJNXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIFtbVlJNSHVtYW5vaWRdXSBpbnN0YW5jZSB0aGF0IHJlcHJlc2VudHMgdGhlIFZSTVxuICAgKi9cbiAgcHVibGljIGltcG9ydChcbiAgICBnbHRmOiBHTFRGLFxuICAgIGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbixcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICk6IFZSTUxvb2tBdEhlYWQgfCBudWxsIHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5maXJzdFBlcnNvbjtcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBhcHBseWVyID0gdGhpcy5faW1wb3J0QXBwbHllcihzY2hlbWFGaXJzdFBlcnNvbiwgYmxlbmRTaGFwZVByb3h5LCBodW1hbm9pZCk7XG4gICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRIZWFkKGZpcnN0UGVyc29uLCBhcHBseWVyIHx8IHVuZGVmaW5lZCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2ltcG9ydEFwcGx5ZXIoXG4gICAgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbixcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICk6IFZSTUxvb2tBdEFwcGx5ZXIgfCBudWxsIHtcbiAgICBjb25zdCBsb29rQXRIb3Jpem9udGFsSW5uZXIgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRIb3Jpem9udGFsSW5uZXI7XG4gICAgY29uc3QgbG9va0F0SG9yaXpvbnRhbE91dGVyID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0SG9yaXpvbnRhbE91dGVyO1xuICAgIGNvbnN0IGxvb2tBdFZlcnRpY2FsRG93biA9IHNjaGVtYUZpcnN0UGVyc29uLmxvb2tBdFZlcnRpY2FsRG93bjtcbiAgICBjb25zdCBsb29rQXRWZXJ0aWNhbFVwID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VmVydGljYWxVcDtcblxuICAgIHN3aXRjaCAoc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VHlwZU5hbWUpIHtcbiAgICAgIGNhc2UgVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQm9uZToge1xuICAgICAgICBpZiAoXG4gICAgICAgICAgbG9va0F0SG9yaXpvbnRhbElubmVyID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBsb29rQXRIb3Jpem9udGFsT3V0ZXIgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGxvb2tBdFZlcnRpY2FsRG93biA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgbG9va0F0VmVydGljYWxVcCA9PT0gdW5kZWZpbmVkXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgVlJNTG9va0F0Qm9uZUFwcGx5ZXIoXG4gICAgICAgICAgICBodW1hbm9pZCxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQm9uZShsb29rQXRIb3Jpem9udGFsSW5uZXIpLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCb25lKGxvb2tBdEhvcml6b250YWxPdXRlciksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobG9va0F0VmVydGljYWxEb3duKSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQm9uZShsb29rQXRWZXJ0aWNhbFVwKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjYXNlIFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJsZW5kU2hhcGU6IHtcbiAgICAgICAgaWYgKGxvb2tBdEhvcml6b250YWxPdXRlciA9PT0gdW5kZWZpbmVkIHx8IGxvb2tBdFZlcnRpY2FsRG93biA9PT0gdW5kZWZpbmVkIHx8IGxvb2tBdFZlcnRpY2FsVXAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBuZXcgVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIoXG4gICAgICAgICAgICBibGVuZFNoYXBlUHJveHksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJsZW5kU2hhcGUobG9va0F0SG9yaXpvbnRhbE91dGVyKSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQmxlbmRTaGFwZShsb29rQXRWZXJ0aWNhbERvd24pLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCbGVuZFNoYXBlKGxvb2tBdFZlcnRpY2FsVXApLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGRlZmF1bHQ6IHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBfaW1wb3J0Q3VydmVNYXBwZXJCb25lKG1hcDogVlJNU2NoZW1hLkZpcnN0UGVyc29uRGVncmVlTWFwKTogVlJNQ3VydmVNYXBwZXIge1xuICAgIHJldHVybiBuZXcgVlJNQ3VydmVNYXBwZXIoXG4gICAgICB0eXBlb2YgbWFwLnhSYW5nZSA9PT0gJ251bWJlcicgPyBERUcyUkFEICogbWFwLnhSYW5nZSA6IHVuZGVmaW5lZCxcbiAgICAgIHR5cGVvZiBtYXAueVJhbmdlID09PSAnbnVtYmVyJyA/IERFRzJSQUQgKiBtYXAueVJhbmdlIDogdW5kZWZpbmVkLFxuICAgICAgbWFwLmN1cnZlLFxuICAgICk7XG4gIH1cblxuICBwcml2YXRlIF9pbXBvcnRDdXJ2ZU1hcHBlckJsZW5kU2hhcGUobWFwOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25EZWdyZWVNYXApOiBWUk1DdXJ2ZU1hcHBlciB7XG4gICAgcmV0dXJuIG5ldyBWUk1DdXJ2ZU1hcHBlcih0eXBlb2YgbWFwLnhSYW5nZSA9PT0gJ251bWJlcicgPyBERUcyUkFEICogbWFwLnhSYW5nZSA6IHVuZGVmaW5lZCwgbWFwLnlSYW5nZSwgbWFwLmN1cnZlKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG4vLyBTaW5jZSB0aGVzZSBjb25zdGFudHMgYXJlIGRlbGV0ZWQgaW4gcjEzNiB3ZSBoYXZlIHRvIGRlZmluZSBieSBvdXJzZWx2ZXNcbi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xuY29uc3QgUkdCRUVuY29kaW5nID0gMzAwMjtcbmNvbnN0IFJHQk03RW5jb2RpbmcgPSAzMDA0O1xuY29uc3QgUkdCTTE2RW5jb2RpbmcgPSAzMDA1O1xuY29uc3QgUkdCREVuY29kaW5nID0gMzAwNjtcbmNvbnN0IEdhbW1hRW5jb2RpbmcgPSAzMDA3O1xuLyogZXNsaW50LWVuYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cblxuLyoqXG4gKiBDT01QQVQ6IHByZS1yMTM3XG4gKiBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9yMTM2L3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtLmpzI0wyMlxuICovXG5leHBvcnQgY29uc3QgZ2V0RW5jb2RpbmdDb21wb25lbnRzID0gKGVuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2RpbmcpOiBbc3RyaW5nLCBzdHJpbmddID0+IHtcbiAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPj0gMTM2KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSBUSFJFRS5MaW5lYXJFbmNvZGluZzpcbiAgICAgICAgcmV0dXJuIFsnTGluZWFyJywgJyggdmFsdWUgKSddO1xuICAgICAgY2FzZSBUSFJFRS5zUkdCRW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ3NSR0InLCAnKCB2YWx1ZSApJ107XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBjb25zb2xlLndhcm4oJ1RIUkVFLldlYkdMUHJvZ3JhbTogVW5zdXBwb3J0ZWQgZW5jb2Rpbmc6JywgZW5jb2RpbmcpO1xuICAgICAgICByZXR1cm4gWydMaW5lYXInLCAnKCB2YWx1ZSApJ107XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIENPTVBBVDogcHJlLXIxMzZcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlIFRIUkVFLkxpbmVhckVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydMaW5lYXInLCAnKCB2YWx1ZSApJ107XG4gICAgICBjYXNlIFRIUkVFLnNSR0JFbmNvZGluZzpcbiAgICAgICAgcmV0dXJuIFsnc1JHQicsICcoIHZhbHVlICknXTtcbiAgICAgIGNhc2UgUkdCRUVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydSR0JFJywgJyggdmFsdWUgKSddO1xuICAgICAgY2FzZSBSR0JNN0VuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydSR0JNJywgJyggdmFsdWUsIDcuMCApJ107XG4gICAgICBjYXNlIFJHQk0xNkVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydSR0JNJywgJyggdmFsdWUsIDE2LjAgKSddO1xuICAgICAgY2FzZSBSR0JERW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ1JHQkQnLCAnKCB2YWx1ZSwgMjU2LjAgKSddO1xuICAgICAgY2FzZSBHYW1tYUVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydHYW1tYScsICcoIHZhbHVlLCBmbG9hdCggR0FNTUFfRkFDVE9SICkgKSddO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogQ09NUEFUOiBwcmUtcjEzN1xuICogVGhpcyBmdW5jdGlvbiBpcyBubyBsb25nZXIgcmVxdWlyZWQgYmVnaW5uaW5nIGZyb20gcjEzN1xuICpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9yMTM2L3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtLmpzI0w1MlxuICovXG5leHBvcnQgY29uc3QgZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uID0gKGZ1bmN0aW9uTmFtZTogc3RyaW5nLCBlbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nKTogc3RyaW5nID0+IHtcbiAgY29uc3QgY29tcG9uZW50cyA9IGdldEVuY29kaW5nQ29tcG9uZW50cyhlbmNvZGluZyk7XG4gIHJldHVybiAndmVjNCAnICsgZnVuY3Rpb25OYW1lICsgJyggdmVjNCB2YWx1ZSApIHsgcmV0dXJuICcgKyBjb21wb25lbnRzWzBdICsgJ1RvTGluZWFyJyArIGNvbXBvbmVudHNbMV0gKyAnOyB9Jztcbn07XG4iLCIvKiB0c2xpbnQ6ZGlzYWJsZTptZW1iZXItb3JkZXJpbmcgKi9cblxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHZlcnRleFNoYWRlciBmcm9tICcuL3NoYWRlcnMvbXRvb24udmVydCc7XG5pbXBvcnQgZnJhZ21lbnRTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL210b29uLmZyYWcnO1xuaW1wb3J0IHsgZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uIH0gZnJvbSAnLi9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24nO1xuXG5jb25zdCBUQVUgPSAyLjAgKiBNYXRoLlBJO1xuXG5leHBvcnQgaW50ZXJmYWNlIE1Ub29uUGFyYW1ldGVycyBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsUGFyYW1ldGVycyB7XG4gIG1Ub29uVmVyc2lvbj86IG51bWJlcjsgLy8gX01Ub29uVmVyc2lvblxuXG4gIGN1dG9mZj86IG51bWJlcjsgLy8gX0N1dG9mZlxuICBjb2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIHJnYiBvZiBfQ29sb3JcbiAgc2hhZGVDb2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9TaGFkZUNvbG9yXG4gIG1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4XG4gIG1haW5UZXg/OiBUSFJFRS5UZXh0dXJlOyAvLyBfTWFpblRleCAod2lsbCBiZSByZW5hbWVkIHRvIG1hcClcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICBtYWluVGV4X1NUPzogVEhSRUUuVmVjdG9yNDsgLy8gX01haW5UZXhfU1RcbiAgc2hhZGVUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1NoYWRlVGV4dHVyZVxuICBidW1wU2NhbGU/OiBudW1iZXI7IC8vIF9CdW1wU2NhbGUgKHdpbGwgYmUgY29udmVydGVkIHRvIG5vcm1hbFNjYWxlKVxuICBub3JtYWxNYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfQnVtcE1hcFxuICBub3JtYWxNYXBUeXBlPzogVEhSRUUuTm9ybWFsTWFwVHlwZXM7IC8vIFRocmVlLmpzIHNwZWNpZmljIHZhbHVlXG4gIG5vcm1hbFNjYWxlPzogVEhSRUUuVmVjdG9yMjsgLy8gX0J1bXBTY2FsZSBpbiBUaHJlZS5qcyBmYXNoaW9uXG4gIGJ1bXBNYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfQnVtcE1hcCAod2lsbCBiZSByZW5hbWVkIHRvIG5vcm1hbE1hcClcbiAgcmVjZWl2ZVNoYWRvd1JhdGU/OiBudW1iZXI7IC8vIF9SZWNlaXZlU2hhZG93UmF0ZVxuICByZWNlaXZlU2hhZG93VGV4dHVyZT86IFRIUkVFLlRleHR1cmU7IC8vIF9SZWNlaXZlU2hhZG93VGV4dHVyZVxuICBzaGFkaW5nR3JhZGVSYXRlPzogbnVtYmVyOyAvLyBfU2hhZGluZ0dyYWRlUmF0ZVxuICBzaGFkaW5nR3JhZGVUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1NoYWRpbmdHcmFkZVRleHR1cmVcbiAgc2hhZGVTaGlmdD86IG51bWJlcjsgLy8gX1NoYWRlU2hpZnRcbiAgc2hhZGVUb29ueT86IG51bWJlcjsgLy8gX1NoYWRlVG9vbnlcbiAgbGlnaHRDb2xvckF0dGVudWF0aW9uPzogbnVtYmVyOyAvLyBfTGlnaHRDb2xvckF0dGVudWF0aW9uXG4gIGluZGlyZWN0TGlnaHRJbnRlbnNpdHk/OiBudW1iZXI7IC8vIF9JbmRpcmVjdExpZ2h0SW50ZW5zaXR5XG4gIHJpbVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfUmltVGV4dHVyZVxuICByaW1Db2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9SaW1Db2xvclxuICByaW1MaWdodGluZ01peD86IG51bWJlcjsgLy8gX1JpbUxpZ2h0aW5nTWl4XG4gIHJpbUZyZXNuZWxQb3dlcj86IG51bWJlcjsgLy8gX1JpbUZyZXNuZWxQb3dlclxuICByaW1MaWZ0PzogbnVtYmVyOyAvLyBfUmltTGlmdFxuICBzcGhlcmVBZGQ/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU3BoZXJlQWRkXG4gIGVtaXNzaW9uQ29sb3I/OiBUSFJFRS5WZWN0b3I0OyAvLyBfRW1pc3Npb25Db2xvclxuICBlbWlzc2l2ZU1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9FbWlzc2lvbk1hcFxuICBlbWlzc2lvbk1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9FbWlzc2lvbk1hcCAod2lsbCBiZSByZW5hbWVkIHRvIGVtaXNzaXZlTWFwKVxuICBvdXRsaW5lV2lkdGhUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVcbiAgb3V0bGluZVdpZHRoPzogbnVtYmVyOyAvLyBfT3V0bGluZVdpZHRoXG4gIG91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZT86IG51bWJlcjsgLy8gX091dGxpbmVTY2FsZWRNYXhEaXN0YW5jZVxuICBvdXRsaW5lQ29sb3I/OiBUSFJFRS5WZWN0b3I0OyAvLyBfT3V0bGluZUNvbG9yXG4gIG91dGxpbmVMaWdodGluZ01peD86IG51bWJlcjsgLy8gX091dGxpbmVMaWdodGluZ01peFxuICB1dkFuaW1NYXNrVGV4dHVyZT86IFRIUkVFLlRleHR1cmU7IC8vIF9VdkFuaW1NYXNrVGV4dHVyZVxuICB1dkFuaW1TY3JvbGxYPzogbnVtYmVyOyAvLyBfVXZBbmltU2Nyb2xsWFxuICB1dkFuaW1TY3JvbGxZPzogbnVtYmVyOyAvLyBfVXZBbmltU2Nyb2xsWVxuICB1dkFuaW1Sb3RhdGlvbj86IG51bWJlcjsgLy8gX3V2QW5pbVJvdGF0aW9uXG5cbiAgZGVidWdNb2RlPzogTVRvb25NYXRlcmlhbERlYnVnTW9kZSB8IG51bWJlcjsgLy8gX0RlYnVnTW9kZVxuICBibGVuZE1vZGU/OiBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZSB8IG51bWJlcjsgLy8gX0JsZW5kTW9kZVxuICBvdXRsaW5lV2lkdGhNb2RlPzogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUgfCBudW1iZXI7IC8vIE91dGxpbmVXaWR0aE1vZGVcbiAgb3V0bGluZUNvbG9yTW9kZT86IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIHwgbnVtYmVyOyAvLyBPdXRsaW5lQ29sb3JNb2RlXG4gIGN1bGxNb2RlPzogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHwgbnVtYmVyOyAvLyBfQ3VsbE1vZGVcbiAgb3V0bGluZUN1bGxNb2RlPzogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHwgbnVtYmVyOyAvLyBfT3V0bGluZUN1bGxNb2RlXG4gIHNyY0JsZW5kPzogbnVtYmVyOyAvLyBfU3JjQmxlbmRcbiAgZHN0QmxlbmQ/OiBudW1iZXI7IC8vIF9Ec3RCbGVuZFxuICB6V3JpdGU/OiBudW1iZXI7IC8vIF9aV3JpdGUgKHdpbGwgYmUgcmVuYW1lZCB0byBkZXB0aFdyaXRlKVxuXG4gIGlzT3V0bGluZT86IGJvb2xlYW47XG4gIGZvZz86IGFueTtcblxuICAvKipcbiAgICogU3BlY2lmeSB0aGUgZW5jb2Rpbmcgb2YgaW5wdXQgdW5pZm9ybSBjb2xvcnMuXG4gICAqXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuc1JHQkVuY29kaW5nYCwgdXNlIGBUSFJFRS5zUkdCRW5jb2RpbmdgLlxuICAgKlxuICAgKiBFbmNvZGluZ3Mgb2YgdGV4dHVyZXMgc2hvdWxkIGJlIHNldCBpbmRlcGVuZGVudGx5IG9uIHRleHR1cmVzLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgdXNlIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AgaWYgdGhpcyBvcHRpb24gaXNuJ3Qgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBTZWUgYWxzbzogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vcmVuZGVyZXJzL1dlYkdMUmVuZGVyZXIub3V0cHV0RW5jb2RpbmdcbiAgICovXG4gIGVuY29kaW5nPzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUge1xuICBPZmYsXG4gIEZyb250LFxuICBCYWNrLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHtcbiAgTm9uZSxcbiAgTm9ybWFsLFxuICBMaXRTaGFkZVJhdGUsXG4gIFVWLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSB7XG4gIEZpeGVkQ29sb3IsXG4gIE1peGVkTGlnaHRpbmcsXG59XG5cbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcbiAgTm9uZSxcbiAgV29ybGRDb29yZGluYXRlcyxcbiAgU2NyZWVuQ29vcmRpbmF0ZXMsXG59XG5cbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHtcbiAgT3BhcXVlLFxuICBDdXRvdXQsXG4gIFRyYW5zcGFyZW50LFxuICBUcmFuc3BhcmVudFdpdGhaV3JpdGUsXG59XG5cbi8qKlxuICogTVRvb24gaXMgYSBtYXRlcmlhbCBzcGVjaWZpY2F0aW9uIHRoYXQgaGFzIHZhcmlvdXMgZmVhdHVyZXMuXG4gKiBUaGUgc3BlYyBhbmQgaW1wbGVtZW50YXRpb24gYXJlIG9yaWdpbmFsbHkgZm91bmRlZCBmb3IgVW5pdHkgZW5naW5lIGFuZCB0aGlzIGlzIGEgcG9ydCBvZiB0aGUgbWF0ZXJpYWwuXG4gKlxuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vU2FudGFyaC9NVG9vblxuICovXG5leHBvcnQgY2xhc3MgTVRvb25NYXRlcmlhbCBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsIHtcbiAgLyoqXG4gICAqIFJlYWRvbmx5IGJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhpcyBpcyBhIFtbTVRvb25NYXRlcmlhbF1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGlzTVRvb25NYXRlcmlhbDogYm9vbGVhbiA9IHRydWU7XG5cbiAgcHVibGljIGN1dG9mZiA9IDAuNTsgLy8gX0N1dG9mZlxuICBwdWJsaWMgY29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgxLjAsIDEuMCwgMS4wLCAxLjApOyAvLyBfQ29sb3JcbiAgcHVibGljIHNoYWRlQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjk3LCAwLjgxLCAwLjg2LCAxLjApOyAvLyBfU2hhZGVDb2xvclxuICBwdWJsaWMgbWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9NYWluVGV4XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgcHVibGljIG1haW5UZXhfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfTWFpblRleF9TVFxuICBwdWJsaWMgc2hhZGVUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9TaGFkZVRleHR1cmVcbiAgLy8gcHVibGljIHNoYWRlVGV4dHVyZV9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9TaGFkZVRleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIG5vcm1hbE1hcDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfQnVtcE1hcC4gYWdhaW4sIFRISVMgSVMgX0J1bXBNYXBcbiAgcHVibGljIG5vcm1hbE1hcFR5cGUgPSBUSFJFRS5UYW5nZW50U3BhY2VOb3JtYWxNYXA7IC8vIFRocmVlLmpzIHJlcXVpcmVzIHRoaXNcbiAgcHVibGljIG5vcm1hbFNjYWxlID0gbmV3IFRIUkVFLlZlY3RvcjIoMS4wLCAxLjApOyAvLyBfQnVtcFNjYWxlLCBpbiBWZWN0b3IyXG4gIC8vIHB1YmxpYyBidW1wTWFwX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX0J1bXBNYXBfU1QgKHVudXNlZClcbiAgcHVibGljIHJlY2VpdmVTaGFkb3dSYXRlID0gMS4wOyAvLyBfUmVjZWl2ZVNoYWRvd1JhdGVcbiAgcHVibGljIHJlY2VpdmVTaGFkb3dUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9SZWNlaXZlU2hhZG93VGV4dHVyZVxuICAvLyBwdWJsaWMgcmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfUmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIHNoYWRpbmdHcmFkZVJhdGUgPSAxLjA7IC8vIF9TaGFkaW5nR3JhZGVSYXRlXG4gIHB1YmxpYyBzaGFkaW5nR3JhZGVUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9TaGFkaW5nR3JhZGVUZXh0dXJlXG4gIC8vIHB1YmxpYyBzaGFkaW5nR3JhZGVUZXh0dXJlX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX1NoYWRpbmdHcmFkZVRleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIHNoYWRlU2hpZnQgPSAwLjA7IC8vIF9TaGFkZVNoaWZ0XG4gIHB1YmxpYyBzaGFkZVRvb255ID0gMC45OyAvLyBfU2hhZGVUb29ueVxuICBwdWJsaWMgbGlnaHRDb2xvckF0dGVudWF0aW9uID0gMC4wOyAvLyBfTGlnaHRDb2xvckF0dGVudWF0aW9uXG4gIHB1YmxpYyBpbmRpcmVjdExpZ2h0SW50ZW5zaXR5ID0gMC4xOyAvLyBfSW5kaXJlY3RMaWdodEludGVuc2l0eVxuICBwdWJsaWMgcmltVGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfUmltVGV4dHVyZVxuICBwdWJsaWMgcmltQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMC4wLCAxLjApOyAvLyBfUmltQ29sb3JcbiAgcHVibGljIHJpbUxpZ2h0aW5nTWl4ID0gMC4wOyAvLyBfUmltTGlnaHRpbmdNaXhcbiAgcHVibGljIHJpbUZyZXNuZWxQb3dlciA9IDEuMDsgLy8gX1JpbUZyZXNuZWxQb3dlclxuICBwdWJsaWMgcmltTGlmdCA9IDAuMDsgLy8gX1JpbUxpZnRcbiAgcHVibGljIHNwaGVyZUFkZDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfU3BoZXJlQWRkXG4gIC8vIHB1YmxpYyBzcGhlcmVBZGRfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfU3BoZXJlQWRkX1NUICh1bnVzZWQpXG4gIHB1YmxpYyBlbWlzc2lvbkNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDAuMCwgMS4wKTsgLy8gX0VtaXNzaW9uQ29sb3JcbiAgcHVibGljIGVtaXNzaXZlTWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9FbWlzc2lvbk1hcFxuICAvLyBwdWJsaWMgZW1pc3Npb25NYXBfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfRW1pc3Npb25NYXBfU1QgKHVudXNlZClcbiAgcHVibGljIG91dGxpbmVXaWR0aFRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVcbiAgLy8gcHVibGljIG91dGxpbmVXaWR0aFRleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfT3V0bGluZVdpZHRoVGV4dHVyZV9TVCAodW51c2VkKVxuICBwdWJsaWMgb3V0bGluZVdpZHRoID0gMC41OyAvLyBfT3V0bGluZVdpZHRoXG4gIHB1YmxpYyBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2UgPSAxLjA7IC8vIF9PdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2VcbiAgcHVibGljIG91dGxpbmVDb2xvciA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAwLjAsIDEuMCk7IC8vIF9PdXRsaW5lQ29sb3JcbiAgcHVibGljIG91dGxpbmVMaWdodGluZ01peCA9IDEuMDsgLy8gX091dGxpbmVMaWdodGluZ01peFxuICBwdWJsaWMgdXZBbmltTWFza1RleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1V2QW5pbU1hc2tUZXh0dXJlXG4gIHB1YmxpYyB1dkFuaW1TY3JvbGxYID0gMC4wOyAvLyBfVXZBbmltU2Nyb2xsWFxuICBwdWJsaWMgdXZBbmltU2Nyb2xsWSA9IDAuMDsgLy8gX1V2QW5pbVNjcm9sbFlcbiAgcHVibGljIHV2QW5pbVJvdGF0aW9uID0gMC4wOyAvLyBfdXZBbmltUm90YXRpb25cblxuICBwdWJsaWMgc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7IC8vIHdoZW4gdGhpcyBpcyB0cnVlLCBhcHBseVVuaWZvcm1zIGVmZmVjdHNcblxuICAvKipcbiAgICogVGhlIGVuY29kaW5nIG9mIGlucHV0IHVuaWZvcm0gY29sb3JzLlxuICAgKlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYC5cbiAgICogV2hlbiB5b3VyIGByZW5kZXJlci5vdXRwdXRFbmNvZGluZ2AgaXMgYFRIUkVFLnNSR0JFbmNvZGluZ2AsIHVzZSBgVEhSRUUuc1JHQkVuY29kaW5nYC5cbiAgICpcbiAgICogRW5jb2RpbmdzIG9mIHRleHR1cmVzIGFyZSBzZXQgaW5kZXBlbmRlbnRseSBvbiB0ZXh0dXJlcy5cbiAgICpcbiAgICogVGhpcyBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgIGJ5IGRlZmF1bHQuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9yZW5kZXJlcnMvV2ViR0xSZW5kZXJlci5vdXRwdXRFbmNvZGluZ1xuICAgKi9cbiAgcHVibGljIGVuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmc7XG5cbiAgcHJpdmF0ZSBfZGVidWdNb2RlID0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5Ob25lOyAvLyBfRGVidWdNb2RlXG4gIHByaXZhdGUgX2JsZW5kTW9kZSA9IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLk9wYXF1ZTsgLy8gX0JsZW5kTW9kZVxuICBwcml2YXRlIF9vdXRsaW5lV2lkdGhNb2RlID0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuTm9uZTsgLy8gX091dGxpbmVXaWR0aE1vZGVcbiAgcHJpdmF0ZSBfb3V0bGluZUNvbG9yTW9kZSA9IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlLkZpeGVkQ29sb3I7IC8vIF9PdXRsaW5lQ29sb3JNb2RlXG4gIHByaXZhdGUgX2N1bGxNb2RlID0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkJhY2s7IC8vIF9DdWxsTW9kZVxuICBwcml2YXRlIF9vdXRsaW5lQ3VsbE1vZGUgPSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQ7IC8vIF9PdXRsaW5lQ3VsbE1vZGVcbiAgLy8gcHVibGljIHNyY0JsZW5kID0gMS4wOyAvLyBfU3JjQmxlbmQgKGlzIG5vdCBzdXBwb3J0ZWQpXG4gIC8vIHB1YmxpYyBkc3RCbGVuZCA9IDAuMDsgLy8gX0RzdEJsZW5kIChpcyBub3Qgc3VwcG9ydGVkKVxuICAvLyBwdWJsaWMgeldyaXRlID0gMS4wOyAvLyBfWldyaXRlICh3aWxsIGJlIGNvbnZlcnRlZCB0byBkZXB0aFdyaXRlKVxuXG4gIHByaXZhdGUgX2lzT3V0bGluZSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgX3V2QW5pbU9mZnNldFggPSAwLjA7XG4gIHByaXZhdGUgX3V2QW5pbU9mZnNldFkgPSAwLjA7XG4gIHByaXZhdGUgX3V2QW5pbVBoYXNlID0gMC4wO1xuXG4gIGNvbnN0cnVjdG9yKHBhcmFtZXRlcnM6IE1Ub29uUGFyYW1ldGVycyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMuZW5jb2RpbmcgPSBwYXJhbWV0ZXJzLmVuY29kaW5nIHx8IFRIUkVFLkxpbmVhckVuY29kaW5nO1xuICAgIGlmICh0aGlzLmVuY29kaW5nICE9PSBUSFJFRS5MaW5lYXJFbmNvZGluZyAmJiB0aGlzLmVuY29kaW5nICE9PSBUSFJFRS5zUkdCRW5jb2RpbmcpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgJ1RoZSBzcGVjaWZpZWQgY29sb3IgZW5jb2RpbmcgZG9lcyBub3Qgd29yayBwcm9wZXJseSB3aXRoIE1Ub29uTWF0ZXJpYWwuIFlvdSBtaWdodCB3YW50IHRvIHVzZSBUSFJFRS5zUkdCRW5jb2RpbmcgaW5zdGVhZC4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA9PSB0aGVzZSBwYXJhbWV0ZXIgaGFzIG5vIGNvbXBhdGliaWxpdHkgd2l0aCB0aGlzIGltcGxlbWVudGF0aW9uID09PT09PT09XG4gICAgW1xuICAgICAgJ21Ub29uVmVyc2lvbicsXG4gICAgICAnc2hhZGVUZXh0dXJlX1NUJyxcbiAgICAgICdidW1wTWFwX1NUJyxcbiAgICAgICdyZWNlaXZlU2hhZG93VGV4dHVyZV9TVCcsXG4gICAgICAnc2hhZGluZ0dyYWRlVGV4dHVyZV9TVCcsXG4gICAgICAncmltVGV4dHVyZV9TVCcsXG4gICAgICAnc3BoZXJlQWRkX1NUJyxcbiAgICAgICdlbWlzc2lvbk1hcF9TVCcsXG4gICAgICAnb3V0bGluZVdpZHRoVGV4dHVyZV9TVCcsXG4gICAgICAndXZBbmltTWFza1RleHR1cmVfU1QnLFxuICAgICAgJ3NyY0JsZW5kJyxcbiAgICAgICdkc3RCbGVuZCcsXG4gICAgXS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmICgocGFyYW1ldGVycyBhcyBhbnkpW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBjb25zb2xlLndhcm4oYFRIUkVFLiR7dGhpcy50eXBlfTogVGhlIHBhcmFtZXRlciBcIiR7a2V5fVwiIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gICAgICAgIGRlbGV0ZSAocGFyYW1ldGVycyBhcyBhbnkpW2tleV07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyA9PSBlbmFibGluZyBidW5jaCBvZiBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgcGFyYW1ldGVycy5mb2cgPSB0cnVlO1xuICAgIHBhcmFtZXRlcnMubGlnaHRzID0gdHJ1ZTtcbiAgICBwYXJhbWV0ZXJzLmNsaXBwaW5nID0gdHJ1ZTtcblxuICAgIC8vIENPTVBBVDogcHJlLXIxMjlcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMTc4OFxuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTI5KSB7XG4gICAgICAocGFyYW1ldGVycyBhcyBhbnkpLnNraW5uaW5nID0gKHBhcmFtZXRlcnMgYXMgYW55KS5za2lubmluZyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDT01QQVQ6IHByZS1yMTMxXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjIxNjlcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEzMSkge1xuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaFRhcmdldHMgPSAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoVGFyZ2V0cyB8fCBmYWxzZTtcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhOb3JtYWxzID0gKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaE5vcm1hbHMgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gPT0gdW5pZm9ybXMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHBhcmFtZXRlcnMudW5pZm9ybXMgPSBUSFJFRS5Vbmlmb3Jtc1V0aWxzLm1lcmdlKFtcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmNvbW1vbiwgLy8gbWFwXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5ub3JtYWxtYXAsIC8vIG5vcm1hbE1hcFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuZW1pc3NpdmVtYXAsIC8vIGVtaXNzaXZlTWFwXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5mb2csXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5saWdodHMsXG4gICAgICB7XG4gICAgICAgIGN1dG9mZjogeyB2YWx1ZTogMC41IH0sXG4gICAgICAgIGNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMS4wLCAxLjAsIDEuMCkgfSxcbiAgICAgICAgY29sb3JBbHBoYTogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHNoYWRlQ29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjk3LCAwLjgxLCAwLjg2KSB9LFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gICAgICAgIG1haW5UZXhfU1Q6IHsgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCkgfSxcbiAgICAgICAgc2hhZGVUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXG4gICAgICAgIHJlY2VpdmVTaGFkb3dSYXRlOiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgcmVjZWl2ZVNoYWRvd1RleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgc2hhZGluZ0dyYWRlUmF0ZTogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHNoYWRpbmdHcmFkZVRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgc2hhZGVTaGlmdDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHNoYWRlVG9vbnk6IHsgdmFsdWU6IDAuOSB9LFxuICAgICAgICBsaWdodENvbG9yQXR0ZW51YXRpb246IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICBpbmRpcmVjdExpZ2h0SW50ZW5zaXR5OiB7IHZhbHVlOiAwLjEgfSxcbiAgICAgICAgcmltVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICByaW1Db2xvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuMCwgMC4wLCAwLjApIH0sXG4gICAgICAgIHJpbUxpZ2h0aW5nTWl4OiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgICAgcmltRnJlc25lbFBvd2VyOiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgcmltTGlmdDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHNwaGVyZUFkZDogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICBlbWlzc2lvbkNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcbiAgICAgICAgb3V0bGluZVdpZHRoVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICBvdXRsaW5lV2lkdGg6IHsgdmFsdWU6IDAuNSB9LFxuICAgICAgICBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2U6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICBvdXRsaW5lQ29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjAsIDAuMCwgMC4wKSB9LFxuICAgICAgICBvdXRsaW5lTGlnaHRpbmdNaXg6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICB1dkFuaW1NYXNrVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICB1dkFuaW1PZmZzZXRYOiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgICAgdXZBbmltT2Zmc2V0WTogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHV2QW5pbVRoZXRhOiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgIH0sXG4gICAgXSk7XG5cbiAgICAvLyA9PSBmaW5hbGx5IGNvbXBpbGUgdGhlIHNoYWRlciBwcm9ncmFtID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5zZXRWYWx1ZXMocGFyYW1ldGVycyk7XG5cbiAgICAvLyA9PSB1cGRhdGUgc2hhZGVyIHN0dWZmID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcbiAgfVxuXG4gIGdldCBtYWluVGV4KCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5tYXA7XG4gIH1cblxuICBzZXQgbWFpblRleCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xuICAgIHRoaXMubWFwID0gdDtcbiAgfVxuXG4gIGdldCBidW1wTWFwKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5ub3JtYWxNYXA7XG4gIH1cblxuICBzZXQgYnVtcE1hcCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xuICAgIHRoaXMubm9ybWFsTWFwID0gdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXR0aW5nIHRoZSBgYnVtcFNjYWxlYCByZXV0cm5zIGl0cyB4IGNvbXBvbmVudCBvZiBgbm9ybWFsU2NhbGVgIChhc3N1bWluZyB4IGFuZCB5IGNvbXBvbmVudCBvZiBgbm9ybWFsU2NhbGVgIGFyZSBzYW1lKS5cbiAgICovXG4gIGdldCBidW1wU2NhbGUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5ub3JtYWxTY2FsZS54O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHRpbmcgdGhlIGBidW1wU2NhbGVgIHdpbGwgYmUgY29udmVydCB0aGUgdmFsdWUgaW50byBWZWN0b3IyIGBub3JtYWxTY2FsZWAgLlxuICAgKi9cbiAgc2V0IGJ1bXBTY2FsZSh0OiBudW1iZXIpIHtcbiAgICB0aGlzLm5vcm1hbFNjYWxlLnNldCh0LCB0KTtcbiAgfVxuXG4gIGdldCBlbWlzc2lvbk1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZW1pc3NpdmVNYXA7XG4gIH1cblxuICBzZXQgZW1pc3Npb25NYXAodDogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcbiAgICB0aGlzLmVtaXNzaXZlTWFwID0gdDtcbiAgfVxuXG4gIGdldCBibGVuZE1vZGUoKTogTVRvb25NYXRlcmlhbFJlbmRlck1vZGUge1xuICAgIHJldHVybiB0aGlzLl9ibGVuZE1vZGU7XG4gIH1cblxuICBzZXQgYmxlbmRNb2RlKG06IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlKSB7XG4gICAgdGhpcy5fYmxlbmRNb2RlID0gbTtcblxuICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRoaXMuX2JsZW5kTW9kZSAhPT0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuVHJhbnNwYXJlbnQ7XG4gICAgdGhpcy50cmFuc3BhcmVudCA9XG4gICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50IHx8XG4gICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICBnZXQgZGVidWdNb2RlKCk6IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUge1xuICAgIHJldHVybiB0aGlzLl9kZWJ1Z01vZGU7XG4gIH1cblxuICBzZXQgZGVidWdNb2RlKG06IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUpIHtcbiAgICB0aGlzLl9kZWJ1Z01vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICB9XG5cbiAgZ2V0IG91dGxpbmVXaWR0aE1vZGUoKTogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUge1xuICAgIHJldHVybiB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlO1xuICB9XG5cbiAgc2V0IG91dGxpbmVXaWR0aE1vZGUobTogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUpIHtcbiAgICB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgfVxuXG4gIGdldCBvdXRsaW5lQ29sb3JNb2RlKCk6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0bGluZUNvbG9yTW9kZTtcbiAgfVxuXG4gIHNldCBvdXRsaW5lQ29sb3JNb2RlKG06IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlKSB7XG4gICAgdGhpcy5fb3V0bGluZUNvbG9yTW9kZSA9IG07XG5cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICBnZXQgY3VsbE1vZGUoKTogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fY3VsbE1vZGU7XG4gIH1cblxuICBzZXQgY3VsbE1vZGUobTogTVRvb25NYXRlcmlhbEN1bGxNb2RlKSB7XG4gICAgdGhpcy5fY3VsbE1vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIGdldCBvdXRsaW5lQ3VsbE1vZGUoKTogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0bGluZUN1bGxNb2RlO1xuICB9XG5cbiAgc2V0IG91dGxpbmVDdWxsTW9kZShtOiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUpIHtcbiAgICB0aGlzLl9vdXRsaW5lQ3VsbE1vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIGdldCB6V3JpdGUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5kZXB0aFdyaXRlID8gMSA6IDA7XG4gIH1cblxuICBzZXQgeldyaXRlKGk6IG51bWJlcikge1xuICAgIHRoaXMuZGVwdGhXcml0ZSA9IDAuNSA8PSBpO1xuICB9XG5cbiAgZ2V0IGlzT3V0bGluZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5faXNPdXRsaW5lO1xuICB9XG5cbiAgc2V0IGlzT3V0bGluZShiOiBib29sZWFuKSB7XG4gICAgdGhpcy5faXNPdXRsaW5lID0gYjtcblxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgICB0aGlzLl91cGRhdGVDdWxsRmFjZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGlzIG1hdGVyaWFsLlxuICAgKiBVc3VhbGx5IHRoaXMgd2lsbCBiZSBjYWxsZWQgdmlhIFtbVlJNLnVwZGF0ZV1dIHNvIHlvdSBkb24ndCBoYXZlIHRvIGNhbGwgdGhpcyBtYW51YWxseS5cbiAgICpcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZSBzaW5jZSBsYXN0IHVwZGF0ZVxuICAgKi9cbiAgcHVibGljIHVwZGF0ZVZSTU1hdGVyaWFscyhkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5fdXZBbmltT2Zmc2V0WCA9IHRoaXMuX3V2QW5pbU9mZnNldFggKyBkZWx0YSAqIHRoaXMudXZBbmltU2Nyb2xsWDtcbiAgICB0aGlzLl91dkFuaW1PZmZzZXRZID0gdGhpcy5fdXZBbmltT2Zmc2V0WSAtIGRlbHRhICogdGhpcy51dkFuaW1TY3JvbGxZOyAvLyBOZWdhdGl2ZSBzaW5jZSB0IGF4aXMgb2YgdXZzIGFyZSBvcHBvc2l0ZSBmcm9tIFVuaXR5J3Mgb25lXG4gICAgdGhpcy5fdXZBbmltUGhhc2UgPSB0aGlzLl91dkFuaW1QaGFzZSArIGRlbHRhICogdGhpcy51dkFuaW1Sb3RhdGlvbjtcblxuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcbiAgfVxuXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogdGhpcyk6IHRoaXMge1xuICAgIHN1cGVyLmNvcHkoc291cmNlKTtcblxuICAgIC8vID09IGNvcHkgbWVtYmVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLmN1dG9mZiA9IHNvdXJjZS5jdXRvZmY7XG4gICAgdGhpcy5jb2xvci5jb3B5KHNvdXJjZS5jb2xvcik7XG4gICAgdGhpcy5zaGFkZUNvbG9yLmNvcHkoc291cmNlLnNoYWRlQ29sb3IpO1xuICAgIHRoaXMubWFwID0gc291cmNlLm1hcDtcbiAgICB0aGlzLm1haW5UZXhfU1QuY29weShzb3VyY2UubWFpblRleF9TVCk7XG4gICAgdGhpcy5zaGFkZVRleHR1cmUgPSBzb3VyY2Uuc2hhZGVUZXh0dXJlO1xuICAgIHRoaXMubm9ybWFsTWFwID0gc291cmNlLm5vcm1hbE1hcDtcbiAgICB0aGlzLm5vcm1hbE1hcFR5cGUgPSBzb3VyY2Uubm9ybWFsTWFwVHlwZTtcbiAgICB0aGlzLm5vcm1hbFNjYWxlLmNvcHkodGhpcy5ub3JtYWxTY2FsZSk7XG4gICAgdGhpcy5yZWNlaXZlU2hhZG93UmF0ZSA9IHNvdXJjZS5yZWNlaXZlU2hhZG93UmF0ZTtcbiAgICB0aGlzLnJlY2VpdmVTaGFkb3dUZXh0dXJlID0gc291cmNlLnJlY2VpdmVTaGFkb3dUZXh0dXJlO1xuICAgIHRoaXMuc2hhZGluZ0dyYWRlUmF0ZSA9IHNvdXJjZS5zaGFkaW5nR3JhZGVSYXRlO1xuICAgIHRoaXMuc2hhZGluZ0dyYWRlVGV4dHVyZSA9IHNvdXJjZS5zaGFkaW5nR3JhZGVUZXh0dXJlO1xuICAgIHRoaXMuc2hhZGVTaGlmdCA9IHNvdXJjZS5zaGFkZVNoaWZ0O1xuICAgIHRoaXMuc2hhZGVUb29ueSA9IHNvdXJjZS5zaGFkZVRvb255O1xuICAgIHRoaXMubGlnaHRDb2xvckF0dGVudWF0aW9uID0gc291cmNlLmxpZ2h0Q29sb3JBdHRlbnVhdGlvbjtcbiAgICB0aGlzLmluZGlyZWN0TGlnaHRJbnRlbnNpdHkgPSBzb3VyY2UuaW5kaXJlY3RMaWdodEludGVuc2l0eTtcbiAgICB0aGlzLnJpbVRleHR1cmUgPSBzb3VyY2UucmltVGV4dHVyZTtcbiAgICB0aGlzLnJpbUNvbG9yLmNvcHkoc291cmNlLnJpbUNvbG9yKTtcbiAgICB0aGlzLnJpbUxpZ2h0aW5nTWl4ID0gc291cmNlLnJpbUxpZ2h0aW5nTWl4O1xuICAgIHRoaXMucmltRnJlc25lbFBvd2VyID0gc291cmNlLnJpbUZyZXNuZWxQb3dlcjtcbiAgICB0aGlzLnJpbUxpZnQgPSBzb3VyY2UucmltTGlmdDtcbiAgICB0aGlzLnNwaGVyZUFkZCA9IHNvdXJjZS5zcGhlcmVBZGQ7XG4gICAgdGhpcy5lbWlzc2lvbkNvbG9yLmNvcHkoc291cmNlLmVtaXNzaW9uQ29sb3IpO1xuICAgIHRoaXMuZW1pc3NpdmVNYXAgPSBzb3VyY2UuZW1pc3NpdmVNYXA7XG4gICAgdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlID0gc291cmNlLm91dGxpbmVXaWR0aFRleHR1cmU7XG4gICAgdGhpcy5vdXRsaW5lV2lkdGggPSBzb3VyY2Uub3V0bGluZVdpZHRoO1xuICAgIHRoaXMub3V0bGluZVNjYWxlZE1heERpc3RhbmNlID0gc291cmNlLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZTtcbiAgICB0aGlzLm91dGxpbmVDb2xvci5jb3B5KHNvdXJjZS5vdXRsaW5lQ29sb3IpO1xuICAgIHRoaXMub3V0bGluZUxpZ2h0aW5nTWl4ID0gc291cmNlLm91dGxpbmVMaWdodGluZ01peDtcbiAgICB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlID0gc291cmNlLnV2QW5pbU1hc2tUZXh0dXJlO1xuICAgIHRoaXMudXZBbmltU2Nyb2xsWCA9IHNvdXJjZS51dkFuaW1TY3JvbGxYO1xuICAgIHRoaXMudXZBbmltU2Nyb2xsWSA9IHNvdXJjZS51dkFuaW1TY3JvbGxZO1xuICAgIHRoaXMudXZBbmltUm90YXRpb24gPSBzb3VyY2UudXZBbmltUm90YXRpb247XG5cbiAgICB0aGlzLmRlYnVnTW9kZSA9IHNvdXJjZS5kZWJ1Z01vZGU7XG4gICAgdGhpcy5ibGVuZE1vZGUgPSBzb3VyY2UuYmxlbmRNb2RlO1xuICAgIHRoaXMub3V0bGluZVdpZHRoTW9kZSA9IHNvdXJjZS5vdXRsaW5lV2lkdGhNb2RlO1xuICAgIHRoaXMub3V0bGluZUNvbG9yTW9kZSA9IHNvdXJjZS5vdXRsaW5lQ29sb3JNb2RlO1xuICAgIHRoaXMuY3VsbE1vZGUgPSBzb3VyY2UuY3VsbE1vZGU7XG4gICAgdGhpcy5vdXRsaW5lQ3VsbE1vZGUgPSBzb3VyY2Uub3V0bGluZUN1bGxNb2RlO1xuXG4gICAgdGhpcy5pc091dGxpbmUgPSBzb3VyY2UuaXNPdXRsaW5lO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQXBwbHkgdXBkYXRlZCB1bmlmb3JtIHZhcmlhYmxlcy5cbiAgICovXG4gIHByaXZhdGUgX2FwcGx5VW5pZm9ybXMoKTogdm9pZCB7XG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1PZmZzZXRYLnZhbHVlID0gdGhpcy5fdXZBbmltT2Zmc2V0WDtcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbU9mZnNldFkudmFsdWUgPSB0aGlzLl91dkFuaW1PZmZzZXRZO1xuICAgIHRoaXMudW5pZm9ybXMudXZBbmltVGhldGEudmFsdWUgPSBUQVUgKiB0aGlzLl91dkFuaW1QaGFzZTtcblxuICAgIGlmICghdGhpcy5zaG91bGRBcHBseVVuaWZvcm1zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IGZhbHNlO1xuXG4gICAgdGhpcy51bmlmb3Jtcy5jdXRvZmYudmFsdWUgPSB0aGlzLmN1dG9mZjtcbiAgICB0aGlzLnVuaWZvcm1zLmNvbG9yLnZhbHVlLnNldFJHQih0aGlzLmNvbG9yLngsIHRoaXMuY29sb3IueSwgdGhpcy5jb2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLmNvbG9yQWxwaGEudmFsdWUgPSB0aGlzLmNvbG9yLnc7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkZUNvbG9yLnZhbHVlLnNldFJHQih0aGlzLnNoYWRlQ29sb3IueCwgdGhpcy5zaGFkZUNvbG9yLnksIHRoaXMuc2hhZGVDb2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLm1hcC52YWx1ZSA9IHRoaXMubWFwO1xuICAgIHRoaXMudW5pZm9ybXMubWFpblRleF9TVC52YWx1ZS5jb3B5KHRoaXMubWFpblRleF9TVCk7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkZVRleHR1cmUudmFsdWUgPSB0aGlzLnNoYWRlVGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLm5vcm1hbE1hcC52YWx1ZSA9IHRoaXMubm9ybWFsTWFwO1xuICAgIHRoaXMudW5pZm9ybXMubm9ybWFsU2NhbGUudmFsdWUuY29weSh0aGlzLm5vcm1hbFNjYWxlKTtcbiAgICB0aGlzLnVuaWZvcm1zLnJlY2VpdmVTaGFkb3dSYXRlLnZhbHVlID0gdGhpcy5yZWNlaXZlU2hhZG93UmF0ZTtcbiAgICB0aGlzLnVuaWZvcm1zLnJlY2VpdmVTaGFkb3dUZXh0dXJlLnZhbHVlID0gdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRpbmdHcmFkZVJhdGUudmFsdWUgPSB0aGlzLnNoYWRpbmdHcmFkZVJhdGU7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkaW5nR3JhZGVUZXh0dXJlLnZhbHVlID0gdGhpcy5zaGFkaW5nR3JhZGVUZXh0dXJlO1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVTaGlmdC52YWx1ZSA9IHRoaXMuc2hhZGVTaGlmdDtcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlVG9vbnkudmFsdWUgPSB0aGlzLnNoYWRlVG9vbnk7XG4gICAgdGhpcy51bmlmb3Jtcy5saWdodENvbG9yQXR0ZW51YXRpb24udmFsdWUgPSB0aGlzLmxpZ2h0Q29sb3JBdHRlbnVhdGlvbjtcbiAgICB0aGlzLnVuaWZvcm1zLmluZGlyZWN0TGlnaHRJbnRlbnNpdHkudmFsdWUgPSB0aGlzLmluZGlyZWN0TGlnaHRJbnRlbnNpdHk7XG4gICAgdGhpcy51bmlmb3Jtcy5yaW1UZXh0dXJlLnZhbHVlID0gdGhpcy5yaW1UZXh0dXJlO1xuICAgIHRoaXMudW5pZm9ybXMucmltQ29sb3IudmFsdWUuc2V0UkdCKHRoaXMucmltQ29sb3IueCwgdGhpcy5yaW1Db2xvci55LCB0aGlzLnJpbUNvbG9yLnopO1xuICAgIHRoaXMudW5pZm9ybXMucmltTGlnaHRpbmdNaXgudmFsdWUgPSB0aGlzLnJpbUxpZ2h0aW5nTWl4O1xuICAgIHRoaXMudW5pZm9ybXMucmltRnJlc25lbFBvd2VyLnZhbHVlID0gdGhpcy5yaW1GcmVzbmVsUG93ZXI7XG4gICAgdGhpcy51bmlmb3Jtcy5yaW1MaWZ0LnZhbHVlID0gdGhpcy5yaW1MaWZ0O1xuICAgIHRoaXMudW5pZm9ybXMuc3BoZXJlQWRkLnZhbHVlID0gdGhpcy5zcGhlcmVBZGQ7XG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2lvbkNvbG9yLnZhbHVlLnNldFJHQih0aGlzLmVtaXNzaW9uQ29sb3IueCwgdGhpcy5lbWlzc2lvbkNvbG9yLnksIHRoaXMuZW1pc3Npb25Db2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLmVtaXNzaXZlTWFwLnZhbHVlID0gdGhpcy5lbWlzc2l2ZU1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVXaWR0aFRleHR1cmUudmFsdWUgPSB0aGlzLm91dGxpbmVXaWR0aFRleHR1cmU7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGgudmFsdWUgPSB0aGlzLm91dGxpbmVXaWR0aDtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZS52YWx1ZSA9IHRoaXMub3V0bGluZVNjYWxlZE1heERpc3RhbmNlO1xuICAgIHRoaXMudW5pZm9ybXMub3V0bGluZUNvbG9yLnZhbHVlLnNldFJHQih0aGlzLm91dGxpbmVDb2xvci54LCB0aGlzLm91dGxpbmVDb2xvci55LCB0aGlzLm91dGxpbmVDb2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVMaWdodGluZ01peC52YWx1ZSA9IHRoaXMub3V0bGluZUxpZ2h0aW5nTWl4O1xuICAgIHRoaXMudW5pZm9ybXMudXZBbmltTWFza1RleHR1cmUudmFsdWUgPSB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlO1xuXG4gICAgLy8gYXBwbHkgY29sb3Igc3BhY2UgdG8gdW5pZm9ybSBjb2xvcnNcbiAgICBpZiAodGhpcy5lbmNvZGluZyA9PT0gVEhSRUUuc1JHQkVuY29kaW5nKSB7XG4gICAgICB0aGlzLnVuaWZvcm1zLmNvbG9yLnZhbHVlLmNvbnZlcnRTUkdCVG9MaW5lYXIoKTtcbiAgICAgIHRoaXMudW5pZm9ybXMuc2hhZGVDb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLnJpbUNvbG9yLnZhbHVlLmNvbnZlcnRTUkdCVG9MaW5lYXIoKTtcbiAgICAgIHRoaXMudW5pZm9ybXMuZW1pc3Npb25Db2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZVNoYWRlckNvZGUoKTogdm9pZCB7XG4gICAgY29uc3QgdXNlVXZJblZlcnQgPSB0aGlzLm91dGxpbmVXaWR0aFRleHR1cmUgIT09IG51bGw7XG4gICAgY29uc3QgdXNlVXZJbkZyYWcgPVxuICAgICAgdGhpcy5tYXAgIT09IG51bGwgfHxcbiAgICAgIHRoaXMuc2hhZGVUZXh0dXJlICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnJlY2VpdmVTaGFkb3dUZXh0dXJlICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgIT09IG51bGwgfHxcbiAgICAgIHRoaXMucmltVGV4dHVyZSAhPT0gbnVsbCB8fFxuICAgICAgdGhpcy51dkFuaW1NYXNrVGV4dHVyZSAhPT0gbnVsbDtcblxuICAgIHRoaXMuZGVmaW5lcyA9IHtcbiAgICAgIC8vIFVzZWQgZm9yIGNvbXBhdHNcbiAgICAgIFRIUkVFX1ZSTV9USFJFRV9SRVZJU0lPTjogcGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSxcblxuICAgICAgT1VUTElORTogdGhpcy5faXNPdXRsaW5lLFxuICAgICAgQkxFTkRNT0RFX09QQVFVRTogdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5PcGFxdWUsXG4gICAgICBCTEVORE1PREVfQ1VUT1VUOiB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLkN1dG91dCxcbiAgICAgIEJMRU5ETU9ERV9UUkFOU1BBUkVOVDpcbiAgICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudCB8fFxuICAgICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50V2l0aFpXcml0ZSxcbiAgICAgIE1UT09OX1VTRV9VVjogdXNlVXZJblZlcnQgfHwgdXNlVXZJbkZyYWcsIC8vIHdlIGNhbid0IHVzZSBgVVNFX1VWYCAsIGl0IHdpbGwgYmUgcmVkZWZpbmVkIGluIFdlYkdMUHJvZ3JhbS5qc1xuICAgICAgTVRPT05fVVZTX1ZFUlRFWF9PTkxZOiB1c2VVdkluVmVydCAmJiAhdXNlVXZJbkZyYWcsXG4gICAgICBVU0VfU0hBREVURVhUVVJFOiB0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9SRUNFSVZFU0hBRE9XVEVYVFVSRTogdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9TSEFESU5HR1JBREVURVhUVVJFOiB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgIT09IG51bGwsXG4gICAgICBVU0VfUklNVEVYVFVSRTogdGhpcy5yaW1UZXh0dXJlICE9PSBudWxsLFxuICAgICAgVVNFX1NQSEVSRUFERDogdGhpcy5zcGhlcmVBZGQgIT09IG51bGwsXG4gICAgICBVU0VfT1VUTElORVdJRFRIVEVYVFVSRTogdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlICE9PSBudWxsLFxuICAgICAgVVNFX1VWQU5JTU1BU0tURVhUVVJFOiB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlICE9PSBudWxsLFxuICAgICAgREVCVUdfTk9STUFMOiB0aGlzLl9kZWJ1Z01vZGUgPT09IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTm9ybWFsLFxuICAgICAgREVCVUdfTElUU0hBREVSQVRFOiB0aGlzLl9kZWJ1Z01vZGUgPT09IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTGl0U2hhZGVSYXRlLFxuICAgICAgREVCVUdfVVY6IHRoaXMuX2RlYnVnTW9kZSA9PT0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5VVixcbiAgICAgIE9VVExJTkVfV0lEVEhfV09STEQ6IHRoaXMuX291dGxpbmVXaWR0aE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLldvcmxkQ29vcmRpbmF0ZXMsXG4gICAgICBPVVRMSU5FX1dJRFRIX1NDUkVFTjogdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuU2NyZWVuQ29vcmRpbmF0ZXMsXG4gICAgICBPVVRMSU5FX0NPTE9SX0ZJWEVEOiB0aGlzLl9vdXRsaW5lQ29sb3JNb2RlID09PSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZS5GaXhlZENvbG9yLFxuICAgICAgT1VUTElORV9DT0xPUl9NSVhFRDogdGhpcy5fb3V0bGluZUNvbG9yTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUuTWl4ZWRMaWdodGluZyxcbiAgICB9O1xuXG4gICAgLy8gPT0gZ2VuZXJhdGUgc2hhZGVyIGNvZGUgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMudmVydGV4U2hhZGVyID0gdmVydGV4U2hhZGVyO1xuICAgIHRoaXMuZnJhZ21lbnRTaGFkZXIgPSBmcmFnbWVudFNoYWRlcjtcblxuICAgIC8vID09IHRleHR1cmUgZW5jb2RpbmdzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDT01QQVQ6IHByZS1yMTM3XG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMzcpIHtcbiAgICAgIGNvbnN0IGVuY29kaW5ncyA9XG4gICAgICAgICh0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbFxuICAgICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKCdzaGFkZVRleHR1cmVUZXhlbFRvTGluZWFyJywgdGhpcy5zaGFkZVRleHR1cmUuZW5jb2RpbmcpICsgJ1xcbidcbiAgICAgICAgICA6ICcnKSArXG4gICAgICAgICh0aGlzLnNwaGVyZUFkZCAhPT0gbnVsbFxuICAgICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKCdzcGhlcmVBZGRUZXhlbFRvTGluZWFyJywgdGhpcy5zcGhlcmVBZGQuZW5jb2RpbmcpICsgJ1xcbidcbiAgICAgICAgICA6ICcnKSArXG4gICAgICAgICh0aGlzLnJpbVRleHR1cmUgIT09IG51bGxcbiAgICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbigncmltVGV4dHVyZVRleGVsVG9MaW5lYXInLCB0aGlzLnJpbVRleHR1cmUuZW5jb2RpbmcpICsgJ1xcbidcbiAgICAgICAgICA6ICcnKTtcbiAgICAgIHRoaXMuZnJhZ21lbnRTaGFkZXIgPSBlbmNvZGluZ3MgKyBmcmFnbWVudFNoYWRlcjtcbiAgICB9XG5cbiAgICAvLyA9PSBzZXQgbmVlZHNVcGRhdGUgZmxhZyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVDdWxsRmFjZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaXNPdXRsaW5lKSB7XG4gICAgICBpZiAodGhpcy5jdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLk9mZikge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Eb3VibGVTaWRlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQpIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuQmFja1NpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5CYWNrKSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkZyb250U2lkZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuT2ZmKSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkRvdWJsZVNpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQpIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuQmFja1NpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuQmFjaykge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Gcm9udFNpZGU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCIvLyBAdHMtbm9jaGVja1xuLyogdHNsaW50OmRpc2FibGU6bWVtYmVyLW9yZGVyaW5nICovXG5cbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB2ZXJ0ZXhTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL3VubGl0LnZlcnQnO1xuaW1wb3J0IGZyYWdtZW50U2hhZGVyIGZyb20gJy4vc2hhZGVycy91bmxpdC5mcmFnJztcblxuZXhwb3J0IGludGVyZmFjZSBWUk1VbmxpdE1hdGVyaWFsUGFyYW1ldGVycyBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsUGFyYW1ldGVycyB7XG4gIGN1dG9mZj86IG51bWJlcjsgLy8gX0N1dG9mZlxuICBtYXA/OiBUSFJFRS5UZXh0dXJlOyAvLyBfTWFpblRleFxuICBtYWluVGV4PzogVEhSRUUuVGV4dHVyZTsgLy8gX01haW5UZXggKHdpbGwgYmUgcmVuYW1lZCB0byBtYXApXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgbWFpblRleF9TVD86IFRIUkVFLlZlY3RvcjQ7IC8vIF9NYWluVGV4X1NUXG5cbiAgcmVuZGVyVHlwZT86IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlIHwgbnVtYmVyO1xuICBmb2c6IGFueTtcbn1cblxuZXhwb3J0IGVudW0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUge1xuICBPcGFxdWUsXG4gIEN1dG91dCxcbiAgVHJhbnNwYXJlbnQsXG4gIFRyYW5zcGFyZW50V2l0aFpXcml0ZSxcbn1cblxuLyoqXG4gKiBUaGlzIGlzIGEgbWF0ZXJpYWwgdGhhdCBpcyBhbiBlcXVpdmFsZW50IG9mIFwiVlJNL1VubGl0KioqXCIgb24gVlJNIHNwZWMsIHRob3NlIG1hdGVyaWFscyBhcmUgYWxyZWFkeSBraW5kYSBkZXByZWNhdGVkIHRob3VnaC4uLlxuICovXG5leHBvcnQgY2xhc3MgVlJNVW5saXRNYXRlcmlhbCBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsIHtcbiAgLyoqXG4gICAqIFJlYWRvbmx5IGJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhpcyBpcyBhIFtbVlJNVW5saXRNYXRlcmlhbF1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGlzVlJNVW5saXRNYXRlcmlhbDogYm9vbGVhbiA9IHRydWU7XG5cbiAgcHVibGljIGN1dG9mZiA9IDAuNTtcbiAgcHVibGljIG1hcDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfTWFpblRleFxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gIHB1YmxpYyBtYWluVGV4X1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX01haW5UZXhfU1RcbiAgcHJpdmF0ZSBfcmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLk9wYXF1ZTtcblxuICBwdWJsaWMgc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7IC8vIHdoZW4gdGhpcyBpcyB0cnVlLCBhcHBseVVuaWZvcm1zIGVmZmVjdHNcblxuICBjb25zdHJ1Y3RvcihwYXJhbWV0ZXJzPzogVlJNVW5saXRNYXRlcmlhbFBhcmFtZXRlcnMpIHtcbiAgICBzdXBlcigpO1xuXG4gICAgaWYgKHBhcmFtZXRlcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFyYW1ldGVycyA9IHt9O1xuICAgIH1cblxuICAgIC8vID09IGVuYWJsaW5nIGJ1bmNoIG9mIHN0dWZmID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBwYXJhbWV0ZXJzLmZvZyA9IHRydWU7XG4gICAgcGFyYW1ldGVycy5jbGlwcGluZyA9IHRydWU7XG5cbiAgICAvLyBDT01QQVQ6IHByZS1yMTI5XG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjE3ODhcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEyOSkge1xuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5za2lubmluZyA9IChwYXJhbWV0ZXJzIGFzIGFueSkuc2tpbm5pbmcgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQ09NUEFUOiBwcmUtcjEzMVxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIyMTY5XG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMzEpIHtcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhUYXJnZXRzID0gKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaFRhcmdldHMgfHwgZmFsc2U7XG4gICAgICAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoTm9ybWFscyA9IChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhOb3JtYWxzIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8vID09IHVuaWZvcm1zID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICBwYXJhbWV0ZXJzLnVuaWZvcm1zID0gVEhSRUUuVW5pZm9ybXNVdGlscy5tZXJnZShbXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5jb21tb24sIC8vIG1hcFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuZm9nLFxuICAgICAge1xuICAgICAgICBjdXRvZmY6IHsgdmFsdWU6IDAuNSB9LFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gICAgICAgIG1haW5UZXhfU1Q6IHsgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCkgfSxcbiAgICAgIH0sXG4gICAgXSk7XG5cbiAgICAvLyA9PSBmaW5hbGx5IGNvbXBpbGUgdGhlIHNoYWRlciBwcm9ncmFtID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5zZXRWYWx1ZXMocGFyYW1ldGVycyk7XG5cbiAgICAvLyA9PSB1cGRhdGUgc2hhZGVyIHN0dWZmID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcbiAgfVxuXG4gIGdldCBtYWluVGV4KCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5tYXA7XG4gIH1cblxuICBzZXQgbWFpblRleCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xuICAgIHRoaXMubWFwID0gdDtcbiAgfVxuXG4gIGdldCByZW5kZXJUeXBlKCk6IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlIHtcbiAgICByZXR1cm4gdGhpcy5fcmVuZGVyVHlwZTtcbiAgfVxuXG4gIHNldCByZW5kZXJUeXBlKHQ6IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlKSB7XG4gICAgdGhpcy5fcmVuZGVyVHlwZSA9IHQ7XG5cbiAgICB0aGlzLmRlcHRoV3JpdGUgPSB0aGlzLl9yZW5kZXJUeXBlICE9PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudDtcbiAgICB0aGlzLnRyYW5zcGFyZW50ID1cbiAgICAgIHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50IHx8XG4gICAgICB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudFdpdGhaV3JpdGU7XG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGlzIG1hdGVyaWFsLlxuICAgKiBVc3VhbGx5IHRoaXMgd2lsbCBiZSBjYWxsZWQgdmlhIFtbVlJNLnVwZGF0ZV1dIHNvIHlvdSBkb24ndCBoYXZlIHRvIGNhbGwgdGhpcyBtYW51YWxseS5cbiAgICpcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZSBzaW5jZSBsYXN0IHVwZGF0ZVxuICAgKi9cbiAgcHVibGljIHVwZGF0ZVZSTU1hdGVyaWFscyhkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5fYXBwbHlVbmlmb3JtcygpO1xuICB9XG5cbiAgcHVibGljIGNvcHkoc291cmNlOiB0aGlzKTogdGhpcyB7XG4gICAgc3VwZXIuY29weShzb3VyY2UpO1xuXG4gICAgLy8gPT0gY29weSBtZW1iZXJzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuY3V0b2ZmID0gc291cmNlLmN1dG9mZjtcbiAgICB0aGlzLm1hcCA9IHNvdXJjZS5tYXA7XG4gICAgdGhpcy5tYWluVGV4X1NULmNvcHkoc291cmNlLm1haW5UZXhfU1QpO1xuICAgIHRoaXMucmVuZGVyVHlwZSA9IHNvdXJjZS5yZW5kZXJUeXBlO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQXBwbHkgdXBkYXRlZCB1bmlmb3JtIHZhcmlhYmxlcy5cbiAgICovXG4gIHByaXZhdGUgX2FwcGx5VW5pZm9ybXMoKTogdm9pZCB7XG4gICAgaWYgKCF0aGlzLnNob3VsZEFwcGx5VW5pZm9ybXMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zaG91bGRBcHBseVVuaWZvcm1zID0gZmFsc2U7XG5cbiAgICB0aGlzLnVuaWZvcm1zLmN1dG9mZi52YWx1ZSA9IHRoaXMuY3V0b2ZmO1xuICAgIHRoaXMudW5pZm9ybXMubWFwLnZhbHVlID0gdGhpcy5tYXA7XG4gICAgdGhpcy51bmlmb3Jtcy5tYWluVGV4X1NULnZhbHVlLmNvcHkodGhpcy5tYWluVGV4X1NUKTtcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZVNoYWRlckNvZGUoKTogdm9pZCB7XG4gICAgdGhpcy5kZWZpbmVzID0ge1xuICAgICAgUkVOREVSVFlQRV9PUEFRVUU6IHRoaXMuX3JlbmRlclR5cGUgPT09IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLk9wYXF1ZSxcbiAgICAgIFJFTkRFUlRZUEVfQ1VUT1VUOiB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5DdXRvdXQsXG4gICAgICBSRU5ERVJUWVBFX1RSQU5TUEFSRU5UOlxuICAgICAgICB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudCB8fFxuICAgICAgICB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudFdpdGhaV3JpdGUsXG4gICAgfTtcblxuICAgIHRoaXMudmVydGV4U2hhZGVyID0gdmVydGV4U2hhZGVyO1xuICAgIHRoaXMuZnJhZ21lbnRTaGFkZXIgPSBmcmFnbWVudFNoYWRlcjtcblxuICAgIC8vID09IHNldCBuZWVkc1VwZGF0ZSBmbGFnID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgR0xURlNjaGVtYSwgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzIH0gZnJvbSAnLi4vdXRpbHMvZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUnO1xuaW1wb3J0IHsgTVRvb25NYXRlcmlhbCwgTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWwnO1xuaW1wb3J0IHsgVlJNVW5saXRNYXRlcmlhbCwgVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUgfSBmcm9tICcuL1ZSTVVubGl0TWF0ZXJpYWwnO1xuXG4vKipcbiAqIE9wdGlvbnMgZm9yIGEgW1tWUk1NYXRlcmlhbEltcG9ydGVyXV0gaW5zdGFuY2UuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgVlJNTWF0ZXJpYWxJbXBvcnRlck9wdGlvbnMge1xuICAvKipcbiAgICogU3BlY2lmeSB0aGUgZW5jb2Rpbmcgb2YgaW5wdXQgdW5pZm9ybSBjb2xvcnMgYW5kIHRleHR1cmVzLlxuICAgKlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYC5cbiAgICogV2hlbiB5b3VyIGByZW5kZXJlci5vdXRwdXRFbmNvZGluZ2AgaXMgYFRIUkVFLnNSR0JFbmNvZGluZ2AsIHVzZSBgVEhSRUUuc1JHQkVuY29kaW5nYC5cbiAgICpcbiAgICogVGhlIGltcG9ydGVyIHdpbGwgdXNlIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AgaWYgdGhpcyBvcHRpb24gaXNuJ3Qgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBTZWUgYWxzbzogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vcmVuZGVyZXJzL1dlYkdMUmVuZGVyZXIub3V0cHV0RW5jb2RpbmdcbiAgICovXG4gIGVuY29kaW5nPzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xuXG4gIC8qKlxuICAgKiBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIGBQcm9taXNlYCBvZiBlbnZpcm9ubWVudCBtYXAgdGV4dHVyZS5cbiAgICogVGhlIGltcG9ydGVyIHdpbGwgYXR0ZW1wdCB0byBjYWxsIHRoaXMgZnVuY3Rpb24gd2hlbiBpdCBoYXZlIHRvIHVzZSBhbiBlbnZtYXAuXG4gICAqL1xuICByZXF1ZXN0RW52TWFwPzogKCkgPT4gUHJvbWlzZTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XG59XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIFZSTSBtYXRlcmlhbHMgZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNTWF0ZXJpYWxJbXBvcnRlciB7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2VuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmc7XG4gIHByaXZhdGUgcmVhZG9ubHkgX3JlcXVlc3RFbnZNYXA/OiAoKSA9PiBQcm9taXNlPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTU1hdGVyaWFsSW1wb3J0ZXIuXG4gICAqXG4gICAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbnMgb2YgdGhlIFZSTU1hdGVyaWFsSW1wb3J0ZXJcbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFZSTU1hdGVyaWFsSW1wb3J0ZXJPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLl9lbmNvZGluZyA9IG9wdGlvbnMuZW5jb2RpbmcgfHwgVEhSRUUuTGluZWFyRW5jb2Rpbmc7XG4gICAgaWYgKHRoaXMuX2VuY29kaW5nICE9PSBUSFJFRS5MaW5lYXJFbmNvZGluZyAmJiB0aGlzLl9lbmNvZGluZyAhPT0gVEhSRUUuc1JHQkVuY29kaW5nKSB7XG4gICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICdUaGUgc3BlY2lmaWVkIGNvbG9yIGVuY29kaW5nIG1pZ2h0IG5vdCB3b3JrIHByb3Blcmx5IHdpdGggVlJNTWF0ZXJpYWxJbXBvcnRlci4gWW91IG1pZ2h0IHdhbnQgdG8gdXNlIFRIUkVFLnNSR0JFbmNvZGluZyBpbnN0ZWFkLicsXG4gICAgICApO1xuICAgIH1cblxuICAgIHRoaXMuX3JlcXVlc3RFbnZNYXAgPSBvcHRpb25zLnJlcXVlc3RFbnZNYXA7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydCBhbGwgdGhlIG1hdGVyaWFscyBvZiBnaXZlbiBHTFRGIGJhc2VkIG9uIFZSTSBleHRlbnNpb24gZmllbGQgYG1hdGVyaWFsUHJvcGVydGllc2AuXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGNvbnZlcnRHTFRGTWF0ZXJpYWxzKGdsdGY6IEdMVEYpOiBQcm9taXNlPFRIUkVFLk1hdGVyaWFsW10gfCBudWxsPiB7XG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XG4gICAgaWYgKCF2cm1FeHQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGVyaWFsUHJvcGVydGllczogVlJNU2NoZW1hLk1hdGVyaWFsW10gfCB1bmRlZmluZWQgPSB2cm1FeHQubWF0ZXJpYWxQcm9wZXJ0aWVzO1xuICAgIGlmICghbWF0ZXJpYWxQcm9wZXJ0aWVzKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBub2RlUHJpbWl0aXZlc01hcCA9IGF3YWl0IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyhnbHRmKTtcbiAgICBjb25zdCBtYXRlcmlhbExpc3Q6IHsgW3ZybU1hdGVyaWFsSW5kZXg6IG51bWJlcl06IHsgc3VyZmFjZTogVEhSRUUuTWF0ZXJpYWw7IG91dGxpbmU/OiBUSFJFRS5NYXRlcmlhbCB9IH0gPSB7fTtcbiAgICBjb25zdCBtYXRlcmlhbHM6IFRIUkVFLk1hdGVyaWFsW10gPSBbXTsgLy8gcmVzdWx0XG5cbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIEFycmF5LmZyb20obm9kZVByaW1pdGl2ZXNNYXAuZW50cmllcygpKS5tYXAoYXN5bmMgKFtub2RlSW5kZXgsIHByaW1pdGl2ZXNdKSA9PiB7XG4gICAgICAgIGNvbnN0IHNjaGVtYU5vZGU6IEdMVEZTY2hlbWEuTm9kZSA9IGdsdGYucGFyc2VyLmpzb24ubm9kZXNbbm9kZUluZGV4XTtcbiAgICAgICAgY29uc3Qgc2NoZW1hTWVzaDogR0xURlNjaGVtYS5NZXNoID0gZ2x0Zi5wYXJzZXIuanNvbi5tZXNoZXNbc2NoZW1hTm9kZS5tZXNoIV07XG5cbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgcHJpbWl0aXZlcy5tYXAoYXN5bmMgKHByaW1pdGl2ZSwgcHJpbWl0aXZlSW5kZXgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHNjaGVtYVByaW1pdGl2ZSA9IHNjaGVtYU1lc2gucHJpbWl0aXZlc1twcmltaXRpdmVJbmRleF07XG5cbiAgICAgICAgICAgIC8vIHNvbWUgZ2xURiBtaWdodCBoYXZlIGJvdGggYG5vZGUubWVzaGAgYW5kIGBub2RlLmNoaWxkcmVuYCBhdCBvbmNlXG4gICAgICAgICAgICAvLyBhbmQgR0xURkxvYWRlciBoYW5kbGVzIGJvdGggbWVzaCBwcmltaXRpdmVzIGFuZCBcImNoaWxkcmVuXCIgaW4gZ2xURiBhcyBcImNoaWxkcmVuXCIgaW4gVEhSRUVcbiAgICAgICAgICAgIC8vIEl0IHNlZW1zIEdMVEZMb2FkZXIgaGFuZGxlcyBwcmltaXRpdmVzIGZpcnN0IHRoZW4gaGFuZGxlcyBcImNoaWxkcmVuXCIgaW4gZ2xURiAoaXQncyBsdWNreSEpXG4gICAgICAgICAgICAvLyBzbyB3ZSBzaG91bGQgaWdub3JlIChwcmltaXRpdmVzLmxlbmd0aCl0aCBhbmQgZm9sbG93aW5nIGNoaWxkcmVuIG9mIGBtZXNoLmNoaWxkcmVuYFxuICAgICAgICAgICAgLy8gVE9ETzogc2FuaXRpemUgdGhpcyBhZnRlciBHTFRGTG9hZGVyIHBsdWdpbiBzeXN0ZW0gZ2V0cyBpbnRyb2R1Y2VkIDogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzE4NDIxXG4gICAgICAgICAgICBpZiAoIXNjaGVtYVByaW1pdGl2ZSkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZUdlb21ldHJ5ID0gcHJpbWl0aXZlLmdlb21ldHJ5O1xuICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlVmVydGljZXMgPSBwcmltaXRpdmVHZW9tZXRyeS5pbmRleFxuICAgICAgICAgICAgICA/IHByaW1pdGl2ZUdlb21ldHJ5LmluZGV4LmNvdW50XG4gICAgICAgICAgICAgIDogcHJpbWl0aXZlR2VvbWV0cnkuYXR0cmlidXRlcy5wb3NpdGlvbi5jb3VudCAvIDM7XG5cbiAgICAgICAgICAgIC8vIGlmIHByaW1pdGl2ZXMgbWF0ZXJpYWwgaXMgbm90IGFuIGFycmF5LCBtYWtlIGl0IGFuIGFycmF5XG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkocHJpbWl0aXZlLm1hdGVyaWFsKSkge1xuICAgICAgICAgICAgICBwcmltaXRpdmUubWF0ZXJpYWwgPSBbcHJpbWl0aXZlLm1hdGVyaWFsXTtcbiAgICAgICAgICAgICAgcHJpbWl0aXZlR2VvbWV0cnkuYWRkR3JvdXAoMCwgcHJpbWl0aXZlVmVydGljZXMsIDApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBjcmVhdGUgLyBwdXNoIHRvIGNhY2hlIChvciBwb3AgZnJvbSBjYWNoZSkgdnJtIG1hdGVyaWFsc1xuICAgICAgICAgICAgY29uc3QgdnJtTWF0ZXJpYWxJbmRleCA9IHNjaGVtYVByaW1pdGl2ZS5tYXRlcmlhbCE7XG5cbiAgICAgICAgICAgIGxldCBwcm9wcyA9IG1hdGVyaWFsUHJvcGVydGllc1t2cm1NYXRlcmlhbEluZGV4XTtcbiAgICAgICAgICAgIGlmICghcHJvcHMpIHtcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIGBWUk1NYXRlcmlhbEltcG9ydGVyOiBUaGVyZSBhcmUgbm8gbWF0ZXJpYWwgZGVmaW5pdGlvbiBmb3IgbWF0ZXJpYWwgIyR7dnJtTWF0ZXJpYWxJbmRleH0gb24gVlJNIGV4dGVuc2lvbi5gLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICBwcm9wcyA9IHsgc2hhZGVyOiAnVlJNX1VTRV9HTFRGU0hBREVSJyB9OyAvLyBmYWxsYmFja1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBsZXQgdnJtTWF0ZXJpYWxzOiB7IHN1cmZhY2U6IFRIUkVFLk1hdGVyaWFsOyBvdXRsaW5lPzogVEhSRUUuTWF0ZXJpYWwgfTtcbiAgICAgICAgICAgIGlmIChtYXRlcmlhbExpc3RbdnJtTWF0ZXJpYWxJbmRleF0pIHtcbiAgICAgICAgICAgICAgdnJtTWF0ZXJpYWxzID0gbWF0ZXJpYWxMaXN0W3ZybU1hdGVyaWFsSW5kZXhdO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdnJtTWF0ZXJpYWxzID0gYXdhaXQgdGhpcy5jcmVhdGVWUk1NYXRlcmlhbHMocHJpbWl0aXZlLm1hdGVyaWFsWzBdLCBwcm9wcywgZ2x0Zik7XG4gICAgICAgICAgICAgIG1hdGVyaWFsTGlzdFt2cm1NYXRlcmlhbEluZGV4XSA9IHZybU1hdGVyaWFscztcblxuICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaCh2cm1NYXRlcmlhbHMuc3VyZmFjZSk7XG4gICAgICAgICAgICAgIGlmICh2cm1NYXRlcmlhbHMub3V0bGluZSkge1xuICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKHZybU1hdGVyaWFscy5vdXRsaW5lKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBzdXJmYWNlXG4gICAgICAgICAgICBwcmltaXRpdmUubWF0ZXJpYWxbMF0gPSB2cm1NYXRlcmlhbHMuc3VyZmFjZTtcblxuICAgICAgICAgICAgLy8gZW52bWFwXG4gICAgICAgICAgICBpZiAodGhpcy5fcmVxdWVzdEVudk1hcCAmJiAodnJtTWF0ZXJpYWxzLnN1cmZhY2UgYXMgYW55KS5pc01lc2hTdGFuZGFyZE1hdGVyaWFsKSB7XG4gICAgICAgICAgICAgIHRoaXMuX3JlcXVlc3RFbnZNYXAoKS50aGVuKChlbnZNYXApID0+IHtcbiAgICAgICAgICAgICAgICAodnJtTWF0ZXJpYWxzLnN1cmZhY2UgYXMgYW55KS5lbnZNYXAgPSBlbnZNYXA7XG4gICAgICAgICAgICAgICAgdnJtTWF0ZXJpYWxzLnN1cmZhY2UubmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gcmVuZGVyIG9yZGVyXG4gICAgICAgICAgICBwcmltaXRpdmUucmVuZGVyT3JkZXIgPSBwcm9wcy5yZW5kZXJRdWV1ZSB8fCAyMDAwO1xuXG4gICAgICAgICAgICAvLyBvdXRsaW5lIChcIjIgcGFzcyBzaGFkaW5nIHVzaW5nIGdyb3Vwc1wiIHRyaWNrIGhlcmUpXG4gICAgICAgICAgICBpZiAodnJtTWF0ZXJpYWxzLm91dGxpbmUpIHtcbiAgICAgICAgICAgICAgcHJpbWl0aXZlLm1hdGVyaWFsWzFdID0gdnJtTWF0ZXJpYWxzLm91dGxpbmU7XG4gICAgICAgICAgICAgIHByaW1pdGl2ZUdlb21ldHJ5LmFkZEdyb3VwKDAsIHByaW1pdGl2ZVZlcnRpY2VzLCAxKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICByZXR1cm4gbWF0ZXJpYWxzO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGNyZWF0ZVZSTU1hdGVyaWFscyhcbiAgICBvcmlnaW5hbE1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCxcbiAgICB2cm1Qcm9wczogVlJNU2NoZW1hLk1hdGVyaWFsLFxuICAgIGdsdGY6IEdMVEYsXG4gICk6IFByb21pc2U8e1xuICAgIHN1cmZhY2U6IFRIUkVFLk1hdGVyaWFsO1xuICAgIG91dGxpbmU/OiBUSFJFRS5NYXRlcmlhbDtcbiAgfT4ge1xuICAgIGxldCBuZXdTdXJmYWNlOiBUSFJFRS5NYXRlcmlhbCB8IHVuZGVmaW5lZDtcbiAgICBsZXQgbmV3T3V0bGluZTogVEhSRUUuTWF0ZXJpYWwgfCB1bmRlZmluZWQ7XG5cbiAgICBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL01Ub29uJykge1xuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG5cbiAgICAgIC8vIHdlIG5lZWQgdG8gZ2V0IHJpZCBvZiB0aGVzZSBwcm9wZXJ0aWVzXG4gICAgICBbJ3NyY0JsZW5kJywgJ2RzdEJsZW5kJywgJ2lzRmlyc3RTZXR1cCddLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgaWYgKHBhcmFtc1tuYW1lXSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgZGVsZXRlIHBhcmFtc1tuYW1lXTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIHRoZXNlIHRleHR1cmVzIG11c3QgYmUgc1JHQiBFbmNvZGluZywgZGVwZW5kcyBvbiBjdXJyZW50IGNvbG9yc3BhY2VcbiAgICAgIFsnbWFpblRleCcsICdzaGFkZVRleHR1cmUnLCAnZW1pc3Npb25NYXAnLCAnc3BoZXJlQWRkJywgJ3JpbVRleHR1cmUnXS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgIGlmIChwYXJhbXNbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHBhcmFtc1tuYW1lXS5lbmNvZGluZyA9IHRoaXMuX2VuY29kaW5nO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gc3BlY2lmeSB1bmlmb3JtIGNvbG9yIGVuY29kaW5nc1xuICAgICAgcGFyYW1zLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XG5cbiAgICAgIC8vIGRvbmVcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgTVRvb25NYXRlcmlhbChwYXJhbXMpO1xuXG4gICAgICAvLyBvdXRsaW5lXG4gICAgICBpZiAocGFyYW1zLm91dGxpbmVXaWR0aE1vZGUgIT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLk5vbmUpIHtcbiAgICAgICAgcGFyYW1zLmlzT3V0bGluZSA9IHRydWU7XG4gICAgICAgIG5ld091dGxpbmUgPSBuZXcgTVRvb25NYXRlcmlhbChwYXJhbXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL1VubGl0VGV4dHVyZScpIHtcbiAgICAgIC8vIHRoaXMgaXMgdmVyeSBsZWdhY3lcbiAgICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IHRoaXMuX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMob3JpZ2luYWxNYXRlcmlhbCwgdnJtUHJvcHMsIGdsdGYpO1xuICAgICAgcGFyYW1zLnJlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5PcGFxdWU7XG4gICAgICBuZXdTdXJmYWNlID0gbmV3IFZSTVVubGl0TWF0ZXJpYWwocGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9VbmxpdEN1dG91dCcpIHtcbiAgICAgIC8vIHRoaXMgaXMgdmVyeSBsZWdhY3lcbiAgICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IHRoaXMuX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMob3JpZ2luYWxNYXRlcmlhbCwgdnJtUHJvcHMsIGdsdGYpO1xuICAgICAgcGFyYW1zLnJlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5DdXRvdXQ7XG4gICAgICBuZXdTdXJmYWNlID0gbmV3IFZSTVVubGl0TWF0ZXJpYWwocGFyYW1zKTtcbiAgICB9IGVsc2UgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9VbmxpdFRyYW5zcGFyZW50Jykge1xuICAgICAgLy8gdGhpcyBpcyB2ZXJ5IGxlZ2FjeVxuICAgICAgY29uc3QgcGFyYW1zID0gYXdhaXQgdGhpcy5fZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhvcmlnaW5hbE1hdGVyaWFsLCB2cm1Qcm9wcywgZ2x0Zik7XG4gICAgICBwYXJhbXMucmVuZGVyVHlwZSA9IFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlLlRyYW5zcGFyZW50O1xuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBWUk1VbmxpdE1hdGVyaWFsKHBhcmFtcyk7XG4gICAgfSBlbHNlIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vVW5saXRUcmFuc3BhcmVudFpXcml0ZScpIHtcbiAgICAgIC8vIHRoaXMgaXMgdmVyeSBsZWdhY3lcbiAgICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IHRoaXMuX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMob3JpZ2luYWxNYXRlcmlhbCwgdnJtUHJvcHMsIGdsdGYpO1xuICAgICAgcGFyYW1zLnJlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudFdpdGhaV3JpdGU7XG4gICAgICBuZXdTdXJmYWNlID0gbmV3IFZSTVVubGl0TWF0ZXJpYWwocGFyYW1zKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHZybVByb3BzLnNoYWRlciAhPT0gJ1ZSTV9VU0VfR0xURlNIQURFUicpIHtcbiAgICAgICAgY29uc29sZS53YXJuKGBVbmtub3duIHNoYWRlciBkZXRlY3RlZDogXCIke3ZybVByb3BzLnNoYWRlcn1cImApO1xuICAgICAgICAvLyB0aGVuIHByZXN1bWUgYXMgVlJNX1VTRV9HTFRGU0hBREVSXG4gICAgICB9XG5cbiAgICAgIG5ld1N1cmZhY2UgPSB0aGlzLl9jb252ZXJ0R0xURk1hdGVyaWFsKG9yaWdpbmFsTWF0ZXJpYWwuY2xvbmUoKSk7XG4gICAgfVxuXG4gICAgbmV3U3VyZmFjZS5uYW1lID0gb3JpZ2luYWxNYXRlcmlhbC5uYW1lO1xuICAgIG5ld1N1cmZhY2UudXNlckRhdGEgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsTWF0ZXJpYWwudXNlckRhdGEpKTtcbiAgICBuZXdTdXJmYWNlLnVzZXJEYXRhLnZybU1hdGVyaWFsUHJvcGVydGllcyA9IHZybVByb3BzO1xuXG4gICAgaWYgKG5ld091dGxpbmUpIHtcbiAgICAgIG5ld091dGxpbmUubmFtZSA9IG9yaWdpbmFsTWF0ZXJpYWwubmFtZSArICcgKE91dGxpbmUpJztcbiAgICAgIG5ld091dGxpbmUudXNlckRhdGEgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsTWF0ZXJpYWwudXNlckRhdGEpKTtcbiAgICAgIG5ld091dGxpbmUudXNlckRhdGEudnJtTWF0ZXJpYWxQcm9wZXJ0aWVzID0gdnJtUHJvcHM7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN1cmZhY2U6IG5ld1N1cmZhY2UsXG4gICAgICBvdXRsaW5lOiBuZXdPdXRsaW5lLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9yZW5hbWVNYXRlcmlhbFByb3BlcnR5KG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKG5hbWVbMF0gIT09ICdfJykge1xuICAgICAgY29uc29sZS53YXJuKGBWUk1NYXRlcmlhbHM6IEdpdmVuIHByb3BlcnR5IG5hbWUgXCIke25hbWV9XCIgbWlnaHQgYmUgaW52YWxpZGApO1xuICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfVxuICAgIG5hbWUgPSBuYW1lLnN1YnN0cmluZygxKTtcblxuICAgIGlmICghL1tBLVpdLy50ZXN0KG5hbWVbMF0pKSB7XG4gICAgICBjb25zb2xlLndhcm4oYFZSTU1hdGVyaWFsczogR2l2ZW4gcHJvcGVydHkgbmFtZSBcIiR7bmFtZX1cIiBtaWdodCBiZSBpbnZhbGlkYCk7XG4gICAgICByZXR1cm4gbmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIG5hbWVbMF0udG9Mb3dlckNhc2UoKSArIG5hbWUuc3Vic3RyaW5nKDEpO1xuICB9XG5cbiAgcHJpdmF0ZSBfY29udmVydEdMVEZNYXRlcmlhbChtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwpOiBUSFJFRS5NYXRlcmlhbCB7XG4gICAgaWYgKChtYXRlcmlhbCBhcyBhbnkpLmlzTWVzaFN0YW5kYXJkTWF0ZXJpYWwpIHtcbiAgICAgIGNvbnN0IG10bCA9IG1hdGVyaWFsIGFzIFRIUkVFLk1lc2hTdGFuZGFyZE1hdGVyaWFsO1xuXG4gICAgICBpZiAobXRsLm1hcCkge1xuICAgICAgICBtdGwubWFwLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XG4gICAgICB9XG4gICAgICBpZiAobXRsLmVtaXNzaXZlTWFwKSB7XG4gICAgICAgIG10bC5lbWlzc2l2ZU1hcC5lbmNvZGluZyA9IHRoaXMuX2VuY29kaW5nO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fZW5jb2RpbmcgPT09IFRIUkVFLkxpbmVhckVuY29kaW5nKSB7XG4gICAgICAgIG10bC5jb2xvci5jb252ZXJ0TGluZWFyVG9TUkdCKCk7XG4gICAgICAgIG10bC5lbWlzc2l2ZS5jb252ZXJ0TGluZWFyVG9TUkdCKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKChtYXRlcmlhbCBhcyBhbnkpLmlzTWVzaEJhc2ljTWF0ZXJpYWwpIHtcbiAgICAgIGNvbnN0IG10bCA9IG1hdGVyaWFsIGFzIFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsO1xuXG4gICAgICBpZiAobXRsLm1hcCkge1xuICAgICAgICBtdGwubWFwLmVuY29kaW5nID0gdGhpcy5fZW5jb2Rpbmc7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl9lbmNvZGluZyA9PT0gVEhSRUUuTGluZWFyRW5jb2RpbmcpIHtcbiAgICAgICAgbXRsLmNvbG9yLmNvbnZlcnRMaW5lYXJUb1NSR0IoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbWF0ZXJpYWw7XG4gIH1cblxuICBwcml2YXRlIF9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKFxuICAgIG9yaWdpbmFsTWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsLFxuICAgIHZybVByb3BzOiBWUk1TY2hlbWEuTWF0ZXJpYWwsXG4gICAgZ2x0ZjogR0xURixcbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zdCB0YXNrTGlzdDogQXJyYXk8UHJvbWlzZTxhbnk+PiA9IFtdO1xuICAgIGNvbnN0IHBhcmFtczogYW55ID0ge307XG5cbiAgICAvLyBleHRyYWN0IHRleHR1cmUgcHJvcGVydGllc1xuICAgIGlmICh2cm1Qcm9wcy50ZXh0dXJlUHJvcGVydGllcykge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKHZybVByb3BzLnRleHR1cmVQcm9wZXJ0aWVzKSkge1xuICAgICAgICBjb25zdCBuZXdOYW1lID0gdGhpcy5fcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShuYW1lKTtcbiAgICAgICAgY29uc3QgdGV4dHVyZUluZGV4ID0gdnJtUHJvcHMudGV4dHVyZVByb3BlcnRpZXNbbmFtZV07XG5cbiAgICAgICAgdGFza0xpc3QucHVzaChcbiAgICAgICAgICBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCd0ZXh0dXJlJywgdGV4dHVyZUluZGV4KS50aGVuKCh0ZXh0dXJlOiBUSFJFRS5UZXh0dXJlKSA9PiB7XG4gICAgICAgICAgICBwYXJhbXNbbmV3TmFtZV0gPSB0ZXh0dXJlO1xuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGV4dHJhY3QgZmxvYXQgcHJvcGVydGllc1xuICAgIGlmICh2cm1Qcm9wcy5mbG9hdFByb3BlcnRpZXMpIHtcbiAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBPYmplY3Qua2V5cyh2cm1Qcm9wcy5mbG9hdFByb3BlcnRpZXMpKSB7XG4gICAgICAgIGNvbnN0IG5ld05hbWUgPSB0aGlzLl9yZW5hbWVNYXRlcmlhbFByb3BlcnR5KG5hbWUpO1xuICAgICAgICBwYXJhbXNbbmV3TmFtZV0gPSB2cm1Qcm9wcy5mbG9hdFByb3BlcnRpZXNbbmFtZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZXh0cmFjdCB2ZWN0b3IgKGNvbG9yIHRiaCkgcHJvcGVydGllc1xuICAgIGlmICh2cm1Qcm9wcy52ZWN0b3JQcm9wZXJ0aWVzKSB7XG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgT2JqZWN0LmtleXModnJtUHJvcHMudmVjdG9yUHJvcGVydGllcykpIHtcbiAgICAgICAgbGV0IG5ld05hbWUgPSB0aGlzLl9yZW5hbWVNYXRlcmlhbFByb3BlcnR5KG5hbWUpO1xuXG4gICAgICAgIC8vIGlmIHRoaXMgaXMgdGV4dHVyZVNUIChzYW1lIG5hbWUgYXMgdGV4dHVyZSBuYW1lIGl0c2VsZiksIGFkZCAnX1NUJ1xuICAgICAgICBjb25zdCBpc1RleHR1cmVTVCA9IFtcbiAgICAgICAgICAnX01haW5UZXgnLFxuICAgICAgICAgICdfU2hhZGVUZXh0dXJlJyxcbiAgICAgICAgICAnX0J1bXBNYXAnLFxuICAgICAgICAgICdfUmVjZWl2ZVNoYWRvd1RleHR1cmUnLFxuICAgICAgICAgICdfU2hhZGluZ0dyYWRlVGV4dHVyZScsXG4gICAgICAgICAgJ19SaW1UZXh0dXJlJyxcbiAgICAgICAgICAnX1NwaGVyZUFkZCcsXG4gICAgICAgICAgJ19FbWlzc2lvbk1hcCcsXG4gICAgICAgICAgJ19PdXRsaW5lV2lkdGhUZXh0dXJlJyxcbiAgICAgICAgICAnX1V2QW5pbU1hc2tUZXh0dXJlJyxcbiAgICAgICAgXS5zb21lKCh0ZXh0dXJlTmFtZSkgPT4gbmFtZSA9PT0gdGV4dHVyZU5hbWUpO1xuICAgICAgICBpZiAoaXNUZXh0dXJlU1QpIHtcbiAgICAgICAgICBuZXdOYW1lICs9ICdfU1QnO1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyYW1zW25ld05hbWVdID0gbmV3IFRIUkVFLlZlY3RvcjQoLi4udnJtUHJvcHMudmVjdG9yUHJvcGVydGllc1tuYW1lXSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ09NUEFUOiBwcmUtcjEyOVxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIxNzg4XG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMjkpIHtcbiAgICAgIHBhcmFtcy5za2lubmluZyA9IChvcmlnaW5hbE1hdGVyaWFsIGFzIGFueSkuc2tpbm5pbmcgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQ09NUEFUOiBwcmUtcjEzMVxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIyMTY5XG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMzEpIHtcbiAgICAgIHBhcmFtcy5tb3JwaFRhcmdldHMgPSAob3JpZ2luYWxNYXRlcmlhbCBhcyBhbnkpLm1vcnBoVGFyZ2V0cyB8fCBmYWxzZTtcbiAgICAgIHBhcmFtcy5tb3JwaE5vcm1hbHMgPSAob3JpZ2luYWxNYXRlcmlhbCBhcyBhbnkpLm1vcnBoTm9ybWFscyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwodGFza0xpc3QpLnRoZW4oKCkgPT4gcGFyYW1zKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNTWV0YSB9IGZyb20gJy4vVlJNTWV0YSc7XG5pbXBvcnQgeyBWUk1NZXRhSW1wb3J0ZXJPcHRpb25zIH0gZnJvbSAnLi9WUk1NZXRhSW1wb3J0ZXJPcHRpb25zJztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSB7QGxpbmsgVlJNTWV0YX0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNTWV0YUltcG9ydGVyIHtcbiAgLyoqXG4gICAqIElmIGB0cnVlYCwgaXQgd29uJ3QgbG9hZCBpdHMgdGh1bWJuYWlsIHRleHR1cmUgKHtAbGluayBWUk1NZXRhLnRleHR1cmV9KS4gYGZhbHNlYCBieSBkZWZhdWx0LlxuICAgKi9cbiAgcHVibGljIGlnbm9yZVRleHR1cmU6IGJvb2xlYW47XG5cbiAgY29uc3RydWN0b3Iob3B0aW9ucz86IFZSTU1ldGFJbXBvcnRlck9wdGlvbnMpIHtcbiAgICB0aGlzLmlnbm9yZVRleHR1cmUgPSBvcHRpb25zPy5pZ25vcmVUZXh0dXJlID8/IGZhbHNlO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1NZXRhIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFNZXRhOiBWUk1TY2hlbWEuTWV0YSB8IHVuZGVmaW5lZCA9IHZybUV4dC5tZXRhO1xuICAgIGlmICghc2NoZW1hTWV0YSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsIHwgdW5kZWZpbmVkO1xuICAgIGlmICghdGhpcy5pZ25vcmVUZXh0dXJlICYmIHNjaGVtYU1ldGEudGV4dHVyZSAhPSBudWxsICYmIHNjaGVtYU1ldGEudGV4dHVyZSAhPT0gLTEpIHtcbiAgICAgIHRleHR1cmUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCd0ZXh0dXJlJywgc2NoZW1hTWV0YS50ZXh0dXJlKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYWxsb3dlZFVzZXJOYW1lOiBzY2hlbWFNZXRhLmFsbG93ZWRVc2VyTmFtZSxcbiAgICAgIGF1dGhvcjogc2NoZW1hTWV0YS5hdXRob3IsXG4gICAgICBjb21tZXJjaWFsVXNzYWdlTmFtZTogc2NoZW1hTWV0YS5jb21tZXJjaWFsVXNzYWdlTmFtZSxcbiAgICAgIGNvbnRhY3RJbmZvcm1hdGlvbjogc2NoZW1hTWV0YS5jb250YWN0SW5mb3JtYXRpb24sXG4gICAgICBsaWNlbnNlTmFtZTogc2NoZW1hTWV0YS5saWNlbnNlTmFtZSxcbiAgICAgIG90aGVyTGljZW5zZVVybDogc2NoZW1hTWV0YS5vdGhlckxpY2Vuc2VVcmwsXG4gICAgICBvdGhlclBlcm1pc3Npb25Vcmw6IHNjaGVtYU1ldGEub3RoZXJQZXJtaXNzaW9uVXJsLFxuICAgICAgcmVmZXJlbmNlOiBzY2hlbWFNZXRhLnJlZmVyZW5jZSxcbiAgICAgIHNleHVhbFVzc2FnZU5hbWU6IHNjaGVtYU1ldGEuc2V4dWFsVXNzYWdlTmFtZSxcbiAgICAgIHRleHR1cmU6IHRleHR1cmUgPz8gdW5kZWZpbmVkLFxuICAgICAgdGl0bGU6IHNjaGVtYU1ldGEudGl0bGUsXG4gICAgICB2ZXJzaW9uOiBzY2hlbWFNZXRhLnZlcnNpb24sXG4gICAgICB2aW9sZW50VXNzYWdlTmFtZTogc2NoZW1hTWV0YS52aW9sZW50VXNzYWdlTmFtZSxcbiAgICB9O1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbmNvbnN0IF9tYXRBID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcblxuLyoqXG4gKiBBIGNvbXBhdCBmdW5jdGlvbiBmb3IgYE1hdHJpeDQuaW52ZXJ0KClgIC8gYE1hdHJpeDQuZ2V0SW52ZXJzZSgpYC5cbiAqIGBNYXRyaXg0LmludmVydCgpYCBpcyBpbnRyb2R1Y2VkIGluIHIxMjMgYW5kIGBNYXRyaXg0LmdldEludmVyc2UoKWAgZW1pdHMgYSB3YXJuaW5nLlxuICogV2UgYXJlIGdvaW5nIHRvIHVzZSB0aGlzIGNvbXBhdCBmb3IgYSB3aGlsZS5cbiAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgbWF0cml4XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBtYXQ0SW52ZXJ0Q29tcGF0PFQgZXh0ZW5kcyBUSFJFRS5NYXRyaXg0Pih0YXJnZXQ6IFQpOiBUIHtcbiAgaWYgKCh0YXJnZXQgYXMgYW55KS5pbnZlcnQpIHtcbiAgICB0YXJnZXQuaW52ZXJ0KCk7XG4gIH0gZWxzZSB7XG4gICAgKHRhcmdldCBhcyBhbnkpLmdldEludmVyc2UoX21hdEEuY29weSh0YXJnZXQpKTtcbiAgfVxuXG4gIHJldHVybiB0YXJnZXQ7XG59XG4iLCIvLyBAdHMtbm9jaGVja1xuXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBtYXQ0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvbWF0NEludmVydENvbXBhdCc7XG5pbXBvcnQgeyBnZXRXb3JsZFF1YXRlcm5pb25MaXRlIH0gZnJvbSAnLi4vdXRpbHMvbWF0aCc7XG5pbXBvcnQgeyBNYXRyaXg0SW52ZXJzZUNhY2hlIH0gZnJvbSAnLi4vdXRpbHMvTWF0cml4NEludmVyc2VDYWNoZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuLy8gYmFzZWQgb25cbi8vIGh0dHA6Ly9yb2NrZXRqdW1wLnNrci5qcC91bml0eTNkLzEwOS9cbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kd2FuZ28vVW5pVlJNL2Jsb2IvbWFzdGVyL1NjcmlwdHMvU3ByaW5nQm9uZS9WUk1TcHJpbmdCb25lLmNzXG5cbmNvbnN0IElERU5USVRZX01BVFJJWDQgPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5NYXRyaXg0KCkpO1xuY29uc3QgSURFTlRJVFlfUVVBVEVSTklPTiA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLlF1YXRlcm5pb24oKSk7XG5cbi8vIOioiOeul+S4reOBruS4gOaZguS/neWtmOeUqOWkieaVsO+8iOS4gOW6puOCpOODs+OCueOCv+ODs+OCueOCkuS9nOOBo+OBn+OCieOBguOBqOOBr+S9v+OBhOWbnuOBme+8iVxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF92M0MgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcbmNvbnN0IF9tYXRBID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcbmNvbnN0IF9tYXRCID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgYSBzaW5nbGUgc3ByaW5nIGJvbmUgb2YgYSBWUk0uXG4gKiBJdCBzaG91bGQgYmUgbWFuYWdlZCBieSBhIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmUge1xuICAvKipcbiAgICogUmFkaXVzIG9mIHRoZSBib25lLCB3aWxsIGJlIHVzZWQgZm9yIGNvbGxpc2lvbi5cbiAgICovXG4gIHB1YmxpYyByYWRpdXM6IG51bWJlcjtcblxuICAvKipcbiAgICogU3RpZmZuZXNzIGZvcmNlIG9mIHRoZSBib25lLiBJbmNyZWFzaW5nIHRoZSB2YWx1ZSA9IGZhc3RlciBjb252ZXJnZW5jZSAoZmVlbHMgXCJoYXJkZXJcIikuXG4gICAqIE9uIFVuaVZSTSwgaXRzIHJhbmdlIG9uIEdVSSBpcyBiZXR3ZWVuIGAwLjBgIGFuZCBgNC4wYCAuXG4gICAqL1xuICBwdWJsaWMgc3RpZmZuZXNzRm9yY2U6IG51bWJlcjtcblxuICAvKipcbiAgICogUG93ZXIgb2YgdGhlIGdyYXZpdHkgYWdhaW5zdCB0aGlzIGJvbmUuXG4gICAqIFRoZSBcInBvd2VyXCIgdXNlZCBpbiBoZXJlIGlzIHZlcnkgZmFyIGZyb20gc2NpZW50aWZpYyBwaHlzaWNzIHRlcm0uLi5cbiAgICovXG4gIHB1YmxpYyBncmF2aXR5UG93ZXI6IG51bWJlcjtcblxuICAvKipcbiAgICogRGlyZWN0aW9uIG9mIHRoZSBncmF2aXR5IGFnYWluc3QgdGhpcyBib25lLlxuICAgKiBVc3VhbGx5IGl0IHNob3VsZCBiZSBub3JtYWxpemVkLlxuICAgKi9cbiAgcHVibGljIGdyYXZpdHlEaXI6IFRIUkVFLlZlY3RvcjM7XG5cbiAgLyoqXG4gICAqIERyYWcgZm9yY2Ugb2YgdGhlIGJvbmUuIEluY3JlYXNpbmcgdGhlIHZhbHVlID0gbGVzcyBvc2NpbGxhdGlvbiAoZmVlbHMgXCJoZWF2aWVyXCIpLlxuICAgKiBPbiBVbmlWUk0sIGl0cyByYW5nZSBvbiBHVUkgaXMgYmV0d2VlbiBgMC4wYCBhbmQgYDEuMGAgLlxuICAgKi9cbiAgcHVibGljIGRyYWdGb3JjZTogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBDb2xsaWRlciBncm91cHMgYXR0YWNoZWQgdG8gdGhpcyBib25lLlxuICAgKi9cbiAgcHVibGljIGNvbGxpZGVyczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaFtdO1xuXG4gIC8qKlxuICAgKiBBbiBPYmplY3QzRCBhdHRhY2hlZCB0byB0aGlzIGJvbmUuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYm9uZTogVEhSRUUuT2JqZWN0M0Q7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgX2N1cnJlbnRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogUHJldmlvdXMgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgX3ByZXZUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogTmV4dCBwb3NpdGlvbiBvZiBjaGlsZCB0YWlsLCBpbiB3b3JsZCB1bml0LiBXaWxsIGJlIHVzZWQgZm9yIHZlcmxldCBpbnRlZ3JhdGlvbi5cbiAgICogQWN0dWFsbHkgdXNlZCBvbmx5IGluIFtbdXBkYXRlXV0gYW5kIGl0J3Mga2luZCBvZiB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBwcm90ZWN0ZWQgX25leHRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBheGlzIG9mIHRoZSBib25lLCBpbiBsb2NhbCB1bml0LlxuICAgKi9cbiAgcHJvdGVjdGVkIF9ib25lQXhpcyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIExlbmd0aCBvZiB0aGUgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSB1bml0LiBXaWxsIGJlIHVzZWQgZm9yIG5vcm1hbGl6YXRpb24gaW4gdXBkYXRlIGxvb3AuXG4gICAqIEl0J3Mgc2FtZSBhcyBsb2NhbCB1bml0IGxlbmd0aCB1bmxlc3MgdGhlcmUgYXJlIHNjYWxlIHRyYW5zZm9ybWF0aW9uIGluIHdvcmxkIG1hdHJpeC5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyU3BhY2VCb25lTGVuZ3RoOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIG9mIHRoaXMgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSwga2luZCBvZiBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyU3BhY2VQb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIFRoaXMgc3ByaW5nYm9uZSB3aWxsIGJlIGNhbGN1bGF0ZWQgYmFzZWQgb24gdGhlIHNwYWNlIHJlbGF0aXZlIGZyb20gdGhpcyBvYmplY3QuXG4gICAqIElmIHRoaXMgaXMgYG51bGxgLCBzcHJpbmdib25lIHdpbGwgYmUgY2FsY3VsYXRlZCBpbiB3b3JsZCBzcGFjZS5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyOiBhbnkgfCBudWxsID0gbnVsbDtcbiAgcHVibGljIGdldCBjZW50ZXIoKTogYW55IHtcbiAgICByZXR1cm4gdGhpcy5fY2VudGVyIGFzIGFueTtcbiAgfVxuICBwdWJsaWMgc2V0IGNlbnRlcihjZW50ZXI6IFRIUkVFLk9iamVjdDNEKSB7XG4gICAgLy8gY29udmVydCB0YWlscyB0byB3b3JsZCBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeENlbnRlclRvV29ybGQoX21hdEEpO1xuXG4gICAgdGhpcy5fY3VycmVudFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcbiAgICB0aGlzLl9wcmV2VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuICAgIHRoaXMuX25leHRUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG5cbiAgICAvLyB1bmluc3RhbGwgaW52ZXJzZSBjYWNoZVxuICAgIC8qIGlmICh0aGlzLl9jZW50ZXI/LnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5KSB7XG4gICAgICAodGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5IGFzIE1hdHJpeDRJbnZlcnNlQ2FjaGUpLnJldmVydCgpO1xuICAgICAgZGVsZXRlIHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eTtcbiAgICB9ICovXG5cbiAgICAvLyBjaGFuZ2UgdGhlIGNlbnRlclxuICAgIHRoaXMuX2NlbnRlciA9IGNlbnRlcjtcblxuICAgIC8vIGluc3RhbGwgaW52ZXJzZSBjYWNoZVxuICAgIGlmICh0aGlzLl9jZW50ZXIpIHtcbiAgICAgIGNvbnN0IG1hdHJpeFdvcmxkSW52ZXJzZSA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XG4gICAgICBsZXQgbWF0cml4V29ybGRJbnZlcnNlTmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgdGhpcy5fY2VudGVyLnVwZGF0ZU1hdHJpeFdvcmxkID0gKF91cGRhdGVNYXRyaXhXb3JsZCA9PiAoKSA9PiB7XG4gICAgICAgICAgbWF0cml4V29ybGRJbnZlcnNlTmVlZHNVcGRhdGUgPSB0cnVlO1xuICAgICAgICAgIHJldHVybiBfdXBkYXRlTWF0cml4V29ybGQuYXBwbHkodGhpcywgYXJndW1lbnRzIGFzIGFueSk7XG4gICAgICB9KSh0aGlzLl9jZW50ZXIudXBkYXRlTWF0cml4V29ybGQpO1xuICAgICAgKHRoaXMuX2NlbnRlciBhcyBhbnkpLmdldE1hdHJpeFdvcmxkSW52ZXJzZSA9ICgpID0+IHtcbiAgICAgICAgaWYgKG1hdHJpeFdvcmxkSW52ZXJzZU5lZWRzVXBkYXRlKSB7XG4gICAgICAgICAgbWF0cml4V29ybGRJbnZlcnNlLmNvcHkoKHRoaXMuX2NlbnRlciBhcyBhbnkpLm1hdHJpeFdvcmxkKS5pbnZlcnQoKTtcbiAgICAgICAgICBtYXRyaXhXb3JsZEludmVyc2VOZWVkc1VwZGF0ZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtYXRyaXhXb3JsZEludmVyc2U7XG4gICAgICB9O1xuICAgICAgLy8gaWYgKCF0aGlzLl9jZW50ZXIudXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkpIHtcbiAgICAgIC8vICAgdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5ID0gbmV3IE1hdHJpeDRJbnZlcnNlQ2FjaGUodGhpcy5fY2VudGVyLm1hdHJpeFdvcmxkKTtcbiAgICAgIC8vIH1cbiAgICB9XG5cbiAgICAvLyBjb252ZXJ0IHRhaWxzIHRvIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEEpO1xuXG4gICAgdGhpcy5fY3VycmVudFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcbiAgICB0aGlzLl9wcmV2VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuICAgIHRoaXMuX25leHRUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG5cbiAgICAvLyBjb252ZXJ0IGNlbnRlciBzcGFjZSBkZXBlbmRhbnQgc3RhdGVcbiAgICBfbWF0QS5tdWx0aXBseSh0aGlzLmJvbmUubWF0cml4V29ybGQpOyAvLyDwn5SlID8/XG5cbiAgICB0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG5cbiAgICB0aGlzLl9jZW50ZXJTcGFjZUJvbmVMZW5ndGggPSBfdjNBXG4gICAgICAuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKVxuICAgICAgLmFwcGx5TWF0cml4NChfbWF0QSlcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgIC5sZW5ndGgoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSb3RhdGlvbiBvZiBwYXJlbnQgYm9uZSwgaW4gd29ybGQgdW5pdC5cbiAgICogV2Ugc2hvdWxkIHVwZGF0ZSB0aGlzIGNvbnN0YW50bHkgaW4gW1t1cGRhdGVdXS5cbiAgICovXG4gIHByaXZhdGUgX3BhcmVudFdvcmxkUm90YXRpb24gPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsIHN0YXRlIG9mIHRoZSBsb2NhbCBtYXRyaXggb2YgdGhlIGJvbmUuXG4gICAqL1xuICBwcml2YXRlIF9pbml0aWFsTG9jYWxNYXRyaXggPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsIHN0YXRlIG9mIHRoZSByb3RhdGlvbiBvZiB0aGUgYm9uZS5cbiAgICovXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbFJvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgcG9zaXRpb24gb2YgaXRzIGNoaWxkLlxuICAgKi9cbiAgcHJpdmF0ZSBfaW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1TcHJpbmdCb25lLlxuICAgKlxuICAgKiBAcGFyYW0gYm9uZSBBbiBPYmplY3QzRCB0aGF0IHdpbGwgYmUgYXR0YWNoZWQgdG8gdGhpcyBib25lXG4gICAqIEBwYXJhbSBwYXJhbXMgU2V2ZXJhbCBwYXJhbWV0ZXJzIHJlbGF0ZWQgdG8gYmVoYXZpb3Igb2YgdGhlIHNwcmluZyBib25lXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyA9IHt9KSB7XG4gICAgdGhpcy5ib25lID0gYm9uZTsgLy8gdW5pVlJN44Gn44GuIHBhcmVudFxuICAgIHRoaXMuYm9uZS5tYXRyaXhBdXRvVXBkYXRlID0gZmFsc2U7IC8vIHVwZGF0ZeOBq+OCiOOCiuioiOeul+OBleOCjOOCi+OBruOBp3RocmVlLmpz5YaF44Gn44Gu6Ieq5YuV5Yem55CG44Gv5LiN6KaBXG5cbiAgICB0aGlzLnJhZGl1cyA9IHBhcmFtcy5yYWRpdXMgPz8gMC4wMjtcbiAgICB0aGlzLnN0aWZmbmVzc0ZvcmNlID0gcGFyYW1zLnN0aWZmbmVzc0ZvcmNlID8/IDEuMDtcbiAgICB0aGlzLmdyYXZpdHlEaXIgPSBwYXJhbXMuZ3Jhdml0eURpclxuICAgICAgPyBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkocGFyYW1zLmdyYXZpdHlEaXIpXG4gICAgICA6IG5ldyBUSFJFRS5WZWN0b3IzKCkuc2V0KDAuMCwgLTEuMCwgMC4wKTtcbiAgICB0aGlzLmdyYXZpdHlQb3dlciA9IHBhcmFtcy5ncmF2aXR5UG93ZXIgPz8gMC4wO1xuICAgIHRoaXMuZHJhZ0ZvcmNlID0gcGFyYW1zLmRyYWdGb3JjZSA/PyAwLjQ7XG4gICAgdGhpcy5jb2xsaWRlcnMgPSBwYXJhbXMuY29sbGlkZXJzID8/IFtdO1xuXG4gICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbi5zZXRGcm9tTWF0cml4UG9zaXRpb24odGhpcy5ib25lLm1hdHJpeFdvcmxkKTtcblxuICAgIHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeC5jb3B5KHRoaXMuYm9uZS5tYXRyaXgpO1xuICAgIHRoaXMuX2luaXRpYWxMb2NhbFJvdGF0aW9uLmNvcHkodGhpcy5ib25lLnF1YXRlcm5pb24pO1xuXG4gICAgaWYgKHRoaXMuYm9uZS5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIOacq+err+OBruODnOODvOODs+OAguWtkOODnOODvOODs+OBjOOBhOOBquOBhOOBn+OCgeOAjOiHquWIhuOBruWwkeOBl+WFiOOAjeOBjOWtkOODnOODvOODs+OBqOOBhOOBhuOBk+OBqOOBq+OBmeOCi1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2R3YW5nby9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9TcHJpbmdCb25lL1ZSTVNwcmluZ0JvbmUuY3MjTDI0NlxuICAgICAgdGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbi5jb3B5KHRoaXMuYm9uZS5wb3NpdGlvbikubm9ybWFsaXplKCkubXVsdGlwbHlTY2FsYXIoMC4wNyk7IC8vIHZybTAgcmVxdWlyZXMgYSA3Y20gZml4ZWQgYm9uZSBsZW5ndGggZm9yIHRoZSBmaW5hbCBub2RlIGluIGEgY2hhaW4gLSBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL3ZybS1zcGVjaWZpY2F0aW9uL3RyZWUvbWFzdGVyL3NwZWNpZmljYXRpb24vVlJNQ19zcHJpbmdCb25lLTEuMC1iZXRhI2Fib3V0LXNwcmluZy1jb25maWd1cmF0aW9uXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZpcnN0Q2hpbGQgPSB0aGlzLmJvbmUuY2hpbGRyZW5bMF07XG4gICAgICB0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uLmNvcHkoZmlyc3RDaGlsZC5wb3NpdGlvbik7XG4gICAgfVxuXG4gICAgLy8gQXBwbHkgdXBkYXRlZCBwb3NpdGlvbiB0byB0YWlsIHN0YXRlc1xuICAgIHRoaXMuYm9uZS5sb2NhbFRvV29ybGQodGhpcy5fY3VycmVudFRhaWwuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKSk7XG4gICAgdGhpcy5fcHJldlRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XG4gICAgdGhpcy5fbmV4dFRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XG5cbiAgICB0aGlzLl9ib25lQXhpcy5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuICAgIHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aCA9IF92M0FcbiAgICAgIC5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pXG4gICAgICAuYXBwbHlNYXRyaXg0KHRoaXMuYm9uZS5tYXRyaXhXb3JsZClcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgIC5sZW5ndGgoKTtcblxuICAgIHRoaXMuY2VudGVyID0gcGFyYW1zLmNlbnRlciA/PyBudWxsIGFzIGFueTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB0aGUgc3RhdGUgb2YgdGhpcyBib25lLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjYWxsIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXIucmVzZXRdXSBpbnN0ZWFkLlxuICAgKi9cbiAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xuICAgIHRoaXMuYm9uZS5xdWF0ZXJuaW9uLmNvcHkodGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24pO1xuXG4gICAgLy8gV2UgbmVlZCB0byB1cGRhdGUgaXRzIG1hdHJpeFdvcmxkIG1hbnVhbGx5LCBzaW5jZSB3ZSB0d2Vha2VkIHRoZSBib25lIGJ5IG91ciBoYW5kXG4gICAgdGhpcy5ib25lLnVwZGF0ZU1hdHJpeCgpO1xuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCksIHRoaXMuYm9uZS5tYXRyaXgpO1xuICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24uc2V0RnJvbU1hdHJpeFBvc2l0aW9uKHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7XG5cbiAgICAvLyBBcHBseSB1cGRhdGVkIHBvc2l0aW9uIHRvIHRhaWwgc3RhdGVzXG4gICAgdGhpcy5ib25lLmxvY2FsVG9Xb3JsZCh0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pKTtcbiAgICB0aGlzLl9wcmV2VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcbiAgICB0aGlzLl9uZXh0VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHN0YXRlIG9mIHRoaXMgYm9uZS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gY2FsbCBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyLnVwZGF0ZV1dIGluc3RlYWQuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIGlmIChkZWx0YSA8PSAwKSByZXR1cm47XG5cbiAgICBpZiAodGhpcy5ib25lLnBhcmVudCkge1xuICAgICAgLy8gU3ByaW5nQm9uZeOBr+imquOBi+OCiemghuOBq+WHpueQhuOBleOCjOOBpuOBhOOBj+OBn+OCgeOAgVxuICAgICAgLy8g6Kaq44GubWF0cml4V29ybGTjga/mnIDmlrDnirbmhYvjga7liY3mj5Djgad3b3JsZE1hdHJpeOOBi+OCiXF1YXRlcm5pb27jgpLlj5bjgorlh7rjgZnjgIJcbiAgICAgIC8vIOWItumZkOOBr+OBguOCi+OBkeOCjOOBqeOAgeioiOeul+OBr+WwkeOBquOBhOOBruOBp2dldFdvcmxkUXVhdGVybmlvbuOBp+OBr+OBquOBj+OBk+OBruaWueazleOCkuWPluOCi+OAglxuICAgICAgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmJvbmUucGFyZW50LCB0aGlzLl9wYXJlbnRXb3JsZFJvdGF0aW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcGFyZW50V29ybGRSb3RhdGlvbi5jb3B5KElERU5USVRZX1FVQVRFUk5JT04pO1xuICAgIH1cblxuICAgIC8vIEdldCBib25lIHBvc2l0aW9uIGluIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEEpO1xuICAgIF9tYXRBLm11bHRpcGx5KHRoaXMuYm9uZS5tYXRyaXhXb3JsZCk7IC8vIPCflKUgPz9cbiAgICB0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG5cbiAgICAvLyBHZXQgcGFyZW50IHBvc2l0aW9uIGluIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEIpO1xuICAgIF9tYXRCLm11bHRpcGx5KHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCkpO1xuXG4gICAgLy8gc2V2ZXJhbCBwYXJhbWV0ZXJzXG4gICAgY29uc3Qgc3RpZmZuZXNzID0gdGhpcy5zdGlmZm5lc3NGb3JjZSAqIGRlbHRhO1xuICAgIGNvbnN0IGV4dGVybmFsID0gX3YzQi5jb3B5KHRoaXMuZ3Jhdml0eURpcikubXVsdGlwbHlTY2FsYXIodGhpcy5ncmF2aXR5UG93ZXIgKiBkZWx0YSk7XG5cbiAgICAvLyB2ZXJsZXTnqY3liIbjgafmrKHjga7kvY3nva7jgpLoqIjnrpdcbiAgICB0aGlzLl9uZXh0VGFpbFxuICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXG4gICAgICAuYWRkKFxuICAgICAgICBfdjNBXG4gICAgICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXG4gICAgICAgICAgLnN1Yih0aGlzLl9wcmV2VGFpbClcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoMSAtIHRoaXMuZHJhZ0ZvcmNlKSxcbiAgICAgICkgLy8g5YmN44OV44Os44O844Og44Gu56e75YuV44KS57aZ57aa44GZ44KLKOa4m+ihsOOCguOBguOCi+OCiClcbiAgICAgIC5hZGQoXG4gICAgICAgIF92M0FcbiAgICAgICAgICAuY29weSh0aGlzLl9ib25lQXhpcylcbiAgICAgICAgICAuYXBwbHlNYXRyaXg0KHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeClcbiAgICAgICAgICAuYXBwbHlNYXRyaXg0KF9tYXRCKVxuICAgICAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgICAgICAubm9ybWFsaXplKClcbiAgICAgICAgICAubXVsdGlwbHlTY2FsYXIoc3RpZmZuZXNzKSxcbiAgICAgICkgLy8g6Kaq44Gu5Zue6Lui44Gr44KI44KL5a2Q44Oc44O844Oz44Gu56e75YuV55uu5qiZXG4gICAgICAuYWRkKGV4dGVybmFsKTsgLy8g5aSW5Yqb44Gr44KI44KL56e75YuV6YePXG5cbiAgICAvLyBub3JtYWxpemUgYm9uZSBsZW5ndGhcbiAgICB0aGlzLl9uZXh0VGFpbFxuICAgICAgLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKVxuICAgICAgLm5vcm1hbGl6ZSgpXG4gICAgICAubXVsdGlwbHlTY2FsYXIodGhpcy5fY2VudGVyU3BhY2VCb25lTGVuZ3RoKVxuICAgICAgLmFkZCh0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcblxuICAgIC8vIENvbGxpc2lvbuOBp+enu+WLlVxuICAgIHRoaXMuX2NvbGxpc2lvbih0aGlzLl9uZXh0VGFpbCk7XG5cbiAgICB0aGlzLl9wcmV2VGFpbC5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKTtcbiAgICB0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX25leHRUYWlsKTtcblxuICAgIC8vIEFwcGx5IHJvdGF0aW9uLCBjb252ZXJ0IHZlY3RvcjMgdGhpbmcgaW50byBhY3R1YWwgcXVhdGVybmlvblxuICAgIC8vIE9yaWdpbmFsIFVuaVZSTSBpcyBkb2luZyB3b3JsZCB1bml0IGNhbGN1bHVzIGF0IGhlcmUgYnV0IHdlJ3JlIGdvbm5hIGRvIHRoaXMgb24gbG9jYWwgdW5pdFxuICAgIC8vIHNpbmNlIFRocmVlLmpzIGlzIG5vdCBnb29kIGF0IHdvcmxkIGNvb3JkaW5hdGlvbiBzdHVmZlxuICAgIGNvbnN0IGluaXRpYWxDZW50ZXJTcGFjZU1hdHJpeEludiA9IG1hdDRJbnZlcnRDb21wYXQoX21hdEEuY29weShfbWF0Qi5tdWx0aXBseSh0aGlzLl9pbml0aWFsTG9jYWxNYXRyaXgpKSk7XG4gICAgY29uc3QgYXBwbHlSb3RhdGlvbiA9IF9xdWF0QS5zZXRGcm9tVW5pdFZlY3RvcnMoXG4gICAgICB0aGlzLl9ib25lQXhpcyxcbiAgICAgIF92M0EuY29weSh0aGlzLl9uZXh0VGFpbCkuYXBwbHlNYXRyaXg0KGluaXRpYWxDZW50ZXJTcGFjZU1hdHJpeEludikubm9ybWFsaXplKCksXG4gICAgKTtcblxuICAgIHRoaXMuYm9uZS5xdWF0ZXJuaW9uLmNvcHkodGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24pLm11bHRpcGx5KGFwcGx5Um90YXRpb24pO1xuXG4gICAgLy8gV2UgbmVlZCB0byB1cGRhdGUgaXRzIG1hdHJpeFdvcmxkIG1hbnVhbGx5LCBzaW5jZSB3ZSB0d2Vha2VkIHRoZSBib25lIGJ5IG91ciBoYW5kXG4gICAgdGhpcy5ib25lLnVwZGF0ZU1hdHJpeCgpO1xuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX2dldFBhcmVudE1hdHJpeFdvcmxkKCksIHRoaXMuYm9uZS5tYXRyaXgpO1xuICB9XG5cbiAgLyoqXG4gICAqIERvIGNvbGxpc2lvbiBtYXRoIGFnYWluc3QgZXZlcnkgY29sbGlkZXJzIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cbiAgICpcbiAgICogQHBhcmFtIHRhaWwgVGhlIHRhaWwgeW91IHdhbnQgdG8gcHJvY2Vzc1xuICAgKi9cbiAgcHJpdmF0ZSBfY29sbGlzaW9uKHRhaWw6IFRIUkVFLlZlY3RvcjMpOiB2b2lkIHtcbiAgICB0aGlzLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xuICAgICAgdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0QSk7XG4gICAgICBfbWF0QS5tdWx0aXBseShjb2xsaWRlci5tYXRyaXhXb3JsZCk7XG4gICAgICBjb25zdCBjb2xsaWRlckNlbnRlclNwYWNlUG9zaXRpb24gPSBfdjNBLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG4gICAgICBjb25zdCBjb2xsaWRlclJhZGl1cyA9IGNvbGxpZGVyLmdlb21ldHJ5LmJvdW5kaW5nU3BoZXJlIS5yYWRpdXM7IC8vIHRoZSBib3VuZGluZyBzcGhlcmUgaXMgZ3VhcmFudGVlZCB0byBiZSBleGlzdCBieSBWUk1TcHJpbmdCb25lSW1wb3J0ZXIuX2NyZWF0ZUNvbGxpZGVyTWVzaFxuICAgICAgY29uc3QgciA9IHRoaXMucmFkaXVzICsgY29sbGlkZXJSYWRpdXM7XG5cbiAgICAgIGlmICh0YWlsLmRpc3RhbmNlVG9TcXVhcmVkKGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbikgPD0gciAqIHIpIHtcbiAgICAgICAgLy8g44OS44OD44OI44CCQ29sbGlkZXLjga7ljYrlvoTmlrnlkJHjgavmirzjgZflh7rjgZlcbiAgICAgICAgY29uc3Qgbm9ybWFsID0gX3YzQi5zdWJWZWN0b3JzKHRhaWwsIGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbikubm9ybWFsaXplKCk7XG4gICAgICAgIGNvbnN0IHBvc0Zyb21Db2xsaWRlciA9IF92M0MuYWRkVmVjdG9ycyhjb2xsaWRlckNlbnRlclNwYWNlUG9zaXRpb24sIG5vcm1hbC5tdWx0aXBseVNjYWxhcihyKSk7XG5cbiAgICAgICAgLy8gbm9ybWFsaXplIGJvbmUgbGVuZ3RoXG4gICAgICAgIHRhaWwuY29weShcbiAgICAgICAgICBwb3NGcm9tQ29sbGlkZXJcbiAgICAgICAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgICAgICAgIC5ub3JtYWxpemUoKVxuICAgICAgICAgICAgLm11bHRpcGx5U2NhbGFyKHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aClcbiAgICAgICAgICAgIC5hZGQodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbiksXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbWF0cml4IHRoYXQgY29udmVydHMgY2VudGVyIHNwYWNlIGludG8gd29ybGQgc3BhY2UuXG4gICAqIEBwYXJhbSB0YXJnZXQgVGFyZ2V0IG1hdHJpeFxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0TWF0cml4Q2VudGVyVG9Xb3JsZCh0YXJnZXQ6IFRIUkVFLk1hdHJpeDQpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICBpZiAodGhpcy5fY2VudGVyKSB7XG4gICAgICB0YXJnZXQuY29weSh0aGlzLl9jZW50ZXIubWF0cml4V29ybGQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXQuaWRlbnRpdHkoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG1hdHJpeCB0aGF0IGNvbnZlcnRzIHdvcmxkIHNwYWNlIGludG8gY2VudGVyIHNwYWNlLlxuICAgKiBAcGFyYW0gdGFyZ2V0IFRhcmdldCBtYXRyaXhcbiAgICovXG4gIHByaXZhdGUgX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIodGFyZ2V0OiBUSFJFRS5NYXRyaXg0KTogVEhSRUUuTWF0cml4NCB7XG4gICAgaWYgKHRoaXMuX2NlbnRlcikge1xuICAgICAgLy8gdGFyZ2V0LmNvcHkoKHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSBhcyBNYXRyaXg0SW52ZXJzZUNhY2hlKS5pbnZlcnNlKTtcbiAgICAgIHRhcmdldC5jb3B5KHRoaXMuX2NlbnRlci5nZXRNYXRyaXhXb3JsZEludmVyc2UoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldC5pZGVudGl0eSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgd29ybGQgbWF0cml4IG9mIGl0cyBwYXJlbnQgb2JqZWN0LlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0UGFyZW50TWF0cml4V29ybGQoKTogVEhSRUUuTWF0cml4NCB7XG4gICAgcmV0dXJuIHRoaXMuYm9uZS5wYXJlbnQgPyB0aGlzLmJvbmUucGFyZW50Lm1hdHJpeFdvcmxkIDogSURFTlRJVFlfTUFUUklYNDtcbiAgfVxufVxuIiwiaW1wb3J0IHsgVlJNU3ByaW5nQm9uZSB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBzaW5nbGUgc3ByaW5nIGJvbmUgZ3JvdXAgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCB0eXBlIFZSTVNwcmluZ0JvbmVHcm91cCA9IFZSTVNwcmluZ0JvbmVbXTtcblxuLyoqXG4gKiBBIGNsYXNzIG1hbmFnZXMgZXZlcnkgc3ByaW5nIGJvbmVzIG9uIGEgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZU1hbmFnZXIge1xuICBwdWJsaWMgcmVhZG9ubHkgY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10gPSBbXTtcbiAgcHVibGljIHJlYWRvbmx5IHNwcmluZ0JvbmVHcm91cExpc3Q6IFZSTVNwcmluZ0JvbmVHcm91cFtdID0gW107XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyXV1cbiAgICpcbiAgICogQHBhcmFtIHNwcmluZ0JvbmVHcm91cExpc3QgQW4gYXJyYXkgb2YgW1tWUk1TcHJpbmdCb25lR3JvdXBdXVxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKGNvbGxpZGVyR3JvdXBzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdLCBzcHJpbmdCb25lR3JvdXBMaXN0OiBWUk1TcHJpbmdCb25lR3JvdXBbXSkge1xuICAgIHRoaXMuY29sbGlkZXJHcm91cHMgPSBjb2xsaWRlckdyb3VwcztcbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QgPSBzcHJpbmdCb25lR3JvdXBMaXN0O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldCBhbGwgYm9uZXMgYmUgY2FsY3VsYXRlZCBiYXNlZCBvbiB0aGUgc3BhY2UgcmVsYXRpdmUgZnJvbSB0aGlzIG9iamVjdC5cbiAgICogSWYgYG51bGxgIGlzIGdpdmVuLCBzcHJpbmdib25lIHdpbGwgYmUgY2FsY3VsYXRlZCBpbiB3b3JsZCBzcGFjZS5cbiAgICogQHBhcmFtIHJvb3QgUm9vdCBvYmplY3QsIG9yIGBudWxsYFxuICAgKi9cbiAgcHVibGljIHNldENlbnRlcihyb290OiBUSFJFRS5PYmplY3QzRCB8IG51bGwpOiB2b2lkIHtcbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QuZm9yRWFjaCgoc3ByaW5nQm9uZUdyb3VwKSA9PiB7XG4gICAgICBzcHJpbmdCb25lR3JvdXAuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xuICAgICAgICBzcHJpbmdCb25lLmNlbnRlciA9IHJvb3Q7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgZXZlcnkgc3ByaW5nIGJvbmUgYXR0YWNoZWQgdG8gdGhpcyBtYW5hZ2VyLlxuICAgKlxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lXG4gICAqL1xuICBwdWJsaWMgbGF0ZVVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgdXBkYXRlZE9iamVjdFNldCA9IG5ldyBTZXQ8VEhSRUUuT2JqZWN0M0Q+KCk7XG5cbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QuZm9yRWFjaCgoc3ByaW5nQm9uZUdyb3VwKSA9PiB7XG4gICAgICBzcHJpbmdCb25lR3JvdXAuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xuICAgICAgICB0aGlzLl91cGRhdGVXb3JsZE1hdHJpeCh1cGRhdGVkT2JqZWN0U2V0LCBzcHJpbmdCb25lLmJvbmUpO1xuICAgICAgICBzcHJpbmdCb25lLnVwZGF0ZShkZWx0YSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCBldmVyeSBzcHJpbmcgYm9uZSBhdHRhY2hlZCB0byB0aGlzIG1hbmFnZXIuXG4gICAqL1xuICBwdWJsaWMgcmVzZXQoKTogdm9pZCB7XG4gICAgY29uc3QgdXBkYXRlZE9iamVjdFNldCA9IG5ldyBTZXQ8VEhSRUUuT2JqZWN0M0Q+KCk7XG5cbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QuZm9yRWFjaCgoc3ByaW5nQm9uZUdyb3VwKSA9PiB7XG4gICAgICBzcHJpbmdCb25lR3JvdXAuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xuICAgICAgICB0aGlzLl91cGRhdGVXb3JsZE1hdHJpeCh1cGRhdGVkT2JqZWN0U2V0LCBzcHJpbmdCb25lLmJvbmUpO1xuICAgICAgICBzcHJpbmdCb25lLnJlc2V0KCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgd29ybGRNYXRyaXggb2YgZ2l2ZW4gb2JqZWN0LCByZXNwZWN0aW5nIGl0cyBhbmNlc3RvcnMuXG4gICAqIGNhbGxlZCBiZWZvcmUgdXBkYXRlIHNwcmluZ2JvbmUuXG4gICAqIEBwYXJhbSB1cGRhdGVkT2JqZWN0U2V0IFNldCBvZiBub2RlIHdoaWNoIHdvcmxkTWF0cml4IGlzIHVwZGF0ZWQuXG4gICAqIEBwYXJhbSBub2RlIHRhcmdldCBib25lIG5vZGUuXG4gICAqL1xuICBwcml2YXRlIF91cGRhdGVXb3JsZE1hdHJpeCh1cGRhdGVkT2JqZWN0U2V0OiBTZXQ8VEhSRUUuT2JqZWN0M0Q+LCBub2RlOiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xuICAgIGlmICh1cGRhdGVkT2JqZWN0U2V0Lmhhcyhub2RlKSkgcmV0dXJuO1xuXG4gICAgaWYgKG5vZGUucGFyZW50KSB0aGlzLl91cGRhdGVXb3JsZE1hdHJpeCh1cGRhdGVkT2JqZWN0U2V0LCBub2RlLnBhcmVudCk7XG4gICAgbm9kZS51cGRhdGVXb3JsZE1hdHJpeChmYWxzZSwgZmFsc2UpO1xuXG4gICAgdXBkYXRlZE9iamVjdFNldC5hZGQobm9kZSk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IEdMVEZOb2RlLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwLCBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lR3JvdXAsIFZSTVNwcmluZ0JvbmVNYW5hZ2VyIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lTWFuYWdlcic7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuY29uc3QgX2NvbGxpZGVyTWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoeyB2aXNpYmxlOiBmYWxzZSB9KTtcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUltcG9ydGVyIHtcbiAgLyoqXG4gICAqIEltcG9ydCBhIFtbVlJNTG9va0F0SGVhZF1dIGZyb20gYSBWUk0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGltcG9ydChnbHRmOiBHTFRGKTogVlJNU3ByaW5nQm9uZU1hbmFnZXIgfCBudWxsIHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkgcmV0dXJuIG51bGw7XG5cbiAgICBjb25zdCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb246IFZSTVNjaGVtYS5TZWNvbmRhcnlBbmltYXRpb24gfCB1bmRlZmluZWQgPSB2cm1FeHQuc2Vjb25kYXJ5QW5pbWF0aW9uO1xuICAgIGlmICghc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uKSByZXR1cm4gbnVsbDtcblxuICAgIC8vIOihneeqgeWIpOWumueQg+S9k+ODoeODg+OCt+ODpeOAglxuICAgIGNvbnN0IGNvbGxpZGVyR3JvdXBzID0gdGhpcy5faW1wb3J0Q29sbGlkZXJNZXNoR3JvdXBzKGdsdGYsIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbik7XG5cbiAgICAvLyDlkIzjgZjlsZ7mgKfvvIhzdGlmZmluZXNz44KEZHJhZ0ZvcmNl44GM5ZCM44GY77yJ44Gu44Oc44O844Oz44GvYm9uZUdyb3Vw44Gr44G+44Go44KB44KJ44KM44Gm44GE44KL44CCXG4gICAgLy8g5LiA5YiX44Gg44GR44Gn44Gv44Gq44GE44GT44Go44Gr5rOo5oSP44CCXG4gICAgY29uc3Qgc3ByaW5nQm9uZUdyb3VwTGlzdCA9IHRoaXMuX2ltcG9ydFNwcmluZ0JvbmVHcm91cExpc3QoZ2x0Ziwgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uLCBjb2xsaWRlckdyb3Vwcyk7XG5cbiAgICByZXR1cm4gbmV3IFZSTVNwcmluZ0JvbmVNYW5hZ2VyKGNvbGxpZGVyR3JvdXBzLCBzcHJpbmdCb25lR3JvdXBMaXN0KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfY3JlYXRlU3ByaW5nQm9uZShib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyA9IHt9KTogVlJNU3ByaW5nQm9uZSB7XG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lKGJvbmUsIHBhcmFtcyk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2ltcG9ydFNwcmluZ0JvbmVHcm91cExpc3QoXG4gICAgZ2x0ZjogR0xURixcbiAgICBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb246IFZSTVNjaGVtYS5TZWNvbmRhcnlBbmltYXRpb24sXG4gICAgY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10sXG4gICk6IFZSTVNwcmluZ0JvbmVHcm91cFtdIHtcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBzID0gc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uLmJvbmVHcm91cHMgfHwgW107XG4gICAgY29uc3Qgc3ByaW5nQm9uZUdyb3VwTGlzdDogYW55W11bXSA9IFtdO1xuICAgIHNwcmluZ0JvbmVHcm91cHMuZm9yRWFjaCgodnJtQm9uZUdyb3VwOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKHZybUJvbmVHcm91cC5zdGlmZmluZXNzID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnggPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICB2cm1Cb25lR3JvdXAuZ3Jhdml0eURpci56ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5UG93ZXIgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgdnJtQm9uZUdyb3VwLmRyYWdGb3JjZSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICB2cm1Cb25lR3JvdXAuaGl0UmFkaXVzID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgIHZybUJvbmVHcm91cC5jb2xsaWRlckdyb3VwcyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICB2cm1Cb25lR3JvdXAuYm9uZXMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgdnJtQm9uZUdyb3VwLmNlbnRlciA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc3RpZmZuZXNzRm9yY2UgPSB2cm1Cb25lR3JvdXAuc3RpZmZpbmVzcztcbiAgICAgICAgY29uc3QgZ3Jhdml0eURpciA9IG5ldyBUSFJFRS5WZWN0b3IzKHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLngsIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnksIC12cm1Cb25lR3JvdXAuZ3Jhdml0eURpci56KTtcbiAgICAgICAgY29uc3QgZ3Jhdml0eVBvd2VyID0gdnJtQm9uZUdyb3VwLmdyYXZpdHlQb3dlcjtcbiAgICAgICAgY29uc3QgZHJhZ0ZvcmNlID0gdnJtQm9uZUdyb3VwLmRyYWdGb3JjZTtcbiAgICAgICAgY29uc3QgcmFkaXVzID0gdnJtQm9uZUdyb3VwLmhpdFJhZGl1cztcbiAgICAgICAgY29uc3QgY29sbGlkZXJzOiBUSFJFRS5NZXNoW10gPSBbXTtcbiAgICAgICAgdnJtQm9uZUdyb3VwLmNvbGxpZGVyR3JvdXBzLmZvckVhY2goKGNvbGxpZGVySW5kZXg6IGFueSkgPT4ge1xuICAgICAgICAgICAgY29sbGlkZXJzLnB1c2goLi4uY29sbGlkZXJHcm91cHNbY29sbGlkZXJJbmRleF0uY29sbGlkZXJzKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHNwcmluZ0JvbmVHcm91cDogVlJNU3ByaW5nQm9uZVtdID0gW107XG4gICAgICAgIHZybUJvbmVHcm91cC5ib25lcy5mb3JFYWNoKChub2RlSW5kZXg6IGFueSkgPT4ge1xuICAgICAgICAgICAgLy8gVlJN44Gu5oOF5aCx44GL44KJ44CM5o+644KM44Oi44OO44CN44Oc44O844Oz44Gu44Or44O844OI44GM5Y+W44KM44KLXG4gICAgICAgICAgICBmdW5jdGlvbiBub2RlTG9va3VwKG5vZGVJbmRleDogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgICAgICAgICAgIGxldCBuYW1lID0gZ2x0Zi5wYXJzZXIuanNvbi5ub2Rlc1tub2RlSW5kZXhdLm5hbWU7XG4gICAgICAgICAgICAgIG5hbWUgPSBUSFJFRS5Qcm9wZXJ0eUJpbmRpbmcuc2FuaXRpemVOb2RlTmFtZShuYW1lKTtcbiAgICAgICAgICAgICAgLy8gZ2x0Zi5wYXJzZXIubm9kZU5hbWVzVXNlZFtuYW1lXSA9IGZhbHNlO1xuICAgICAgICAgICAgICAvLyBuYW1lID0gZ2x0Zi5wYXJzZXIuY3JlYXRlVW5pcXVlTmFtZShuYW1lKTtcbiAgICAgICAgICAgICAgY29uc3Qgbm9kZSA9IGdsdGYuc2NlbmUuZ2V0T2JqZWN0QnlOYW1lKG5hbWUpO1xuICAgICAgICAgICAgICByZXR1cm4gbm9kZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgc3ByaW5nUm9vdEJvbmUgPSBub2RlTG9va3VwKG5vZGVJbmRleCk7XG4gICAgICAgICAgY29uc3QgY2VudGVyID0gdnJtQm9uZUdyb3VwLmNlbnRlciAhPT0gLTEgPyBub2RlTG9va3VwKHZybUJvbmVHcm91cC5jZW50ZXIpIDogbnVsbDtcbiAgICAgICAgICBcbiAgICAgICAgICAgIC8vIGl0J3Mgd2VpcmQgYnV0IHRoZXJlIG1pZ2h0IGJlIGNhc2VzIHdlIGNhbid0IGZpbmQgdGhlIHJvb3QgYm9uZVxuICAgICAgICAgICAgaWYgKCFzcHJpbmdSb290Qm9uZSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHNwcmluZ1Jvb3RCb25lLnRyYXZlcnNlKChib25lOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBzcHJpbmdCb25lID0gdGhpcy5fY3JlYXRlU3ByaW5nQm9uZShib25lLCB7XG4gICAgICAgICAgICAgICAgICAgIHJhZGl1cyxcbiAgICAgICAgICAgICAgICAgICAgc3RpZmZuZXNzRm9yY2UsXG4gICAgICAgICAgICAgICAgICAgIGdyYXZpdHlEaXIsXG4gICAgICAgICAgICAgICAgICAgIGdyYXZpdHlQb3dlcixcbiAgICAgICAgICAgICAgICAgICAgZHJhZ0ZvcmNlLFxuICAgICAgICAgICAgICAgICAgICBjb2xsaWRlcnMsXG4gICAgICAgICAgICAgICAgICAgIGNlbnRlcixcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzcHJpbmdCb25lR3JvdXAucHVzaChzcHJpbmdCb25lKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgc3ByaW5nQm9uZUdyb3VwTGlzdC5wdXNoKHNwcmluZ0JvbmVHcm91cCk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHNwcmluZ0JvbmVHcm91cExpc3Q7XG59XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbiBhcnJheSBvZiBbW1ZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwXV0uXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKiBAcGFyYW0gc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uIEEgYHNlY29uZGFyeUFuaW1hdGlvbmAgZmllbGQgb2YgVlJNXG4gICAqL1xuICBwcm90ZWN0ZWQgX2ltcG9ydENvbGxpZGVyTWVzaEdyb3VwcyhcbiAgICBnbHRmOiBHTFRGLFxuICAgIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbixcbiAgKTogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSB7XG4gICAgY29uc3QgdnJtQ29sbGlkZXJHcm91cHMgPSBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24uY29sbGlkZXJHcm91cHM7XG4gICAgaWYgKHZybUNvbGxpZGVyR3JvdXBzID09PSB1bmRlZmluZWQpIHJldHVybiBbXTtcblxuICAgIGNvbnN0IGNvbGxpZGVyR3JvdXBzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdID0gW107XG4gICAgdnJtQ29sbGlkZXJHcm91cHMuZm9yRWFjaCgoY29sbGlkZXJHcm91cDogYW55KSA9PiB7XG4gICAgICBpZiAoY29sbGlkZXJHcm91cC5ub2RlID09PSB1bmRlZmluZWQgfHwgY29sbGlkZXJHcm91cC5jb2xsaWRlcnMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZnVuY3Rpb24gbm9kZUxvb2t1cChub2RlSW5kZXg6IHN0cmluZyB8IG51bWJlcikge1xuICAgICAgICBsZXQgbmFtZSA9IGdsdGYucGFyc2VyLmpzb24ubm9kZXNbbm9kZUluZGV4XS5uYW1lO1xuICAgICAgICBuYW1lID0gVEhSRUUuUHJvcGVydHlCaW5kaW5nLnNhbml0aXplTm9kZU5hbWUobmFtZSk7XG4gICAgICAgIC8vIGdsdGYucGFyc2VyLm5vZGVOYW1lc1VzZWRbbmFtZV0gPSBmYWxzZTtcbiAgICAgICAgLy8gbmFtZSA9IGdsdGYucGFyc2VyLmNyZWF0ZVVuaXF1ZU5hbWUobmFtZSk7XG4gICAgICAgIGNvbnN0IG5vZGUgPSBnbHRmLnNjZW5lLmdldE9iamVjdEJ5TmFtZShuYW1lKTtcbiAgICAgICAgcmV0dXJuIG5vZGU7XG4gICAgICB9XG4gICAgICBjb25zdCBib25lID0gbm9kZUxvb2t1cChjb2xsaWRlckdyb3VwLm5vZGUpIGFzIFRIUkVFLkJvbmU7XG4gICAgICBcbiAgICAgIGNvbnN0IGNvbGxpZGVyczogVEhSRUUuTWVzaFtdID0gW107XG4gICAgICBjb2xsaWRlckdyb3VwLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcjogYW55KSA9PiB7XG4gICAgICAgICAgaWYgKGNvbGxpZGVyLm9mZnNldCA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAgIGNvbGxpZGVyLm9mZnNldC54ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICAgY29sbGlkZXIub2Zmc2V0LnkgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueiA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgICAgIGNvbGxpZGVyLnJhZGl1cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3Qgb2Zmc2V0ID0gX3YzQS5zZXQoY29sbGlkZXIub2Zmc2V0LngsIGNvbGxpZGVyLm9mZnNldC55LCAtY29sbGlkZXIub2Zmc2V0LnopO1xuICAgICAgICAgIGNvbnN0IGNvbGxpZGVyTWVzaCA9IHRoaXMuX2NyZWF0ZUNvbGxpZGVyTWVzaChjb2xsaWRlci5yYWRpdXMsIG9mZnNldCk7XG4gICAgICAgICAgYm9uZS5hZGQoY29sbGlkZXJNZXNoKTtcbiAgICAgICAgICBjb2xsaWRlcnMucHVzaChjb2xsaWRlck1lc2gpO1xuICAgICAgfSk7XG4gICAgICBjb25zdCBjb2xsaWRlck1lc2hHcm91cCA9IHtcbiAgICAgICAgICBub2RlOiBjb2xsaWRlckdyb3VwLm5vZGUsXG4gICAgICAgICAgY29sbGlkZXJzLFxuICAgICAgfTtcbiAgICAgIGNvbGxpZGVyR3JvdXBzLnB1c2goY29sbGlkZXJNZXNoR3JvdXApO1xuICB9KTtcbiAgcmV0dXJuIGNvbGxpZGVyR3JvdXBzO1xufVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjb2xsaWRlciBtZXNoLlxuICAgKlxuICAgKiBAcGFyYW0gcmFkaXVzIFJhZGl1cyBvZiB0aGUgbmV3IGNvbGxpZGVyIG1lc2hcbiAgICogQHBhcmFtIG9mZnNldCBPZmZlc3Qgb2YgdGhlIG5ldyBjb2xsaWRlciBtZXNoXG4gICAqL1xuICBwcm90ZWN0ZWQgX2NyZWF0ZUNvbGxpZGVyTWVzaChyYWRpdXM6IG51bWJlciwgb2Zmc2V0OiBUSFJFRS5WZWN0b3IzKTogVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaCB7XG4gICAgY29uc3QgY29sbGlkZXJNZXNoID0gbmV3IFRIUkVFLk1lc2gobmV3IFRIUkVFLlNwaGVyZUJ1ZmZlckdlb21ldHJ5KHJhZGl1cywgOCwgNCksIF9jb2xsaWRlck1hdGVyaWFsKTtcblxuICAgIGNvbGxpZGVyTWVzaC5wb3NpdGlvbi5jb3B5KG9mZnNldCk7XG5cbiAgICAvLyB0aGUgbmFtZSBoYXZlIHRvIGJlIHRoaXMgaW4gb3JkZXIgdG8gZXhjbHVkZSBjb2xsaWRlcnMgZnJvbSBib3VuZGluZyBib3hcbiAgICAvLyAoU2VlIFZpZXdlci50cywgc2VhcmNoIGZvciBjaGlsZC5uYW1lID09PSAndnJtQ29sbGlkZXJTcGhlcmUnKVxuICAgIGNvbGxpZGVyTWVzaC5uYW1lID0gJ3ZybUNvbGxpZGVyU3BoZXJlJztcblxuICAgIC8vIFdlIHdpbGwgdXNlIHRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSBmb3IgY29sbGlzaW9uIHZzIGJvbmVzLlxuICAgIC8vIGBib3VuZGluZ1NwaGVyZWAgbXVzdCBiZSBjcmVhdGVkIHRvIGNvbXB1dGUgdGhlIHJhZGl1cy5cbiAgICBjb2xsaWRlck1lc2guZ2VvbWV0cnkuY29tcHV0ZUJvdW5kaW5nU3BoZXJlKCk7XG5cbiAgICByZXR1cm4gY29sbGlkZXJNZXNoO1xuICB9XG59XG4iLCJpbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlSW1wb3J0ZXIgfSBmcm9tICcuL2JsZW5kc2hhcGUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb25JbXBvcnRlciB9IGZyb20gJy4vZmlyc3RwZXJzb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWRJbXBvcnRlciB9IGZyb20gJy4vaHVtYW5vaWQvVlJNSHVtYW5vaWRJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlciB9IGZyb20gJy4vbG9va2F0L1ZSTUxvb2tBdEltcG9ydGVyJztcbmltcG9ydCB7IFZSTU1hdGVyaWFsSW1wb3J0ZXIgfSBmcm9tICcuL21hdGVyaWFsJztcbmltcG9ydCB7IFZSTU1ldGFJbXBvcnRlciB9IGZyb20gJy4vbWV0YS9WUk1NZXRhSW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUltcG9ydGVyIH0gZnJvbSAnLi9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk0gfSBmcm9tICcuL1ZSTSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVlJNSW1wb3J0ZXJPcHRpb25zIHtcbiAgbWV0YUltcG9ydGVyPzogVlJNTWV0YUltcG9ydGVyO1xuICBsb29rQXRJbXBvcnRlcj86IFZSTUxvb2tBdEltcG9ydGVyO1xuICBodW1hbm9pZEltcG9ydGVyPzogVlJNSHVtYW5vaWRJbXBvcnRlcjtcbiAgYmxlbmRTaGFwZUltcG9ydGVyPzogVlJNQmxlbmRTaGFwZUltcG9ydGVyO1xuICBmaXJzdFBlcnNvbkltcG9ydGVyPzogVlJNRmlyc3RQZXJzb25JbXBvcnRlcjtcbiAgbWF0ZXJpYWxJbXBvcnRlcj86IFZSTU1hdGVyaWFsSW1wb3J0ZXI7XG4gIHNwcmluZ0JvbmVJbXBvcnRlcj86IFZSTVNwcmluZ0JvbmVJbXBvcnRlcjtcbn1cblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTV1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUltcG9ydGVyIHtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9tZXRhSW1wb3J0ZXI6IFZSTU1ldGFJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9ibGVuZFNoYXBlSW1wb3J0ZXI6IFZSTUJsZW5kU2hhcGVJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9sb29rQXRJbXBvcnRlcjogVlJNTG9va0F0SW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfaHVtYW5vaWRJbXBvcnRlcjogVlJNSHVtYW5vaWRJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9maXJzdFBlcnNvbkltcG9ydGVyOiBWUk1GaXJzdFBlcnNvbkltcG9ydGVyO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX21hdGVyaWFsSW1wb3J0ZXI6IFZSTU1hdGVyaWFsSW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfc3ByaW5nQm9uZUltcG9ydGVyOiBWUk1TcHJpbmdCb25lSW1wb3J0ZXI7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1JbXBvcnRlci5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgW1tWUk1JbXBvcnRlck9wdGlvbnNdXSwgb3B0aW9uYWxseSBjb250YWlucyBpbXBvcnRlcnMgZm9yIGVhY2ggY29tcG9uZW50XG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3Iob3B0aW9uczogVlJNSW1wb3J0ZXJPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLl9tZXRhSW1wb3J0ZXIgPSBvcHRpb25zLm1ldGFJbXBvcnRlciB8fCBuZXcgVlJNTWV0YUltcG9ydGVyKCk7XG4gICAgdGhpcy5fYmxlbmRTaGFwZUltcG9ydGVyID0gb3B0aW9ucy5ibGVuZFNoYXBlSW1wb3J0ZXIgfHwgbmV3IFZSTUJsZW5kU2hhcGVJbXBvcnRlcigpO1xuICAgIHRoaXMuX2xvb2tBdEltcG9ydGVyID0gb3B0aW9ucy5sb29rQXRJbXBvcnRlciB8fCBuZXcgVlJNTG9va0F0SW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9odW1hbm9pZEltcG9ydGVyID0gb3B0aW9ucy5odW1hbm9pZEltcG9ydGVyIHx8IG5ldyBWUk1IdW1hbm9pZEltcG9ydGVyKCk7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25JbXBvcnRlciA9IG9wdGlvbnMuZmlyc3RQZXJzb25JbXBvcnRlciB8fCBuZXcgVlJNRmlyc3RQZXJzb25JbXBvcnRlcigpO1xuICAgIHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIgPSBvcHRpb25zLm1hdGVyaWFsSW1wb3J0ZXIgfHwgbmV3IFZSTU1hdGVyaWFsSW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9zcHJpbmdCb25lSW1wb3J0ZXIgPSBvcHRpb25zLnNwcmluZ0JvbmVJbXBvcnRlciB8fCBuZXcgVlJNU3ByaW5nQm9uZUltcG9ydGVyKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVjZWl2ZSBhIEdMVEYgb2JqZWN0IHJldHJpZXZlZCBmcm9tIGBUSFJFRS5HTFRGTG9hZGVyYCBhbmQgY3JlYXRlIGEgbmV3IFtbVlJNXV0gaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk0+IHtcbiAgICBpZiAoZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zID09PSB1bmRlZmluZWQgfHwgZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zLlZSTSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIFZSTSBleHRlbnNpb24gb24gdGhlIEdMVEYnKTtcbiAgICB9XG4gICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lO1xuXG4gICAgc2NlbmUudXBkYXRlTWF0cml4V29ybGQoZmFsc2UpO1xuXG4gICAgLy8gU2tpbm5lZCBvYmplY3Qgc2hvdWxkIG5vdCBiZSBmcnVzdHVtQ3VsbGVkXG4gICAgLy8gU2luY2UgcHJlLXNraW5uZWQgcG9zaXRpb24gbWlnaHQgYmUgb3V0c2lkZSBvZiB2aWV3XG4gICAgc2NlbmUudHJhdmVyc2UoKG9iamVjdDNkKSA9PiB7XG4gICAgICBpZiAoKG9iamVjdDNkIGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICAgIG9iamVjdDNkLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IG1ldGEgPSAoYXdhaXQgdGhpcy5fbWV0YUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgbWF0ZXJpYWxzID0gKGF3YWl0IHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIuY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGh1bWFub2lkID0gKGF3YWl0IHRoaXMuX2h1bWFub2lkSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbiA9IGh1bWFub2lkID8gKGF3YWl0IHRoaXMuX2ZpcnN0UGVyc29uSW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgYmxlbmRTaGFwZVByb3h5ID0gKGF3YWl0IHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGxvb2tBdCA9XG4gICAgICBmaXJzdFBlcnNvbiAmJiBibGVuZFNoYXBlUHJveHkgJiYgaHVtYW5vaWRcbiAgICAgICAgPyAoYXdhaXQgdGhpcy5fbG9va0F0SW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkXG4gICAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgY29uc3Qgc3ByaW5nQm9uZU1hbmFnZXIgPSAoYXdhaXQgdGhpcy5fc3ByaW5nQm9uZUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgcmV0dXJuIG5ldyBWUk0oe1xuICAgICAgc2NlbmU6IGdsdGYuc2NlbmUsXG4gICAgICBtZXRhLFxuICAgICAgbWF0ZXJpYWxzLFxuICAgICAgaHVtYW5vaWQsXG4gICAgICBmaXJzdFBlcnNvbixcbiAgICAgIGJsZW5kU2hhcGVQcm94eSxcbiAgICAgIGxvb2tBdCxcbiAgICAgIHNwcmluZ0JvbmVNYW5hZ2VyLFxuICAgIH0pO1xuICB9XG59XG4iLCIvLyBAdHMtbm9jaGVja1xuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNQmxlbmRTaGFwZVByb3h5IH0gZnJvbSAnLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi9maXJzdHBlcnNvbic7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4vaHVtYW5vaWQnO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZCB9IGZyb20gJy4vbG9va2F0JztcbmltcG9ydCB7IFZSTU1ldGEgfSBmcm9tICcuL21ldGEvVlJNTWV0YSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lTWFuYWdlciB9IGZyb20gJy4vc3ByaW5nYm9uZSc7XG5pbXBvcnQgeyBkZWVwRGlzcG9zZSB9IGZyb20gJy4vdXRpbHMvZGlzcG9zZXInO1xuaW1wb3J0IHsgVlJNSW1wb3J0ZXIsIFZSTUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4vVlJNSW1wb3J0ZXInO1xuXG4vKipcbiAqIFBhcmFtZXRlcnMgZm9yIGEgW1tWUk1dXSBjbGFzcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBWUk1QYXJhbWV0ZXJzIHtcbiAgc2NlbmU6IFRIUkVFLlNjZW5lIHwgVEhSRUUuR3JvdXA7IC8vIENPTVBBVDogYEdMVEYuc2NlbmVgIGlzIGdvaW5nIHRvIGJlIGBUSFJFRS5Hcm91cGAgaW4gcjExNFxuICBodW1hbm9pZD86IFZSTUh1bWFub2lkO1xuICBibGVuZFNoYXBlUHJveHk/OiBWUk1CbGVuZFNoYXBlUHJveHk7XG4gIGZpcnN0UGVyc29uPzogVlJNRmlyc3RQZXJzb247XG4gIGxvb2tBdD86IFZSTUxvb2tBdEhlYWQ7XG4gIG1hdGVyaWFscz86IFRIUkVFLk1hdGVyaWFsW107XG4gIHNwcmluZ0JvbmVNYW5hZ2VyPzogVlJNU3ByaW5nQm9uZU1hbmFnZXI7XG4gIG1ldGE/OiBWUk1NZXRhO1xufVxuXG4vKipcbiAqIEEgY2xhc3MgdGhhdCByZXByZXNlbnRzIGEgc2luZ2xlIFZSTSBtb2RlbC5cbiAqIFNlZSB0aGUgZG9jdW1lbnRhdGlvbiBvZiBbW1ZSTS5mcm9tXV0gZm9yIHRoZSBtb3N0IGJhc2ljIHVzZSBvZiBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk0ge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTSBmcm9tIGEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlci5cbiAgICogSXQncyBwcm9iYWJseSBhIHRoaW5nIHdoYXQgeW91IHdhbnQgdG8gZ2V0IHN0YXJ0ZWQgd2l0aCBWUk1zLlxuICAgKlxuICAgKiBAZXhhbXBsZSBNb3N0IGJhc2ljIHVzZSBvZiBWUk1cbiAgICogYGBgXG4gICAqIGNvbnN0IHNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG4gICAqXG4gICAqIG5ldyBUSFJFRS5HTFRGTG9hZGVyKCkubG9hZCggJ21vZGVscy90aHJlZS12cm0tZ2lybC52cm0nLCAoIGdsdGYgKSA9PiB7XG4gICAqXG4gICAqICAgVEhSRUUuVlJNLmZyb20oIGdsdGYgKS50aGVuKCAoIHZybSApID0+IHtcbiAgICpcbiAgICogICAgIHNjZW5lLmFkZCggdnJtLnNjZW5lICk7XG4gICAqXG4gICAqICAgfSApO1xuICAgKlxuICAgKiB9ICk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCBHTFRGIG9iamVjdCB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICogQHBhcmFtIG9wdGlvbnMgT3B0aW9ucyB0aGF0IHdpbGwgYmUgdXNlZCBpbiBpbXBvcnRlclxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBhc3luYyBmcm9tKGdsdGY6IEdMVEYsIG9wdGlvbnM6IFZSTUltcG9ydGVyT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxWUk0+IHtcbiAgICBjb25zdCBpbXBvcnRlciA9IG5ldyBWUk1JbXBvcnRlcihvcHRpb25zKTtcbiAgICByZXR1cm4gYXdhaXQgaW1wb3J0ZXIuaW1wb3J0KGdsdGYpO1xuICB9XG4gIC8qKlxuICAgKiBgVEhSRUUuU2NlbmVgIG9yIGBUSFJFRS5Hcm91cGAgKGRlcGVuZHMgb24geW91ciB0aHJlZS5qcyByZXZpc2lvbikgdGhhdCBjb250YWlucyB0aGUgZW50aXJlIFZSTS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzY2VuZTogVEhSRUUuU2NlbmUgfCBUSFJFRS5Hcm91cDsgLy8gQ09NUEFUOiBgR0xURi5zY2VuZWAgaXMgZ29pbmcgdG8gYmUgYFRIUkVFLkdyb3VwYCBpbiByMTE0XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIFtbVlJNSHVtYW5vaWRdXSBvZiB0aGUgVlJNLlxuICAgKiBZb3UgY2FuIGNvbnRyb2wgZWFjaCBib25lcyB1c2luZyBbW1ZSTUh1bWFub2lkLmdldEJvbmVOb2RlXV0uXG4gICAqXG4gICAqIEBUT0RPIEFkZCBhIGxpbmsgdG8gVlJNIHNwZWNcbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBodW1hbm9pZD86IFZSTUh1bWFub2lkO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBbW1ZSTUJsZW5kU2hhcGVQcm94eV1dIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGNvbnRyb2wgdGhlc2UgZmFjaWFsIGV4cHJlc3Npb25zIHZpYSBbW1ZSTUJsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZV1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGJsZW5kU2hhcGVQcm94eT86IFZSTUJsZW5kU2hhcGVQcm94eTtcblxuICAvKipcbiAgICogQ29udGFpbnMgW1tWUk1GaXJzdFBlcnNvbl1dIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBjYW4gdXNlIHZhcmlvdXMgZmVhdHVyZSBvZiB0aGUgZmlyc3RQZXJzb24gZmllbGQuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgZmlyc3RQZXJzb24/OiBWUk1GaXJzdFBlcnNvbjtcblxuICAvKipcbiAgICogQ29udGFpbnMgW1tWUk1Mb29rQXRIZWFkXV0gb2YgdGhlIFZSTS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gdXNlIFtbVlJNTG9va0F0SGVhZC50YXJnZXRdXSB0byBjb250cm9sIHRoZSBleWUgZGlyZWN0aW9uIG9mIHlvdXIgVlJNcy5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBsb29rQXQ/OiBWUk1Mb29rQXRIZWFkO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBtYXRlcmlhbHMgb2YgdGhlIFZSTS5cbiAgICogYHVwZGF0ZVZSTU1hdGVyaWFsc2AgbWV0aG9kIG9mIHRoZXNlIG1hdGVyaWFscyB3aWxsIGJlIGNhbGxlZCB2aWEgaXRzIFtbVlJNLnVwZGF0ZV1dIG1ldGhvZC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtYXRlcmlhbHM/OiBUSFJFRS5NYXRlcmlhbFtdO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBtZXRhIGZpZWxkcyBvZiB0aGUgVlJNLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byByZWZlciB0aGVzZSBsaWNlbnNlIGZpZWxkcyBiZWZvcmUgdXNlIHlvdXIgVlJNcy5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBtZXRhPzogVlJNTWV0YTtcblxuICAvKipcbiAgICogQSBbW1ZSTVNwcmluZ0JvbmVNYW5hZ2VyXV0gbWFuaXB1bGF0ZXMgYWxsIHNwcmluZyBib25lcyBhdHRhY2hlZCBvbiB0aGUgVlJNLlxuICAgKiBVc3VhbGx5IHlvdSBkb24ndCBoYXZlIHRvIGNhcmUgYWJvdXQgdGhpcyBwcm9wZXJ0eS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBzcHJpbmdCb25lTWFuYWdlcj86IFZSTVNwcmluZ0JvbmVNYW5hZ2VyO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcGFyYW1zIFtbVlJNUGFyYW1ldGVyc11dIHRoYXQgcmVwcmVzZW50cyBjb21wb25lbnRzIG9mIHRoZSBWUk1cbiAgICovXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihwYXJhbXM6IFZSTVBhcmFtZXRlcnMpIHtcbiAgICB0aGlzLnNjZW5lID0gcGFyYW1zLnNjZW5lO1xuICAgIHRoaXMuaHVtYW5vaWQgPSBwYXJhbXMuaHVtYW5vaWQ7XG4gICAgdGhpcy5ibGVuZFNoYXBlUHJveHkgPSBwYXJhbXMuYmxlbmRTaGFwZVByb3h5O1xuICAgIHRoaXMuZmlyc3RQZXJzb24gPSBwYXJhbXMuZmlyc3RQZXJzb247XG4gICAgdGhpcy5sb29rQXQgPSBwYXJhbXMubG9va0F0O1xuICAgIHRoaXMubWF0ZXJpYWxzID0gcGFyYW1zLm1hdGVyaWFscztcbiAgICB0aGlzLnNwcmluZ0JvbmVNYW5hZ2VyID0gcGFyYW1zLnNwcmluZ0JvbmVNYW5hZ2VyO1xuICAgIHRoaXMubWV0YSA9IHBhcmFtcy5tZXRhO1xuICB9XG5cbiAgLyoqXG4gICAqICoqWW91IG5lZWQgdG8gY2FsbCB0aGlzIG9uIHlvdXIgdXBkYXRlIGxvb3AuKipcbiAgICpcbiAgICogVGhpcyBmdW5jdGlvbiB1cGRhdGVzIGV2ZXJ5IFZSTSBjb21wb25lbnRzLlxuICAgKlxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5sb29rQXQpIHtcbiAgICAgIHRoaXMubG9va0F0LnVwZGF0ZShkZWx0YSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuYmxlbmRTaGFwZVByb3h5KSB7XG4gICAgICB0aGlzLmJsZW5kU2hhcGVQcm94eS51cGRhdGUoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zcHJpbmdCb25lTWFuYWdlcikge1xuICAgICAgdGhpcy5zcHJpbmdCb25lTWFuYWdlci5sYXRlVXBkYXRlKGRlbHRhKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5tYXRlcmlhbHMpIHtcbiAgICAgIHRoaXMubWF0ZXJpYWxzLmZvckVhY2goKG1hdGVyaWFsOiBhbnkpID0+IHtcbiAgICAgICAgaWYgKG1hdGVyaWFsLnVwZGF0ZVZSTU1hdGVyaWFscykge1xuICAgICAgICAgIG1hdGVyaWFsLnVwZGF0ZVZSTU1hdGVyaWFscyhkZWx0YSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBEaXNwb3NlIGV2ZXJ5dGhpbmcgYWJvdXQgdGhlIFZSTSBpbnN0YW5jZS5cbiAgICovXG4gIHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuICAgIGNvbnN0IHNjZW5lID0gdGhpcy5zY2VuZTtcbiAgICBpZiAoc2NlbmUpIHtcbiAgICAgIGRlZXBEaXNwb3NlKHNjZW5lKTtcbiAgICB9XG5cbiAgICB0aGlzLm1ldGE/LnRleHR1cmU/LmRpc3Bvc2UoKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNIH0gZnJvbSAnLi4vVlJNJztcblxuY29uc3QgX3YyQSA9IG5ldyBUSFJFRS5WZWN0b3IyKCk7XG5cbmNvbnN0IF9jYW1lcmEgPSBuZXcgVEhSRUUuT3J0aG9ncmFwaGljQ2FtZXJhKC0xLCAxLCAtMSwgMSwgLTEsIDEpO1xuY29uc3QgX21hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHsgY29sb3I6IDB4ZmZmZmZmLCBzaWRlOiBUSFJFRS5Eb3VibGVTaWRlIH0pO1xuY29uc3QgX3BsYW5lID0gbmV3IFRIUkVFLk1lc2gobmV3IFRIUkVFLlBsYW5lQnVmZmVyR2VvbWV0cnkoMiwgMiksIF9tYXRlcmlhbCk7XG5jb25zdCBfc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcbl9zY2VuZS5hZGQoX3BsYW5lKTtcblxuLyoqXG4gKiBFeHRyYWN0IGEgdGh1bWJuYWlsIGltYWdlIGJsb2IgZnJvbSBhIHtAbGluayBWUk19LlxuICogSWYgdGhlIHZybSBkb2VzIG5vdCBoYXZlIGEgdGh1bWJuYWlsLCBpdCB3aWxsIHRocm93IGFuIGVycm9yLlxuICogQHBhcmFtIHJlbmRlcmVyIFJlbmRlcmVyXG4gKiBAcGFyYW0gdnJtIFZSTSB3aXRoIGEgdGh1bWJuYWlsXG4gKiBAcGFyYW0gc2l6ZSB3aWR0aCAvIGhlaWdodCBvZiB0aGUgaW1hZ2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RUaHVtYm5haWxCbG9iKHJlbmRlcmVyOiBUSFJFRS5XZWJHTFJlbmRlcmVyLCB2cm06IFZSTSwgc2l6ZSA9IDUxMik6IFByb21pc2U8QmxvYj4ge1xuICAvLyBnZXQgdGhlIHRleHR1cmVcbiAgY29uc3QgdGV4dHVyZSA9IHZybS5tZXRhPy50ZXh0dXJlO1xuICBpZiAoIXRleHR1cmUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2V4dHJhY3RUaHVtYm5haWxCbG9iOiBUaGlzIFZSTSBkb2VzIG5vdCBoYXZlIGEgdGh1bWJuYWlsJyk7XG4gIH1cblxuICBjb25zdCBjYW52YXMgPSByZW5kZXJlci5nZXRDb250ZXh0KCkuY2FudmFzO1xuXG4gIC8vIHN0b3JlIHRoZSBjdXJyZW50IHJlc29sdXRpb25cbiAgcmVuZGVyZXIuZ2V0U2l6ZShfdjJBKTtcbiAgY29uc3QgcHJldldpZHRoID0gX3YyQS54O1xuICBjb25zdCBwcmV2SGVpZ2h0ID0gX3YyQS55O1xuXG4gIC8vIG92ZXJ3cml0ZSB0aGUgcmVzb2x1dGlvblxuICByZW5kZXJlci5zZXRTaXplKHNpemUsIHNpemUsIGZhbHNlKTtcblxuICAvLyBhc3NpZ24gdGhlIHRleHR1cmUgdG8gcGxhbmVcbiAgX21hdGVyaWFsLm1hcCA9IHRleHR1cmU7XG5cbiAgLy8gcmVuZGVyXG4gIHJlbmRlcmVyLnJlbmRlcihfc2NlbmUsIF9jYW1lcmEpO1xuXG4gIC8vIHVuYXNzaWduIHRoZSB0ZXh0dXJlXG4gIF9tYXRlcmlhbC5tYXAgPSBudWxsO1xuXG4gIC8vIGdldCBibG9iXG4gIGlmIChjYW52YXMgaW5zdGFuY2VvZiBPZmZzY3JlZW5DYW52YXMpIHtcbiAgICByZXR1cm4gY2FudmFzLmNvbnZlcnRUb0Jsb2IoKS5maW5hbGx5KCgpID0+IHtcbiAgICAgIC8vIHJldmVydCB0byBwcmV2aW91cyByZXNvbHV0aW9uXG4gICAgICByZW5kZXJlci5zZXRTaXplKHByZXZXaWR0aCwgcHJldkhlaWdodCwgZmFsc2UpO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBjYW52YXMudG9CbG9iKChibG9iKSA9PiB7XG4gICAgICAvLyByZXZlcnQgdG8gcHJldmlvdXMgcmVzb2x1dGlvblxuICAgICAgcmVuZGVyZXIuc2V0U2l6ZShwcmV2V2lkdGgsIHByZXZIZWlnaHQsIGZhbHNlKTtcblxuICAgICAgaWYgKGJsb2IgPT0gbnVsbCkge1xuICAgICAgICByZWplY3QoJ2V4dHJhY3RUaHVtYm5haWxCbG9iOiBGYWlsZWQgdG8gY3JlYXRlIGEgYmxvYicpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZShibG9iKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogVHJhdmVyc2UgZ2l2ZW4gb2JqZWN0IGFuZCByZW1vdmUgdW5uZWNlc3NhcmlseSBib3VuZCBqb2ludHMgZnJvbSBldmVyeSBgVEhSRUUuU2tpbm5lZE1lc2hgLlxuICogU29tZSBlbnZpcm9ubWVudHMgbGlrZSBtb2JpbGUgZGV2aWNlcyBoYXZlIGEgbG93ZXIgbGltaXQgb2YgYm9uZXMgYW5kIG1pZ2h0IGJlIHVuYWJsZSB0byBwZXJmb3JtIG1lc2ggc2tpbm5pbmcsIHRoaXMgZnVuY3Rpb24gbWlnaHQgcmVzb2x2ZSBzdWNoIGFuIGlzc3VlLlxuICogQWxzbyB0aGlzIGZ1bmN0aW9uIG1pZ2h0IGdyZWF0bHkgaW1wcm92ZSB0aGUgcGVyZm9ybWFuY2Ugb2YgbWVzaCBza2lubmluZy5cbiAqXG4gKiBAcGFyYW0gcm9vdCBSb290IG9iamVjdCB0aGF0IHdpbGwgYmUgdHJhdmVyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVVbm5lY2Vzc2FyeUpvaW50cyhyb290OiBUSFJFRS5PYmplY3QzRCk6IHZvaWQge1xuICAvLyBzb21lIG1lc2hlcyBtaWdodCBzaGFyZSBhIHNhbWUgc2tpbkluZGV4IGF0dHJpYnV0ZSBhbmQgdGhpcyBtYXAgcHJldmVudHMgdG8gY29udmVydCB0aGUgYXR0cmlidXRlIHR3aWNlXG4gIGNvbnN0IHNrZWxldG9uTGlzdDogTWFwPFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZSwgVEhSRUUuU2tlbGV0b24+ID0gbmV3IE1hcCgpO1xuXG4gIC8vIFRyYXZlcnNlIGFuIGVudGlyZSB0cmVlXG4gIHJvb3QudHJhdmVyc2UoKG9iaikgPT4ge1xuICAgIGlmIChvYmoudHlwZSAhPT0gJ1NraW5uZWRNZXNoJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1lc2ggPSBvYmogYXMgVEhSRUUuU2tpbm5lZE1lc2g7XG4gICAgY29uc3QgZ2VvbWV0cnkgPSBtZXNoLmdlb21ldHJ5O1xuICAgIGNvbnN0IGF0dHJpYnV0ZSA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbkluZGV4JykgYXMgVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xuXG4gICAgLy8gbG9vayBmb3IgZXhpc3Rpbmcgc2tlbGV0b25cbiAgICBsZXQgc2tlbGV0b24gPSBza2VsZXRvbkxpc3QuZ2V0KGF0dHJpYnV0ZSk7XG5cbiAgICBpZiAoIXNrZWxldG9uKSB7XG4gICAgICAvLyBnZW5lcmF0ZSByZWR1Y2VkIGJvbmUgbGlzdFxuICAgICAgY29uc3QgYm9uZXM6IFRIUkVFLkJvbmVbXSA9IFtdOyAvLyBuZXcgbGlzdCBvZiBib25lXG4gICAgICBjb25zdCBib25lSW52ZXJzZXM6IFRIUkVFLk1hdHJpeDRbXSA9IFtdOyAvLyBuZXcgbGlzdCBvZiBib25lSW52ZXJzZVxuICAgICAgY29uc3QgYm9uZUluZGV4TWFwOiB7IFtpbmRleDogbnVtYmVyXTogbnVtYmVyIH0gPSB7fTsgLy8gbWFwIG9mIG9sZCBib25lIGluZGV4IHZzLiBuZXcgYm9uZSBpbmRleFxuXG4gICAgICAvLyBjcmVhdGUgYSBuZXcgYm9uZSBtYXBcbiAgICAgIGNvbnN0IGFycmF5ID0gYXR0cmlidXRlLmFycmF5IGFzIG51bWJlcltdO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBpbmRleCA9IGFycmF5W2ldO1xuXG4gICAgICAgIC8vIG5ldyBza2luSW5kZXggYnVmZmVyXG4gICAgICAgIGlmIChib25lSW5kZXhNYXBbaW5kZXhdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBib25lSW5kZXhNYXBbaW5kZXhdID0gYm9uZXMubGVuZ3RoO1xuICAgICAgICAgIGJvbmVzLnB1c2gobWVzaC5za2VsZXRvbi5ib25lc1tpbmRleF0pO1xuICAgICAgICAgIGJvbmVJbnZlcnNlcy5wdXNoKG1lc2guc2tlbGV0b24uYm9uZUludmVyc2VzW2luZGV4XSk7XG4gICAgICAgIH1cblxuICAgICAgICBhcnJheVtpXSA9IGJvbmVJbmRleE1hcFtpbmRleF07XG4gICAgICB9XG5cbiAgICAgIC8vIHJlcGxhY2Ugd2l0aCBuZXcgaW5kaWNlc1xuICAgICAgYXR0cmlidXRlLmNvcHlBcnJheShhcnJheSk7XG4gICAgICBhdHRyaWJ1dGUubmVlZHNVcGRhdGUgPSB0cnVlO1xuXG4gICAgICAvLyByZXBsYWNlIHdpdGggbmV3IGluZGljZXNcbiAgICAgIHNrZWxldG9uID0gbmV3IFRIUkVFLlNrZWxldG9uKGJvbmVzLCBib25lSW52ZXJzZXMpO1xuICAgICAgc2tlbGV0b25MaXN0LnNldChhdHRyaWJ1dGUsIHNrZWxldG9uKTtcbiAgICB9XG5cbiAgICBtZXNoLmJpbmQoc2tlbGV0b24sIG5ldyBUSFJFRS5NYXRyaXg0KCkpO1xuICAgIC8vICAgICAgICAgICAgICAgICAgXl5eXl5eXl5eXl5eXl5eXl5eXiB0cmFuc2Zvcm0gb2YgbWVzaGVzIHNob3VsZCBiZSBpZ25vcmVkXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vS2hyb25vc0dyb3VwL2dsVEYvdHJlZS9tYXN0ZXIvc3BlY2lmaWNhdGlvbi8yLjAjc2tpbnNcbiAgfSk7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBCdWZmZXJBdHRyaWJ1dGUgfSBmcm9tICd0aHJlZSc7XG5cbi8qKlxuICogVHJhdmVyc2UgZ2l2ZW4gb2JqZWN0IGFuZCByZW1vdmUgdW5uZWNlc3NhcnkgdmVydGljZXMgZnJvbSBldmVyeSBCdWZmZXJHZW9tZXRyaWVzLlxuICogVGhpcyBvbmx5IHByb2Nlc3NlcyBidWZmZXIgZ2VvbWV0cmllcyB3aXRoIGluZGV4IGJ1ZmZlci5cbiAqXG4gKiBUaHJlZS5qcyBjcmVhdGVzIG1vcnBoIHRleHR1cmVzIGZvciBlYWNoIGdlb21ldHJpZXMgYW5kIGl0IHNvbWV0aW1lcyBjb25zdW1lcyB1bm5lY2Vzc2FyeSBhbW91bnQgb2YgVlJBTSBmb3IgY2VydGFpbiBtb2RlbHMuXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgb3B0aW1pemUgZ2VvbWV0cmllcyB0byByZWR1Y2UgdGhlIHNpemUgb2YgbW9ycGggdGV4dHVyZS5cbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9pc3N1ZXMvMjMwOTVcbiAqXG4gKiBAcGFyYW0gcm9vdCBSb290IG9iamVjdCB0aGF0IHdpbGwgYmUgdHJhdmVyc2VkXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVVbm5lY2Vzc2FyeVZlcnRpY2VzKHJvb3Q6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gIGNvbnN0IGdlb21ldHJ5TWFwID0gbmV3IE1hcDxUSFJFRS5CdWZmZXJHZW9tZXRyeSwgVEhSRUUuQnVmZmVyR2VvbWV0cnk+KCk7XG5cbiAgLy8gVHJhdmVyc2UgYW4gZW50aXJlIHRyZWVcbiAgcm9vdC50cmF2ZXJzZSgob2JqKSA9PiB7XG4gICAgaWYgKCEob2JqIGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzaCA9IG9iaiBhcyBUSFJFRS5NZXNoO1xuICAgIGNvbnN0IGdlb21ldHJ5ID0gbWVzaC5nZW9tZXRyeTtcblxuICAgIC8vIGlmIHRoZSBnZW9tZXRyeSBkb2VzIG5vdCBoYXZlIGFuIGluZGV4IGJ1ZmZlciBpdCBkb2VzIG5vdCBuZWVkIHRvIHByb2Nlc3NcbiAgICBjb25zdCBvcmlnaWFubEluZGV4ID0gZ2VvbWV0cnkuaW5kZXg7XG4gICAgaWYgKG9yaWdpYW5sSW5kZXggPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIHNraXAgYWxyZWFkeSBwcm9jZXNzZWQgZ2VvbWV0cnlcbiAgICBjb25zdCBuZXdHZW9tZXRyeUFscmVhZHlFeGlzdGVkID0gZ2VvbWV0cnlNYXAuZ2V0KGdlb21ldHJ5KTtcbiAgICBpZiAobmV3R2VvbWV0cnlBbHJlYWR5RXhpc3RlZCAhPSBudWxsKSB7XG4gICAgICBtZXNoLmdlb21ldHJ5ID0gbmV3R2VvbWV0cnlBbHJlYWR5RXhpc3RlZDtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBuZXdHZW9tZXRyeSA9IG5ldyBUSFJFRS5CdWZmZXJHZW9tZXRyeSgpO1xuXG4gICAgLy8gY29weSB2YXJpb3VzIHByb3BlcnRpZXNcbiAgICAvLyBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi8xYTI0MWVmMTAwNDg3NzBkNTZlMDZkNmNkNmE2NGM3NmNjNzIwZjk1L3NyYy9jb3JlL0J1ZmZlckdlb21ldHJ5LmpzI0wxMDExXG4gICAgbmV3R2VvbWV0cnkubmFtZSA9IGdlb21ldHJ5Lm5hbWU7XG5cbiAgICBuZXdHZW9tZXRyeS5tb3JwaFRhcmdldHNSZWxhdGl2ZSA9IGdlb21ldHJ5Lm1vcnBoVGFyZ2V0c1JlbGF0aXZlO1xuXG4gICAgZ2VvbWV0cnkuZ3JvdXBzLmZvckVhY2goKGdyb3VwKSA9PiB7XG4gICAgICBuZXdHZW9tZXRyeS5hZGRHcm91cChncm91cC5zdGFydCwgZ3JvdXAuY291bnQsIGdyb3VwLm1hdGVyaWFsSW5kZXgpO1xuICAgIH0pO1xuXG4gICAgbmV3R2VvbWV0cnkuYm91bmRpbmdCb3ggPSBnZW9tZXRyeS5ib3VuZGluZ0JveD8uY2xvbmUoKSA/PyBudWxsO1xuICAgIG5ld0dlb21ldHJ5LmJvdW5kaW5nU3BoZXJlID0gZ2VvbWV0cnkuYm91bmRpbmdTcGhlcmU/LmNsb25lKCkgPz8gbnVsbDtcblxuICAgIG5ld0dlb21ldHJ5LnNldERyYXdSYW5nZShnZW9tZXRyeS5kcmF3UmFuZ2Uuc3RhcnQsIGdlb21ldHJ5LmRyYXdSYW5nZS5jb3VudCk7XG5cbiAgICBuZXdHZW9tZXRyeS51c2VyRGF0YSA9IGdlb21ldHJ5LnVzZXJEYXRhO1xuXG4gICAgLy8gc2V0IHRvIGdlb21ldHJ5TWFwXG4gICAgZ2VvbWV0cnlNYXAuc2V0KGdlb21ldHJ5LCBuZXdHZW9tZXRyeSk7XG5cbiAgICAvKiogZnJvbSBvcmlnaW5hbCBpbmRleCB0byBuZXcgaW5kZXggKi9cbiAgICBjb25zdCBvcmlnaW5hbEluZGV4TmV3SW5kZXhNYXA6IG51bWJlcltdID0gW107XG5cbiAgICAvKiogZnJvbSBuZXcgaW5kZXggdG8gb3JpZ2luYWwgaW5kZXggKi9cbiAgICBjb25zdCBuZXdJbmRleE9yaWdpbmFsSW5kZXhNYXA6IG51bWJlcltdID0gW107XG5cbiAgICAvLyByZW9yZ2FuaXplIGluZGljZXNcbiAgICB7XG4gICAgICBjb25zdCBvcmlnaW5hbEluZGV4QXJyYXkgPSBvcmlnaWFubEluZGV4LmFycmF5O1xuICAgICAgY29uc3QgbmV3SW5kZXhBcnJheSA9IG5ldyAob3JpZ2luYWxJbmRleEFycmF5LmNvbnN0cnVjdG9yIGFzIGFueSkob3JpZ2luYWxJbmRleEFycmF5Lmxlbmd0aCk7XG5cbiAgICAgIGxldCBpbmRleEhlYWQgPSAwO1xuXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9yaWdpbmFsSW5kZXhBcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBvcmlnaW5hbEluZGV4ID0gb3JpZ2luYWxJbmRleEFycmF5W2ldO1xuXG4gICAgICAgIGxldCBuZXdJbmRleCA9IG9yaWdpbmFsSW5kZXhOZXdJbmRleE1hcFtvcmlnaW5hbEluZGV4XTtcbiAgICAgICAgaWYgKG5ld0luZGV4ID09IG51bGwpIHtcbiAgICAgICAgICBvcmlnaW5hbEluZGV4TmV3SW5kZXhNYXBbb3JpZ2luYWxJbmRleF0gPSBpbmRleEhlYWQ7XG4gICAgICAgICAgbmV3SW5kZXhPcmlnaW5hbEluZGV4TWFwW2luZGV4SGVhZF0gPSBvcmlnaW5hbEluZGV4O1xuICAgICAgICAgIG5ld0luZGV4ID0gaW5kZXhIZWFkO1xuICAgICAgICAgIGluZGV4SGVhZCsrO1xuICAgICAgICB9XG4gICAgICAgIG5ld0luZGV4QXJyYXlbaV0gPSBuZXdJbmRleDtcbiAgICAgIH1cblxuICAgICAgbmV3R2VvbWV0cnkuc2V0SW5kZXgobmV3IEJ1ZmZlckF0dHJpYnV0ZShuZXdJbmRleEFycmF5LCAxLCBmYWxzZSkpO1xuICAgIH1cblxuICAgIC8vIHJlb3JnYW5pemUgYXR0cmlidXRlc1xuICAgIE9iamVjdC5rZXlzKGdlb21ldHJ5LmF0dHJpYnV0ZXMpLmZvckVhY2goKGF0dHJpYnV0ZU5hbWUpID0+IHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsQXR0cmlidXRlID0gZ2VvbWV0cnkuYXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSBhcyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XG5cbiAgICAgIGlmICgob3JpZ2luYWxBdHRyaWJ1dGUgYXMgYW55KS5pc0ludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlczogSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUgaXMgbm90IHN1cHBvcnRlZCcpO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBvcmlnaW5hbEF0dHJpYnV0ZUFycmF5ID0gb3JpZ2luYWxBdHRyaWJ1dGUuYXJyYXk7XG4gICAgICBjb25zdCB7IGl0ZW1TaXplLCBub3JtYWxpemVkIH0gPSBvcmlnaW5hbEF0dHJpYnV0ZTtcblxuICAgICAgY29uc3QgbmV3QXR0cmlidXRlQXJyYXkgPSBuZXcgKG9yaWdpbmFsQXR0cmlidXRlQXJyYXkuY29uc3RydWN0b3IgYXMgYW55KShcbiAgICAgICAgbmV3SW5kZXhPcmlnaW5hbEluZGV4TWFwLmxlbmd0aCAqIGl0ZW1TaXplLFxuICAgICAgKTtcblxuICAgICAgbmV3SW5kZXhPcmlnaW5hbEluZGV4TWFwLmZvckVhY2goKG9yaWdpbmFsSW5kZXgsIGkpID0+IHtcbiAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBpdGVtU2l6ZTsgaisrKSB7XG4gICAgICAgICAgbmV3QXR0cmlidXRlQXJyYXlbaSAqIGl0ZW1TaXplICsgal0gPSBvcmlnaW5hbEF0dHJpYnV0ZUFycmF5W29yaWdpbmFsSW5kZXggKiBpdGVtU2l6ZSArIGpdO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgbmV3R2VvbWV0cnkuc2V0QXR0cmlidXRlKGF0dHJpYnV0ZU5hbWUsIG5ldyBCdWZmZXJBdHRyaWJ1dGUobmV3QXR0cmlidXRlQXJyYXksIGl0ZW1TaXplLCBub3JtYWxpemVkKSk7XG4gICAgfSk7XG5cbiAgICAvLyByZW9yZ2FuaXplIG1vcnBoIGF0dHJpYnV0ZXNcbiAgICAvKiogVHJ1ZSBpZiBhbGwgbW9ycGhzIGFyZSB6ZXJvLiAqL1xuICAgIGxldCBpc051bGxNb3JwaCA9IHRydWU7XG5cbiAgICBPYmplY3Qua2V5cyhnZW9tZXRyeS5tb3JwaEF0dHJpYnV0ZXMpLmZvckVhY2goKGF0dHJpYnV0ZU5hbWUpID0+IHtcbiAgICAgIG5ld0dlb21ldHJ5Lm1vcnBoQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXSA9IFtdO1xuXG4gICAgICBjb25zdCBtb3JwaHMgPSBnZW9tZXRyeS5tb3JwaEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV07XG4gICAgICBmb3IgKGxldCBpTW9ycGggPSAwOyBpTW9ycGggPCBtb3JwaHMubGVuZ3RoOyBpTW9ycGgrKykge1xuICAgICAgICBjb25zdCBvcmlnaW5hbEF0dHJpYnV0ZSA9IG1vcnBoc1tpTW9ycGhdIGFzIFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcblxuICAgICAgICBpZiAoKG9yaWdpbmFsQXR0cmlidXRlIGFzIGFueSkuaXNJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcigncmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlczogSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUgaXMgbm90IHN1cHBvcnRlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgb3JpZ2luYWxBdHRyaWJ1dGVBcnJheSA9IG9yaWdpbmFsQXR0cmlidXRlLmFycmF5O1xuICAgICAgICBjb25zdCB7IGl0ZW1TaXplLCBub3JtYWxpemVkIH0gPSBvcmlnaW5hbEF0dHJpYnV0ZTtcblxuICAgICAgICBjb25zdCBuZXdBdHRyaWJ1dGVBcnJheSA9IG5ldyAob3JpZ2luYWxBdHRyaWJ1dGVBcnJheS5jb25zdHJ1Y3RvciBhcyBhbnkpKFxuICAgICAgICAgIG5ld0luZGV4T3JpZ2luYWxJbmRleE1hcC5sZW5ndGggKiBpdGVtU2l6ZSxcbiAgICAgICAgKTtcblxuICAgICAgICBuZXdJbmRleE9yaWdpbmFsSW5kZXhNYXAuZm9yRWFjaCgob3JpZ2luYWxJbmRleCwgaSkgPT4ge1xuICAgICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgaXRlbVNpemU7IGorKykge1xuICAgICAgICAgICAgbmV3QXR0cmlidXRlQXJyYXlbaSAqIGl0ZW1TaXplICsgal0gPSBvcmlnaW5hbEF0dHJpYnV0ZUFycmF5W29yaWdpbmFsSW5kZXggKiBpdGVtU2l6ZSArIGpdO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaXNOdWxsTW9ycGggPSBpc051bGxNb3JwaCAmJiBuZXdBdHRyaWJ1dGVBcnJheS5ldmVyeSgodjogbnVtYmVyKSA9PiB2ID09PSAwKTtcblxuICAgICAgICBuZXdHZW9tZXRyeS5tb3JwaEF0dHJpYnV0ZXNbYXR0cmlidXRlTmFtZV1baU1vcnBoXSA9IG5ldyBCdWZmZXJBdHRyaWJ1dGUoXG4gICAgICAgICAgbmV3QXR0cmlidXRlQXJyYXksXG4gICAgICAgICAgaXRlbVNpemUsXG4gICAgICAgICAgbm9ybWFsaXplZCxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIElmIGFsbCBtb3JwaHMgYXJlIHplcm8sIGp1c3QgZGlzY2FyZCB0aGUgbW9ycGggYXR0cmlidXRlcyB3ZSd2ZSBqdXN0IG1hZGVcbiAgICBpZiAoaXNOdWxsTW9ycGgpIHtcbiAgICAgIG5ld0dlb21ldHJ5Lm1vcnBoQXR0cmlidXRlcyA9IHt9O1xuICAgIH1cblxuICAgIG1lc2guZ2VvbWV0cnkgPSBuZXdHZW9tZXRyeTtcbiAgfSk7XG5cbiAgQXJyYXkuZnJvbShnZW9tZXRyeU1hcC5rZXlzKCkpLmZvckVhY2goKG9yaWdpbmFsR2VvbWV0cnkpID0+IHtcbiAgICBvcmlnaW5hbEdlb21ldHJ5LmRpc3Bvc2UoKTtcbiAgfSk7XG59XG4iLCJpbXBvcnQgeyBleHRyYWN0VGh1bWJuYWlsQmxvYiB9IGZyb20gJy4vZXh0cmFjdFRodW1ibmFpbEJsb2InO1xuaW1wb3J0IHsgcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMgfSBmcm9tICcuL3JlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzJztcbmltcG9ydCB7IHJlbW92ZVVubmVjZXNzYXJ5VmVydGljZXMgfSBmcm9tICcuL3JlbW92ZVVubmVjZXNzYXJ5VmVydGljZXMnO1xuXG5leHBvcnQgY2xhc3MgVlJNVXRpbHMge1xuICBwcml2YXRlIGNvbnN0cnVjdG9yKCkge1xuICAgIC8vIHRoaXMgY2xhc3MgaXMgbm90IG1lYW50IHRvIGJlIGluc3RhbnRpYXRlZFxuICB9XG5cbiAgcHVibGljIHN0YXRpYyBleHRyYWN0VGh1bWJuYWlsQmxvYiA9IGV4dHJhY3RUaHVtYm5haWxCbG9iO1xuICBwdWJsaWMgc3RhdGljIHJlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzID0gcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHM7XG4gIHB1YmxpYyBzdGF0aWMgcmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlcyA9IHJlbW92ZVVubmVjZXNzYXJ5VmVydGljZXM7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi4vbG9va2F0L1ZSTUxvb2tBdEhlYWQnO1xuaW1wb3J0IHsgVlJNRGVidWdPcHRpb25zIH0gZnJvbSAnLi9WUk1EZWJ1Z09wdGlvbnMnO1xuXG5jb25zdCBfdjMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SGVhZERlYnVnIGV4dGVuZHMgVlJNTG9va0F0SGVhZCB7XG4gIHByaXZhdGUgX2ZhY2VEaXJlY3Rpb25IZWxwZXI/OiBUSFJFRS5BcnJvd0hlbHBlcjtcblxuICBwdWJsaWMgc2V0dXBIZWxwZXIoc2NlbmU6IFRIUkVFLk9iamVjdDNELCBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlRmFjZURpcmVjdGlvbkhlbHBlcikge1xuICAgICAgdGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlciA9IG5ldyBUSFJFRS5BcnJvd0hlbHBlcihcbiAgICAgICAgbmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgLTEpLFxuICAgICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAwKSxcbiAgICAgICAgMC41LFxuICAgICAgICAweGZmMDBmZixcbiAgICAgICk7XG4gICAgICBzY2VuZS5hZGQodGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlcik7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcblxuICAgIGlmICh0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyKSB7XG4gICAgICB0aGlzLmZpcnN0UGVyc29uLmdldEZpcnN0UGVyc29uV29ybGRQb3NpdGlvbih0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyLnBvc2l0aW9uKTtcbiAgICAgIHRoaXMuX2ZhY2VEaXJlY3Rpb25IZWxwZXIuc2V0RGlyZWN0aW9uKHRoaXMuZ2V0TG9va0F0V29ybGREaXJlY3Rpb24oX3YzKSk7XG4gICAgfVxuICB9XG59XG4iLCJpbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi4vZmlyc3RwZXJzb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZCc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi4vbG9va2F0L1ZSTUxvb2tBdEhlYWQnO1xuaW1wb3J0IHsgVlJNTG9va0F0SW1wb3J0ZXIgfSBmcm9tICcuLi9sb29rYXQvVlJNTG9va0F0SW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZERlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkRGVidWcnO1xuXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SW1wb3J0ZXJEZWJ1ZyBleHRlbmRzIFZSTUxvb2tBdEltcG9ydGVyIHtcbiAgcHVibGljIGltcG9ydChcbiAgICBnbHRmOiBHTFRGLFxuICAgIGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbixcbiAgICBibGVuZFNoYXBlUHJveHk6IFZSTUJsZW5kU2hhcGVQcm94eSxcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXG4gICk6IFZSTUxvb2tBdEhlYWQgfCBudWxsIHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb246IFZSTVNjaGVtYS5GaXJzdFBlcnNvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5maXJzdFBlcnNvbjtcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBhcHBseWVyID0gdGhpcy5faW1wb3J0QXBwbHllcihzY2hlbWFGaXJzdFBlcnNvbiwgYmxlbmRTaGFwZVByb3h5LCBodW1hbm9pZCk7XG4gICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRIZWFkRGVidWcoZmlyc3RQZXJzb24sIGFwcGx5ZXIgfHwgdW5kZWZpbmVkKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXIgfSBmcm9tICcuLi9zcHJpbmdib25lJztcbmltcG9ydCB7IFZSTURlYnVnT3B0aW9ucyB9IGZyb20gJy4vVlJNRGVidWdPcHRpb25zJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZURlYnVnJztcbmltcG9ydCB7IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgfSBmcm9tICcuL1ZSTURlYnVnJztcblxuY29uc3QgX2NvbGxpZGVyR2l6bW9NYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7XG4gIGNvbG9yOiAweGZmMDBmZixcbiAgd2lyZWZyYW1lOiB0cnVlLFxuICB0cmFuc3BhcmVudDogdHJ1ZSxcbiAgZGVwdGhUZXN0OiBmYWxzZSxcbn0pO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBzaW5nbGUgc3ByaW5nIGJvbmUgZ3JvdXAgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCB0eXBlIFZSTVNwcmluZ0JvbmVHcm91cERlYnVnID0gVlJNU3ByaW5nQm9uZURlYnVnW107XG5cbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnIGV4dGVuZHMgVlJNU3ByaW5nQm9uZU1hbmFnZXIge1xuICBwdWJsaWMgc2V0dXBIZWxwZXIoc2NlbmU6IFRIUkVFLk9iamVjdDNELCBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zKTogdm9pZCB7XG4gICAgaWYgKGRlYnVnT3B0aW9uLmRpc2FibGVTcHJpbmdCb25lSGVscGVyKSByZXR1cm47XG5cbiAgICB0aGlzLnNwcmluZ0JvbmVHcm91cExpc3QuZm9yRWFjaCgoc3ByaW5nQm9uZUdyb3VwKSA9PiB7XG4gICAgICBzcHJpbmdCb25lR3JvdXAuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xuICAgICAgICBpZiAoKHNwcmluZ0JvbmUgYXMgYW55KS5nZXRHaXptbykge1xuICAgICAgICAgIGNvbnN0IGdpem1vID0gKHNwcmluZ0JvbmUgYXMgVlJNU3ByaW5nQm9uZURlYnVnKS5nZXRHaXptbygpO1xuICAgICAgICAgIHNjZW5lLmFkZChnaXptbyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckdyb3VwKSA9PiB7XG4gICAgICBjb2xsaWRlckdyb3VwLmNvbGxpZGVycy5mb3JFYWNoKChjb2xsaWRlcikgPT4ge1xuICAgICAgICBjb2xsaWRlci5tYXRlcmlhbCA9IF9jb2xsaWRlckdpem1vTWF0ZXJpYWw7XG4gICAgICAgIGNvbGxpZGVyLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lIH0gZnJvbSAnLi4vc3ByaW5nYm9uZSc7XG5pbXBvcnQgeyBWUk1fR0laTU9fUkVOREVSX09SREVSIH0gZnJvbSAnLi9WUk1EZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4uL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVEZWJ1ZyBleHRlbmRzIFZSTVNwcmluZ0JvbmUge1xuICBwcml2YXRlIF9naXptbz86IFRIUkVFLkFycm93SGVscGVyO1xuXG4gIGNvbnN0cnVjdG9yKGJvbmU6IFRIUkVFLk9iamVjdDNELCBwYXJhbXM6IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzKSB7XG4gICAgc3VwZXIoYm9uZSwgcGFyYW1zKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gc3ByaW5nIGJvbmUgZ2l6bW8sIGFzIGBUSFJFRS5BcnJvd0hlbHBlcmAuXG4gICAqIFVzZWZ1bCBmb3IgZGVidWdnaW5nIHNwcmluZyBib25lcy5cbiAgICovXG4gIHB1YmxpYyBnZXRHaXptbygpOiBUSFJFRS5BcnJvd0hlbHBlciB7XG4gICAgLy8gcmV0dXJuIGlmIGdpem1vIGlzIGFscmVhZHkgZXhpc3RlZFxuICAgIGlmICh0aGlzLl9naXptbykge1xuICAgICAgcmV0dXJuIHRoaXMuX2dpem1vO1xuICAgIH1cblxuICAgIGNvbnN0IG5leHRUYWlsUmVsYXRpdmUgPSBfdjNBLmNvcHkodGhpcy5fbmV4dFRhaWwpLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcbiAgICBjb25zdCBuZXh0VGFpbFJlbGF0aXZlTGVuZ3RoID0gbmV4dFRhaWxSZWxhdGl2ZS5sZW5ndGgoKTtcblxuICAgIHRoaXMuX2dpem1vID0gbmV3IFRIUkVFLkFycm93SGVscGVyKFxuICAgICAgbmV4dFRhaWxSZWxhdGl2ZS5ub3JtYWxpemUoKSxcbiAgICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24sXG4gICAgICBuZXh0VGFpbFJlbGF0aXZlTGVuZ3RoLFxuICAgICAgMHhmZmZmMDAsXG4gICAgICB0aGlzLnJhZGl1cyxcbiAgICAgIHRoaXMucmFkaXVzLFxuICAgICk7XG5cbiAgICAvLyBpdCBzaG91bGQgYmUgYWx3YXlzIHZpc2libGVcbiAgICB0aGlzLl9naXptby5saW5lLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcbiAgICB0aGlzLl9naXptby5jb25lLnJlbmRlck9yZGVyID0gVlJNX0dJWk1PX1JFTkRFUl9PUkRFUjtcbiAgICAodGhpcy5fZ2l6bW8ubGluZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgKHRoaXMuX2dpem1vLmxpbmUubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLnRyYW5zcGFyZW50ID0gdHJ1ZTtcbiAgICAodGhpcy5fZ2l6bW8uY29uZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkuZGVwdGhUZXN0ID0gZmFsc2U7XG4gICAgKHRoaXMuX2dpem1vLmNvbmUubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLnRyYW5zcGFyZW50ID0gdHJ1ZTtcblxuICAgIHJldHVybiB0aGlzLl9naXptbztcbiAgfVxuXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIHN1cGVyLnVwZGF0ZShkZWx0YSk7XG4gICAgLy8gbGFzdGx5IHdlJ3JlIGdvbm5hIHVwZGF0ZSBnaXptb1xuICAgIHRoaXMuX3VwZGF0ZUdpem1vKCk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVHaXptbygpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuX2dpem1vKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZSA9IF92M0EuY29weSh0aGlzLl9jdXJyZW50VGFpbCkuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pO1xuICAgIGNvbnN0IG5leHRUYWlsUmVsYXRpdmVMZW5ndGggPSBuZXh0VGFpbFJlbGF0aXZlLmxlbmd0aCgpO1xuXG4gICAgdGhpcy5fZ2l6bW8uc2V0RGlyZWN0aW9uKG5leHRUYWlsUmVsYXRpdmUubm9ybWFsaXplKCkpO1xuICAgIHRoaXMuX2dpem1vLnNldExlbmd0aChuZXh0VGFpbFJlbGF0aXZlTGVuZ3RoLCB0aGlzLnJhZGl1cywgdGhpcy5yYWRpdXMpO1xuICAgIHRoaXMuX2dpem1vLnBvc2l0aW9uLmNvcHkodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbik7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVJbXBvcnRlciB9IGZyb20gJy4uL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZUltcG9ydGVyJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcnO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZURlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lRGVidWcnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgfSBmcm9tICcuLi9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzJztcblxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVJbXBvcnRlckRlYnVnIGV4dGVuZHMgVlJNU3ByaW5nQm9uZUltcG9ydGVyIHtcbiAgcHVibGljIGltcG9ydChnbHRmOiBHTFRGKTogVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyB8IG51bGwge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSByZXR1cm4gbnVsbDtcblxuICAgIGNvbnN0IHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbjogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvbiB8IHVuZGVmaW5lZCA9IHZybUV4dC5zZWNvbmRhcnlBbmltYXRpb247XG4gICAgaWYgKCFzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24pIHJldHVybiBudWxsO1xuXG4gICAgLy8g6KGd56qB5Yik5a6a55CD5L2T44Oh44OD44K344Ol44CCXG4gICAgY29uc3QgY29sbGlkZXJHcm91cHMgPSB0aGlzLl9pbXBvcnRDb2xsaWRlck1lc2hHcm91cHMoZ2x0Ziwgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uKTtcblxuICAgIC8vIOWQjOOBmOWxnuaAp++8iHN0aWZmaW5lc3PjgoRkcmFnRm9yY2XjgYzlkIzjgZjvvInjga7jg5zjg7zjg7Pjga9ib25lR3JvdXDjgavjgb7jgajjgoHjgonjgozjgabjgYTjgovjgIJcbiAgICAvLyDkuIDliJfjgaDjgZHjgafjga/jgarjgYTjgZPjgajjgavms6jmhI/jgIJcbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBMaXN0ID0gdGhpcy5faW1wb3J0U3ByaW5nQm9uZUdyb3VwTGlzdChnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24sIGNvbGxpZGVyR3JvdXBzKTtcblxuICAgIHJldHVybiBuZXcgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zyhjb2xsaWRlckdyb3Vwcywgc3ByaW5nQm9uZUdyb3VwTGlzdCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NyZWF0ZVNwcmluZ0JvbmUoYm9uZTogVEhSRUUuT2JqZWN0M0QsIHBhcmFtczogVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMpOiBWUk1TcHJpbmdCb25lRGVidWcge1xuICAgIHJldHVybiBuZXcgVlJNU3ByaW5nQm9uZURlYnVnKGJvbmUsIHBhcmFtcyk7XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTUltcG9ydGVyLCBWUk1JbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuLi9WUk1JbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1EZWJ1ZyB9IGZyb20gJy4vVlJNRGVidWcnO1xuaW1wb3J0IHsgVlJNRGVidWdPcHRpb25zIH0gZnJvbSAnLi9WUk1EZWJ1Z09wdGlvbnMnO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZERlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRIZWFkRGVidWcnO1xuaW1wb3J0IHsgVlJNTG9va0F0SW1wb3J0ZXJEZWJ1ZyB9IGZyb20gJy4vVlJNTG9va0F0SW1wb3J0ZXJEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zyc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1EZWJ1Z11dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUltcG9ydGVyRGVidWcgZXh0ZW5kcyBWUk1JbXBvcnRlciB7XG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSkge1xuICAgIG9wdGlvbnMubG9va0F0SW1wb3J0ZXIgPSBvcHRpb25zLmxvb2tBdEltcG9ydGVyIHx8IG5ldyBWUk1Mb29rQXRJbXBvcnRlckRlYnVnKCk7XG4gICAgb3B0aW9ucy5zcHJpbmdCb25lSW1wb3J0ZXIgPSBvcHRpb25zLnNwcmluZ0JvbmVJbXBvcnRlciB8fCBuZXcgVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcoKTtcbiAgICBzdXBlcihvcHRpb25zKTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURiwgZGVidWdPcHRpb25zOiBWUk1EZWJ1Z09wdGlvbnMgPSB7fSk6IFByb21pc2U8VlJNRGVidWc+IHtcbiAgICBpZiAoZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zID09PSB1bmRlZmluZWQgfHwgZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zLlZSTSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIFZSTSBleHRlbnNpb24gb24gdGhlIEdMVEYnKTtcbiAgICB9XG4gICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lO1xuXG4gICAgc2NlbmUudXBkYXRlTWF0cml4V29ybGQoZmFsc2UpO1xuXG4gICAgLy8gU2tpbm5lZCBvYmplY3Qgc2hvdWxkIG5vdCBiZSBmcnVzdHVtQ3VsbGVkXG4gICAgLy8gU2luY2UgcHJlLXNraW5uZWQgcG9zaXRpb24gbWlnaHQgYmUgb3V0c2lkZSBvZiB2aWV3XG4gICAgc2NlbmUudHJhdmVyc2UoKG9iamVjdDNkKSA9PiB7XG4gICAgICBpZiAoKG9iamVjdDNkIGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICAgIG9iamVjdDNkLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IG1ldGEgPSAoYXdhaXQgdGhpcy5fbWV0YUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgbWF0ZXJpYWxzID0gKGF3YWl0IHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIuY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGh1bWFub2lkID0gKGF3YWl0IHRoaXMuX2h1bWFub2lkSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbiA9IGh1bWFub2lkID8gKGF3YWl0IHRoaXMuX2ZpcnN0UGVyc29uSW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgYmxlbmRTaGFwZVByb3h5ID0gKGF3YWl0IHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGxvb2tBdCA9XG4gICAgICBmaXJzdFBlcnNvbiAmJiBibGVuZFNoYXBlUHJveHkgJiYgaHVtYW5vaWRcbiAgICAgICAgPyAoYXdhaXQgdGhpcy5fbG9va0F0SW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkXG4gICAgICAgIDogdW5kZWZpbmVkO1xuICAgIGlmICgobG9va0F0IGFzIGFueSkuc2V0dXBIZWxwZXIpIHtcbiAgICAgIChsb29rQXQgYXMgVlJNTG9va0F0SGVhZERlYnVnKS5zZXR1cEhlbHBlcihzY2VuZSwgZGVidWdPcHRpb25zKTtcbiAgICB9XG5cbiAgICBjb25zdCBzcHJpbmdCb25lTWFuYWdlciA9IChhd2FpdCB0aGlzLl9zcHJpbmdCb25lSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG4gICAgaWYgKChzcHJpbmdCb25lTWFuYWdlciBhcyBhbnkpLnNldHVwSGVscGVyKSB7XG4gICAgICAoc3ByaW5nQm9uZU1hbmFnZXIgYXMgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zykuc2V0dXBIZWxwZXIoc2NlbmUsIGRlYnVnT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBWUk1EZWJ1ZyhcbiAgICAgIHtcbiAgICAgICAgc2NlbmU6IGdsdGYuc2NlbmUsXG4gICAgICAgIG1ldGEsXG4gICAgICAgIG1hdGVyaWFscyxcbiAgICAgICAgaHVtYW5vaWQsXG4gICAgICAgIGZpcnN0UGVyc29uLFxuICAgICAgICBibGVuZFNoYXBlUHJveHksXG4gICAgICAgIGxvb2tBdCxcbiAgICAgICAgc3ByaW5nQm9uZU1hbmFnZXIsXG4gICAgICB9LFxuICAgICAgZGVidWdPcHRpb25zLFxuICAgICk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTSwgVlJNUGFyYW1ldGVycyB9IGZyb20gJy4uL1ZSTSc7XG5pbXBvcnQgeyBWUk1JbXBvcnRlck9wdGlvbnMgfSBmcm9tICcuLi9WUk1JbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1EZWJ1Z09wdGlvbnMgfSBmcm9tICcuL1ZSTURlYnVnT3B0aW9ucyc7XG5pbXBvcnQgeyBWUk1JbXBvcnRlckRlYnVnIH0gZnJvbSAnLi9WUk1JbXBvcnRlckRlYnVnJztcblxuZXhwb3J0IGNvbnN0IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgPSAxMDAwMDtcblxuLyoqXG4gKiBbW1ZSTV1dIGJ1dCBpdCBoYXMgc29tZSB1c2VmdWwgZ2l6bW9zLlxuICovXG5leHBvcnQgY2xhc3MgVlJNRGVidWcgZXh0ZW5kcyBWUk0ge1xuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTURlYnVnIGZyb20gYSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyLlxuICAgKlxuICAgKiBTZWUgW1tWUk0uZnJvbV1dIGZvciBhIGRldGFpbGVkIGV4YW1wbGUuXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHRoYXQgd2lsbCBiZSB1c2VkIGluIGltcG9ydGVyXG4gICAqIEBwYXJhbSBkZWJ1Z09wdGlvbiBPcHRpb25zIGZvciBWUk1EZWJ1ZyBmZWF0dXJlc1xuICAgKi9cbiAgcHVibGljIHN0YXRpYyBhc3luYyBmcm9tKFxuICAgIGdsdGY6IEdMVEYsXG4gICAgb3B0aW9uczogVlJNSW1wb3J0ZXJPcHRpb25zID0ge30sXG4gICAgZGVidWdPcHRpb246IFZSTURlYnVnT3B0aW9ucyA9IHt9LFxuICApOiBQcm9taXNlPFZSTT4ge1xuICAgIGNvbnN0IGltcG9ydGVyID0gbmV3IFZSTUltcG9ydGVyRGVidWcob3B0aW9ucyk7XG4gICAgcmV0dXJuIGltcG9ydGVyLmltcG9ydChnbHRmLCBkZWJ1Z09wdGlvbik7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTURlYnVnIGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0gcGFyYW1zIFtbVlJNUGFyYW1ldGVyc11dIHRoYXQgcmVwcmVzZW50cyBjb21wb25lbnRzIG9mIHRoZSBWUk1cbiAgICogQHBhcmFtIGRlYnVnT3B0aW9uIE9wdGlvbnMgZm9yIFZSTURlYnVnIGZlYXR1cmVzXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwYXJhbXM6IFZSTVBhcmFtZXRlcnMsIGRlYnVnT3B0aW9uOiBWUk1EZWJ1Z09wdGlvbnMgPSB7fSkge1xuICAgIHN1cGVyKHBhcmFtcyk7XG5cbiAgICAvLyBHaXptb+OCkuWxlemWi1xuICAgIGlmICghZGVidWdPcHRpb24uZGlzYWJsZUJveEhlbHBlcikge1xuICAgICAgdGhpcy5zY2VuZS5hZGQobmV3IFRIUkVFLkJveEhlbHBlcih0aGlzLnNjZW5lKSk7XG4gICAgfVxuXG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlU2tlbGV0b25IZWxwZXIpIHtcbiAgICAgIHRoaXMuc2NlbmUuYWRkKG5ldyBUSFJFRS5Ta2VsZXRvbkhlbHBlcih0aGlzLnNjZW5lKSk7XG4gICAgfVxuICB9XG5cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbIlRIUkVFIiwiX3YzIiwiVlJNU2NoZW1hIiwiVkVDVE9SM19GUk9OVCIsIl9xdWF0IiwiX3YzQSIsIl9xdWF0QSIsIl92M0IiLCJfdjNDIiwiTVRvb25NYXRlcmlhbEN1bGxNb2RlIiwiTVRvb25NYXRlcmlhbERlYnVnTW9kZSIsIk1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIiwiTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUiLCJNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZSIsInZlcnRleFNoYWRlciIsImZyYWdtZW50U2hhZGVyIiwiVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUiLCJfbWF0QSIsIkJ1ZmZlckF0dHJpYnV0ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBO0lBQ0E7QUFDQTtJQUNBO0lBQ0E7QUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7QUF1REE7SUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7SUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7SUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7SUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0lBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0lBQ3RHLFFBQVEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFF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QUFDLENBQUMsQ0FBQztJQUUzQixnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQUUsU0FBUztJQUN2RCxnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQUUsU0FBUztJQUN2RCxnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQUUsU0FBUztJQUN2RCxnQkFBQSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7d0JBQUUsU0FBUztJQUV2RCxnQkFBQSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkIsZ0JBQUEsTUFBTSxLQUFLLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzNCLGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxTQUFTO0lBQ3ZELGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxTQUFTO0lBQ3ZELGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxTQUFTO0lBQ3ZELGdCQUFBLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFBRSxTQUFTO0lBRXZELGdCQUFBLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNuQixnQkFBQSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0IsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUFFLFNBQVM7SUFDdkQsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUFFLFNBQVM7SUFDdkQsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUFFLFNBQVM7SUFDdkQsZ0JBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUFFLFNBQVM7SUFFdkQsZ0JBQUEsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLGdCQUFBLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN2QixnQkFBQSxTQUFTLENBQUMsS0FBSyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEIsYUFBQTtJQUNGLFNBQUE7SUFDRCxRQUFBLE9BQU8sS0FBSyxDQUFDO1NBQ2Q7UUFFTyxpQkFBaUIsQ0FBQyxHQUFzQixFQUFFLGlCQUEyQixFQUFBO0lBQzNFLFFBQUEsTUFBTSxHQUFHLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdEUsR0FBRyxDQUFDLElBQUksR0FBRyxDQUFBLEVBQUcsR0FBRyxDQUFDLElBQUksU0FBUyxDQUFDO0lBQ2hDLFFBQUEsR0FBRyxDQUFDLGFBQWEsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQ3RDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBRTNDLFFBQUEsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQztZQUU5QixNQUFNLGFBQWEsR0FBRyxRQUFRLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUMvRCxNQUFNLFNBQVMsR0FBRyxFQUFFLENBQUM7SUFDckIsUUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFO0lBQ2hELFlBQUEsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxhQUFhLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDdEcsU0FBQTtZQUVELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLENBQUMsS0FBSyxDQUFDO1lBQ2pFLE1BQU0sVUFBVSxHQUFHLEVBQUUsQ0FBQztJQUN0QixRQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxjQUFjLENBQUMsTUFBTSxFQUFFLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDakQsWUFBQSxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxFQUFFLGNBQWMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxjQUFjLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMzRyxTQUFBO0lBRUQsUUFBQSxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLEtBQUssRUFBRTtJQUNWLFlBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBMkMsQ0FBQyxDQUFDO0lBQzlELFNBQUE7WUFDRCxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUU3QyxRQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO1lBQzdGLE1BQU0sV0FBVyxHQUFhLEVBQUUsQ0FBQztZQUNqQyxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsRUFBRSxFQUFFO2dCQUM5QixXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xDLFNBQUE7SUFDRCxRQUFBLFFBQVEsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7O1lBRy9CLElBQUksR0FBRyxDQUFDLGNBQWMsRUFBRTtJQUN0QixZQUFBLEdBQUcsQ0FBQyxjQUFjLEdBQUcsR0FBRyxDQUFDLGNBQWMsQ0FBQztJQUN6QyxTQUFBO1lBQ0QsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJQSxnQkFBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxFQUFFLElBQUlBLGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUNqRyxRQUFBLE9BQU8sR0FBRyxDQUFDO1NBQ1o7UUFFTyxrQ0FBa0MsQ0FBQyxNQUFzQixFQUFFLElBQXVCLEVBQUE7WUFDeEYsTUFBTSxnQkFBZ0IsR0FBYSxFQUFFLENBQUM7SUFDdEMsUUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxLQUFJO0lBQzFDLFlBQUEsSUFBSSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztJQUFFLGdCQUFBLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUM5RCxTQUFDLENBQUMsQ0FBQzs7SUFHSCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUU7Z0JBQzVCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO2dCQUMvQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztnQkFDL0MsT0FBTztJQUNSLFNBQUE7WUFDRCxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUM1QyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFDL0QsUUFBQSxNQUFNLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ3JCO0lBRU8sSUFBQSxvQkFBb0IsQ0FBQyxVQUEyQixFQUFBO0lBQ3RELFFBQUEsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsS0FBSTtJQUMvQixZQUFBLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxhQUFhLEVBQUU7b0JBQ3BDLE1BQU0sV0FBVyxHQUFHLFNBQThCLENBQUM7b0JBQ25ELElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxXQUFXLENBQUMsTUFBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQzNFLGFBQUE7SUFBTSxpQkFBQTtJQUNMLGdCQUFBLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRTt3QkFDbEMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDbEQsaUJBQUE7SUFDRixhQUFBO0lBQ0gsU0FBQyxDQUFDLENBQUM7U0FDSjtJQUVEOzs7SUFHRztJQUNLLElBQUEsY0FBYyxDQUFDLElBQWMsRUFBQTtJQUNuQyxRQUFBLElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtJQUNsQyxZQUFBLE9BQU8sSUFBSSxDQUFDO0lBQ2IsU0FBQTtJQUFNLGFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7SUFDdkIsWUFBQSxPQUFPLEtBQUssQ0FBQztJQUNkLFNBQUE7SUFBTSxhQUFBO2dCQUNMLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDekMsU0FBQTtTQUNGOztJQWhRRDs7OztJQUlHO0lBQ3FCLGNBQStCLENBQUEsK0JBQUEsR0FBRyxDQUFDLENBQUM7SUFFNUQ7Ozs7SUFJRztJQUNxQixjQUErQixDQUFBLCtCQUFBLEdBQUcsRUFBRTs7SUM3RDlEOztJQUVHO1VBQ1Usc0JBQXNCLENBQUE7SUFDakM7Ozs7O0lBS0c7UUFDVSxNQUFNLENBQUMsSUFBVSxFQUFFLFFBQXFCLEVBQUE7OztJQUNuRCxZQUFBLE1BQU0sTUFBTSxHQUE4QixDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQUUsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsR0FBRyxDQUFDO2dCQUMzRSxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQ1gsZ0JBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixhQUFBO0lBRUQsWUFBQSxNQUFNLGlCQUFpQixHQUFzQyxNQUFNLENBQUMsV0FBVyxDQUFDO2dCQUNoRixJQUFJLENBQUMsaUJBQWlCLEVBQUU7SUFDdEIsZ0JBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixhQUFBO0lBRUQsWUFBQSxNQUFNLG9CQUFvQixHQUFHLGlCQUFpQixDQUFDLGVBQWUsQ0FBQztJQUUvRCxZQUFBLElBQUksZUFBZ0MsQ0FBQztnQkFDckMsSUFBSSxvQkFBb0IsS0FBSyxTQUFTLElBQUksb0JBQW9CLEtBQUssQ0FBQyxDQUFDLEVBQUU7b0JBQ3JFLGVBQWUsR0FBRyxRQUFRLENBQUMsV0FBVyxDQUFDRSxpQkFBUyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3pFLGFBQUE7SUFBTSxpQkFBQTtJQUNMLGdCQUFBLGVBQWUsR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO0lBQ2pGLGFBQUE7Z0JBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRTtJQUNwQixnQkFBQSxPQUFPLENBQUMsSUFBSSxDQUFDLG1FQUFtRSxDQUFDLENBQUM7SUFDbEYsZ0JBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixhQUFBO0lBRUQsWUFBQSxNQUFNLHFCQUFxQixHQUFHLGlCQUFpQixDQUFDLHFCQUFxQjtzQkFDakUsSUFBSUYsZ0JBQUssQ0FBQyxPQUFPLENBQ2YsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsQ0FBQyxFQUN6QyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLEVBQ3pDLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLENBQUMsQ0FBRSxDQUM1QztJQUNILGtCQUFFLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBRXRDLE1BQU0sZUFBZSxHQUFrQyxFQUFFLENBQUM7SUFDMUQsWUFBQSxNQUFNLGlCQUFpQixHQUFHLE1BQU0sOEJBQThCLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFckUsWUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLEtBQUk7SUFDMUUsZ0JBQUEsTUFBTSxVQUFVLEdBQW9CLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUV0RSxnQkFBQSxNQUFNLElBQUksR0FBRyxpQkFBaUIsQ0FBQyxlQUFlO0lBQzVDLHNCQUFFLGlCQUFpQixDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsSUFBSSxDQUFDOzBCQUN6RSxTQUFTLENBQUM7SUFDZCxnQkFBQSxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksMkJBQTJCLENBQUMsSUFBSSxLQUFBLElBQUEsSUFBSixJQUFJLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUosSUFBSSxDQUFFLGVBQWUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQzNGLGFBQUMsQ0FBQyxDQUFDO2dCQUVILE9BQU8sSUFBSSxjQUFjLENBQUMsZUFBZSxFQUFFLHFCQUFxQixFQUFFLGVBQWUsQ0FBQyxDQUFDOztJQUNwRixLQUFBO0lBQ0Y7O0lDN0REOztJQUVHO1VBQ1UsWUFBWSxDQUFBO0lBV3ZCOzs7OztJQUtHO1FBQ0gsV0FBbUIsQ0FBQSxJQUFjLEVBQUUsVUFBeUIsRUFBQTtJQUMxRCxRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ2pCLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7U0FDOUI7SUFDRjs7SUN6QkQ7Ozs7O0lBS0c7SUFDRyxTQUFVLGdCQUFnQixDQUE2QixNQUFTLEVBQUE7UUFDcEUsSUFBSyxNQUFjLENBQUMsTUFBTSxFQUFFO1lBQzFCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNqQixLQUFBO0lBQU0sU0FBQTtZQUNKLE1BQWMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUMzQixLQUFBO0lBRUQsSUFBQSxPQUFPLE1BQU0sQ0FBQztJQUNoQjs7SUNSQSxNQUFNSyxNQUFJLEdBQUcsSUFBSUwsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQyxNQUFNTSxRQUFNLEdBQUcsSUFBSU4sZ0JBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUV0Qzs7SUFFRztVQUNVLFdBQVcsQ0FBQTtJQWtCdEI7Ozs7SUFJRztRQUNILFdBQW1CLENBQUEsU0FBNEIsRUFBRSxnQkFBcUMsRUFBQTtJQVh0Rjs7O0lBR0c7WUFDYSxJQUFRLENBQUEsUUFBQSxHQUFZLEVBQUUsQ0FBQztZQVFyQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUNwRCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxnQkFBZ0IsQ0FBQztJQUV6QyxRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1NBQ2hDO0lBRUQ7Ozs7SUFJRztRQUNJLE9BQU8sR0FBQTtZQUNaLE1BQU0sSUFBSSxHQUFZLEVBQUUsQ0FBQztJQUN6QixRQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFdBQVcsS0FBSTtnQkFDbkQsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUF5QyxDQUFFLENBQUM7O2dCQUcxRSxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUNULE9BQU87SUFDUixhQUFBOztJQUdELFlBQUEsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUU7b0JBQ3JCLE9BQU87SUFDUixhQUFBOzs7Z0JBSURLLE1BQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDbEJDLFFBQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFFbEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM3QyxZQUFBLElBQUksU0FBUyxLQUFULElBQUEsSUFBQSxTQUFTLHVCQUFULFNBQVMsQ0FBRSxRQUFRLEVBQUU7b0JBQ3ZCRCxNQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUM3QyxhQUFBO0lBQ0QsWUFBQSxJQUFJLFNBQVMsS0FBVCxJQUFBLElBQUEsU0FBUyx1QkFBVCxTQUFTLENBQUUsUUFBUSxFQUFFO29CQUN2QixnQkFBZ0IsQ0FBQ0MsUUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUN4RCxhQUFBOztJQUdELFlBQUFELE1BQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hCLFlBQUFDLFFBQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUVwQyxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUc7SUFDbEIsZ0JBQUEsUUFBUSxFQUFFRCxNQUFJLENBQUMsT0FBTyxFQUFnQjtJQUN0QyxnQkFBQSxRQUFRLEVBQUVDLFFBQU0sQ0FBQyxPQUFPLEVBQWdCO2lCQUN6QyxDQUFDO2FBQ0gsRUFBRSxFQUFhLENBQUMsQ0FBQztJQUNsQixRQUFBLE9BQU8sSUFBSSxDQUFDO1NBQ2I7SUFFRDs7Ozs7OztJQU9HO0lBQ0ksSUFBQSxPQUFPLENBQUMsVUFBbUIsRUFBQTtZQUNoQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsS0FBSTtJQUMzQyxZQUFBLE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUUsQ0FBQztnQkFDcEMsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFzQyxDQUFDLENBQUM7O2dCQUd0RSxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUNULE9BQU87SUFDUixhQUFBO2dCQUVELE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQzFDLElBQUksQ0FBQyxTQUFTLEVBQUU7b0JBQ2QsT0FBTztJQUNSLGFBQUE7Z0JBRUQsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO29CQUNsQixJQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBRXhDLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRTtJQUN0QixvQkFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQ0QsTUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUN2RCxpQkFBQTtJQUNGLGFBQUE7Z0JBRUQsSUFBSSxLQUFLLENBQUMsUUFBUSxFQUFFO29CQUNsQixJQUFJLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7b0JBRTFDLElBQUksU0FBUyxDQUFDLFFBQVEsRUFBRTtJQUN0QixvQkFBQSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQ0MsUUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNoRSxpQkFBQTtJQUNGLGFBQUE7SUFDSCxTQUFDLENBQUMsQ0FBQztTQUNKO0lBRUQ7O0lBRUc7UUFDSSxTQUFTLEdBQUE7SUFDZCxRQUFBLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxLQUFJO2dCQUN6RCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQXNDLENBQUMsQ0FBQztnQkFFdEUsSUFBSSxDQUFDLElBQUksRUFBRTtvQkFDVCxPQUFPO0lBQ1IsYUFBQTtJQUVELFlBQUEsSUFBSSxJQUFJLEtBQUosSUFBQSxJQUFBLElBQUksdUJBQUosSUFBSSxDQUFFLFFBQVEsRUFBRTtvQkFDbEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3hDLGFBQUE7SUFFRCxZQUFBLElBQUksSUFBSSxLQUFKLElBQUEsSUFBQSxJQUFJLHVCQUFKLElBQUksQ0FBRSxRQUFRLEVBQUU7b0JBQ2xCLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMxQyxhQUFBO0lBQ0gsU0FBQyxDQUFDLENBQUM7U0FDSjtJQUVEOzs7Ozs7SUFNRztJQUNJLElBQUEsT0FBTyxDQUFDLElBQWdDLEVBQUE7O0lBQzdDLFFBQUEsT0FBTyxDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLFNBQVMsQ0FBQztTQUM5QztJQUVEOzs7Ozs7O0lBT0c7SUFDSSxJQUFBLFFBQVEsQ0FBQyxJQUFnQyxFQUFBOztZQUM5QyxPQUFPLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQUksSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsRUFBRSxDQUFDO1NBQ3BDO0lBRUQ7Ozs7OztJQU1HO0lBQ0ksSUFBQSxXQUFXLENBQUMsSUFBZ0MsRUFBQTs7SUFDakQsUUFBQSxPQUFPLENBQUEsRUFBQSxHQUFBLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUUsSUFBSSxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFJLElBQUksQ0FBQztTQUMvQztJQUVEOzs7Ozs7O0lBT0c7SUFDSSxJQUFBLFlBQVksQ0FBQyxJQUFnQyxFQUFBOztZQUNsRCxPQUFPLENBQUEsRUFBQSxHQUFBLE1BQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEVBQUUsQ0FBQztTQUM5RDtJQUVEOztJQUVHO0lBQ0ssSUFBQSxpQkFBaUIsQ0FBQyxTQUE0QixFQUFBO0lBQ3BELFFBQUEsTUFBTSxLQUFLLEdBQWtCLE1BQU0sQ0FBQyxNQUFNLENBQUNKLGlCQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxLQUFJO0lBQzVGLFlBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUNqQixZQUFBLE9BQU8sS0FBSyxDQUFDO2FBQ2QsRUFBRSxFQUE0QixDQUFrQixDQUFDO0lBRWxELFFBQUEsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSTtJQUN6QixZQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNuQyxTQUFDLENBQUMsQ0FBQztJQUVILFFBQUEsT0FBTyxLQUFLLENBQUM7U0FDZDtJQUNGOztJQzVNRDs7SUFFRztVQUNVLG1CQUFtQixDQUFBO0lBQzlCOzs7O0lBSUc7SUFDVSxJQUFBLE1BQU0sQ0FBQyxJQUFVLEVBQUE7OztJQUM1QixZQUFBLE1BQU0sTUFBTSxHQUE4QixDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQUUsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsR0FBRyxDQUFDO2dCQUMzRSxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQ1gsZ0JBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixhQUFBO0lBRUQsWUFBQSxNQUFNLGNBQWMsR0FBbUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztnQkFDdkUsSUFBSSxDQUFDLGNBQWMsRUFBRTtJQUNuQixnQkFBQSxPQUFPLElBQUksQ0FBQztJQUNiLGFBQUE7Z0JBRUQsTUFBTSxjQUFjLEdBQXNCLEVBQUUsQ0FBQztnQkFDN0MsSUFBSSxjQUFjLENBQUMsVUFBVSxFQUFFO0lBQzdCLGdCQUFBLE1BQU0sT0FBTyxDQUFDLEdBQUcsQ0FDZixjQUFjLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFPLElBQUksS0FBSSxTQUFBLENBQUEsSUFBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLGFBQUE7d0JBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxFQUFFOzRCQUNuQyxPQUFPO0lBQ1IscUJBQUE7SUFFRCxvQkFBQSxNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ2hFLGNBQWMsQ0FBQyxJQUFJLENBQUM7NEJBQ2xCLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTtJQUNmLHdCQUFBLElBQUksRUFBRSxJQUFJLFlBQVksQ0FBQyxJQUFJLEVBQUU7Z0NBQzNCLFVBQVUsRUFBRSxJQUFJLENBQUMsVUFBVTtnQ0FDM0IsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNLElBQUksSUFBSUYsZ0JBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7Z0NBQ3JGLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxJQUFJLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dDQUN0RSxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztnQ0FDdEUsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjs2QkFDeEMsQ0FBQztJQUNILHFCQUFBLENBQUMsQ0FBQztxQkFDSixDQUFBLENBQUMsQ0FDSCxDQUFDO0lBQ0gsYUFBQTtJQUVELFlBQUEsTUFBTSxnQkFBZ0IsR0FBd0I7b0JBQzVDLFVBQVUsRUFBRSxjQUFjLENBQUMsVUFBVTtvQkFDckMsVUFBVSxFQUFFLGNBQWMsQ0FBQyxVQUFVO29CQUNyQyxhQUFhLEVBQUUsY0FBYyxDQUFDLGFBQWE7b0JBQzNDLGFBQWEsRUFBRSxjQUFjLENBQUMsYUFBYTtvQkFDM0MsYUFBYSxFQUFFLGNBQWMsQ0FBQyxhQUFhO29CQUMzQyxhQUFhLEVBQUUsY0FBYyxDQUFDLGFBQWE7b0JBQzNDLFdBQVcsRUFBRSxjQUFjLENBQUMsV0FBVztvQkFDdkMsaUJBQWlCLEVBQUUsY0FBYyxDQUFDLGlCQUFpQjtpQkFDcEQsQ0FBQztJQUVGLFlBQUEsT0FBTyxJQUFJLFdBQVcsQ0FBQyxjQUFjLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQzs7SUFDMUQsS0FBQTtJQUNGOztJQ2hFRDs7Ozs7Ozs7SUFRRztJQUNILE1BQU0sYUFBYSxHQUFHLENBQUMsRUFBVSxFQUFFLEVBQVUsRUFBRSxFQUFVLEVBQUUsRUFBVSxFQUFFLENBQVMsS0FBWTtJQUMxRixJQUFBLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLElBQUEsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNqQixJQUFBLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDbkIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLENBQUM7UUFDakMsTUFBTSxHQUFHLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzlCLElBQUEsTUFBTSxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQztJQUNwQixJQUFBLE9BQU8sRUFBRSxHQUFHLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxFQUFFLEdBQUcsR0FBRyxDQUFDO0lBQzdDLENBQUMsQ0FBQztJQUVGOzs7Ozs7O0lBT0c7SUFDSCxNQUFNLGFBQWEsR0FBRyxDQUFDLEdBQWEsRUFBRSxDQUFTLEtBQVk7O0lBRXpELElBQUEsSUFBSSxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtJQUNsQixRQUFBLE1BQU0sSUFBSSxLQUFLLENBQUMsMEVBQTBFLENBQUMsQ0FBQztJQUM3RixLQUFBO0lBQ0QsSUFBQSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRTtJQUN4QixRQUFBLE1BQU0sSUFBSSxLQUFLLENBQUMsNkVBQTZFLENBQUMsQ0FBQztJQUNoRyxLQUFBOztJQUdELElBQUEsSUFBSSxPQUFPLENBQUM7SUFDWixJQUFBLEtBQUssT0FBTyxHQUFHLENBQUMsR0FBSSxPQUFPLEVBQUUsRUFBRTtJQUM3QixRQUFBLElBQUksR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUcsT0FBTyxFQUFFO2dCQUM3QixPQUFPLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzdCLFNBQUE7aUJBQU0sSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRTtnQkFDaEMsTUFBTTtJQUNQLFNBQUE7SUFDRixLQUFBO0lBRUQsSUFBQSxNQUFNLE1BQU0sR0FBRyxPQUFPLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNkLE9BQU8sR0FBRyxDQUFDLENBQUMsR0FBRyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDNUIsS0FBQTs7UUFHRCxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQzNCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUM7SUFDNUIsSUFBQSxNQUFNLFFBQVEsR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDOztRQUd0QyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMvQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNoQyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztRQUMvQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNoQyxJQUFBLE9BQU8sYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNqRCxDQUFDLENBQUM7SUFFRjs7Ozs7SUFLRztVQUNVLGNBQWMsQ0FBQTtJQWtCekI7Ozs7OztJQU1HO0lBQ0gsSUFBQSxXQUFBLENBQVksTUFBZSxFQUFFLE1BQWUsRUFBRSxLQUFnQixFQUFBO0lBeEI5RDs7OztJQUlHO0lBQ0ksUUFBQSxJQUFBLENBQUEsS0FBSyxHQUFhLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBRWxFOztJQUVHO1lBQ0ksSUFBaUIsQ0FBQSxpQkFBQSxHQUFHLElBQUksQ0FBQztJQUVoQzs7SUFFRztZQUNJLElBQWlCLENBQUEsaUJBQUEsR0FBRyxJQUFJLENBQUM7WUFVOUIsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO0lBQ3hCLFlBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE1BQU0sQ0FBQztJQUNqQyxTQUFBO1lBRUQsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO0lBQ3hCLFlBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE1BQU0sQ0FBQztJQUNqQyxTQUFBO1lBRUQsSUFBSSxLQUFLLEtBQUssU0FBUyxFQUFFO0lBQ3ZCLFlBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDcEIsU0FBQTtTQUNGO0lBRUQ7Ozs7SUFJRztJQUNJLElBQUEsR0FBRyxDQUFDLEdBQVcsRUFBQTtJQUNwQixRQUFBLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7SUFDeEUsUUFBQSxNQUFNLENBQUMsR0FBRyxVQUFVLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDO0lBQzlDLFFBQUEsT0FBTyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7U0FDOUQ7SUFDRjs7SUNwSEQ7OztJQUdHO1VBQ21CLGdCQUFnQixDQUFBO0lBWXJDOztJQ2JEOztJQUVHO0lBQ0csTUFBTywwQkFBMkIsU0FBUSxnQkFBZ0IsQ0FBQTtJQVM5RDs7Ozs7OztJQU9HO0lBQ0gsSUFBQSxXQUFBLENBQ0UsZUFBbUMsRUFDbkMsZUFBK0IsRUFDL0IsaUJBQWlDLEVBQ2pDLGVBQStCLEVBQUE7SUFFL0IsUUFBQSxLQUFLLEVBQUUsQ0FBQztJQXRCTSxRQUFBLElBQUEsQ0FBQSxJQUFJLEdBQUdFLGlCQUFTLENBQUMseUJBQXlCLENBQUMsVUFBVSxDQUFDO0lBd0JwRSxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxlQUFlLENBQUM7SUFDeEMsUUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsaUJBQWlCLENBQUM7SUFDNUMsUUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsZUFBZSxDQUFDO0lBRXhDLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGVBQWUsQ0FBQztTQUN6QztRQUVNLElBQUksR0FBQTtJQUNULFFBQUEsT0FBT0EsaUJBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLENBQUM7U0FDdkQ7SUFFTSxJQUFBLE1BQU0sQ0FBQyxLQUFrQixFQUFBO0lBQzlCLFFBQUEsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNyQixRQUFBLE1BQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFFckIsSUFBSSxJQUFJLEdBQUcsR0FBRyxFQUFFO0lBQ2QsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDQSxpQkFBUyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDM0UsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQ0EsaUJBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDN0csU0FBQTtJQUFNLGFBQUE7SUFDTCxZQUFBLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUNBLGlCQUFTLENBQUMsb0JBQW9CLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUM3RSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDQSxpQkFBUyxDQUFDLG9CQUFvQixDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7SUFDeEcsU0FBQTtZQUVELElBQUksSUFBSSxHQUFHLEdBQUcsRUFBRTtJQUNkLFlBQUEsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQ0EsaUJBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQzdFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUNBLGlCQUFTLENBQUMsb0JBQW9CLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzVHLFNBQUE7SUFBTSxhQUFBO0lBQ0wsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDQSxpQkFBUyxDQUFDLG9CQUFvQixDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDOUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQ0EsaUJBQVMsQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzFHLFNBQUE7U0FDRjtJQUNGOztJQzNERCxNQUFNLGFBQWEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUlGLGdCQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBRXZFLE1BQU1LLE1BQUksR0FBRyxJQUFJTCxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pDLE1BQU1PLE1BQUksR0FBRyxJQUFJUCxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pDLE1BQU1RLE1BQUksR0FBRyxJQUFJUixnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pDLE1BQU0sS0FBSyxHQUFHLElBQUlBLGdCQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7SUFFckM7O0lBRUc7VUFDVSxhQUFhLENBQUE7SUE0QnhCOzs7OztJQUtHO1FBQ0gsV0FBWSxDQUFBLFdBQTJCLEVBQUUsT0FBMEIsRUFBQTtJQXJCbkU7Ozs7SUFJRztZQUNJLElBQVUsQ0FBQSxVQUFBLEdBQUcsSUFBSSxDQUFDO0lBUWYsUUFBQSxJQUFBLENBQUEsTUFBTSxHQUFnQixJQUFJQSxnQkFBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxhQUFhLENBQUMsV0FBVyxDQUFDLENBQUM7SUFTeEYsUUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUMvQixRQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1NBQ3hCO0lBRUQ7Ozs7SUFJRztJQUNJLElBQUEsdUJBQXVCLENBQUMsTUFBcUIsRUFBQTtJQUNsRCxRQUFBLE1BQU0sR0FBRyxHQUFHLHNCQUFzQixDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzVFLFFBQUEsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2hGO0lBRUQ7Ozs7O0lBS0c7SUFDSSxJQUFBLE1BQU0sQ0FBQyxRQUF1QixFQUFBO1lBQ25DLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztZQUV2QyxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsQyxTQUFBO1NBQ0Y7SUFFRDs7Ozs7SUFLRztJQUNJLElBQUEsTUFBTSxDQUFDLEtBQWEsRUFBQTtJQUN6QixRQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0lBQ2xDLFlBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDSyxNQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUVoRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7b0JBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNsQyxhQUFBO0lBQ0YsU0FBQTtTQUNGO1FBRVMsVUFBVSxDQUFDLE1BQW1CLEVBQUUsUUFBdUIsRUFBQTtZQUMvRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLDJCQUEyQixDQUFDRSxNQUFJLENBQUMsQ0FBQzs7SUFHeEUsUUFBQSxNQUFNLFNBQVMsR0FBR0MsTUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7O0lBR3BFLFFBQUEsU0FBUyxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGVBQWUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7O0lBRzdHLFFBQUEsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDLEdBQUcsU0FBUyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyRyxRQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFbEQsUUFBQSxPQUFPLE1BQU0sQ0FBQztTQUNmOztJQTVGc0IsYUFBQSxDQUFBLFdBQVcsR0FBRyxLQUFLLENBQUM7O0lDVjdDLE1BQU0sTUFBTSxHQUFHLElBQUlSLGdCQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUV6RTs7SUFFRztJQUNHLE1BQU8sb0JBQXFCLFNBQVEsZ0JBQWdCLENBQUE7SUFXeEQ7Ozs7Ozs7O0lBUUc7UUFDSCxXQUNFLENBQUEsUUFBcUIsRUFDckIsb0JBQW9DLEVBQ3BDLG9CQUFvQyxFQUNwQyxpQkFBaUMsRUFDakMsZUFBK0IsRUFBQTtJQUUvQixRQUFBLEtBQUssRUFBRSxDQUFDO0lBMUJNLFFBQUEsSUFBQSxDQUFBLElBQUksR0FBR0UsaUJBQVMsQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLENBQUM7SUE0QjlELFFBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLG9CQUFvQixDQUFDO0lBQ2xELFFBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLG9CQUFvQixDQUFDO0lBQ2xELFFBQUEsSUFBSSxDQUFDLGtCQUFrQixHQUFHLGlCQUFpQixDQUFDO0lBQzVDLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLGVBQWUsQ0FBQztJQUV4QyxRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQ0EsaUJBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN6RSxRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDLFdBQVcsQ0FBQ0EsaUJBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUM1RTtJQUVNLElBQUEsTUFBTSxDQUFDLEtBQWtCLEVBQUE7SUFDOUIsUUFBQSxNQUFNLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3JCLFFBQUEsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQzs7WUFHckIsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFO2dCQUNqQixJQUFJLElBQUksR0FBRyxHQUFHLEVBQUU7SUFDZCxnQkFBQSxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2hELGFBQUE7SUFBTSxpQkFBQTtvQkFDTCxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDNUMsYUFBQTtnQkFFRCxJQUFJLElBQUksR0FBRyxHQUFHLEVBQUU7SUFDZCxnQkFBQSxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25ELGFBQUE7SUFBTSxpQkFBQTtvQkFDTCxNQUFNLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDakQsYUFBQTtnQkFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDL0MsU0FBQTs7WUFHRCxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7Z0JBQ2xCLElBQUksSUFBSSxHQUFHLEdBQUcsRUFBRTtJQUNkLGdCQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDaEQsYUFBQTtJQUFNLGlCQUFBO29CQUNMLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUM1QyxhQUFBO2dCQUVELElBQUksSUFBSSxHQUFHLEdBQUcsRUFBRTtJQUNkLGdCQUFBLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDbkQsYUFBQTtJQUFNLGlCQUFBO29CQUNMLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNqRCxhQUFBO2dCQUVELElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNoRCxTQUFBO1NBQ0Y7SUFDRjs7SUM3RUQ7SUFDQTtJQUNBO0lBQ0EsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUM7SUFFOUI7O0lBRUc7VUFDVSxpQkFBaUIsQ0FBQTtJQUM1Qjs7Ozs7O0lBTUc7SUFDSSxJQUFBLE1BQU0sQ0FDWCxJQUFVLEVBQ1YsV0FBMkIsRUFDM0IsZUFBbUMsRUFDbkMsUUFBcUIsRUFBQTs7SUFFckIsUUFBQSxNQUFNLE1BQU0sR0FBOEIsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEdBQUcsQ0FBQztZQUMzRSxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQ1gsWUFBQSxPQUFPLElBQUksQ0FBQztJQUNiLFNBQUE7SUFFRCxRQUFBLE1BQU0saUJBQWlCLEdBQXNDLE1BQU0sQ0FBQyxXQUFXLENBQUM7WUFDaEYsSUFBSSxDQUFDLGlCQUFpQixFQUFFO0lBQ3RCLFlBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixTQUFBO0lBRUQsUUFBQSxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUNsRixPQUFPLElBQUksYUFBYSxDQUFDLFdBQVcsRUFBRSxPQUFPLElBQUksU0FBUyxDQUFDLENBQUM7U0FDN0Q7SUFFUyxJQUFBLGNBQWMsQ0FDdEIsaUJBQXdDLEVBQ3hDLGVBQW1DLEVBQ25DLFFBQXFCLEVBQUE7SUFFckIsUUFBQSxNQUFNLHFCQUFxQixHQUFHLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDO0lBQ3RFLFFBQUEsTUFBTSxxQkFBcUIsR0FBRyxpQkFBaUIsQ0FBQyxxQkFBcUIsQ0FBQztJQUN0RSxRQUFBLE1BQU0sa0JBQWtCLEdBQUcsaUJBQWlCLENBQUMsa0JBQWtCLENBQUM7SUFDaEUsUUFBQSxNQUFNLGdCQUFnQixHQUFHLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDO1lBRTVELFFBQVEsaUJBQWlCLENBQUMsY0FBYztJQUN0QyxZQUFBLEtBQUtBLGlCQUFTLENBQUMseUJBQXlCLENBQUMsSUFBSSxFQUFFO29CQUM3QyxJQUNFLHFCQUFxQixLQUFLLFNBQVM7SUFDbkMsb0JBQUEscUJBQXFCLEtBQUssU0FBUztJQUNuQyxvQkFBQSxrQkFBa0IsS0FBSyxTQUFTO3dCQUNoQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQzlCO0lBQ0Esb0JBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixpQkFBQTtJQUFNLHFCQUFBO0lBQ0wsb0JBQUEsT0FBTyxJQUFJLG9CQUFvQixDQUM3QixRQUFRLEVBQ1IsSUFBSSxDQUFDLHNCQUFzQixDQUFDLHFCQUFxQixDQUFDLEVBQ2xELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxxQkFBcUIsQ0FBQyxFQUNsRCxJQUFJLENBQUMsc0JBQXNCLENBQUMsa0JBQWtCLENBQUMsRUFDL0MsSUFBSSxDQUFDLHNCQUFzQixDQUFDLGdCQUFnQixDQUFDLENBQzlDLENBQUM7SUFDSCxpQkFBQTtJQUNGLGFBQUE7SUFDRCxZQUFBLEtBQUtBLGlCQUFTLENBQUMseUJBQXlCLENBQUMsVUFBVSxFQUFFO29CQUNuRCxJQUFJLHFCQUFxQixLQUFLLFNBQVMsSUFBSSxrQkFBa0IsS0FBSyxTQUFTLElBQUksZ0JBQWdCLEtBQUssU0FBUyxFQUFFO0lBQzdHLG9CQUFBLE9BQU8sSUFBSSxDQUFDO0lBQ2IsaUJBQUE7SUFBTSxxQkFBQTt3QkFDTCxPQUFPLElBQUksMEJBQTBCLENBQ25DLGVBQWUsRUFDZixJQUFJLENBQUMsNEJBQTRCLENBQUMscUJBQXFCLENBQUMsRUFDeEQsSUFBSSxDQUFDLDRCQUE0QixDQUFDLGtCQUFrQixDQUFDLEVBQ3JELElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUNwRCxDQUFDO0lBQ0gsaUJBQUE7SUFDRixhQUFBO0lBQ0QsWUFBQSxTQUFTO0lBQ1AsZ0JBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixhQUFBO0lBQ0YsU0FBQTtTQUNGO0lBRU8sSUFBQSxzQkFBc0IsQ0FBQyxHQUFtQyxFQUFBO1lBQ2hFLE9BQU8sSUFBSSxjQUFjLENBQ3ZCLE9BQU8sR0FBRyxDQUFDLE1BQU0sS0FBSyxRQUFRLEdBQUcsT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsU0FBUyxFQUNqRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLEtBQUssUUFBUSxHQUFHLE9BQU8sR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFDakUsR0FBRyxDQUFDLEtBQUssQ0FDVixDQUFDO1NBQ0g7SUFFTyxJQUFBLDRCQUE0QixDQUFDLEdBQW1DLEVBQUE7SUFDdEUsUUFBQSxPQUFPLElBQUksY0FBYyxDQUFDLE9BQU8sR0FBRyxDQUFDLE1BQU0sS0FBSyxRQUFRLEdBQUcsT0FBTyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsU0FBUyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ3JIO0lBQ0Y7Ozs7OztJQ3ZHRDtJQUNBO0lBQ0EsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO0lBQzFCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQztJQUMzQixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUM7SUFDNUIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDO0lBQzFCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQztJQUMzQjtJQUVBOzs7SUFHRztJQUNJLE1BQU0scUJBQXFCLEdBQUcsQ0FBQyxRQUErQixLQUFzQjtRQUN6RixJQUFJLFFBQVEsQ0FBQ0YsZ0JBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLElBQUksR0FBRyxFQUFFO0lBQ3ZDLFFBQUEsUUFBUSxRQUFRO2dCQUNkLEtBQUtBLGdCQUFLLENBQUMsY0FBYztJQUN2QixnQkFBQSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO2dCQUNqQyxLQUFLQSxnQkFBSyxDQUFDLFlBQVk7SUFDckIsZ0JBQUEsT0FBTyxDQUFDLE1BQU0sRUFBRSxXQUFXLENBQUMsQ0FBQztJQUMvQixZQUFBO0lBQ0UsZ0JBQUEsT0FBTyxDQUFDLElBQUksQ0FBQywyQ0FBMkMsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNwRSxnQkFBQSxPQUFPLENBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQ2xDLFNBQUE7SUFDRixLQUFBO0lBQU0sU0FBQTs7SUFFTCxRQUFBLFFBQVEsUUFBUTtnQkFDZCxLQUFLQSxnQkFBSyxDQUFDLGNBQWM7SUFDdkIsZ0JBQUEsT0FBTyxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDakMsS0FBS0EsZ0JBQUssQ0FBQyxZQUFZO0lBQ3JCLGdCQUFBLE9BQU8sQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDL0IsWUFBQSxLQUFLLFlBQVk7SUFDZixnQkFBQSxPQUFPLENBQUMsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO0lBQy9CLFlBQUEsS0FBSyxhQUFhO0lBQ2hCLGdCQUFBLE9BQU8sQ0FBQyxNQUFNLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUNwQyxZQUFBLEtBQUssY0FBYztJQUNqQixnQkFBQSxPQUFPLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDLENBQUM7SUFDckMsWUFBQSxLQUFLLFlBQVk7SUFDZixnQkFBQSxPQUFPLENBQUMsTUFBTSxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDdEMsWUFBQSxLQUFLLGFBQWE7SUFDaEIsZ0JBQUEsT0FBTyxDQUFDLE9BQU8sRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO0lBQ3ZELFlBQUE7SUFDRSxnQkFBQSxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixHQUFHLFFBQVEsQ0FBQyxDQUFDO0lBQ3hELFNBQUE7SUFDRixLQUFBO0lBQ0gsQ0FBQyxDQUFDO0lBRUY7Ozs7O0lBS0c7SUFDSSxNQUFNLHdCQUF3QixHQUFHLENBQUMsWUFBb0IsRUFBRSxRQUErQixLQUFZO0lBQ3hHLElBQUEsTUFBTSxVQUFVLEdBQUcscUJBQXFCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDbkQsSUFBQSxPQUFPLE9BQU8sR0FBRyxZQUFZLEdBQUcsMEJBQTBCLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLFVBQVUsR0FBRyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQ2xILENBQUM7O0lDMUREO0lBT0EsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxFQUFFLENBQUM7QUF5RWRTLDJDQUlYO0lBSkQsQ0FBQSxVQUFZLHFCQUFxQixFQUFBO0lBQy9CLElBQUEscUJBQUEsQ0FBQSxxQkFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLEtBQUcsQ0FBQTtJQUNILElBQUEscUJBQUEsQ0FBQSxxQkFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLE9BQUssQ0FBQTtJQUNMLElBQUEscUJBQUEsQ0FBQSxxQkFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLE1BQUksQ0FBQTtJQUNOLENBQUMsRUFKV0EsNkJBQXFCLEtBQXJCQSw2QkFBcUIsR0FJaEMsRUFBQSxDQUFBLENBQUEsQ0FBQTtBQUVXQyw0Q0FLWDtJQUxELENBQUEsVUFBWSxzQkFBc0IsRUFBQTtJQUNoQyxJQUFBLHNCQUFBLENBQUEsc0JBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxNQUFJLENBQUE7SUFDSixJQUFBLHNCQUFBLENBQUEsc0JBQUEsQ0FBQSxRQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxRQUFNLENBQUE7SUFDTixJQUFBLHNCQUFBLENBQUEsc0JBQUEsQ0FBQSxjQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxjQUFZLENBQUE7SUFDWixJQUFBLHNCQUFBLENBQUEsc0JBQUEsQ0FBQSxJQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxJQUFFLENBQUE7SUFDSixDQUFDLEVBTFdBLDhCQUFzQixLQUF0QkEsOEJBQXNCLEdBS2pDLEVBQUEsQ0FBQSxDQUFBLENBQUE7QUFFV0MsbURBR1g7SUFIRCxDQUFBLFVBQVksNkJBQTZCLEVBQUE7SUFDdkMsSUFBQSw2QkFBQSxDQUFBLDZCQUFBLENBQUEsWUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsWUFBVSxDQUFBO0lBQ1YsSUFBQSw2QkFBQSxDQUFBLDZCQUFBLENBQUEsZUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsZUFBYSxDQUFBO0lBQ2YsQ0FBQyxFQUhXQSxxQ0FBNkIsS0FBN0JBLHFDQUE2QixHQUd4QyxFQUFBLENBQUEsQ0FBQSxDQUFBO0FBRVdDLG1EQUlYO0lBSkQsQ0FBQSxVQUFZLDZCQUE2QixFQUFBO0lBQ3ZDLElBQUEsNkJBQUEsQ0FBQSw2QkFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLE1BQUksQ0FBQTtJQUNKLElBQUEsNkJBQUEsQ0FBQSw2QkFBQSxDQUFBLGtCQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxrQkFBZ0IsQ0FBQTtJQUNoQixJQUFBLDZCQUFBLENBQUEsNkJBQUEsQ0FBQSxtQkFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsbUJBQWlCLENBQUE7SUFDbkIsQ0FBQyxFQUpXQSxxQ0FBNkIsS0FBN0JBLHFDQUE2QixHQUl4QyxFQUFBLENBQUEsQ0FBQSxDQUFBO0FBRVdDLDZDQUtYO0lBTEQsQ0FBQSxVQUFZLHVCQUF1QixFQUFBO0lBQ2pDLElBQUEsdUJBQUEsQ0FBQSx1QkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFFBQU0sQ0FBQTtJQUNOLElBQUEsdUJBQUEsQ0FBQSx1QkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLFFBQU0sQ0FBQTtJQUNOLElBQUEsdUJBQUEsQ0FBQSx1QkFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLGFBQVcsQ0FBQTtJQUNYLElBQUEsdUJBQUEsQ0FBQSx1QkFBQSxDQUFBLHVCQUFBLENBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSx1QkFBcUIsQ0FBQTtJQUN2QixDQUFDLEVBTFdBLCtCQUF1QixLQUF2QkEsK0JBQXVCLEdBS2xDLEVBQUEsQ0FBQSxDQUFBLENBQUE7SUFFRDs7Ozs7SUFLRztJQUNVLE1BQUEsYUFBYyxTQUFRYixnQkFBSyxDQUFDLGNBQWMsQ0FBQTtJQWlGckQsSUFBQSxXQUFBLENBQVksYUFBOEIsRUFBRSxFQUFBO0lBQzFDLFFBQUEsS0FBSyxFQUFFLENBQUM7SUFqRlY7O0lBRUc7WUFDYSxJQUFlLENBQUEsZUFBQSxHQUFZLElBQUksQ0FBQztJQUV6QyxRQUFBLElBQUEsQ0FBQSxNQUFNLEdBQUcsR0FBRyxDQUFDO0lBQ2IsUUFBQSxJQUFBLENBQUEsS0FBSyxHQUFHLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzlDLFFBQUEsSUFBQSxDQUFBLFVBQVUsR0FBRyxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQztJQUN0RCxRQUFBLElBQUEsQ0FBQSxHQUFHLEdBQXlCLElBQUksQ0FBQzs7SUFFakMsUUFBQSxJQUFBLENBQUEsVUFBVSxHQUFHLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ25ELFFBQUEsSUFBQSxDQUFBLFlBQVksR0FBeUIsSUFBSSxDQUFDOztJQUUxQyxRQUFBLElBQUEsQ0FBQSxTQUFTLEdBQXlCLElBQUksQ0FBQztJQUN2QyxRQUFBLElBQUEsQ0FBQSxhQUFhLEdBQUdBLGdCQUFLLENBQUMscUJBQXFCLENBQUM7SUFDNUMsUUFBQSxJQUFBLENBQUEsV0FBVyxHQUFHLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQzs7SUFFMUMsUUFBQSxJQUFBLENBQUEsaUJBQWlCLEdBQUcsR0FBRyxDQUFDO0lBQ3hCLFFBQUEsSUFBQSxDQUFBLG9CQUFvQixHQUF5QixJQUFJLENBQUM7O0lBRWxELFFBQUEsSUFBQSxDQUFBLGdCQUFnQixHQUFHLEdBQUcsQ0FBQztJQUN2QixRQUFBLElBQUEsQ0FBQSxtQkFBbUIsR0FBeUIsSUFBSSxDQUFDOztJQUVqRCxRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQUcsR0FBRyxDQUFDO0lBQ2pCLFFBQUEsSUFBQSxDQUFBLFVBQVUsR0FBRyxHQUFHLENBQUM7SUFDakIsUUFBQSxJQUFBLENBQUEscUJBQXFCLEdBQUcsR0FBRyxDQUFDO0lBQzVCLFFBQUEsSUFBQSxDQUFBLHNCQUFzQixHQUFHLEdBQUcsQ0FBQztJQUM3QixRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQXlCLElBQUksQ0FBQztJQUN4QyxRQUFBLElBQUEsQ0FBQSxRQUFRLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDakQsUUFBQSxJQUFBLENBQUEsY0FBYyxHQUFHLEdBQUcsQ0FBQztJQUNyQixRQUFBLElBQUEsQ0FBQSxlQUFlLEdBQUcsR0FBRyxDQUFDO0lBQ3RCLFFBQUEsSUFBQSxDQUFBLE9BQU8sR0FBRyxHQUFHLENBQUM7SUFDZCxRQUFBLElBQUEsQ0FBQSxTQUFTLEdBQXlCLElBQUksQ0FBQzs7SUFFdkMsUUFBQSxJQUFBLENBQUEsYUFBYSxHQUFHLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3RELFFBQUEsSUFBQSxDQUFBLFdBQVcsR0FBeUIsSUFBSSxDQUFDOztJQUV6QyxRQUFBLElBQUEsQ0FBQSxtQkFBbUIsR0FBeUIsSUFBSSxDQUFDOztJQUVqRCxRQUFBLElBQUEsQ0FBQSxZQUFZLEdBQUcsR0FBRyxDQUFDO0lBQ25CLFFBQUEsSUFBQSxDQUFBLHdCQUF3QixHQUFHLEdBQUcsQ0FBQztJQUMvQixRQUFBLElBQUEsQ0FBQSxZQUFZLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDckQsUUFBQSxJQUFBLENBQUEsa0JBQWtCLEdBQUcsR0FBRyxDQUFDO0lBQ3pCLFFBQUEsSUFBQSxDQUFBLGlCQUFpQixHQUF5QixJQUFJLENBQUM7SUFDL0MsUUFBQSxJQUFBLENBQUEsYUFBYSxHQUFHLEdBQUcsQ0FBQztJQUNwQixRQUFBLElBQUEsQ0FBQSxhQUFhLEdBQUcsR0FBRyxDQUFDO0lBQ3BCLFFBQUEsSUFBQSxDQUFBLGNBQWMsR0FBRyxHQUFHLENBQUM7SUFFckIsUUFBQSxJQUFBLENBQUEsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0lBZ0IxQixRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQUdVLDhCQUFzQixDQUFDLElBQUksQ0FBQztJQUN6QyxRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQUdHLCtCQUF1QixDQUFDLE1BQU0sQ0FBQztJQUM1QyxRQUFBLElBQUEsQ0FBQSxpQkFBaUIsR0FBR0QscUNBQTZCLENBQUMsSUFBSSxDQUFDO0lBQ3ZELFFBQUEsSUFBQSxDQUFBLGlCQUFpQixHQUFHRCxxQ0FBNkIsQ0FBQyxVQUFVLENBQUM7SUFDN0QsUUFBQSxJQUFBLENBQUEsU0FBUyxHQUFHRiw2QkFBcUIsQ0FBQyxJQUFJLENBQUM7SUFDdkMsUUFBQSxJQUFBLENBQUEsZ0JBQWdCLEdBQUdBLDZCQUFxQixDQUFDLEtBQUssQ0FBQzs7OztZQUsvQyxJQUFVLENBQUEsVUFBQSxHQUFHLEtBQUssQ0FBQztZQUVuQixJQUFjLENBQUEsY0FBQSxHQUFHLEdBQUcsQ0FBQztZQUNyQixJQUFjLENBQUEsY0FBQSxHQUFHLEdBQUcsQ0FBQztZQUNyQixJQUFZLENBQUEsWUFBQSxHQUFHLEdBQUcsQ0FBQztZQUt6QixJQUFJLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQyxRQUFRLElBQUlULGdCQUFLLENBQUMsY0FBYyxDQUFDO0lBQzVELFFBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLQSxnQkFBSyxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLQSxnQkFBSyxDQUFDLFlBQVksRUFBRTtJQUNsRixZQUFBLE9BQU8sQ0FBQyxJQUFJLENBQ1YsMkhBQTJILENBQzVILENBQUM7SUFDSCxTQUFBOztJQUdELFFBQUE7Z0JBQ0UsY0FBYztnQkFDZCxpQkFBaUI7Z0JBQ2pCLFlBQVk7Z0JBQ1oseUJBQXlCO2dCQUN6Qix3QkFBd0I7Z0JBQ3hCLGVBQWU7Z0JBQ2YsY0FBYztnQkFDZCxnQkFBZ0I7Z0JBQ2hCLHdCQUF3QjtnQkFDeEIsc0JBQXNCO2dCQUN0QixVQUFVO2dCQUNWLFVBQVU7SUFDWCxTQUFBLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxLQUFJO0lBQ2hCLFlBQUEsSUFBSyxVQUFrQixDQUFDLEdBQUcsQ0FBQyxLQUFLLFNBQVMsRUFBRTs7SUFFMUMsZ0JBQUEsT0FBUSxVQUFrQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2pDLGFBQUE7SUFDSCxTQUFDLENBQUMsQ0FBQzs7SUFHSCxRQUFBLFVBQVUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLFFBQUEsVUFBVSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUM7SUFDekIsUUFBQSxVQUFVLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQzs7O1lBSTNCLElBQUksUUFBUSxDQUFDQSxnQkFBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUU7Z0JBQ3JDLFVBQWtCLENBQUMsUUFBUSxHQUFJLFVBQWtCLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQztJQUN0RSxTQUFBOzs7WUFJRCxJQUFJLFFBQVEsQ0FBQ0EsZ0JBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFO2dCQUNyQyxVQUFrQixDQUFDLFlBQVksR0FBSSxVQUFrQixDQUFDLFlBQVksSUFBSSxLQUFLLENBQUM7Z0JBQzVFLFVBQWtCLENBQUMsWUFBWSxHQUFJLFVBQWtCLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztJQUM5RSxTQUFBOztZQUdELFVBQVUsQ0FBQyxRQUFRLEdBQUdBLGdCQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQztnQkFDOUNBLGdCQUFLLENBQUMsV0FBVyxDQUFDLE1BQU07Z0JBQ3hCQSxnQkFBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTO2dCQUMzQkEsZ0JBQUssQ0FBQyxXQUFXLENBQUMsV0FBVztnQkFDN0JBLGdCQUFLLENBQUMsV0FBVyxDQUFDLEdBQUc7Z0JBQ3JCQSxnQkFBSyxDQUFDLFdBQVcsQ0FBQyxNQUFNO0lBQ3hCLFlBQUE7SUFDRSxnQkFBQSxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0lBQ3RCLGdCQUFBLEtBQUssRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJQSxnQkFBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFO0lBQ2hELGdCQUFBLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7SUFDMUIsZ0JBQUEsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUlBLGdCQUFLLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7O0lBRXhELGdCQUFBLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRTtJQUM1RCxnQkFBQSxZQUFZLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0lBQzdCLGdCQUFBLGlCQUFpQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtJQUNqQyxnQkFBQSxvQkFBb0IsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7SUFDckMsZ0JBQUEsZ0JBQWdCLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0lBQ2hDLGdCQUFBLG1CQUFtQixFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRTtJQUNwQyxnQkFBQSxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0lBQzFCLGdCQUFBLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7SUFDMUIsZ0JBQUEscUJBQXFCLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0lBQ3JDLGdCQUFBLHNCQUFzQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtJQUN0QyxnQkFBQSxVQUFVLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0lBQzNCLGdCQUFBLFFBQVEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJQSxnQkFBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFO0lBQ25ELGdCQUFBLGNBQWMsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7SUFDOUIsZ0JBQUEsZUFBZSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtJQUMvQixnQkFBQSxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0lBQ3ZCLGdCQUFBLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7SUFDMUIsZ0JBQUEsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUlBLGdCQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLEVBQUU7SUFDeEQsZ0JBQUEsbUJBQW1CLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFO0lBQ3BDLGdCQUFBLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7SUFDNUIsZ0JBQUEsd0JBQXdCLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0lBQ3hDLGdCQUFBLFlBQVksRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJQSxnQkFBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxFQUFFO0lBQ3ZELGdCQUFBLGtCQUFrQixFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtJQUNsQyxnQkFBQSxpQkFBaUIsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUU7SUFDbEMsZ0JBQUEsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLEdBQUcsRUFBRTtJQUM3QixnQkFBQSxhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRyxFQUFFO0lBQzdCLGdCQUFBLFdBQVcsRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7SUFDNUIsYUFBQTtJQUNGLFNBQUEsQ0FBQyxDQUFDOztJQUdILFFBQUEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQzs7WUFHM0IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1NBQ3ZCO0lBRUQsSUFBQSxJQUFJLE9BQU8sR0FBQTtZQUNULE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQztTQUNqQjtRQUVELElBQUksT0FBTyxDQUFDLENBQXVCLEVBQUE7SUFDakMsUUFBQSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQztTQUNkO0lBRUQsSUFBQSxJQUFJLE9BQU8sR0FBQTtZQUNULE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztTQUN2QjtRQUVELElBQUksT0FBTyxDQUFDLENBQXVCLEVBQUE7SUFDakMsUUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQztTQUNwQjtJQUVEOztJQUVHO0lBQ0gsSUFBQSxJQUFJLFNBQVMsR0FBQTtJQUNYLFFBQUEsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQztTQUMzQjtJQUVEOztJQUVHO1FBQ0gsSUFBSSxTQUFTLENBQUMsQ0FBUyxFQUFBO1lBQ3JCLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztTQUM1QjtJQUVELElBQUEsSUFBSSxXQUFXLEdBQUE7WUFDYixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7U0FDekI7UUFFRCxJQUFJLFdBQVcsQ0FBQyxDQUF1QixFQUFBO0lBQ3JDLFFBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxDQUFDLENBQUM7U0FDdEI7SUFFRCxJQUFBLElBQUksU0FBUyxHQUFBO1lBQ1gsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO1NBQ3hCO1FBRUQsSUFBSSxTQUFTLENBQUMsQ0FBMEIsRUFBQTtJQUN0QyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1lBRXBCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsS0FBS2EsK0JBQXVCLENBQUMsV0FBVyxDQUFDO0lBQzFFLFFBQUEsSUFBSSxDQUFDLFdBQVc7SUFDZCxZQUFBLElBQUksQ0FBQyxVQUFVLEtBQUtBLCtCQUF1QixDQUFDLFdBQVc7SUFDdkQsZ0JBQUEsSUFBSSxDQUFDLFVBQVUsS0FBS0EsK0JBQXVCLENBQUMscUJBQXFCLENBQUM7WUFDcEUsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7U0FDMUI7SUFFRCxJQUFBLElBQUksU0FBUyxHQUFBO1lBQ1gsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO1NBQ3hCO1FBRUQsSUFBSSxTQUFTLENBQUMsQ0FBeUIsRUFBQTtJQUNyQyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1lBRXBCLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1NBQzFCO0lBRUQsSUFBQSxJQUFJLGdCQUFnQixHQUFBO1lBQ2xCLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDO1NBQy9CO1FBRUQsSUFBSSxnQkFBZ0IsQ0FBQyxDQUFnQyxFQUFBO0lBQ25ELFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLENBQUMsQ0FBQztZQUUzQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztTQUMxQjtJQUVELElBQUEsSUFBSSxnQkFBZ0IsR0FBQTtZQUNsQixPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztTQUMvQjtRQUVELElBQUksZ0JBQWdCLENBQUMsQ0FBZ0MsRUFBQTtJQUNuRCxRQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxDQUFDLENBQUM7WUFFM0IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7U0FDMUI7SUFFRCxJQUFBLElBQUksUUFBUSxHQUFBO1lBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO1NBQ3ZCO1FBRUQsSUFBSSxRQUFRLENBQUMsQ0FBd0IsRUFBQTtJQUNuQyxRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO1lBRW5CLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztTQUN4QjtJQUVELElBQUEsSUFBSSxlQUFlLEdBQUE7WUFDakIsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7U0FDOUI7UUFFRCxJQUFJLGVBQWUsQ0FBQyxDQUF3QixFQUFBO0lBQzFDLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQztZQUUxQixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7U0FDeEI7SUFFRCxJQUFBLElBQUksTUFBTSxHQUFBO1lBQ1IsT0FBTyxJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7U0FDaEM7UUFFRCxJQUFJLE1BQU0sQ0FBQyxDQUFTLEVBQUE7SUFDbEIsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUcsSUFBSSxDQUFDLENBQUM7U0FDNUI7SUFFRCxJQUFBLElBQUksU0FBUyxHQUFBO1lBQ1gsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO1NBQ3hCO1FBRUQsSUFBSSxTQUFTLENBQUMsQ0FBVSxFQUFBO0lBQ3RCLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUM7WUFFcEIsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1NBQ3hCO0lBRUQ7Ozs7O0lBS0c7SUFDSSxJQUFBLGtCQUFrQixDQUFDLEtBQWEsRUFBQTtJQUNyQyxRQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUN2RSxRQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUN2RSxRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztZQUVwRSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7U0FDdkI7SUFFTSxJQUFBLElBQUksQ0FBQyxNQUFZLEVBQUE7SUFDdEIsUUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztJQUduQixRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztZQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQ3hDLFFBQUEsSUFBSSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsR0FBRyxDQUFDO1lBQ3RCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN4QyxRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDLFlBQVksQ0FBQztJQUN4QyxRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUNsQyxRQUFBLElBQUksQ0FBQyxhQUFhLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQztZQUMxQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDeEMsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDO0lBQ2xELFFBQUEsSUFBSSxDQUFDLG9CQUFvQixHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQztJQUN4RCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7SUFDaEQsUUFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsTUFBTSxDQUFDLG1CQUFtQixDQUFDO0lBQ3RELFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO0lBQ3BDLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO0lBQ3BDLFFBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLE1BQU0sQ0FBQyxxQkFBcUIsQ0FBQztJQUMxRCxRQUFBLElBQUksQ0FBQyxzQkFBc0IsR0FBRyxNQUFNLENBQUMsc0JBQXNCLENBQUM7SUFDNUQsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFDcEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3BDLFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDO0lBQzVDLFFBQUEsSUFBSSxDQUFDLGVBQWUsR0FBRyxNQUFNLENBQUMsZUFBZSxDQUFDO0lBQzlDLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDO0lBQzlCLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO1lBQ2xDLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUM5QyxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztJQUN0QyxRQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxNQUFNLENBQUMsbUJBQW1CLENBQUM7SUFDdEQsUUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUM7SUFDeEMsUUFBQSxJQUFJLENBQUMsd0JBQXdCLEdBQUcsTUFBTSxDQUFDLHdCQUF3QixDQUFDO1lBQ2hFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUM1QyxRQUFBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxNQUFNLENBQUMsa0JBQWtCLENBQUM7SUFDcEQsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDO0lBQ2xELFFBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDO0lBQzFDLFFBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDO0lBQzFDLFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDO0lBRTVDLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ2xDLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDO0lBQ2xDLFFBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQztJQUNoRCxRQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsZ0JBQWdCLENBQUM7SUFDaEQsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7SUFDaEMsUUFBQSxJQUFJLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxlQUFlLENBQUM7SUFFOUMsUUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7SUFFbEMsUUFBQSxPQUFPLElBQUksQ0FBQztTQUNiO0lBRUQ7O0lBRUc7UUFDSyxjQUFjLEdBQUE7WUFDcEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7WUFDeEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDeEQsUUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEdBQUcsR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7SUFFMUQsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFO2dCQUM3QixPQUFPO0lBQ1IsU0FBQTtJQUNELFFBQUEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLEtBQUssQ0FBQztZQUVqQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUN6QyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDM0UsUUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDOUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQy9GLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ25DLFFBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDckQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDL0MsUUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUM7WUFDL0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDO1lBQ3JFLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztZQUM3RCxJQUFJLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUM7WUFDbkUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDakQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7WUFDakQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDO1lBQ3ZFLElBQUksQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztZQUN6RSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQztZQUNqRCxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUM7WUFDekQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUM7WUFDM0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDM0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDL0MsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNHLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBQ25ELElBQUksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztZQUNuRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQztZQUNyRCxJQUFJLENBQUMsUUFBUSxDQUFDLHdCQUF3QixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUM7WUFDN0UsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZHLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztZQUNqRSxJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUM7O0lBRy9ELFFBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLYixnQkFBSyxDQUFDLFlBQVksRUFBRTtnQkFDeEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLENBQUM7Z0JBQ2hELElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO2dCQUNyRCxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztnQkFDbkQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLENBQUM7Z0JBQ3hELElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0lBQ3hELFNBQUE7WUFFRCxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7U0FDeEI7UUFFTyxpQkFBaUIsR0FBQTtJQUN2QixRQUFBLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxJQUFJLENBQUM7SUFDdEQsUUFBQSxNQUFNLFdBQVcsR0FDZixJQUFJLENBQUMsR0FBRyxLQUFLLElBQUk7Z0JBQ2pCLElBQUksQ0FBQyxZQUFZLEtBQUssSUFBSTtnQkFDMUIsSUFBSSxDQUFDLG9CQUFvQixLQUFLLElBQUk7Z0JBQ2xDLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxJQUFJO2dCQUNqQyxJQUFJLENBQUMsVUFBVSxLQUFLLElBQUk7SUFDeEIsWUFBQSxJQUFJLENBQUMsaUJBQWlCLEtBQUssSUFBSSxDQUFDO1lBRWxDLElBQUksQ0FBQyxPQUFPLEdBQUc7O2dCQUViLHdCQUF3QixFQUFFLFFBQVEsQ0FBQ0EsZ0JBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDO2dCQUV0RCxPQUFPLEVBQUUsSUFBSSxDQUFDLFVBQVU7SUFDeEIsWUFBQSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsVUFBVSxLQUFLYSwrQkFBdUIsQ0FBQyxNQUFNO0lBQ3BFLFlBQUEsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLFVBQVUsS0FBS0EsK0JBQXVCLENBQUMsTUFBTTtJQUNwRSxZQUFBLHFCQUFxQixFQUNuQixJQUFJLENBQUMsVUFBVSxLQUFLQSwrQkFBdUIsQ0FBQyxXQUFXO0lBQ3ZELGdCQUFBLElBQUksQ0FBQyxVQUFVLEtBQUtBLCtCQUF1QixDQUFDLHFCQUFxQjtnQkFDbkUsWUFBWSxFQUFFLFdBQVcsSUFBSSxXQUFXO0lBQ3hDLFlBQUEscUJBQXFCLEVBQUUsV0FBVyxJQUFJLENBQUMsV0FBVztJQUNsRCxZQUFBLGdCQUFnQixFQUFFLElBQUksQ0FBQyxZQUFZLEtBQUssSUFBSTtJQUM1QyxZQUFBLHdCQUF3QixFQUFFLElBQUksQ0FBQyxvQkFBb0IsS0FBSyxJQUFJO0lBQzVELFlBQUEsdUJBQXVCLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixLQUFLLElBQUk7SUFDMUQsWUFBQSxjQUFjLEVBQUUsSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJO0lBQ3hDLFlBQUEsYUFBYSxFQUFFLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSTtJQUN0QyxZQUFBLHVCQUF1QixFQUFFLElBQUksQ0FBQyxtQkFBbUIsS0FBSyxJQUFJO0lBQzFELFlBQUEscUJBQXFCLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixLQUFLLElBQUk7SUFDdEQsWUFBQSxZQUFZLEVBQUUsSUFBSSxDQUFDLFVBQVUsS0FBS0gsOEJBQXNCLENBQUMsTUFBTTtJQUMvRCxZQUFBLGtCQUFrQixFQUFFLElBQUksQ0FBQyxVQUFVLEtBQUtBLDhCQUFzQixDQUFDLFlBQVk7SUFDM0UsWUFBQSxRQUFRLEVBQUUsSUFBSSxDQUFDLFVBQVUsS0FBS0EsOEJBQXNCLENBQUMsRUFBRTtJQUN2RCxZQUFBLG1CQUFtQixFQUFFLElBQUksQ0FBQyxpQkFBaUIsS0FBS0UscUNBQTZCLENBQUMsZ0JBQWdCO0lBQzlGLFlBQUEsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixLQUFLQSxxQ0FBNkIsQ0FBQyxpQkFBaUI7SUFDaEcsWUFBQSxtQkFBbUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEtBQUtELHFDQUE2QixDQUFDLFVBQVU7SUFDeEYsWUFBQSxtQkFBbUIsRUFBRSxJQUFJLENBQUMsaUJBQWlCLEtBQUtBLHFDQUE2QixDQUFDLGFBQWE7YUFDNUYsQ0FBQzs7SUFHRixRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUdHLGNBQVksQ0FBQztJQUNqQyxRQUFBLElBQUksQ0FBQyxjQUFjLEdBQUdDLGdCQUFjLENBQUM7OztZQUlyQyxJQUFJLFFBQVEsQ0FBQ2YsZ0JBQUssQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFO0lBQ3RDLFlBQUEsTUFBTSxTQUFTLEdBQ2IsQ0FBQyxJQUFJLENBQUMsWUFBWSxLQUFLLElBQUk7SUFDekIsa0JBQUUsd0JBQXdCLENBQUMsMkJBQTJCLEVBQUUsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJO3NCQUN4RixFQUFFO0lBQ04saUJBQUMsSUFBSSxDQUFDLFNBQVMsS0FBSyxJQUFJO0lBQ3RCLHNCQUFFLHdCQUF3QixDQUFDLHdCQUF3QixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSTswQkFDbEYsRUFBRSxDQUFDO0lBQ1AsaUJBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJO0lBQ3ZCLHNCQUFFLHdCQUF3QixDQUFDLHlCQUF5QixFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSTswQkFDcEYsRUFBRSxDQUFDLENBQUM7SUFDVixZQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxHQUFHZSxnQkFBYyxDQUFDO0lBQ2xELFNBQUE7O0lBR0QsUUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztTQUN6QjtRQUVPLGVBQWUsR0FBQTtJQUNyQixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFO0lBQ25CLFlBQUEsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLTiw2QkFBcUIsQ0FBQyxHQUFHLEVBQUU7SUFDL0MsZ0JBQUEsSUFBSSxDQUFDLElBQUksR0FBR1QsZ0JBQUssQ0FBQyxVQUFVLENBQUM7SUFDOUIsYUFBQTtJQUFNLGlCQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBS1MsNkJBQXFCLENBQUMsS0FBSyxFQUFFO0lBQ3hELGdCQUFBLElBQUksQ0FBQyxJQUFJLEdBQUdULGdCQUFLLENBQUMsUUFBUSxDQUFDO0lBQzVCLGFBQUE7SUFBTSxpQkFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUtTLDZCQUFxQixDQUFDLElBQUksRUFBRTtJQUN2RCxnQkFBQSxJQUFJLENBQUMsSUFBSSxHQUFHVCxnQkFBSyxDQUFDLFNBQVMsQ0FBQztJQUM3QixhQUFBO0lBQ0YsU0FBQTtJQUFNLGFBQUE7SUFDTCxZQUFBLElBQUksSUFBSSxDQUFDLGVBQWUsS0FBS1MsNkJBQXFCLENBQUMsR0FBRyxFQUFFO0lBQ3RELGdCQUFBLElBQUksQ0FBQyxJQUFJLEdBQUdULGdCQUFLLENBQUMsVUFBVSxDQUFDO0lBQzlCLGFBQUE7SUFBTSxpQkFBQSxJQUFJLElBQUksQ0FBQyxlQUFlLEtBQUtTLDZCQUFxQixDQUFDLEtBQUssRUFBRTtJQUMvRCxnQkFBQSxJQUFJLENBQUMsSUFBSSxHQUFHVCxnQkFBSyxDQUFDLFFBQVEsQ0FBQztJQUM1QixhQUFBO0lBQU0saUJBQUEsSUFBSSxJQUFJLENBQUMsZUFBZSxLQUFLUyw2QkFBcUIsQ0FBQyxJQUFJLEVBQUU7SUFDOUQsZ0JBQUEsSUFBSSxDQUFDLElBQUksR0FBR1QsZ0JBQUssQ0FBQyxTQUFTLENBQUM7SUFDN0IsYUFBQTtJQUNGLFNBQUE7U0FDRjtJQUNGOzs7Ozs7SUM3bUJEO0FBa0JZZ0IsZ0RBS1g7SUFMRCxDQUFBLFVBQVksMEJBQTBCLEVBQUE7SUFDcEMsSUFBQSwwQkFBQSxDQUFBLDBCQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsUUFBTSxDQUFBO0lBQ04sSUFBQSwwQkFBQSxDQUFBLDBCQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsUUFBTSxDQUFBO0lBQ04sSUFBQSwwQkFBQSxDQUFBLDBCQUFBLENBQUEsYUFBQSxDQUFBLEdBQUEsQ0FBQSxDQUFBLEdBQUEsYUFBVyxDQUFBO0lBQ1gsSUFBQSwwQkFBQSxDQUFBLDBCQUFBLENBQUEsdUJBQUEsQ0FBQSxHQUFBLENBQUEsQ0FBQSxHQUFBLHVCQUFxQixDQUFBO0lBQ3ZCLENBQUMsRUFMV0Esa0NBQTBCLEtBQTFCQSxrQ0FBMEIsR0FLckMsRUFBQSxDQUFBLENBQUEsQ0FBQTtJQUVEOztJQUVHO0lBQ1UsTUFBQSxnQkFBaUIsU0FBUWhCLGdCQUFLLENBQUMsY0FBYyxDQUFBO0lBY3hELElBQUEsV0FBQSxDQUFZLFVBQXVDLEVBQUE7SUFDakQsUUFBQSxLQUFLLEVBQUUsQ0FBQztJQWRWOztJQUVHO1lBQ2EsSUFBa0IsQ0FBQSxrQkFBQSxHQUFZLElBQUksQ0FBQztZQUU1QyxJQUFNLENBQUEsTUFBQSxHQUFHLEdBQUcsQ0FBQztJQUNiLFFBQUEsSUFBQSxDQUFBLEdBQUcsR0FBeUIsSUFBSSxDQUFDOztJQUVqQyxRQUFBLElBQUEsQ0FBQSxVQUFVLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDbEQsUUFBQSxJQUFBLENBQUEsV0FBVyxHQUFHZ0Isa0NBQTBCLENBQUMsTUFBTSxDQUFDO0lBRWpELFFBQUEsSUFBQSxDQUFBLG1CQUFtQixHQUFHLElBQUksQ0FBQztZQUtoQyxJQUFJLFVBQVUsS0FBSyxTQUFTLEVBQUU7Z0JBQzVCLFVBQVUsR0FBRyxFQUFFLENBQUM7SUFDakIsU0FBQTs7SUFHRCxRQUFBLFVBQVUsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLFFBQUEsVUFBVSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7OztZQUkzQixJQUFJLFFBQVEsQ0FBQ2hCLGdCQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtnQkFDckMsVUFBa0IsQ0FBQyxRQUFRLEdBQUksVUFBa0IsQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDO0lBQ3RFLFNBQUE7OztZQUlELElBQUksUUFBUSxDQUFDQSxnQkFBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUU7Z0JBQ3JDLFVBQWtCLENBQUMsWUFBWSxHQUFJLFVBQWtCLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztnQkFDNUUsVUFBa0IsQ0FBQyxZQUFZLEdBQUksVUFBa0IsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDO0lBQzlFLFNBQUE7O1lBR0QsVUFBVSxDQUFDLFFBQVEsR0FBR0EsZ0JBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDO2dCQUM5Q0EsZ0JBQUssQ0FBQyxXQUFXLENBQUMsTUFBTTtnQkFDeEJBLGdCQUFLLENBQUMsV0FBVyxDQUFDLEdBQUc7SUFDckIsWUFBQTtJQUNFLGdCQUFBLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRSxHQUFHLEVBQUU7O0lBRXRCLGdCQUFBLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsRUFBRTtJQUM3RCxhQUFBO0lBQ0YsU0FBQSxDQUFDLENBQUM7O0lBR0gsUUFBQSxJQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxDQUFDOztZQUczQixJQUFJLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztZQUN6QixJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7U0FDdkI7SUFFRCxJQUFBLElBQUksT0FBTyxHQUFBO1lBQ1QsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDO1NBQ2pCO1FBRUQsSUFBSSxPQUFPLENBQUMsQ0FBdUIsRUFBQTtJQUNqQyxRQUFBLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1NBQ2Q7SUFFRCxJQUFBLElBQUksVUFBVSxHQUFBO1lBQ1osT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDO1NBQ3pCO1FBRUQsSUFBSSxVQUFVLENBQUMsQ0FBNkIsRUFBQTtJQUMxQyxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsQ0FBQyxDQUFDO1lBRXJCLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFdBQVcsS0FBS2dCLGtDQUEwQixDQUFDLFdBQVcsQ0FBQztJQUM5RSxRQUFBLElBQUksQ0FBQyxXQUFXO0lBQ2QsWUFBQSxJQUFJLENBQUMsV0FBVyxLQUFLQSxrQ0FBMEIsQ0FBQyxXQUFXO0lBQzNELGdCQUFBLElBQUksQ0FBQyxXQUFXLEtBQUtBLGtDQUEwQixDQUFDLHFCQUFxQixDQUFDO1lBQ3hFLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1NBQzFCO0lBRUQ7Ozs7O0lBS0c7SUFDSSxJQUFBLGtCQUFrQixDQUFDLEtBQWEsRUFBQTtZQUNyQyxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7U0FDdkI7SUFFTSxJQUFBLElBQUksQ0FBQyxNQUFZLEVBQUE7SUFDdEIsUUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztJQUduQixRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUM1QixRQUFBLElBQUksQ0FBQyxHQUFHLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQztZQUN0QixJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDeEMsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUM7SUFFcEMsUUFBQSxPQUFPLElBQUksQ0FBQztTQUNiO0lBRUQ7O0lBRUc7UUFDSyxjQUFjLEdBQUE7SUFDcEIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFO2dCQUM3QixPQUFPO0lBQ1IsU0FBQTtJQUNELFFBQUEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLEtBQUssQ0FBQztZQUVqQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQztZQUN6QyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUNuQyxRQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ3REO1FBRU8saUJBQWlCLEdBQUE7WUFDdkIsSUFBSSxDQUFDLE9BQU8sR0FBRztJQUNiLFlBQUEsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFdBQVcsS0FBS0Esa0NBQTBCLENBQUMsTUFBTTtJQUN6RSxZQUFBLGlCQUFpQixFQUFFLElBQUksQ0FBQyxXQUFXLEtBQUtBLGtDQUEwQixDQUFDLE1BQU07SUFDekUsWUFBQSxzQkFBc0IsRUFDcEIsSUFBSSxDQUFDLFdBQVcsS0FBS0Esa0NBQTBCLENBQUMsV0FBVztJQUMzRCxnQkFBQSxJQUFJLENBQUMsV0FBVyxLQUFLQSxrQ0FBMEIsQ0FBQyxxQkFBcUI7YUFDeEUsQ0FBQztJQUVGLFFBQUEsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7SUFDakMsUUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLGNBQWMsQ0FBQzs7SUFHckMsUUFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztTQUN6QjtJQUNGOztJQ2hJRDs7SUFFRztVQUNVLG1CQUFtQixDQUFBO0lBSTlCOzs7O0lBSUc7SUFDSCxJQUFBLFdBQUEsQ0FBWSxVQUFzQyxFQUFFLEVBQUE7WUFDbEQsSUFBSSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsUUFBUSxJQUFJaEIsZ0JBQUssQ0FBQyxjQUFjLENBQUM7SUFDMUQsUUFBQSxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUtBLGdCQUFLLENBQUMsY0FBYyxJQUFJLElBQUksQ0FBQyxTQUFTLEtBQUtBLGdCQUFLLENBQUMsWUFBWSxFQUFFO0lBQ3BGLFlBQUEsT0FBTyxDQUFDLElBQUksQ0FDVixrSUFBa0ksQ0FDbkksQ0FBQztJQUNILFNBQUE7SUFFRCxRQUFBLElBQUksQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGFBQWEsQ0FBQztTQUM3QztJQUVEOzs7O0lBSUc7SUFDVSxJQUFBLG9CQUFvQixDQUFDLElBQVUsRUFBQTs7O0lBQzFDLFlBQUEsTUFBTSxNQUFNLEdBQThCLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBRSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxHQUFHLENBQUM7Z0JBQzNFLElBQUksQ0FBQyxNQUFNLEVBQUU7SUFDWCxnQkFBQSxPQUFPLElBQUksQ0FBQztJQUNiLGFBQUE7SUFFRCxZQUFBLE1BQU0sa0JBQWtCLEdBQXFDLE1BQU0sQ0FBQyxrQkFBa0IsQ0FBQztnQkFDdkYsSUFBSSxDQUFDLGtCQUFrQixFQUFFO0lBQ3ZCLGdCQUFBLE9BQU8sSUFBSSxDQUFDO0lBQ2IsYUFBQTtJQUVELFlBQUEsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLDhCQUE4QixDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNyRSxNQUFNLFlBQVksR0FBMEYsRUFBRSxDQUFDO0lBQy9HLFlBQUEsTUFBTSxTQUFTLEdBQXFCLEVBQUUsQ0FBQztnQkFFdkMsTUFBTSxPQUFPLENBQUMsR0FBRyxDQUNmLEtBQUssQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBTyxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsS0FBSSxTQUFBLENBQUEsSUFBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLEtBQUEsQ0FBQSxFQUFBLGFBQUE7SUFDNUUsZ0JBQUEsTUFBTSxVQUFVLEdBQW9CLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUN0RSxnQkFBQSxNQUFNLFVBQVUsR0FBb0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFLLENBQUMsQ0FBQztJQUU5RSxnQkFBQSxNQUFNLE9BQU8sQ0FBQyxHQUFHLENBQ2YsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFPLFNBQVMsRUFBRSxjQUFjLEtBQUksU0FBQSxDQUFBLElBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxLQUFBLENBQUEsRUFBQSxhQUFBO3dCQUNqRCxNQUFNLGVBQWUsR0FBRyxVQUFVLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxDQUFDOzs7Ozs7d0JBTzlELElBQUksQ0FBQyxlQUFlLEVBQUU7NEJBQ3BCLE9BQU87SUFDUixxQkFBQTtJQUVELG9CQUFBLE1BQU0saUJBQWlCLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQztJQUM3QyxvQkFBQSxNQUFNLGlCQUFpQixHQUFHLGlCQUFpQixDQUFDLEtBQUs7SUFDL0MsMEJBQUUsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEtBQUs7OEJBQzdCLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQzs7d0JBR3BELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsRUFBRTs0QkFDdEMsU0FBUyxDQUFDLFFBQVEsR0FBRyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQzs0QkFDMUMsaUJBQWlCLENBQUMsUUFBUSxDQUFDLENBQUMsRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNyRCxxQkFBQTs7SUFHRCxvQkFBQSxNQUFNLGdCQUFnQixHQUFHLGVBQWUsQ0FBQyxRQUFTLENBQUM7SUFFbkQsb0JBQUEsSUFBSSxLQUFLLEdBQUcsa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsQ0FBQzt3QkFDakQsSUFBSSxDQUFDLEtBQUssRUFBRTtJQUNWLHdCQUFBLE9BQU8sQ0FBQyxJQUFJLENBQ1YsdUVBQXVFLGdCQUFnQixDQUFBLGtCQUFBLENBQW9CLENBQzVHLENBQUM7NEJBQ0YsS0FBSyxHQUFHLEVBQUUsTUFBTSxFQUFFLG9CQUFvQixFQUFFLENBQUM7SUFDMUMscUJBQUE7SUFFRCxvQkFBQSxJQUFJLFlBQW1FLENBQUM7SUFDeEUsb0JBQUEsSUFBSSxZQUFZLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtJQUNsQyx3QkFBQSxZQUFZLEdBQUcsWUFBWSxDQUFDLGdCQUFnQixDQUFDLENBQUM7SUFDL0MscUJBQUE7SUFBTSx5QkFBQTtJQUNMLHdCQUFBLFlBQVksR0FBRyxNQUFNLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqRix3QkFBQSxZQUFZLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxZQUFZLENBQUM7SUFFOUMsd0JBQUEsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7NEJBQ3JDLElBQUksWUFBWSxDQUFDLE9BQU8sRUFBRTtJQUN4Qiw0QkFBQSxTQUFTLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN0Qyx5QkFBQTtJQUNGLHFCQUFBOzt3QkFHRCxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUM7O3dCQUc3QyxJQUFJLElBQUksQ0FBQyxjQUFjLElBQUssWUFBWSxDQUFDLE9BQWUsQ0FBQyxzQkFBc0IsRUFBRTs0QkFDL0UsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSTtJQUNuQyw0QkFBQSxZQUFZLENBQUMsT0FBZSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDOUMsNEJBQUEsWUFBWSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO0lBQzFDLHlCQUFDLENBQUMsQ0FBQztJQUNKLHFCQUFBOzt3QkFHRCxTQUFTLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDOzt3QkFHbEQsSUFBSSxZQUFZLENBQUMsT0FBTyxFQUFFOzRCQUN4QixTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUM7NEJBQzdDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDckQscUJBQUE7cUJBQ0YsQ0FBQSxDQUFDLENBQ0gsQ0FBQztpQkFDSCxDQUFBLENBQUMsQ0FDSCxDQUFDO0lBRUYsWUFBQSxPQUFPLFNBQVMsQ0FBQzs7SUFDbEIsS0FBQTtJQUVZLElBQUEsa0JBQWtCLENBQzdCLGdCQUFnQyxFQUNoQyxRQUE0QixFQUM1QixJQUFVLEVBQUE7O0lBS1YsWUFBQSxJQUFJLFVBQXNDLENBQUM7SUFDM0MsWUFBQSxJQUFJLFVBQXNDLENBQUM7SUFFM0MsWUFBQSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssV0FBVyxFQUFFO0lBQ25DLGdCQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQzs7SUFHdkYsZ0JBQUEsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLGNBQWMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSTtJQUN4RCxvQkFBQSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLEVBQUU7SUFDOUIsd0JBQUEsT0FBTyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckIscUJBQUE7SUFDSCxpQkFBQyxDQUFDLENBQUM7O0lBR0gsZ0JBQUEsQ0FBQyxTQUFTLEVBQUUsY0FBYyxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUUsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxLQUFJO0lBQ3JGLG9CQUFBLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsRUFBRTs0QkFDOUIsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3hDLHFCQUFBO0lBQ0gsaUJBQUMsQ0FBQyxDQUFDOztJQUdILGdCQUFBLE1BQU0sQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQzs7SUFHakMsZ0JBQUEsVUFBVSxHQUFHLElBQUksYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDOztJQUd2QyxnQkFBQSxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBS1kscUNBQTZCLENBQUMsSUFBSSxFQUFFO0lBQ2xFLG9CQUFBLE1BQU0sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0lBQ3hCLG9CQUFBLFVBQVUsR0FBRyxJQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4QyxpQkFBQTtJQUNGLGFBQUE7SUFBTSxpQkFBQSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssa0JBQWtCLEVBQUU7O0lBRWpELGdCQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN2RixnQkFBQSxNQUFNLENBQUMsVUFBVSxHQUFHSSxrQ0FBMEIsQ0FBQyxNQUFNLENBQUM7SUFDdEQsZ0JBQUEsVUFBVSxHQUFHLElBQUksZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDM0MsYUFBQTtJQUFNLGlCQUFBLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxpQkFBaUIsRUFBRTs7SUFFaEQsZ0JBQUEsTUFBTSxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsMEJBQTBCLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3ZGLGdCQUFBLE1BQU0sQ0FBQyxVQUFVLEdBQUdBLGtDQUEwQixDQUFDLE1BQU0sQ0FBQztJQUN0RCxnQkFBQSxVQUFVLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzQyxhQUFBO0lBQU0saUJBQUEsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLHNCQUFzQixFQUFFOztJQUVyRCxnQkFBQSxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxnQkFBZ0IsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDdkYsZ0JBQUEsTUFBTSxDQUFDLFVBQVUsR0FBR0Esa0NBQTBCLENBQUMsV0FBVyxDQUFDO0lBQzNELGdCQUFBLFVBQVUsR0FBRyxJQUFJLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQzNDLGFBQUE7SUFBTSxpQkFBQSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssNEJBQTRCLEVBQUU7O0lBRTNELGdCQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLDBCQUEwQixDQUFDLGdCQUFnQixFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUN2RixnQkFBQSxNQUFNLENBQUMsVUFBVSxHQUFHQSxrQ0FBMEIsQ0FBQyxxQkFBcUIsQ0FBQztJQUNyRSxnQkFBQSxVQUFVLEdBQUcsSUFBSSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzQyxhQUFBO0lBQU0saUJBQUE7SUFDTCxnQkFBQSxJQUFJLFFBQVEsQ0FBQyxNQUFNLEtBQUssb0JBQW9CLEVBQUU7d0JBQzVDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQSwwQkFBQSxFQUE2QixRQUFRLENBQUMsTUFBTSxDQUFHLENBQUEsQ0FBQSxDQUFDLENBQUM7O0lBRS9ELGlCQUFBO29CQUVELFVBQVUsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUNsRSxhQUFBO0lBRUQsWUFBQSxVQUFVLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQztJQUN4QyxZQUFBLFVBQVUsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7SUFDNUUsWUFBQSxVQUFVLENBQUMsUUFBUSxDQUFDLHFCQUFxQixHQUFHLFFBQVEsQ0FBQztJQUVyRCxZQUFBLElBQUksVUFBVSxFQUFFO29CQUNkLFVBQVUsQ0FBQyxJQUFJLEdBQUcsZ0JBQWdCLENBQUMsSUFBSSxHQUFHLFlBQVksQ0FBQztJQUN2RCxnQkFBQSxVQUFVLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0lBQzVFLGdCQUFBLFVBQVUsQ0FBQyxRQUFRLENBQUMscUJBQXFCLEdBQUcsUUFBUSxDQUFDO0lBQ3RELGFBQUE7Z0JBRUQsT0FBTztJQUNMLGdCQUFBLE9BQU8sRUFBRSxVQUFVO0lBQ25CLGdCQUFBLE9BQU8sRUFBRSxVQUFVO2lCQUNwQixDQUFDO2FBQ0gsQ0FBQSxDQUFBO0lBQUEsS0FBQTtJQUVPLElBQUEsdUJBQXVCLENBQUMsSUFBWSxFQUFBO0lBQzFDLFFBQUEsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO0lBQ25CLFlBQUEsT0FBTyxDQUFDLElBQUksQ0FBQyxzQ0FBc0MsSUFBSSxDQUFBLGtCQUFBLENBQW9CLENBQUMsQ0FBQztJQUM3RSxZQUFBLE9BQU8sSUFBSSxDQUFDO0lBQ2IsU0FBQTtJQUNELFFBQUEsSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFekIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7SUFDMUIsWUFBQSxPQUFPLENBQUMsSUFBSSxDQUFDLHNDQUFzQyxJQUFJLENBQUEsa0JBQUEsQ0FBb0IsQ0FBQyxDQUFDO0lBQzdFLFlBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixTQUFBO0lBQ0QsUUFBQSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLEVBQUUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2xEO0lBRU8sSUFBQSxvQkFBb0IsQ0FBQyxRQUF3QixFQUFBO1lBQ25ELElBQUssUUFBZ0IsQ0FBQyxzQkFBc0IsRUFBRTtnQkFDNUMsTUFBTSxHQUFHLEdBQUcsUUFBc0MsQ0FBQztnQkFFbkQsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFO29CQUNYLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDbkMsYUFBQTtnQkFDRCxJQUFJLEdBQUcsQ0FBQyxXQUFXLEVBQUU7b0JBQ25CLEdBQUcsQ0FBQyxXQUFXLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDM0MsYUFBQTtJQUVELFlBQUEsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLaEIsZ0JBQUssQ0FBQyxjQUFjLEVBQUU7SUFDM0MsZ0JBQUEsR0FBRyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0lBQ2hDLGdCQUFBLEdBQUcsQ0FBQyxRQUFRLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztJQUNwQyxhQUFBO0lBQ0YsU0FBQTtZQUVELElBQUssUUFBZ0IsQ0FBQyxtQkFBbUIsRUFBRTtnQkFDekMsTUFBTSxHQUFHLEdBQUcsUUFBbUMsQ0FBQztnQkFFaEQsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFO29CQUNYLEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7SUFDbkMsYUFBQTtJQUVELFlBQUEsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLQSxnQkFBSyxDQUFDLGNBQWMsRUFBRTtJQUMzQyxnQkFBQSxHQUFHLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLENBQUM7SUFDakMsYUFBQTtJQUNGLFNBQUE7SUFFRCxRQUFBLE9BQU8sUUFBUSxDQUFDO1NBQ2pCO0lBRU8sSUFBQSwwQkFBMEIsQ0FDaEMsZ0JBQWdDLEVBQ2hDLFFBQTRCLEVBQzVCLElBQVUsRUFBQTtZQUVWLE1BQU0sUUFBUSxHQUF3QixFQUFFLENBQUM7WUFDekMsTUFBTSxNQUFNLEdBQVEsRUFBRSxDQUFDOztZQUd2QixJQUFJLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRTtnQkFDOUIsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxFQUFFO29CQUMxRCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ25ELE1BQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUV0RCxnQkFBQSxRQUFRLENBQUMsSUFBSSxDQUNYLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLFNBQVMsRUFBRSxZQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxPQUFzQixLQUFJO0lBQ2pGLG9CQUFBLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxPQUFPLENBQUM7cUJBQzNCLENBQUMsQ0FDSCxDQUFDO0lBQ0gsYUFBQTtJQUNGLFNBQUE7O1lBR0QsSUFBSSxRQUFRLENBQUMsZUFBZSxFQUFFO2dCQUM1QixLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxFQUFFO29CQUN4RCxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ25ELE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ2xELGFBQUE7SUFDRixTQUFBOztZQUdELElBQUksUUFBUSxDQUFDLGdCQUFnQixFQUFFO2dCQUM3QixLQUFLLE1BQU0sSUFBSSxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7b0JBQ3pELElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQzs7SUFHakQsZ0JBQUEsTUFBTSxXQUFXLEdBQUc7d0JBQ2xCLFVBQVU7d0JBQ1YsZUFBZTt3QkFDZixVQUFVO3dCQUNWLHVCQUF1Qjt3QkFDdkIsc0JBQXNCO3dCQUN0QixhQUFhO3dCQUNiLFlBQVk7d0JBQ1osY0FBYzt3QkFDZCxzQkFBc0I7d0JBQ3RCLG9CQUFvQjtxQkFDckIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLEtBQUssSUFBSSxLQUFLLFdBQVcsQ0FBQyxDQUFDO0lBQzlDLGdCQUFBLElBQUksV0FBVyxFQUFFO3dCQUNmLE9BQU8sSUFBSSxLQUFLLENBQUM7SUFDbEIsaUJBQUE7SUFFRCxnQkFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztJQUN6RSxhQUFBO0lBQ0YsU0FBQTs7O1lBSUQsSUFBSSxRQUFRLENBQUNBLGdCQUFLLENBQUMsUUFBUSxFQUFFLEVBQUUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtnQkFDdEMsTUFBTSxDQUFDLFFBQVEsR0FBSSxnQkFBd0IsQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDO0lBQy9ELFNBQUE7OztZQUlELElBQUksUUFBUSxDQUFDQSxnQkFBSyxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUU7Z0JBQ3RDLE1BQU0sQ0FBQyxZQUFZLEdBQUksZ0JBQXdCLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQztnQkFDdEUsTUFBTSxDQUFDLFlBQVksR0FBSSxnQkFBd0IsQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDO0lBQ3ZFLFNBQUE7SUFFRCxRQUFBLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxNQUFNLENBQUMsQ0FBQztTQUNqRDtJQUNGOztJQzVWRDs7SUFFRztVQUNVLGVBQWUsQ0FBQTtJQU0xQixJQUFBLFdBQUEsQ0FBWSxPQUFnQyxFQUFBOztJQUMxQyxRQUFBLElBQUksQ0FBQyxhQUFhLEdBQUcsQ0FBQSxFQUFBLEdBQUEsT0FBTyxLQUFBLElBQUEsSUFBUCxPQUFPLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQVAsT0FBTyxDQUFFLGFBQWEsTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBSSxLQUFLLENBQUM7U0FDdEQ7SUFFWSxJQUFBLE1BQU0sQ0FBQyxJQUFVLEVBQUE7OztJQUM1QixZQUFBLE1BQU0sTUFBTSxHQUE4QixDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQUUsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsR0FBRyxDQUFDO2dCQUMzRSxJQUFJLENBQUMsTUFBTSxFQUFFO0lBQ1gsZ0JBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixhQUFBO0lBRUQsWUFBQSxNQUFNLFVBQVUsR0FBK0IsTUFBTSxDQUFDLElBQUksQ0FBQztnQkFDM0QsSUFBSSxDQUFDLFVBQVUsRUFBRTtJQUNmLGdCQUFBLE9BQU8sSUFBSSxDQUFDO0lBQ2IsYUFBQTtJQUVELFlBQUEsSUFBSSxPQUF5QyxDQUFDO0lBQzlDLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLElBQUksVUFBVSxDQUFDLE9BQU8sSUFBSSxJQUFJLElBQUksVUFBVSxDQUFDLE9BQU8sS0FBSyxDQUFDLENBQUMsRUFBRTtJQUNsRixnQkFBQSxPQUFPLEdBQUcsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzFFLGFBQUE7Z0JBRUQsT0FBTztvQkFDTCxlQUFlLEVBQUUsVUFBVSxDQUFDLGVBQWU7b0JBQzNDLE1BQU0sRUFBRSxVQUFVLENBQUMsTUFBTTtvQkFDekIsb0JBQW9CLEVBQUUsVUFBVSxDQUFDLG9CQUFvQjtvQkFDckQsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLGtCQUFrQjtvQkFDakQsV0FBVyxFQUFFLFVBQVUsQ0FBQyxXQUFXO29CQUNuQyxlQUFlLEVBQUUsVUFBVSxDQUFDLGVBQWU7b0JBQzNDLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxrQkFBa0I7b0JBQ2pELFNBQVMsRUFBRSxVQUFVLENBQUMsU0FBUztvQkFDL0IsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLGdCQUFnQjtJQUM3QyxnQkFBQSxPQUFPLEVBQUUsT0FBTyxLQUFBLElBQUEsSUFBUCxPQUFPLEtBQVAsS0FBQSxDQUFBLEdBQUEsT0FBTyxHQUFJLFNBQVM7b0JBQzdCLEtBQUssRUFBRSxVQUFVLENBQUMsS0FBSztvQkFDdkIsT0FBTyxFQUFFLFVBQVUsQ0FBQyxPQUFPO29CQUMzQixpQkFBaUIsRUFBRSxVQUFVLENBQUMsaUJBQWlCO2lCQUNoRCxDQUFDOztJQUNILEtBQUE7SUFDRjs7SUNqREQsTUFBTWlCLE9BQUssR0FBRyxJQUFJakIsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUVsQzs7Ozs7SUFLRztJQUNHLFNBQVUsZ0JBQWdCLENBQTBCLE1BQVMsRUFBQTtRQUNqRSxJQUFLLE1BQWMsQ0FBQyxNQUFNLEVBQUU7WUFDMUIsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBQ2pCLEtBQUE7SUFBTSxTQUFBO1lBQ0osTUFBYyxDQUFDLFVBQVUsQ0FBQ2lCLE9BQUssQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUNoRCxLQUFBO0lBRUQsSUFBQSxPQUFPLE1BQU0sQ0FBQztJQUNoQjs7SUNsQkE7SUFRQTtJQUNBO0lBQ0E7SUFFQSxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSWpCLGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUM1RCxNQUFNLG1CQUFtQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSUEsZ0JBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBRWxFO0lBQ0EsTUFBTUssTUFBSSxHQUFHLElBQUlMLGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDakMsTUFBTSxJQUFJLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNqQyxNQUFNLElBQUksR0FBRyxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2pDLE1BQU0sTUFBTSxHQUFHLElBQUlBLGdCQUFLLENBQUMsVUFBVSxFQUFFLENBQUM7SUFDdEMsTUFBTSxLQUFLLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUNsQyxNQUFNLEtBQUssR0FBRyxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRWxDOzs7SUFHRztVQUNVLGFBQWEsQ0FBQTtJQTZKeEI7Ozs7O0lBS0c7UUFDSCxXQUFZLENBQUEsSUFBb0IsRUFBRSxNQUFBLEdBQWtDLEVBQUUsRUFBQTs7SUEzSHRFOztJQUVHO0lBQ08sUUFBQSxJQUFBLENBQUEsWUFBWSxHQUFHLElBQUlBLGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFN0M7O0lBRUc7SUFDTyxRQUFBLElBQUEsQ0FBQSxTQUFTLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUUxQzs7O0lBR0c7SUFDTyxRQUFBLElBQUEsQ0FBQSxTQUFTLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUUxQzs7SUFFRztJQUNPLFFBQUEsSUFBQSxDQUFBLFNBQVMsR0FBRyxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBUTFDOztJQUVHO0lBQ08sUUFBQSxJQUFBLENBQUEsb0JBQW9CLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUVyRDs7O0lBR0c7WUFDTyxJQUFPLENBQUEsT0FBQSxHQUFlLElBQUksQ0FBQztJQTREckM7OztJQUdHO0lBQ0ssUUFBQSxJQUFBLENBQUEsb0JBQW9CLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxVQUFVLEVBQUUsQ0FBQztJQUV0RDs7SUFFRztJQUNLLFFBQUEsSUFBQSxDQUFBLG1CQUFtQixHQUFHLElBQUlBLGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFbEQ7O0lBRUc7SUFDSyxRQUFBLElBQUEsQ0FBQSxxQkFBcUIsR0FBRyxJQUFJQSxnQkFBSyxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBRXZEOztJQUVHO0lBQ0ssUUFBQSxJQUFBLENBQUEsMEJBQTBCLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQVN2RCxRQUFBLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO1lBRW5DLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQSxFQUFBLEdBQUEsTUFBTSxDQUFDLE1BQU0sTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxJQUFJLENBQUM7WUFDcEMsSUFBSSxDQUFDLGNBQWMsR0FBRyxDQUFBLEVBQUEsR0FBQSxNQUFNLENBQUMsY0FBYyxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEdBQUcsQ0FBQztJQUNuRCxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVU7SUFDakMsY0FBRSxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO0lBQzdDLGNBQUUsSUFBSUEsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzVDLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQSxFQUFBLEdBQUEsTUFBTSxDQUFDLFlBQVksTUFBSSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBQSxHQUFHLENBQUM7WUFDL0MsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFBLEVBQUEsR0FBQSxNQUFNLENBQUMsU0FBUyxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLEdBQUcsQ0FBQztZQUN6QyxJQUFJLENBQUMsU0FBUyxHQUFHLENBQUEsRUFBQSxHQUFBLE1BQU0sQ0FBQyxTQUFTLE1BQUksSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLEdBQUEsRUFBRSxDQUFDO1lBRXhDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBRXZFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNoRCxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFFdEQsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFOzs7Z0JBR25DLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDM0YsU0FBQTtJQUFNLGFBQUE7Z0JBQ0wsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzNELFNBQUE7O0lBR0QsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO1lBQ2hGLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUN2QyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFFdkMsUUFBQSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNqRSxJQUFJLENBQUMsc0JBQXNCLEdBQUdLLE1BQUk7SUFDL0IsYUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDO0lBQ3JDLGFBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO0lBQ25DLGFBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztJQUM5QixhQUFBLE1BQU0sRUFBRSxDQUFDO1lBRVosSUFBSSxDQUFDLE1BQU0sR0FBRyxDQUFBLEVBQUEsR0FBQSxNQUFNLENBQUMsTUFBTSxNQUFJLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFBLElBQVcsQ0FBQztTQUM1QztJQTlIRCxJQUFBLElBQVcsTUFBTSxHQUFBO1lBQ2YsT0FBTyxJQUFJLENBQUMsT0FBYyxDQUFDO1NBQzVCO1FBQ0QsSUFBVyxNQUFNLENBQUMsTUFBc0IsRUFBQTs7SUFFdEMsUUFBQSxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFcEMsUUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN0QyxRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLFFBQUEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7O0lBR25DOzs7SUFHSTs7SUFHSixRQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDOztZQUd0QixJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7SUFDaEIsWUFBQSxNQUFNLGtCQUFrQixHQUFHLElBQUlMLGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7Z0JBQy9DLElBQUksNkJBQTZCLEdBQUcsSUFBSSxDQUFDO2dCQUN6QyxJQUFJLENBQUMsT0FBTyxDQUFDLGlCQUFpQixHQUFHLENBQUMsa0JBQWtCLElBQUksTUFBSztvQkFDekQsNkJBQTZCLEdBQUcsSUFBSSxDQUFDO29CQUNyQyxPQUFPLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsU0FBZ0IsQ0FBQyxDQUFDO2lCQUMzRCxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUNsQyxZQUFBLElBQUksQ0FBQyxPQUFlLENBQUMscUJBQXFCLEdBQUcsTUFBSztJQUNqRCxnQkFBQSxJQUFJLDZCQUE2QixFQUFFO0lBQ2pDLG9CQUFBLGtCQUFrQixDQUFDLElBQUksQ0FBRSxJQUFJLENBQUMsT0FBZSxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sRUFBRSxDQUFDO3dCQUNwRSw2QkFBNkIsR0FBRyxLQUFLLENBQUM7SUFDdkMsaUJBQUE7SUFDRCxnQkFBQSxPQUFPLGtCQUFrQixDQUFDO0lBQzVCLGFBQUMsQ0FBQzs7OztJQUlILFNBQUE7O0lBR0QsUUFBQSxJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFcEMsUUFBQSxJQUFJLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUN0QyxRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ25DLFFBQUEsSUFBSSxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7O1lBR25DLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUV0QyxRQUFBLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUV2RCxJQUFJLENBQUMsc0JBQXNCLEdBQUdLLE1BQUk7SUFDL0IsYUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDO2lCQUNyQyxZQUFZLENBQUMsS0FBSyxDQUFDO0lBQ25CLGFBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztJQUM5QixhQUFBLE1BQU0sRUFBRSxDQUFDO1NBQ2I7SUF1RUQ7OztJQUdHO1FBQ0ksS0FBSyxHQUFBO1lBQ1YsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDOztJQUd0RCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDekIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMscUJBQXFCLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3ZGLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDOztJQUd2RSxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7WUFDaEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztTQUN4QztJQUVEOzs7OztJQUtHO0lBQ0ksSUFBQSxNQUFNLENBQUMsS0FBYSxFQUFBO1lBQ3pCLElBQUksS0FBSyxJQUFJLENBQUM7Z0JBQUUsT0FBTztJQUV2QixRQUFBLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7Ozs7Z0JBSXBCLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ3JFLFNBQUE7SUFBTSxhQUFBO0lBQ0wsWUFBQSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDckQsU0FBQTs7SUFHRCxRQUFBLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdEMsUUFBQSxJQUFJLENBQUMsb0JBQW9CLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7O0lBR3ZELFFBQUEsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQ3BDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQzs7SUFHN0MsUUFBQSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQztJQUM5QyxRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxDQUFDOztJQUd0RixRQUFBLElBQUksQ0FBQyxTQUFTO0lBQ1gsYUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQztJQUN2QixhQUFBLEdBQUcsQ0FDRkEsTUFBSTtJQUNELGFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7SUFDdkIsYUFBQSxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztpQkFDbkIsY0FBYyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQ3RDO0lBQ0EsYUFBQSxHQUFHLENBQ0ZBLE1BQUk7SUFDRCxhQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQ3BCLGFBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztpQkFDdEMsWUFBWSxDQUFDLEtBQUssQ0FBQztJQUNuQixhQUFBLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUM7SUFDOUIsYUFBQSxTQUFTLEVBQUU7SUFDWCxhQUFBLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FDN0I7SUFDQSxhQUFBLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzs7SUFHakIsUUFBQSxJQUFJLENBQUMsU0FBUztJQUNYLGFBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztJQUM5QixhQUFBLFNBQVMsRUFBRTtJQUNYLGFBQUEsY0FBYyxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQztJQUMzQyxhQUFBLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQzs7SUFHbEMsUUFBQSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUVoQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDdkMsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDOzs7O0lBS3ZDLFFBQUEsTUFBTSwyQkFBMkIsR0FBRyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzNHLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxrQkFBa0IsQ0FDN0MsSUFBSSxDQUFDLFNBQVMsRUFDZEEsTUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsWUFBWSxDQUFDLDJCQUEyQixDQUFDLENBQUMsU0FBUyxFQUFFLENBQ2hGLENBQUM7SUFFRixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLENBQUM7O0lBRzlFLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN6QixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7U0FDeEY7SUFFRDs7OztJQUlHO0lBQ0ssSUFBQSxVQUFVLENBQUMsSUFBbUIsRUFBQTtZQUNwQyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsS0FBSTtJQUNsQyxZQUFBLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNwQyxZQUFBLEtBQUssQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO2dCQUNyQyxNQUFNLDJCQUEyQixHQUFHQSxNQUFJLENBQUMscUJBQXFCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3RFLE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsY0FBZSxDQUFDLE1BQU0sQ0FBQztJQUNoRSxZQUFBLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsY0FBYyxDQUFDO2dCQUV2QyxJQUFJLElBQUksQ0FBQyxpQkFBaUIsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7O0lBRWhFLGdCQUFBLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLDJCQUEyQixDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7SUFDOUUsZ0JBQUEsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQywyQkFBMkIsRUFBRSxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7O29CQUcvRixJQUFJLENBQUMsSUFBSSxDQUNQLGVBQWU7SUFDWixxQkFBQSxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDO0lBQzlCLHFCQUFBLFNBQVMsRUFBRTtJQUNYLHFCQUFBLGNBQWMsQ0FBQyxJQUFJLENBQUMsc0JBQXNCLENBQUM7SUFDM0MscUJBQUEsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUNsQyxDQUFDO0lBQ0gsYUFBQTtJQUNILFNBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFFRDs7O0lBR0c7SUFDSyxJQUFBLHVCQUF1QixDQUFDLE1BQXFCLEVBQUE7WUFDbkQsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUNoQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDdkMsU0FBQTtJQUFNLGFBQUE7Z0JBQ0wsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ25CLFNBQUE7SUFFRCxRQUFBLE9BQU8sTUFBTSxDQUFDO1NBQ2Y7SUFFRDs7O0lBR0c7SUFDSyxJQUFBLHVCQUF1QixDQUFDLE1BQXFCLEVBQUE7WUFDbkQsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFOztnQkFFaEIsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLHFCQUFxQixFQUFFLENBQUMsQ0FBQztJQUNuRCxTQUFBO0lBQU0sYUFBQTtnQkFDTCxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDbkIsU0FBQTtJQUVELFFBQUEsT0FBTyxNQUFNLENBQUM7U0FDZjtJQUVEOztJQUVHO1FBQ0sscUJBQXFCLEdBQUE7SUFDM0IsUUFBQSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQztTQUMzRTtJQUNGOztJQ25ZRDs7SUFFRztVQUNVLG9CQUFvQixDQUFBO0lBSS9COzs7O0lBSUc7UUFDSCxXQUFtQixDQUFBLGNBQTRDLEVBQUUsbUJBQXlDLEVBQUE7WUFSMUYsSUFBYyxDQUFBLGNBQUEsR0FBaUMsRUFBRSxDQUFDO1lBQ2xELElBQW1CLENBQUEsbUJBQUEsR0FBeUIsRUFBRSxDQUFDO0lBUTdELFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7SUFDckMsUUFBQSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsbUJBQW1CLENBQUM7U0FDaEQ7SUFFRDs7OztJQUlHO0lBQ0ksSUFBQSxTQUFTLENBQUMsSUFBMkIsRUFBQTtZQUMxQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsZUFBZSxLQUFJO0lBQ25ELFlBQUEsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsS0FBSTtJQUNyQyxnQkFBQSxVQUFVLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztJQUMzQixhQUFDLENBQUMsQ0FBQztJQUNMLFNBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFFRDs7OztJQUlHO0lBQ0ksSUFBQSxVQUFVLENBQUMsS0FBYSxFQUFBO0lBQzdCLFFBQUEsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsRUFBa0IsQ0FBQztZQUVuRCxJQUFJLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUMsZUFBZSxLQUFJO0lBQ25ELFlBQUEsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFVBQVUsS0FBSTtvQkFDckMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUMzRCxnQkFBQSxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzNCLGFBQUMsQ0FBQyxDQUFDO0lBQ0wsU0FBQyxDQUFDLENBQUM7U0FDSjtJQUVEOztJQUVHO1FBQ0ksS0FBSyxHQUFBO0lBQ1YsUUFBQSxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxFQUFrQixDQUFDO1lBRW5ELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxlQUFlLEtBQUk7SUFDbkQsWUFBQSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxLQUFJO29CQUNyQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUMzRCxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDckIsYUFBQyxDQUFDLENBQUM7SUFDTCxTQUFDLENBQUMsQ0FBQztTQUNKO0lBRUQ7Ozs7O0lBS0c7UUFDSyxrQkFBa0IsQ0FBQyxnQkFBcUMsRUFBRSxJQUFvQixFQUFBO0lBQ3BGLFFBQUEsSUFBSSxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO2dCQUFFLE9BQU87WUFFdkMsSUFBSSxJQUFJLENBQUMsTUFBTTtnQkFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3hFLFFBQUEsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztJQUVyQyxRQUFBLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUM1QjtJQUNGOztJQzFFRCxNQUFNQSxNQUFJLEdBQUcsSUFBSUwsZ0JBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUVqQyxNQUFNLGlCQUFpQixHQUFHLElBQUlBLGdCQUFLLENBQUMsaUJBQWlCLENBQUMsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLENBQUMsQ0FBQztJQUUxRTs7SUFFRztVQUNVLHFCQUFxQixDQUFBO0lBQ2hDOzs7O0lBSUc7SUFDSSxJQUFBLE1BQU0sQ0FBQyxJQUFVLEVBQUE7O0lBQ3RCLFFBQUEsTUFBTSxNQUFNLEdBQThCLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBRSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxHQUFHLENBQUM7SUFDM0UsUUFBQSxJQUFJLENBQUMsTUFBTTtJQUFFLFlBQUEsT0FBTyxJQUFJLENBQUM7SUFFekIsUUFBQSxNQUFNLHdCQUF3QixHQUE2QyxNQUFNLENBQUMsa0JBQWtCLENBQUM7SUFDckcsUUFBQSxJQUFJLENBQUMsd0JBQXdCO0lBQUUsWUFBQSxPQUFPLElBQUksQ0FBQzs7WUFHM0MsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksRUFBRSx3QkFBd0IsQ0FBQyxDQUFDOzs7SUFJdEYsUUFBQSxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFFNUcsUUFBQSxPQUFPLElBQUksb0JBQW9CLENBQUMsY0FBYyxFQUFFLG1CQUFtQixDQUFDLENBQUM7U0FDdEU7SUFFUyxJQUFBLGlCQUFpQixDQUFDLElBQW9CLEVBQUUsTUFBQSxHQUFrQyxFQUFFLEVBQUE7SUFDcEYsUUFBQSxPQUFPLElBQUksYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztTQUN4QztJQUVTLElBQUEsMEJBQTBCLENBQ2xDLElBQVUsRUFDVix3QkFBc0QsRUFDdEQsY0FBNEMsRUFBQTtJQUU1QyxRQUFBLE1BQU0sZ0JBQWdCLEdBQUcsd0JBQXdCLENBQUMsVUFBVSxJQUFJLEVBQUUsQ0FBQztZQUNuRSxNQUFNLG1CQUFtQixHQUFZLEVBQUUsQ0FBQztJQUN4QyxRQUFBLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDLFlBQWlCLEtBQUk7SUFDM0MsWUFBQSxJQUFJLFlBQVksQ0FBQyxVQUFVLEtBQUssU0FBUztvQkFDckMsWUFBWSxDQUFDLFVBQVUsS0FBSyxTQUFTO0lBQ3JDLGdCQUFBLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxLQUFLLFNBQVM7SUFDdkMsZ0JBQUEsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLEtBQUssU0FBUztJQUN2QyxnQkFBQSxZQUFZLENBQUMsVUFBVSxDQUFDLENBQUMsS0FBSyxTQUFTO29CQUN2QyxZQUFZLENBQUMsWUFBWSxLQUFLLFNBQVM7b0JBQ3ZDLFlBQVksQ0FBQyxTQUFTLEtBQUssU0FBUztvQkFDcEMsWUFBWSxDQUFDLFNBQVMsS0FBSyxTQUFTO29CQUNwQyxZQUFZLENBQUMsY0FBYyxLQUFLLFNBQVM7b0JBQ3pDLFlBQVksQ0FBQyxLQUFLLEtBQUssU0FBUztJQUNoQyxnQkFBQSxZQUFZLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtvQkFDbkMsT0FBTztJQUNWLGFBQUE7SUFDRCxZQUFBLE1BQU0sY0FBYyxHQUFHLFlBQVksQ0FBQyxVQUFVLENBQUM7Z0JBQy9DLE1BQU0sVUFBVSxHQUFHLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2SCxZQUFBLE1BQU0sWUFBWSxHQUFHLFlBQVksQ0FBQyxZQUFZLENBQUM7SUFDL0MsWUFBQSxNQUFNLFNBQVMsR0FBRyxZQUFZLENBQUMsU0FBUyxDQUFDO0lBQ3pDLFlBQUEsTUFBTSxNQUFNLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQztnQkFDdEMsTUFBTSxTQUFTLEdBQWlCLEVBQUUsQ0FBQztnQkFDbkMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxhQUFrQixLQUFJO29CQUN2RCxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsY0FBYyxDQUFDLGFBQWEsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQy9ELGFBQUMsQ0FBQyxDQUFDO2dCQUNILE1BQU0sZUFBZSxHQUFvQixFQUFFLENBQUM7Z0JBQzVDLFlBQVksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBYyxLQUFJOztvQkFFMUMsU0FBUyxVQUFVLENBQUMsU0FBMEIsRUFBQTtJQUM1QyxvQkFBQSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDO3dCQUNsRCxJQUFJLEdBQUdBLGdCQUFLLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDOzs7d0JBR3BELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlDLG9CQUFBLE9BQU8sSUFBSSxDQUFDO3FCQUNmO0lBQ0QsZ0JBQUEsTUFBTSxjQUFjLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUM3QyxNQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDOztvQkFHakYsSUFBSSxDQUFDLGNBQWMsRUFBRTt3QkFDakIsT0FBTztJQUNWLGlCQUFBO0lBQ0QsZ0JBQUEsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQVMsS0FBSTtJQUNsQyxvQkFBQSxNQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFOzRCQUM1QyxNQUFNOzRCQUNOLGNBQWM7NEJBQ2QsVUFBVTs0QkFDVixZQUFZOzRCQUNaLFNBQVM7NEJBQ1QsU0FBUzs0QkFDVCxNQUFNO0lBQ1QscUJBQUEsQ0FBQyxDQUFDO0lBQ0gsb0JBQUEsZUFBZSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUNyQyxpQkFBQyxDQUFDLENBQUM7SUFDUCxhQUFDLENBQUMsQ0FBQztJQUNILFlBQUEsbUJBQW1CLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO0lBQzlDLFNBQUMsQ0FBQyxDQUFDO0lBQ0gsUUFBQSxPQUFPLG1CQUFtQixDQUFDO1NBQzlCO0lBRUM7Ozs7O0lBS0c7UUFDTyx5QkFBeUIsQ0FDakMsSUFBVSxFQUNWLHdCQUFzRCxFQUFBO0lBRXRELFFBQUEsTUFBTSxpQkFBaUIsR0FBRyx3QkFBd0IsQ0FBQyxjQUFjLENBQUM7WUFDbEUsSUFBSSxpQkFBaUIsS0FBSyxTQUFTO0lBQUUsWUFBQSxPQUFPLEVBQUUsQ0FBQztZQUUvQyxNQUFNLGNBQWMsR0FBaUMsRUFBRSxDQUFDO0lBQ3hELFFBQUEsaUJBQWlCLENBQUMsT0FBTyxDQUFDLENBQUMsYUFBa0IsS0FBSTtnQkFDL0MsSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLFNBQVMsSUFBSSxhQUFhLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRTtvQkFDM0UsT0FBTztJQUNWLGFBQUE7Z0JBRUQsU0FBUyxVQUFVLENBQUMsU0FBMEIsRUFBQTtJQUM1QyxnQkFBQSxJQUFJLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBSSxDQUFDO29CQUNsRCxJQUFJLEdBQUdBLGdCQUFLLENBQUMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDOzs7b0JBR3BELE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlDLGdCQUFBLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUNELE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFlLENBQUM7Z0JBRTFELE1BQU0sU0FBUyxHQUFpQixFQUFFLENBQUM7Z0JBQ25DLGFBQWEsQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBYSxLQUFJO0lBQzlDLGdCQUFBLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxTQUFTO0lBQzdCLG9CQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLFNBQVM7SUFDL0Isb0JBQUEsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssU0FBUztJQUMvQixvQkFBQSxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxTQUFTO0lBQy9CLG9CQUFBLFFBQVEsQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFO3dCQUMvQixPQUFPO0lBQ1YsaUJBQUE7b0JBQ0QsTUFBTSxNQUFNLEdBQUdLLE1BQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLGdCQUFBLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZFLGdCQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDdkIsZ0JBQUEsU0FBUyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztJQUNqQyxhQUFDLENBQUMsQ0FBQztJQUNILFlBQUEsTUFBTSxpQkFBaUIsR0FBRztvQkFDdEIsSUFBSSxFQUFFLGFBQWEsQ0FBQyxJQUFJO29CQUN4QixTQUFTO2lCQUNaLENBQUM7SUFDRixZQUFBLGNBQWMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztJQUMzQyxTQUFDLENBQUMsQ0FBQztJQUNILFFBQUEsT0FBTyxjQUFjLENBQUM7U0FDdkI7SUFFQzs7Ozs7SUFLRztRQUNPLG1CQUFtQixDQUFDLE1BQWMsRUFBRSxNQUFxQixFQUFBO1lBQ2pFLE1BQU0sWUFBWSxHQUFHLElBQUlMLGdCQUFLLENBQUMsSUFBSSxDQUFDLElBQUlBLGdCQUFLLENBQUMsb0JBQW9CLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0lBRXJHLFFBQUEsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7OztJQUluQyxRQUFBLFlBQVksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7OztJQUl4QyxRQUFBLFlBQVksQ0FBQyxRQUFRLENBQUMscUJBQXFCLEVBQUUsQ0FBQztJQUU5QyxRQUFBLE9BQU8sWUFBWSxDQUFDO1NBQ3JCO0lBQ0Y7O0lDaktEOztJQUVHO1VBQ1UsV0FBVyxDQUFBO0lBU3RCOzs7O0lBSUc7SUFDSCxJQUFBLFdBQUEsQ0FBbUIsVUFBOEIsRUFBRSxFQUFBO1lBQ2pELElBQUksQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLFlBQVksSUFBSSxJQUFJLGVBQWUsRUFBRSxDQUFDO1lBQ25FLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxPQUFPLENBQUMsa0JBQWtCLElBQUksSUFBSSxxQkFBcUIsRUFBRSxDQUFDO1lBQ3JGLElBQUksQ0FBQyxlQUFlLEdBQUcsT0FBTyxDQUFDLGNBQWMsSUFBSSxJQUFJLGlCQUFpQixFQUFFLENBQUM7WUFDekUsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDL0UsSUFBSSxDQUFDLG9CQUFvQixHQUFHLE9BQU8sQ0FBQyxtQkFBbUIsSUFBSSxJQUFJLHNCQUFzQixFQUFFLENBQUM7WUFDeEYsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixFQUFFLENBQUM7WUFDL0UsSUFBSSxDQUFDLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxrQkFBa0IsSUFBSSxJQUFJLHFCQUFxQixFQUFFLENBQUM7U0FDdEY7SUFFRDs7OztJQUlHO0lBQ1UsSUFBQSxNQUFNLENBQUMsSUFBVSxFQUFBOztnQkFDNUIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLEtBQUssU0FBUyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLEtBQUssU0FBUyxFQUFFO0lBQzlGLGdCQUFBLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQTBDLENBQUMsQ0FBQztJQUM3RCxhQUFBO0lBQ0QsWUFBQSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDO0lBRXpCLFlBQUEsS0FBSyxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDOzs7SUFJL0IsWUFBQSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxLQUFJO29CQUMxQixJQUFLLFFBQWdCLENBQUMsTUFBTSxFQUFFO0lBQzVCLG9CQUFBLFFBQVEsQ0FBQyxhQUFhLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLGlCQUFBO0lBQ0gsYUFBQyxDQUFDLENBQUM7SUFFSCxZQUFBLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7SUFFbEUsWUFBQSxNQUFNLFNBQVMsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztJQUV6RixZQUFBLE1BQU0sUUFBUSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztnQkFFMUUsTUFBTSxXQUFXLEdBQUcsUUFBUSxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxRQUFRLENBQUMsS0FBSyxTQUFTLEdBQUcsU0FBUyxDQUFDO0lBRWpILFlBQUEsTUFBTSxlQUFlLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO0lBRW5GLFlBQUEsTUFBTSxNQUFNLEdBQ1YsV0FBVyxJQUFJLGVBQWUsSUFBSSxRQUFRO0lBQ3hDLGtCQUFFLENBQUMsTUFBTSxJQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsS0FBSyxTQUFTO3NCQUM5RixTQUFTLENBQUM7SUFFaEIsWUFBQSxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztnQkFFckYsT0FBTyxJQUFJLEdBQUcsQ0FBQztvQkFDYixLQUFLLEVBQUUsSUFBSSxDQUFDLEtBQUs7b0JBQ2pCLElBQUk7b0JBQ0osU0FBUztvQkFDVCxRQUFRO29CQUNSLFdBQVc7b0JBQ1gsZUFBZTtvQkFDZixNQUFNO29CQUNOLGlCQUFpQjtJQUNsQixhQUFBLENBQUMsQ0FBQzthQUNKLENBQUEsQ0FBQTtJQUFBLEtBQUE7SUFDRjs7SUN0RUQ7OztJQUdHO1VBQ1UsR0FBRyxDQUFBO0lBNEVkOzs7O0lBSUc7SUFDSCxJQUFBLFdBQUEsQ0FBbUIsTUFBcUIsRUFBQTtJQUN0QyxRQUFBLElBQUksQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQztJQUMxQixRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsQ0FBQztJQUNoQyxRQUFBLElBQUksQ0FBQyxlQUFlLEdBQUcsTUFBTSxDQUFDLGVBQWUsQ0FBQztJQUM5QyxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQztJQUN0QyxRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUM1QixRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQztJQUNsQyxRQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUM7SUFDbEQsUUFBQSxJQUFJLENBQUMsSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7U0FDekI7SUF6RkQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQXFCRztJQUNJLElBQUEsT0FBYSxJQUFJLENBQUMsSUFBVSxFQUFFLFVBQThCLEVBQUUsRUFBQTs7SUFDbkUsWUFBQSxNQUFNLFFBQVEsR0FBRyxJQUFJLFdBQVcsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUMxQyxZQUFBLE9BQU8sTUFBTSxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3BDLENBQUEsQ0FBQTtJQUFBLEtBQUE7SUFrRUQ7Ozs7OztJQU1HO0lBQ0ksSUFBQSxNQUFNLENBQUMsS0FBYSxFQUFBO1lBQ3pCLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtJQUNmLFlBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDM0IsU0FBQTtZQUVELElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtJQUN4QixZQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLENBQUM7SUFDL0IsU0FBQTtZQUVELElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO0lBQzFCLFlBQUEsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMxQyxTQUFBO1lBRUQsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO2dCQUNsQixJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQWEsS0FBSTtvQkFDdkMsSUFBSSxRQUFRLENBQUMsa0JBQWtCLEVBQUU7SUFDL0Isb0JBQUEsUUFBUSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLGlCQUFBO0lBQ0gsYUFBQyxDQUFDLENBQUM7SUFDSixTQUFBO1NBQ0Y7SUFFRDs7SUFFRztRQUNJLE9BQU8sR0FBQTs7SUFDWixRQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7SUFDekIsUUFBQSxJQUFJLEtBQUssRUFBRTtnQkFDVCxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEIsU0FBQTtZQUVELENBQUEsRUFBQSxHQUFBLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxJQUFJLDBDQUFFLE9BQU8sTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBRSxPQUFPLEVBQUUsQ0FBQztTQUMvQjtJQUNGOztJQy9KRCxNQUFNLElBQUksR0FBRyxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRWpDLE1BQU0sT0FBTyxHQUFHLElBQUlBLGdCQUFLLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNsRSxNQUFNLFNBQVMsR0FBRyxJQUFJQSxnQkFBSyxDQUFDLGlCQUFpQixDQUFDLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUVBLGdCQUFLLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUMzRixNQUFNLE1BQU0sR0FBRyxJQUFJQSxnQkFBSyxDQUFDLElBQUksQ0FBQyxJQUFJQSxnQkFBSyxDQUFDLG1CQUFtQixDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUM5RSxNQUFNLE1BQU0sR0FBRyxJQUFJQSxnQkFBSyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ2pDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFFbkI7Ozs7OztJQU1HO0lBQ0csU0FBVSxvQkFBb0IsQ0FBQyxRQUE2QixFQUFFLEdBQVEsRUFBRSxJQUFJLEdBQUcsR0FBRyxFQUFBOzs7UUFFdEYsTUFBTSxPQUFPLEdBQUcsQ0FBQSxFQUFBLEdBQUEsR0FBRyxDQUFDLElBQUksTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBRSxPQUFPLENBQUM7UUFDbEMsSUFBSSxDQUFDLE9BQU8sRUFBRTtJQUNaLFFBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywwREFBMEQsQ0FBQyxDQUFDO0lBQzdFLEtBQUE7UUFFRCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUMsTUFBTSxDQUFDOztJQUc1QyxJQUFBLFFBQVEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDdkIsSUFBQSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ3pCLElBQUEsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQzs7UUFHMUIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDOztJQUdwQyxJQUFBLFNBQVMsQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDOztJQUd4QixJQUFBLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDOztJQUdqQyxJQUFBLFNBQVMsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDOztRQUdyQixJQUFJLE1BQU0sWUFBWSxlQUFlLEVBQUU7WUFDckMsT0FBTyxNQUFNLENBQUMsYUFBYSxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQUs7O2dCQUV6QyxRQUFRLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDakQsU0FBQyxDQUFDLENBQUM7SUFDSixLQUFBO1FBRUQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNLEtBQUk7SUFDckMsUUFBQSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxLQUFJOztnQkFFckIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUUvQyxJQUFJLElBQUksSUFBSSxJQUFJLEVBQUU7b0JBQ2hCLE1BQU0sQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO0lBQ3pELGFBQUE7SUFBTSxpQkFBQTtvQkFDTCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDZixhQUFBO0lBQ0gsU0FBQyxDQUFDLENBQUM7SUFDTCxLQUFDLENBQUMsQ0FBQztJQUNMOztJQzlEQTs7Ozs7O0lBTUc7SUFDRyxTQUFVLHVCQUF1QixDQUFDLElBQW9CLEVBQUE7O0lBRTFELElBQUEsTUFBTSxZQUFZLEdBQStDLElBQUksR0FBRyxFQUFFLENBQUM7O0lBRzNFLElBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsS0FBSTtJQUNwQixRQUFBLElBQUksR0FBRyxDQUFDLElBQUksS0FBSyxhQUFhLEVBQUU7Z0JBQzlCLE9BQU87SUFDUixTQUFBO1lBRUQsTUFBTSxJQUFJLEdBQUcsR0FBd0IsQ0FBQztJQUN0QyxRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7WUFDL0IsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQTBCLENBQUM7O1lBRzlFLElBQUksUUFBUSxHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFM0MsSUFBSSxDQUFDLFFBQVEsRUFBRTs7SUFFYixZQUFBLE1BQU0sS0FBSyxHQUFpQixFQUFFLENBQUM7SUFDL0IsWUFBQSxNQUFNLFlBQVksR0FBb0IsRUFBRSxDQUFDO0lBQ3pDLFlBQUEsTUFBTSxZQUFZLEdBQWdDLEVBQUUsQ0FBQzs7SUFHckQsWUFBQSxNQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsS0FBaUIsQ0FBQztJQUMxQyxZQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0lBQ3JDLGdCQUFBLE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQzs7SUFHdkIsZ0JBQUEsSUFBSSxZQUFZLENBQUMsS0FBSyxDQUFDLEtBQUssU0FBUyxFQUFFO0lBQ3JDLG9CQUFBLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0lBQ25DLG9CQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUN2QyxvQkFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDdEQsaUJBQUE7b0JBRUQsS0FBSyxDQUFDLENBQUMsQ0FBQyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxhQUFBOztJQUdELFlBQUEsU0FBUyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUMzQixZQUFBLFNBQVMsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDOztnQkFHN0IsUUFBUSxHQUFHLElBQUlBLGdCQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNuRCxZQUFBLFlBQVksQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ3ZDLFNBQUE7WUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7OztJQUczQyxLQUFDLENBQUMsQ0FBQztJQUNMOztJQ3pEQTs7Ozs7Ozs7O0lBU0c7SUFDRyxTQUFVLHlCQUF5QixDQUFDLElBQW9CLEVBQUE7SUFDNUQsSUFBQSxNQUFNLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBOEMsQ0FBQzs7SUFHMUUsSUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxLQUFJOztJQUNwQixRQUFBLElBQUksQ0FBRSxHQUFXLENBQUMsTUFBTSxFQUFFO2dCQUN4QixPQUFPO0lBQ1IsU0FBQTtZQUVELE1BQU0sSUFBSSxHQUFHLEdBQWlCLENBQUM7SUFDL0IsUUFBQSxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDOztJQUcvQixRQUFBLE1BQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUM7WUFDckMsSUFBSSxhQUFhLElBQUksSUFBSSxFQUFFO2dCQUN6QixPQUFPO0lBQ1IsU0FBQTs7WUFHRCxNQUFNLHlCQUF5QixHQUFHLFdBQVcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDNUQsSUFBSSx5QkFBeUIsSUFBSSxJQUFJLEVBQUU7SUFDckMsWUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLHlCQUF5QixDQUFDO2dCQUMxQyxPQUFPO0lBQ1IsU0FBQTtJQUVELFFBQUEsTUFBTSxXQUFXLEdBQUcsSUFBSUEsZ0JBQUssQ0FBQyxjQUFjLEVBQUUsQ0FBQzs7O0lBSS9DLFFBQUEsV0FBVyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDO0lBRWpDLFFBQUEsV0FBVyxDQUFDLG9CQUFvQixHQUFHLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQztZQUVqRSxRQUFRLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssS0FBSTtJQUNoQyxZQUFBLFdBQVcsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUN0RSxTQUFDLENBQUMsQ0FBQztJQUVILFFBQUEsV0FBVyxDQUFDLFdBQVcsR0FBRyxDQUFBLEVBQUEsR0FBQSxDQUFBLEVBQUEsR0FBQSxRQUFRLENBQUMsV0FBVyxNQUFFLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxDQUFBLEtBQUssRUFBRSxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsS0FBQSxDQUFBLEdBQUEsRUFBQSxHQUFJLElBQUksQ0FBQztJQUNoRSxRQUFBLFdBQVcsQ0FBQyxjQUFjLEdBQUcsQ0FBQSxFQUFBLEdBQUEsQ0FBQSxFQUFBLEdBQUEsUUFBUSxDQUFDLGNBQWMsTUFBRSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxLQUFLLEVBQUUsTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsR0FBSSxJQUFJLENBQUM7SUFFdEUsUUFBQSxXQUFXLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFN0UsUUFBQSxXQUFXLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUM7O0lBR3pDLFFBQUEsV0FBVyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7O1lBR3ZDLE1BQU0sd0JBQXdCLEdBQWEsRUFBRSxDQUFDOztZQUc5QyxNQUFNLHdCQUF3QixHQUFhLEVBQUUsQ0FBQzs7SUFHOUMsUUFBQTtJQUNFLFlBQUEsTUFBTSxrQkFBa0IsR0FBRyxhQUFhLENBQUMsS0FBSyxDQUFDO2dCQUMvQyxNQUFNLGFBQWEsR0FBRyxJQUFLLGtCQUFrQixDQUFDLFdBQW1CLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBRTdGLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztJQUVsQixZQUFBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDbEQsZ0JBQUEsTUFBTSxhQUFhLEdBQUcsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFFNUMsZ0JBQUEsSUFBSSxRQUFRLEdBQUcsd0JBQXdCLENBQUMsYUFBYSxDQUFDLENBQUM7b0JBQ3ZELElBQUksUUFBUSxJQUFJLElBQUksRUFBRTtJQUNwQixvQkFBQSx3QkFBd0IsQ0FBQyxhQUFhLENBQUMsR0FBRyxTQUFTLENBQUM7SUFDcEQsb0JBQUEsd0JBQXdCLENBQUMsU0FBUyxDQUFDLEdBQUcsYUFBYSxDQUFDO3dCQUNwRCxRQUFRLEdBQUcsU0FBUyxDQUFDO0lBQ3JCLG9CQUFBLFNBQVMsRUFBRSxDQUFDO0lBQ2IsaUJBQUE7SUFDRCxnQkFBQSxhQUFhLENBQUMsQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDO0lBQzdCLGFBQUE7SUFFRCxZQUFBLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSWtCLHFCQUFlLENBQUMsYUFBYSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQ3BFLFNBQUE7O0lBR0QsUUFBQSxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxhQUFhLEtBQUk7Z0JBQ3pELE1BQU0saUJBQWlCLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQTBCLENBQUM7Z0JBRXRGLElBQUssaUJBQXlCLENBQUMsNEJBQTRCLEVBQUU7SUFDM0QsZ0JBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQyx3RUFBd0UsQ0FBQyxDQUFDO0lBQzNGLGFBQUE7SUFFRCxZQUFBLE1BQU0sc0JBQXNCLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxDQUFDO0lBQ3ZELFlBQUEsTUFBTSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsR0FBRyxpQkFBaUIsQ0FBQztJQUVuRCxZQUFBLE1BQU0saUJBQWlCLEdBQUcsSUFBSyxzQkFBc0IsQ0FBQyxXQUFtQixDQUN2RSx3QkFBd0IsQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUMzQyxDQUFDO2dCQUVGLHdCQUF3QixDQUFDLE9BQU8sQ0FBQyxDQUFDLGFBQWEsRUFBRSxDQUFDLEtBQUk7b0JBQ3BELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLEVBQUUsQ0FBQyxFQUFFLEVBQUU7SUFDakMsb0JBQUEsaUJBQWlCLENBQUMsQ0FBQyxHQUFHLFFBQVEsR0FBRyxDQUFDLENBQUMsR0FBRyxzQkFBc0IsQ0FBQyxhQUFhLEdBQUcsUUFBUSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVGLGlCQUFBO0lBQ0gsYUFBQyxDQUFDLENBQUM7SUFFSCxZQUFBLFdBQVcsQ0FBQyxZQUFZLENBQUMsYUFBYSxFQUFFLElBQUlBLHFCQUFlLENBQUMsaUJBQWlCLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7SUFDeEcsU0FBQyxDQUFDLENBQUM7OztZQUlILElBQUksV0FBVyxHQUFHLElBQUksQ0FBQztJQUV2QixRQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGFBQWEsS0FBSTtJQUM5RCxZQUFBLFdBQVcsQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUVoRCxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3ZELFlBQUEsS0FBSyxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUUsTUFBTSxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLEVBQUU7SUFDckQsZ0JBQUEsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUEwQixDQUFDO29CQUVsRSxJQUFLLGlCQUF5QixDQUFDLDRCQUE0QixFQUFFO0lBQzNELG9CQUFBLE1BQU0sSUFBSSxLQUFLLENBQUMsd0VBQXdFLENBQUMsQ0FBQztJQUMzRixpQkFBQTtJQUVELGdCQUFBLE1BQU0sc0JBQXNCLEdBQUcsaUJBQWlCLENBQUMsS0FBSyxDQUFDO0lBQ3ZELGdCQUFBLE1BQU0sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEdBQUcsaUJBQWlCLENBQUM7SUFFbkQsZ0JBQUEsTUFBTSxpQkFBaUIsR0FBRyxJQUFLLHNCQUFzQixDQUFDLFdBQW1CLENBQ3ZFLHdCQUF3QixDQUFDLE1BQU0sR0FBRyxRQUFRLENBQzNDLENBQUM7b0JBRUYsd0JBQXdCLENBQUMsT0FBTyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsS0FBSTt3QkFDcEQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFFBQVEsRUFBRSxDQUFDLEVBQUUsRUFBRTtJQUNqQyx3QkFBQSxpQkFBaUIsQ0FBQyxDQUFDLEdBQUcsUUFBUSxHQUFHLENBQUMsQ0FBQyxHQUFHLHNCQUFzQixDQUFDLGFBQWEsR0FBRyxRQUFRLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDNUYscUJBQUE7SUFDSCxpQkFBQyxDQUFDLENBQUM7SUFFSCxnQkFBQSxXQUFXLEdBQUcsV0FBVyxJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQVMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFFN0UsZ0JBQUEsV0FBVyxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJQSxxQkFBZSxDQUN0RSxpQkFBaUIsRUFDakIsUUFBUSxFQUNSLFVBQVUsQ0FDWCxDQUFDO0lBQ0gsYUFBQTtJQUNILFNBQUMsQ0FBQyxDQUFDOztJQUdILFFBQUEsSUFBSSxXQUFXLEVBQUU7SUFDZixZQUFBLFdBQVcsQ0FBQyxlQUFlLEdBQUcsRUFBRSxDQUFDO0lBQ2xDLFNBQUE7SUFFRCxRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsV0FBVyxDQUFDO0lBQzlCLEtBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGdCQUFnQixLQUFJO1lBQzFELGdCQUFnQixDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQzdCLEtBQUMsQ0FBQyxDQUFDO0lBQ0w7O1VDOUphLFFBQVEsQ0FBQTtJQUNuQixJQUFBLFdBQUEsR0FBQTs7U0FFQzs7SUFFYSxRQUFvQixDQUFBLG9CQUFBLEdBQUcsb0JBQW9CLENBQUM7SUFDNUMsUUFBdUIsQ0FBQSx1QkFBQSxHQUFHLHVCQUF1QixDQUFDO0lBQ2xELFFBQXlCLENBQUEseUJBQUEsR0FBRyx5QkFBeUI7O0lDUHJFLE1BQU0sR0FBRyxHQUFHLElBQUlsQixnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRTFCLE1BQU8sa0JBQW1CLFNBQVEsYUFBYSxDQUFBO1FBRzVDLFdBQVcsQ0FBQyxLQUFxQixFQUFFLFdBQTRCLEVBQUE7SUFDcEUsUUFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLDBCQUEwQixFQUFFO0lBQzNDLFlBQUEsSUFBSSxDQUFDLG9CQUFvQixHQUFHLElBQUlBLGdCQUFLLENBQUMsV0FBVyxDQUMvQyxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQzNCLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQzFCLEdBQUcsRUFDSCxRQUFRLENBQ1QsQ0FBQztJQUNGLFlBQUEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztJQUN0QyxTQUFBO1NBQ0Y7SUFFTSxJQUFBLE1BQU0sQ0FBQyxLQUFhLEVBQUE7SUFDekIsUUFBQSxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXBCLElBQUksSUFBSSxDQUFDLG9CQUFvQixFQUFFO2dCQUM3QixJQUFJLENBQUMsV0FBVyxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqRixZQUFBLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDM0UsU0FBQTtTQUNGO0lBQ0Y7O0lDcEJLLE1BQU8sc0JBQXVCLFNBQVEsaUJBQWlCLENBQUE7SUFDcEQsSUFBQSxNQUFNLENBQ1gsSUFBVSxFQUNWLFdBQTJCLEVBQzNCLGVBQW1DLEVBQ25DLFFBQXFCLEVBQUE7O0lBRXJCLFFBQUEsTUFBTSxNQUFNLEdBQThCLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBRSxJQUFBLElBQUEsRUFBQSxLQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQUEsQ0FBQSxHQUFBLEVBQUEsQ0FBQSxHQUFHLENBQUM7WUFDM0UsSUFBSSxDQUFDLE1BQU0sRUFBRTtJQUNYLFlBQUEsT0FBTyxJQUFJLENBQUM7SUFDYixTQUFBO0lBRUQsUUFBQSxNQUFNLGlCQUFpQixHQUFzQyxNQUFNLENBQUMsV0FBVyxDQUFDO1lBQ2hGLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtJQUN0QixZQUFBLE9BQU8sSUFBSSxDQUFDO0lBQ2IsU0FBQTtJQUVELFFBQUEsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxpQkFBaUIsRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDbEYsT0FBTyxJQUFJLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxPQUFPLElBQUksU0FBUyxDQUFDLENBQUM7U0FDbEU7SUFDRjs7SUN2QkQsTUFBTSxzQkFBc0IsR0FBRyxJQUFJQSxnQkFBSyxDQUFDLGlCQUFpQixDQUFDO0lBQ3pELElBQUEsS0FBSyxFQUFFLFFBQVE7SUFDZixJQUFBLFNBQVMsRUFBRSxJQUFJO0lBQ2YsSUFBQSxXQUFXLEVBQUUsSUFBSTtJQUNqQixJQUFBLFNBQVMsRUFBRSxLQUFLO0lBQ2pCLENBQUEsQ0FBQyxDQUFDO0lBT0csTUFBTyx5QkFBMEIsU0FBUSxvQkFBb0IsQ0FBQTtRQUMxRCxXQUFXLENBQUMsS0FBcUIsRUFBRSxXQUE0QixFQUFBO1lBQ3BFLElBQUksV0FBVyxDQUFDLHVCQUF1QjtnQkFBRSxPQUFPO1lBRWhELElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxlQUFlLEtBQUk7SUFDbkQsWUFBQSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBVSxLQUFJO29CQUNyQyxJQUFLLFVBQWtCLENBQUMsUUFBUSxFQUFFO0lBQ2hDLG9CQUFBLE1BQU0sS0FBSyxHQUFJLFVBQWlDLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDNUQsb0JBQUEsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNsQixpQkFBQTtJQUNILGFBQUMsQ0FBQyxDQUFDO0lBQ0wsU0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDLGFBQWEsS0FBSTtnQkFDNUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLEtBQUk7SUFDM0MsZ0JBQUEsUUFBUSxDQUFDLFFBQVEsR0FBRyxzQkFBc0IsQ0FBQztJQUMzQyxnQkFBQSxRQUFRLENBQUMsV0FBVyxHQUFHLHNCQUFzQixDQUFDO0lBQ2hELGFBQUMsQ0FBQyxDQUFDO0lBQ0wsU0FBQyxDQUFDLENBQUM7U0FDSjtJQUNGOztJQ2pDRCxNQUFNLElBQUksR0FBRyxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRTNCLE1BQU8sa0JBQW1CLFNBQVEsYUFBYSxDQUFBO1FBR25ELFdBQVksQ0FBQSxJQUFvQixFQUFFLE1BQStCLEVBQUE7SUFDL0QsUUFBQSxLQUFLLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1NBQ3JCO0lBRUQ7OztJQUdHO1FBQ0ksUUFBUSxHQUFBOztZQUViLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtnQkFDZixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7SUFDcEIsU0FBQTtJQUVELFFBQUEsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDbEYsUUFBQSxNQUFNLHNCQUFzQixHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDO0lBRXpELFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJQSxnQkFBSyxDQUFDLFdBQVcsQ0FDakMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLEVBQzVCLElBQUksQ0FBQyxvQkFBb0IsRUFDekIsc0JBQXNCLEVBQ3RCLFFBQVEsRUFDUixJQUFJLENBQUMsTUFBTSxFQUNYLElBQUksQ0FBQyxNQUFNLENBQ1osQ0FBQzs7WUFHRixJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxXQUFXLEdBQUcsc0JBQXNCLENBQUM7WUFDdEQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxHQUFHLHNCQUFzQixDQUFDO1lBQ3JELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQTJCLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUMvRCxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUEyQixDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFDaEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBMkIsQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQy9ELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQTJCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztZQUVqRSxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7U0FDcEI7SUFFTSxJQUFBLE1BQU0sQ0FBQyxLQUFhLEVBQUE7SUFDekIsUUFBQSxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDOztZQUVwQixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7U0FDckI7UUFFTyxZQUFZLEdBQUE7SUFDbEIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtnQkFDaEIsT0FBTztJQUNSLFNBQUE7SUFFRCxRQUFBLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0lBQ3JGLFFBQUEsTUFBTSxzQkFBc0IsR0FBRyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUV6RCxJQUFJLENBQUMsTUFBTSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO0lBQ3ZELFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDeEUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ3REO0lBQ0Y7O0lDekRLLE1BQU8sMEJBQTJCLFNBQVEscUJBQXFCLENBQUE7SUFDNUQsSUFBQSxNQUFNLENBQUMsSUFBVSxFQUFBOztJQUN0QixRQUFBLE1BQU0sTUFBTSxHQUE4QixDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLE1BQUUsSUFBQSxJQUFBLEVBQUEsS0FBQSxLQUFBLENBQUEsR0FBQSxLQUFBLENBQUEsR0FBQSxFQUFBLENBQUEsR0FBRyxDQUFDO0lBQzNFLFFBQUEsSUFBSSxDQUFDLE1BQU07SUFBRSxZQUFBLE9BQU8sSUFBSSxDQUFDO0lBRXpCLFFBQUEsTUFBTSx3QkFBd0IsR0FBNkMsTUFBTSxDQUFDLGtCQUFrQixDQUFDO0lBQ3JHLFFBQUEsSUFBSSxDQUFDLHdCQUF3QjtJQUFFLFlBQUEsT0FBTyxJQUFJLENBQUM7O1lBRzNDLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLENBQUMsQ0FBQzs7O0lBSXRGLFFBQUEsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxFQUFFLHdCQUF3QixFQUFFLGNBQWMsQ0FBQyxDQUFDO0lBRTVHLFFBQUEsT0FBTyxJQUFJLHlCQUF5QixDQUFDLGNBQWMsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1NBQzNFO1FBRVMsaUJBQWlCLENBQUMsSUFBb0IsRUFBRSxNQUErQixFQUFBO0lBQy9FLFFBQUEsT0FBTyxJQUFJLGtCQUFrQixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztTQUM3QztJQUNGOztJQ3BCRDs7SUFFRztJQUNHLE1BQU8sZ0JBQWlCLFNBQVEsV0FBVyxDQUFBO0lBQy9DLElBQUEsV0FBQSxDQUFtQixVQUE4QixFQUFFLEVBQUE7WUFDakQsT0FBTyxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxJQUFJLElBQUksc0JBQXNCLEVBQUUsQ0FBQztZQUNoRixPQUFPLENBQUMsa0JBQWtCLEdBQUcsT0FBTyxDQUFDLGtCQUFrQixJQUFJLElBQUksMEJBQTBCLEVBQUUsQ0FBQztZQUM1RixLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7U0FDaEI7SUFFWSxJQUFBLE1BQU0sQ0FBQyxJQUFVLEVBQUUsWUFBQSxHQUFnQyxFQUFFLEVBQUE7O2dCQUNoRSxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsS0FBSyxTQUFTLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsS0FBSyxTQUFTLEVBQUU7SUFDOUYsZ0JBQUEsTUFBTSxJQUFJLEtBQUssQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO0lBQzdELGFBQUE7SUFDRCxZQUFBLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7SUFFekIsWUFBQSxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7OztJQUkvQixZQUFBLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxRQUFRLEtBQUk7b0JBQzFCLElBQUssUUFBZ0IsQ0FBQyxNQUFNLEVBQUU7SUFDNUIsb0JBQUEsUUFBUSxDQUFDLGFBQWEsR0FBRyxLQUFLLENBQUM7SUFDaEMsaUJBQUE7SUFDSCxhQUFDLENBQUMsQ0FBQztJQUVILFlBQUEsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztJQUVsRSxZQUFBLE1BQU0sU0FBUyxHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsaUJBQWlCLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO0lBRXpGLFlBQUEsTUFBTSxRQUFRLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssU0FBUyxDQUFDO2dCQUUxRSxNQUFNLFdBQVcsR0FBRyxRQUFRLEdBQUcsQ0FBQyxNQUFNLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxLQUFLLFNBQVMsR0FBRyxTQUFTLENBQUM7SUFFakgsWUFBQSxNQUFNLGVBQWUsR0FBRyxDQUFDLE1BQU0sSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxTQUFTLENBQUM7SUFFbkYsWUFBQSxNQUFNLE1BQU0sR0FDVixXQUFXLElBQUksZUFBZSxJQUFJLFFBQVE7SUFDeEMsa0JBQUUsQ0FBQyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQyxLQUFLLFNBQVM7c0JBQzlGLFNBQVMsQ0FBQztnQkFDaEIsSUFBSyxNQUFjLENBQUMsV0FBVyxFQUFFO0lBQzlCLGdCQUFBLE1BQTZCLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNqRSxhQUFBO0lBRUQsWUFBQSxNQUFNLGlCQUFpQixHQUFHLENBQUMsTUFBTSxJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLFNBQVMsQ0FBQztnQkFDckYsSUFBSyxpQkFBeUIsQ0FBQyxXQUFXLEVBQUU7SUFDekMsZ0JBQUEsaUJBQStDLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNuRixhQUFBO2dCQUVELE9BQU8sSUFBSSxRQUFRLENBQ2pCO29CQUNFLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSztvQkFDakIsSUFBSTtvQkFDSixTQUFTO29CQUNULFFBQVE7b0JBQ1IsV0FBVztvQkFDWCxlQUFlO29CQUNmLE1BQU07b0JBQ04saUJBQWlCO2lCQUNsQixFQUNELFlBQVksQ0FDYixDQUFDO2FBQ0gsQ0FBQSxDQUFBO0lBQUEsS0FBQTtJQUNGOztBQ2pFTSxVQUFNLHNCQUFzQixHQUFHLE1BQU07SUFFNUM7O0lBRUc7SUFDRyxNQUFPLFFBQVMsU0FBUSxHQUFHLENBQUE7SUFDL0I7Ozs7Ozs7O0lBUUc7UUFDSSxPQUFhLElBQUksQ0FDdEIsSUFBVSxFQUNWLE9BQThCLEdBQUEsRUFBRSxFQUNoQyxXQUFBLEdBQStCLEVBQUUsRUFBQTs7SUFFakMsWUFBQSxNQUFNLFFBQVEsR0FBRyxJQUFJLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUMvQyxPQUFPLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO2FBQzNDLENBQUEsQ0FBQTtJQUFBLEtBQUE7SUFFRDs7Ozs7SUFLRztRQUNILFdBQVksQ0FBQSxNQUFxQixFQUFFLFdBQUEsR0FBK0IsRUFBRSxFQUFBO1lBQ2xFLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQzs7SUFHZCxRQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsZ0JBQWdCLEVBQUU7SUFDakMsWUFBQSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJQSxnQkFBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNqRCxTQUFBO0lBRUQsUUFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLHFCQUFxQixFQUFFO0lBQ3RDLFlBQUEsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSUEsZ0JBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDdEQsU0FBQTtTQUNGO0lBRU0sSUFBQSxNQUFNLENBQUMsS0FBYSxFQUFBO0lBQ3pCLFFBQUEsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztTQUNyQjtJQUNGOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyJ9
