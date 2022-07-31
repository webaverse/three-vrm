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

    /* tslint:disable:member-ordering */
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

    class Matrix4InverseCache {
        constructor(matrix) {
            /**
             * A cache of inverse of current matrix.
             */
            this._inverseCache = new THREE__namespace.Matrix4();
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
                    const gravityDir = new THREE__namespace.Vector3(vrmBoneGroup.gravityDir.x, vrmBoneGroup.gravityDir.y, -vrmBoneGroup.gravityDir.z);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLmpzIiwic291cmNlcyI6WyIuLi9ub2RlX21vZHVsZXMvdHNsaWIvdHNsaWIuZXM2LmpzIiwiLi4vc3JjL3V0aWxzL2Rpc3Bvc2VyLnRzIiwiLi4vc3JjL2JsZW5kc2hhcGUvVlJNQmxlbmRTaGFwZUdyb3VwLnRzIiwiLi4vc3JjL3R5cGVzL1ZSTVNjaGVtYS50cyIsIi4uL3NyYy91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZS50cyIsIi4uL3NyYy91dGlscy9yZW5hbWVNYXRlcmlhbFByb3BlcnR5LnRzIiwiLi4vc3JjL3V0aWxzL21hdGgudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlUHJveHkudHMiLCIuLi9zcmMvYmxlbmRzaGFwZS9WUk1CbGVuZFNoYXBlSW1wb3J0ZXIudHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb24udHMiLCIuLi9zcmMvZmlyc3RwZXJzb24vVlJNRmlyc3RQZXJzb25JbXBvcnRlci50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmUudHMiLCIuLi9zcmMvdXRpbHMvcXVhdEludmVydENvbXBhdC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZEltcG9ydGVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1DdXJ2ZU1hcHBlci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QXBwbHllci50cyIsIi4uL3NyYy9sb29rYXQvVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXIudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEhlYWQudHMiLCIuLi9zcmMvbG9va2F0L1ZSTUxvb2tBdEJvbmVBcHBseWVyLnRzIiwiLi4vc3JjL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlci50cyIsIi4uL3NyYy9tYXRlcmlhbC9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24udHMiLCIuLi9zcmMvbWF0ZXJpYWwvTVRvb25NYXRlcmlhbC50cyIsIi4uL3NyYy9tYXRlcmlhbC9WUk1VbmxpdE1hdGVyaWFsLnRzIiwiLi4vc3JjL21hdGVyaWFsL1ZSTU1hdGVyaWFsSW1wb3J0ZXIudHMiLCIuLi9zcmMvbWV0YS9WUk1NZXRhSW1wb3J0ZXIudHMiLCIuLi9zcmMvdXRpbHMvbWF0NEludmVydENvbXBhdC50cyIsIi4uL3NyYy91dGlscy9NYXRyaXg0SW52ZXJzZUNhY2hlLnRzIiwiLi4vc3JjL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZS50cyIsIi4uL3NyYy9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyLnRzIiwiLi4vc3JjL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZUltcG9ydGVyLnRzIiwiLi4vc3JjL1ZSTUltcG9ydGVyLnRzIiwiLi4vc3JjL1ZSTS50cyIsIi4uL3NyYy9WUk1VdGlscy9leHRyYWN0VGh1bWJuYWlsQmxvYi50cyIsIi4uL3NyYy9WUk1VdGlscy9yZW1vdmVVbm5lY2Vzc2FyeUpvaW50cy50cyIsIi4uL3NyYy9WUk1VdGlscy9yZW1vdmVVbm5lY2Vzc2FyeVZlcnRpY2VzLnRzIiwiLi4vc3JjL1ZSTVV0aWxzL2luZGV4LnRzIiwiLi4vc3JjL2RlYnVnL1ZSTUxvb2tBdEhlYWREZWJ1Zy50cyIsIi4uL3NyYy9kZWJ1Zy9WUk1Mb29rQXRJbXBvcnRlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcudHMiLCIuLi9zcmMvZGVidWcvVlJNU3ByaW5nQm9uZURlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTVNwcmluZ0JvbmVJbXBvcnRlckRlYnVnLnRzIiwiLi4vc3JjL2RlYnVnL1ZSTUltcG9ydGVyRGVidWcudHMiLCIuLi9zcmMvZGVidWcvVlJNRGVidWcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaWYgKGdbbl0pIGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBuID09PSBcInJldHVyblwiIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrIGluIG1vZCkgaWYgKGsgIT09IFwiZGVmYXVsdFwiICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtb2QsIGspKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGspO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgc3RhdGUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIGdldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHJlYWQgcHJpdmF0ZSBtZW1iZXIgZnJvbSBhbiBvYmplY3Qgd2hvc2UgY2xhc3MgZGlkIG5vdCBkZWNsYXJlIGl0XCIpO1xyXG4gICAgcmV0dXJuIGtpbmQgPT09IFwibVwiID8gZiA6IGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyKSA6IGYgPyBmLnZhbHVlIDogc3RhdGUuZ2V0KHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRTZXQocmVjZWl2ZXIsIHN0YXRlLCB2YWx1ZSwga2luZCwgZikge1xyXG4gICAgaWYgKGtpbmQgPT09IFwibVwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBtZXRob2QgaXMgbm90IHdyaXRhYmxlXCIpO1xyXG4gICAgaWYgKGtpbmQgPT09IFwiYVwiICYmICFmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiUHJpdmF0ZSBhY2Nlc3NvciB3YXMgZGVmaW5lZCB3aXRob3V0IGEgc2V0dGVyXCIpO1xyXG4gICAgaWYgKHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgIT09IHN0YXRlIHx8ICFmIDogIXN0YXRlLmhhcyhyZWNlaXZlcikpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3Qgd3JpdGUgcHJpdmF0ZSBtZW1iZXIgdG8gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiAoa2luZCA9PT0gXCJhXCIgPyBmLmNhbGwocmVjZWl2ZXIsIHZhbHVlKSA6IGYgPyBmLnZhbHVlID0gdmFsdWUgOiBzdGF0ZS5zZXQocmVjZWl2ZXIsIHZhbHVlKSksIHZhbHVlO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEluKHN0YXRlLCByZWNlaXZlcikge1xyXG4gICAgaWYgKHJlY2VpdmVyID09PSBudWxsIHx8ICh0eXBlb2YgcmVjZWl2ZXIgIT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHJlY2VpdmVyICE9PSBcImZ1bmN0aW9uXCIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHVzZSAnaW4nIG9wZXJhdG9yIG9uIG5vbi1vYmplY3RcIik7XHJcbiAgICByZXR1cm4gdHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciA9PT0gc3RhdGUgOiBzdGF0ZS5oYXMocmVjZWl2ZXIpO1xyXG59XHJcbiIsIi8vIFNlZTogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNtYW51YWwvZW4vaW50cm9kdWN0aW9uL0hvdy10by1kaXNwb3NlLW9mLW9iamVjdHNcblxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG5mdW5jdGlvbiBkaXNwb3NlTWF0ZXJpYWwobWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsKTogdm9pZCB7XG4gIE9iamVjdC5rZXlzKG1hdGVyaWFsKS5mb3JFYWNoKChwcm9wZXJ0eU5hbWUpID0+IHtcbiAgICBjb25zdCB2YWx1ZSA9IChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV07XG4gICAgaWYgKHZhbHVlPy5pc1RleHR1cmUpIHtcbiAgICAgIGNvbnN0IHRleHR1cmUgPSB2YWx1ZSBhcyBUSFJFRS5UZXh0dXJlO1xuICAgICAgdGV4dHVyZS5kaXNwb3NlKCk7XG4gICAgfVxuICB9KTtcblxuICBtYXRlcmlhbC5kaXNwb3NlKCk7XG59XG5cbmZ1bmN0aW9uIGRpc3Bvc2Uob2JqZWN0M0Q6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gIGNvbnN0IGdlb21ldHJ5OiBUSFJFRS5CdWZmZXJHZW9tZXRyeSB8IHVuZGVmaW5lZCA9IChvYmplY3QzRCBhcyBhbnkpLmdlb21ldHJ5O1xuICBpZiAoZ2VvbWV0cnkpIHtcbiAgICBnZW9tZXRyeS5kaXNwb3NlKCk7XG4gIH1cblxuICBjb25zdCBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwgfCBUSFJFRS5NYXRlcmlhbFtdID0gKG9iamVjdDNEIGFzIGFueSkubWF0ZXJpYWw7XG4gIGlmIChtYXRlcmlhbCkge1xuICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGVyaWFsKSkge1xuICAgICAgbWF0ZXJpYWwuZm9yRWFjaCgobWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsKSA9PiBkaXNwb3NlTWF0ZXJpYWwobWF0ZXJpYWwpKTtcbiAgICB9IGVsc2UgaWYgKG1hdGVyaWFsKSB7XG4gICAgICBkaXNwb3NlTWF0ZXJpYWwobWF0ZXJpYWwpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVlcERpc3Bvc2Uob2JqZWN0M0Q6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gIG9iamVjdDNELnRyYXZlcnNlKGRpc3Bvc2UpO1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURlByaW1pdGl2ZSB9IGZyb20gJy4uL3R5cGVzJztcblxuZXhwb3J0IGludGVyZmFjZSBWUk1CbGVuZFNoYXBlQmluZCB7XG4gIG1lc2hlczogR0xURlByaW1pdGl2ZVtdO1xuICBtb3JwaFRhcmdldEluZGV4OiBudW1iZXI7XG4gIHdlaWdodDogbnVtYmVyO1xufVxuXG5lbnVtIFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZSB7XG4gIE5VTUJFUixcbiAgVkVDVE9SMixcbiAgVkVDVE9SMyxcbiAgVkVDVE9SNCxcbiAgQ09MT1IsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWUge1xuICBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XG4gIHByb3BlcnR5TmFtZTogc3RyaW5nO1xuICBkZWZhdWx0VmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICB0YXJnZXRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG4gIGRlbHRhVmFsdWU6IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yOyAvLyB0YXJnZXRWYWx1ZSAtIGRlZmF1bHRWYWx1ZVxuICB0eXBlOiBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGU7XG59XG5cbmNvbnN0IF92MiA9IG5ldyBUSFJFRS5WZWN0b3IyKCk7XG5jb25zdCBfdjMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3Y0ID0gbmV3IFRIUkVFLlZlY3RvcjQoKTtcbmNvbnN0IF9jb2xvciA9IG5ldyBUSFJFRS5Db2xvcigpO1xuXG4vLyBhbmltYXRpb25NaXhlciDjga7nm6Poppblr77osaHjga/jgIFTY2VuZSDjga7kuK3jgavlhaXjgaPjgabjgYTjgovlv4XopoHjgYzjgYLjgovjgIJcbi8vIOOBneOBruOBn+OCgeOAgeihqOekuuOCquODluOCuOOCp+OCr+ODiOOBp+OBr+OBquOBhOOBkeOCjOOBqeOAgU9iamVjdDNEIOOCkue2meaJv+OBl+OBpiBTY2VuZSDjgavmipXlhaXjgafjgY3jgovjgojjgYbjgavjgZnjgovjgIJcbmV4cG9ydCBjbGFzcyBWUk1CbGVuZFNoYXBlR3JvdXAgZXh0ZW5kcyBUSFJFRS5PYmplY3QzRCB7XG4gIHB1YmxpYyB3ZWlnaHQgPSAwLjA7XG4gIHB1YmxpYyBpc0JpbmFyeSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgX2JpbmRzOiBWUk1CbGVuZFNoYXBlQmluZFtdID0gW107XG4gIHByaXZhdGUgX21hdGVyaWFsVmFsdWVzOiBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVtdID0gW107XG5cbiAgY29uc3RydWN0b3IoZXhwcmVzc2lvbk5hbWU6IHN0cmluZykge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5uYW1lID0gYEJsZW5kU2hhcGVDb250cm9sbGVyXyR7ZXhwcmVzc2lvbk5hbWV9YDtcblxuICAgIC8vIHRyYXZlcnNlIOaZguOBruaVkea4iOaJi+auteOBqOOBl+OBpiBPYmplY3QzRCDjgafjga/jgarjgYTjgZPjgajjgpLmmI7npLrjgZfjgabjgYrjgY9cbiAgICB0aGlzLnR5cGUgPSAnQmxlbmRTaGFwZUNvbnRyb2xsZXInO1xuICAgIC8vIOihqOekuuebrueahOOBruOCquODluOCuOOCp+OCr+ODiOOBp+OBr+OBquOBhOOBruOBp+OAgeiyoOiNt+i7vea4m+OBruOBn+OCgeOBqyB2aXNpYmxlIOOCkiBmYWxzZSDjgavjgZfjgabjgYrjgY/jgIJcbiAgICAvLyDjgZPjgozjgavjgojjgorjgIHjgZPjga7jgqTjg7Pjgrnjgr/jg7Pjgrnjgavlr77jgZnjgovmr47jg5Xjg6zjg7zjg6Djga4gbWF0cml4IOiHquWLleioiOeul+OCkuecgeeVpeOBp+OBjeOCi+OAglxuICAgIHRoaXMudmlzaWJsZSA9IGZhbHNlO1xuICB9XG5cbiAgcHVibGljIGFkZEJpbmQoYXJnczogeyBtZXNoZXM6IEdMVEZQcmltaXRpdmVbXTsgbW9ycGhUYXJnZXRJbmRleDogbnVtYmVyOyB3ZWlnaHQ6IG51bWJlciB9KTogdm9pZCB7XG4gICAgLy8gb3JpZ2luYWwgd2VpZ2h0IGlzIDAtMTAwIGJ1dCB3ZSB3YW50IHRvIGRlYWwgd2l0aCB0aGlzIHZhbHVlIHdpdGhpbiAwLTFcbiAgICBjb25zdCB3ZWlnaHQgPSBhcmdzLndlaWdodCAvIDEwMDtcblxuICAgIHRoaXMuX2JpbmRzLnB1c2goe1xuICAgICAgbWVzaGVzOiBhcmdzLm1lc2hlcyxcbiAgICAgIG1vcnBoVGFyZ2V0SW5kZXg6IGFyZ3MubW9ycGhUYXJnZXRJbmRleCxcbiAgICAgIHdlaWdodCxcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBhZGRNYXRlcmlhbFZhbHVlKGFyZ3M6IHtcbiAgICBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XG4gICAgcHJvcGVydHlOYW1lOiBzdHJpbmc7XG4gICAgdGFyZ2V0VmFsdWU6IG51bWJlcltdO1xuICAgIGRlZmF1bHRWYWx1ZT86IG51bWJlciB8IFRIUkVFLlZlY3RvcjIgfCBUSFJFRS5WZWN0b3IzIHwgVEhSRUUuVmVjdG9yNCB8IFRIUkVFLkNvbG9yO1xuICB9KTogdm9pZCB7XG4gICAgY29uc3QgbWF0ZXJpYWwgPSBhcmdzLm1hdGVyaWFsO1xuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IGFyZ3MucHJvcGVydHlOYW1lO1xuXG4gICAgbGV0IHZhbHVlID0gKG1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXTtcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICAvLyBwcm9wZXJ0eSBoYXMgbm90IGJlZW4gZm91bmRcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFsdWUgPSBhcmdzLmRlZmF1bHRWYWx1ZSB8fCB2YWx1ZTtcblxuICAgIGxldCB0eXBlOiBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGU7XG4gICAgbGV0IGRlZmF1bHRWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG4gICAgbGV0IHRhcmdldFZhbHVlOiBudW1iZXIgfCBUSFJFRS5WZWN0b3IyIHwgVEhSRUUuVmVjdG9yMyB8IFRIUkVFLlZlY3RvcjQgfCBUSFJFRS5Db2xvcjtcbiAgICBsZXQgZGVsdGFWYWx1ZTogbnVtYmVyIHwgVEhSRUUuVmVjdG9yMiB8IFRIUkVFLlZlY3RvcjMgfCBUSFJFRS5WZWN0b3I0IHwgVEhSRUUuQ29sb3I7XG5cbiAgICBpZiAodmFsdWUuaXNWZWN0b3IyKSB7XG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjI7XG4gICAgICBkZWZhdWx0VmFsdWUgPSAodmFsdWUgYXMgVEhSRUUuVmVjdG9yMikuY2xvbmUoKTtcbiAgICAgIHRhcmdldFZhbHVlID0gbmV3IFRIUkVFLlZlY3RvcjIoKS5mcm9tQXJyYXkoYXJncy50YXJnZXRWYWx1ZSk7XG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUuY2xvbmUoKS5zdWIoZGVmYXVsdFZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlLmlzVmVjdG9yMykge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IzO1xuICAgICAgZGVmYXVsdFZhbHVlID0gKHZhbHVlIGFzIFRIUkVFLlZlY3RvcjMpLmNsb25lKCk7XG4gICAgICB0YXJnZXRWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3IzKCkuZnJvbUFycmF5KGFyZ3MudGFyZ2V0VmFsdWUpO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5pc1ZlY3RvcjQpIHtcbiAgICAgIHR5cGUgPSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SNDtcbiAgICAgIGRlZmF1bHRWYWx1ZSA9ICh2YWx1ZSBhcyBUSFJFRS5WZWN0b3I0KS5jbG9uZSgpO1xuXG4gICAgICAvLyB2ZWN0b3JQcm9wZXJ0eSBhbmQgdGFyZ2V0VmFsdWUgaW5kZXggaXMgZGlmZmVyZW50IGZyb20gZWFjaCBvdGhlclxuICAgICAgLy8gZXhwb3J0ZWQgdnJtIGJ5IFVuaVZSTSBmaWxlIGlzXG4gICAgICAvL1xuICAgICAgLy8gdmVjdG9yUHJvcGVydHlcbiAgICAgIC8vIG9mZnNldCA9IHRhcmdldFZhbHVlWzBdLCB0YXJnZXRWYWx1ZVsxXVxuICAgICAgLy8gdGlsaW5nID0gdGFyZ2V0VmFsdWVbMl0sIHRhcmdldFZhbHVlWzNdXG4gICAgICAvL1xuICAgICAgLy8gdGFyZ2V0VmFsdWVcbiAgICAgIC8vIG9mZnNldCA9IHRhcmdldFZhbHVlWzJdLCB0YXJnZXRWYWx1ZVszXVxuICAgICAgLy8gdGlsaW5nID0gdGFyZ2V0VmFsdWVbMF0sIHRhcmdldFZhbHVlWzFdXG4gICAgICB0YXJnZXRWYWx1ZSA9IG5ldyBUSFJFRS5WZWN0b3I0KCkuZnJvbUFycmF5KFtcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVsyXSxcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVszXSxcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVswXSxcbiAgICAgICAgYXJncy50YXJnZXRWYWx1ZVsxXSxcbiAgICAgIF0pO1xuICAgICAgZGVsdGFWYWx1ZSA9IHRhcmdldFZhbHVlLmNsb25lKCkuc3ViKGRlZmF1bHRWYWx1ZSk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZS5pc0NvbG9yKSB7XG4gICAgICB0eXBlID0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLkNPTE9SO1xuICAgICAgZGVmYXVsdFZhbHVlID0gKHZhbHVlIGFzIFRIUkVFLkNvbG9yKS5jbG9uZSgpO1xuICAgICAgdGFyZ2V0VmFsdWUgPSBuZXcgVEhSRUUuQ29sb3IoKS5mcm9tQXJyYXkoYXJncy50YXJnZXRWYWx1ZSk7XG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUuY2xvbmUoKS5zdWIoZGVmYXVsdFZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdHlwZSA9IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5OVU1CRVI7XG4gICAgICBkZWZhdWx0VmFsdWUgPSB2YWx1ZSBhcyBudW1iZXI7XG4gICAgICB0YXJnZXRWYWx1ZSA9IGFyZ3MudGFyZ2V0VmFsdWVbMF07XG4gICAgICBkZWx0YVZhbHVlID0gdGFyZ2V0VmFsdWUgLSBkZWZhdWx0VmFsdWU7XG4gICAgfVxuXG4gICAgdGhpcy5fbWF0ZXJpYWxWYWx1ZXMucHVzaCh7XG4gICAgICBtYXRlcmlhbCxcbiAgICAgIHByb3BlcnR5TmFtZSxcbiAgICAgIGRlZmF1bHRWYWx1ZSxcbiAgICAgIHRhcmdldFZhbHVlLFxuICAgICAgZGVsdGFWYWx1ZSxcbiAgICAgIHR5cGUsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQXBwbHkgd2VpZ2h0IHRvIGV2ZXJ5IGFzc2lnbmVkIGJsZW5kIHNoYXBlcy5cbiAgICogU2hvdWxkIGJlIGNhbGxlZCB2aWEge0BsaW5rIEJsZW5kU2hhcGVNYXN0ZXIjdXBkYXRlfS5cbiAgICovXG4gIHB1YmxpYyBhcHBseVdlaWdodCgpOiB2b2lkIHtcbiAgICBjb25zdCB3ID0gdGhpcy5pc0JpbmFyeSA/ICh0aGlzLndlaWdodCA8IDAuNSA/IDAuMCA6IDEuMCkgOiB0aGlzLndlaWdodDtcblxuICAgIHRoaXMuX2JpbmRzLmZvckVhY2goKGJpbmQpID0+IHtcbiAgICAgIGJpbmQubWVzaGVzLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgaWYgKCFtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlcykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRCaW5kYFxuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1tiaW5kLm1vcnBoVGFyZ2V0SW5kZXhdICs9IHcgKiBiaW5kLndlaWdodDtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdGhpcy5fbWF0ZXJpYWxWYWx1ZXMuZm9yRWFjaCgobWF0ZXJpYWxWYWx1ZSkgPT4ge1xuICAgICAgY29uc3QgcHJvcCA9IChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdO1xuICAgICAgaWYgKHByb3AgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXG5cbiAgICAgIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5OVU1CRVIpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBudW1iZXI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdICs9IGRlbHRhVmFsdWUgKiB3O1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IyKSB7XG4gICAgICAgIGNvbnN0IGRlbHRhVmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlbHRhVmFsdWUgYXMgVEhSRUUuVmVjdG9yMjtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uYWRkKF92Mi5jb3B5KGRlbHRhVmFsdWUpLm11bHRpcGx5U2NhbGFyKHcpKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMykge1xuICAgICAgICBjb25zdCBkZWx0YVZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWx0YVZhbHVlIGFzIFRIUkVFLlZlY3RvcjM7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmFkZChfdjMuY29weShkZWx0YVZhbHVlKS5tdWx0aXBseVNjYWxhcih3KSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjQpIHtcbiAgICAgICAgY29uc3QgZGVsdGFWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVsdGFWYWx1ZSBhcyBUSFJFRS5WZWN0b3I0O1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX3Y0LmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5DT0xPUikge1xuICAgICAgICBjb25zdCBkZWx0YVZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWx0YVZhbHVlIGFzIFRIUkVFLkNvbG9yO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5hZGQoX2NvbG9yLmNvcHkoZGVsdGFWYWx1ZSkubXVsdGlwbHlTY2FsYXIodykpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2xlYXIgcHJldmlvdXNseSBhc3NpZ25lZCBibGVuZCBzaGFwZXMuXG4gICAqL1xuICBwdWJsaWMgY2xlYXJBcHBsaWVkV2VpZ2h0KCk6IHZvaWQge1xuICAgIHRoaXMuX2JpbmRzLmZvckVhY2goKGJpbmQpID0+IHtcbiAgICAgIGJpbmQubWVzaGVzLmZvckVhY2goKG1lc2gpID0+IHtcbiAgICAgICAgaWYgKCFtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlcykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSAvLyBUT0RPOiB3ZSBzaG91bGQga2ljayB0aGlzIGF0IGBhZGRCaW5kYFxuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1tiaW5kLm1vcnBoVGFyZ2V0SW5kZXhdID0gMC4wO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLl9tYXRlcmlhbFZhbHVlcy5mb3JFYWNoKChtYXRlcmlhbFZhbHVlKSA9PiB7XG4gICAgICBjb25zdCBwcm9wID0gKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV07XG4gICAgICBpZiAocHJvcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkTWF0ZXJpYWxWYWx1ZWBcblxuICAgICAgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLk5VTUJFUikge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBudW1iZXI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdID0gZGVmYXVsdFZhbHVlO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5WRUNUT1IyKSB7XG4gICAgICAgIGNvbnN0IGRlZmF1bHRWYWx1ZSA9IG1hdGVyaWFsVmFsdWUuZGVmYXVsdFZhbHVlIGFzIFRIUkVFLlZlY3RvcjI7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSlbbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWVdLmNvcHkoZGVmYXVsdFZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWxWYWx1ZS50eXBlID09PSBWUk1CbGVuZFNoYXBlTWF0ZXJpYWxWYWx1ZVR5cGUuVkVDVE9SMykge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBUSFJFRS5WZWN0b3IzO1xuICAgICAgICAobWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbCBhcyBhbnkpW21hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lXS5jb3B5KGRlZmF1bHRWYWx1ZSk7XG4gICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsVmFsdWUudHlwZSA9PT0gVlJNQmxlbmRTaGFwZU1hdGVyaWFsVmFsdWVUeXBlLlZFQ1RPUjQpIHtcbiAgICAgICAgY29uc3QgZGVmYXVsdFZhbHVlID0gbWF0ZXJpYWxWYWx1ZS5kZWZhdWx0VmFsdWUgYXMgVEhSRUUuVmVjdG9yNDtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xuICAgICAgfSBlbHNlIGlmIChtYXRlcmlhbFZhbHVlLnR5cGUgPT09IFZSTUJsZW5kU2hhcGVNYXRlcmlhbFZhbHVlVHlwZS5DT0xPUikge1xuICAgICAgICBjb25zdCBkZWZhdWx0VmFsdWUgPSBtYXRlcmlhbFZhbHVlLmRlZmF1bHRWYWx1ZSBhcyBUSFJFRS5Db2xvcjtcbiAgICAgICAgKG1hdGVyaWFsVmFsdWUubWF0ZXJpYWwgYXMgYW55KVttYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZV0uY29weShkZWZhdWx0VmFsdWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIChtYXRlcmlhbFZhbHVlLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cbiIsIi8vIFR5cGVkb2MgZG9lcyBub3Qgc3VwcG9ydCBleHBvcnQgZGVjbGFyYXRpb25zIHlldFxuLy8gdGhlbiB3ZSBoYXZlIHRvIHVzZSBgbmFtZXNwYWNlYCBpbnN0ZWFkIG9mIGV4cG9ydCBkZWNsYXJhdGlvbnMgZm9yIG5vdy5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1R5cGVTdHJvbmcvdHlwZWRvYy9wdWxsLzgwMVxuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5hbWVzcGFjZVxuZXhwb3J0IG5hbWVzcGFjZSBWUk1TY2hlbWEge1xuICAvKipcbiAgICogVlJNIGV4dGVuc2lvbiBpcyBmb3IgM2QgaHVtYW5vaWQgYXZhdGFycyAoYW5kIG1vZGVscykgaW4gVlIgYXBwbGljYXRpb25zLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBWUk0ge1xuICAgIGJsZW5kU2hhcGVNYXN0ZXI/OiBCbGVuZFNoYXBlO1xuICAgIC8qKlxuICAgICAqIFZlcnNpb24gb2YgZXhwb3J0ZXIgdGhhdCB2cm0gY3JlYXRlZC4gVW5pVlJNLTAuNTMuMFxuICAgICAqL1xuICAgIGV4cG9ydGVyVmVyc2lvbj86IHN0cmluZztcbiAgICBmaXJzdFBlcnNvbj86IEZpcnN0UGVyc29uO1xuICAgIGh1bWFub2lkPzogSHVtYW5vaWQ7XG4gICAgbWF0ZXJpYWxQcm9wZXJ0aWVzPzogTWF0ZXJpYWxbXTtcbiAgICBtZXRhPzogTWV0YTtcbiAgICBzZWNvbmRhcnlBbmltYXRpb24/OiBTZWNvbmRhcnlBbmltYXRpb247XG4gICAgLyoqXG4gICAgICogVmVyc2lvbiBvZiBWUk0gc3BlY2lmaWNhdGlvbi4gMC4wXG4gICAgICovXG4gICAgc3BlY1ZlcnNpb24/OiBzdHJpbmc7XG4gIH1cblxuICAvKipcbiAgICogQmxlbmRTaGFwZUF2YXRhciBvZiBVbmlWUk1cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZSB7XG4gICAgYmxlbmRTaGFwZUdyb3Vwcz86IEJsZW5kU2hhcGVHcm91cFtdO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBCbGVuZFNoYXBlR3JvdXAge1xuICAgIC8qKlxuICAgICAqIExvdyBsZXZlbCBibGVuZHNoYXBlIHJlZmVyZW5jZXMuXG4gICAgICovXG4gICAgYmluZHM/OiBCbGVuZFNoYXBlQmluZFtdO1xuICAgIC8qKlxuICAgICAqIDAgb3IgMS4gRG8gbm90IGFsbG93IGFuIGludGVybWVkaWF0ZSB2YWx1ZS4gVmFsdWUgc2hvdWxkIHJvdW5kZWRcbiAgICAgKi9cbiAgICBpc0JpbmFyeT86IGJvb2xlYW47XG4gICAgLyoqXG4gICAgICogTWF0ZXJpYWwgYW5pbWF0aW9uIHJlZmVyZW5jZXMuXG4gICAgICovXG4gICAgbWF0ZXJpYWxWYWx1ZXM/OiBCbGVuZFNoYXBlTWF0ZXJpYWxiaW5kW107XG4gICAgLyoqXG4gICAgICogRXhwcmVzc2lvbiBuYW1lXG4gICAgICovXG4gICAgbmFtZT86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQcmVkZWZpbmVkIEV4cHJlc3Npb24gbmFtZVxuICAgICAqL1xuICAgIHByZXNldE5hbWU/OiBCbGVuZFNoYXBlUHJlc2V0TmFtZTtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgQmxlbmRTaGFwZUJpbmQge1xuICAgIGluZGV4PzogbnVtYmVyO1xuICAgIG1lc2g/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogU2tpbm5lZE1lc2hSZW5kZXJlci5TZXRCbGVuZFNoYXBlV2VpZ2h0XG4gICAgICovXG4gICAgd2VpZ2h0PzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBCbGVuZFNoYXBlTWF0ZXJpYWxiaW5kIHtcbiAgICBtYXRlcmlhbE5hbWU/OiBzdHJpbmc7XG4gICAgcHJvcGVydHlOYW1lPzogc3RyaW5nO1xuICAgIHRhcmdldFZhbHVlPzogbnVtYmVyW107XG4gIH1cblxuICAvKipcbiAgICogUHJlZGVmaW5lZCBFeHByZXNzaW9uIG5hbWVcbiAgICovXG4gIGV4cG9ydCBlbnVtIEJsZW5kU2hhcGVQcmVzZXROYW1lIHtcbiAgICBBID0gJ2EnLFxuICAgIEFuZ3J5ID0gJ2FuZ3J5JyxcbiAgICBCbGluayA9ICdibGluaycsXG4gICAgQmxpbmtMID0gJ2JsaW5rX2wnLFxuICAgIEJsaW5rUiA9ICdibGlua19yJyxcbiAgICBFID0gJ2UnLFxuICAgIEZ1biA9ICdmdW4nLFxuICAgIEkgPSAnaScsXG4gICAgSm95ID0gJ2pveScsXG4gICAgTG9va2Rvd24gPSAnbG9va2Rvd24nLFxuICAgIExvb2tsZWZ0ID0gJ2xvb2tsZWZ0JyxcbiAgICBMb29rcmlnaHQgPSAnbG9va3JpZ2h0JyxcbiAgICBMb29rdXAgPSAnbG9va3VwJyxcbiAgICBOZXV0cmFsID0gJ25ldXRyYWwnLFxuICAgIE8gPSAnbycsXG4gICAgU29ycm93ID0gJ3NvcnJvdycsXG4gICAgVSA9ICd1JyxcbiAgICBVbmtub3duID0gJ3Vua25vd24nLFxuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbiB7XG4gICAgLyoqXG4gICAgICogVGhlIGJvbmUgd2hvc2UgcmVuZGVyaW5nIHNob3VsZCBiZSB0dXJuZWQgb2ZmIGluIGZpcnN0LXBlcnNvbiB2aWV3LiBVc3VhbGx5IEhlYWQgaXNcbiAgICAgKiBzcGVjaWZpZWQuXG4gICAgICovXG4gICAgZmlyc3RQZXJzb25Cb25lPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSB0YXJnZXQgcG9zaXRpb24gb2YgdGhlIFZSIGhlYWRzZXQgaW4gZmlyc3QtcGVyc29uIHZpZXcuIEl0IGlzIGFzc3VtZWQgdGhhdCBhbiBvZmZzZXRcbiAgICAgKiBmcm9tIHRoZSBoZWFkIGJvbmUgdG8gdGhlIFZSIGhlYWRzZXQgaXMgYWRkZWQuXG4gICAgICovXG4gICAgZmlyc3RQZXJzb25Cb25lT2Zmc2V0PzogVmVjdG9yMztcbiAgICBsb29rQXRIb3Jpem9udGFsSW5uZXI/OiBGaXJzdFBlcnNvbkRlZ3JlZU1hcDtcbiAgICBsb29rQXRIb3Jpem9udGFsT3V0ZXI/OiBGaXJzdFBlcnNvbkRlZ3JlZU1hcDtcbiAgICAvKipcbiAgICAgKiBFeWUgY29udHJvbGxlciBtb2RlLlxuICAgICAqL1xuICAgIGxvb2tBdFR5cGVOYW1lPzogRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZTtcbiAgICBsb29rQXRWZXJ0aWNhbERvd24/OiBGaXJzdFBlcnNvbkRlZ3JlZU1hcDtcbiAgICBsb29rQXRWZXJ0aWNhbFVwPzogRmlyc3RQZXJzb25EZWdyZWVNYXA7XG4gICAgLyoqXG4gICAgICogU3dpdGNoIGRpc3BsYXkgLyB1bmRpc3BsYXkgZm9yIGVhY2ggbWVzaCBpbiBmaXJzdC1wZXJzb24gdmlldyBvciB0aGUgb3RoZXJzLlxuICAgICAqL1xuICAgIG1lc2hBbm5vdGF0aW9ucz86IEZpcnN0UGVyc29uTWVzaGFubm90YXRpb25bXTtcbiAgfVxuXG4gIC8qKlxuICAgKiBFeWUgY29udHJvbGxlciBzZXR0aW5nLlxuICAgKi9cbiAgZXhwb3J0IGludGVyZmFjZSBGaXJzdFBlcnNvbkRlZ3JlZU1hcCB7XG4gICAgLyoqXG4gICAgICogTm9uZSBsaW5lYXIgbWFwcGluZyBwYXJhbXMuIHRpbWUsIHZhbHVlLCBpblRhbmdlbnQsIG91dFRhbmdlbnRcbiAgICAgKi9cbiAgICBjdXJ2ZT86IG51bWJlcltdO1xuICAgIC8qKlxuICAgICAqIExvb2sgYXQgaW5wdXQgY2xhbXAgcmFuZ2UgZGVncmVlLlxuICAgICAqL1xuICAgIHhSYW5nZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBMb29rIGF0IG1hcCByYW5nZSBkZWdyZWUgZnJvbSB4UmFuZ2UuXG4gICAgICovXG4gICAgeVJhbmdlPzogbnVtYmVyO1xuICB9XG5cbiAgLyoqXG4gICAqIEV5ZSBjb250cm9sbGVyIG1vZGUuXG4gICAqL1xuICBleHBvcnQgZW51bSBGaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lIHtcbiAgICBCbGVuZFNoYXBlID0gJ0JsZW5kU2hhcGUnLFxuICAgIEJvbmUgPSAnQm9uZScsXG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIEZpcnN0UGVyc29uTWVzaGFubm90YXRpb24ge1xuICAgIGZpcnN0UGVyc29uRmxhZz86IHN0cmluZztcbiAgICBtZXNoPzogbnVtYmVyO1xuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBIdW1hbm9pZCB7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmFybVN0cmV0Y2hcbiAgICAgKi9cbiAgICBhcm1TdHJldGNoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5mZWV0U3BhY2luZ1xuICAgICAqL1xuICAgIGZlZXRTcGFjaW5nPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5oYXNUcmFuc2xhdGlvbkRvRlxuICAgICAqL1xuICAgIGhhc1RyYW5zbGF0aW9uRG9GPzogYm9vbGVhbjtcbiAgICBodW1hbkJvbmVzPzogSHVtYW5vaWRCb25lW107XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLmxlZ1N0cmV0Y2hcbiAgICAgKi9cbiAgICBsZWdTdHJldGNoPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi5sb3dlckFybVR3aXN0XG4gICAgICovXG4gICAgbG93ZXJBcm1Ud2lzdD86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuRGVzY3JpcHRpb24ubG93ZXJMZWdUd2lzdFxuICAgICAqL1xuICAgIGxvd2VyTGVnVHdpc3Q/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVW5pdHkncyBIdW1hbkRlc2NyaXB0aW9uLnVwcGVyQXJtVHdpc3RcbiAgICAgKi9cbiAgICB1cHBlckFybVR3aXN0PzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5EZXNjcmlwdGlvbi51cHBlckxlZ1R3aXN0XG4gICAgICovXG4gICAgdXBwZXJMZWdUd2lzdD86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgSHVtYW5vaWRCb25lIHtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQuYXhpc0xlbmd0aFxuICAgICAqL1xuICAgIGF4aXNMZW5ndGg/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogSHVtYW4gYm9uZSBuYW1lLlxuICAgICAqL1xuICAgIGJvbmU/OiBIdW1hbm9pZEJvbmVOYW1lO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5MaW1pdC5jZW50ZXJcbiAgICAgKi9cbiAgICBjZW50ZXI/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5MaW1pdC5tYXhcbiAgICAgKi9cbiAgICBtYXg/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFVuaXR5J3MgSHVtYW5MaW1pdC5taW5cbiAgICAgKi9cbiAgICBtaW4/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFJlZmVyZW5jZSBub2RlIGluZGV4XG4gICAgICovXG4gICAgbm9kZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBVbml0eSdzIEh1bWFuTGltaXQudXNlRGVmYXVsdFZhbHVlc1xuICAgICAqL1xuICAgIHVzZURlZmF1bHRWYWx1ZXM/OiBib29sZWFuO1xuICB9XG5cbiAgLyoqXG4gICAqIEh1bWFuIGJvbmUgbmFtZS5cbiAgICovXG4gIGV4cG9ydCBlbnVtIEh1bWFub2lkQm9uZU5hbWUge1xuICAgIENoZXN0ID0gJ2NoZXN0JyxcbiAgICBIZWFkID0gJ2hlYWQnLFxuICAgIEhpcHMgPSAnaGlwcycsXG4gICAgSmF3ID0gJ2phdycsXG4gICAgTGVmdEV5ZSA9ICdsZWZ0RXllJyxcbiAgICBMZWZ0Rm9vdCA9ICdsZWZ0Rm9vdCcsXG4gICAgTGVmdEhhbmQgPSAnbGVmdEhhbmQnLFxuICAgIExlZnRJbmRleERpc3RhbCA9ICdsZWZ0SW5kZXhEaXN0YWwnLFxuICAgIExlZnRJbmRleEludGVybWVkaWF0ZSA9ICdsZWZ0SW5kZXhJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRJbmRleFByb3hpbWFsID0gJ2xlZnRJbmRleFByb3hpbWFsJyxcbiAgICBMZWZ0TGl0dGxlRGlzdGFsID0gJ2xlZnRMaXR0bGVEaXN0YWwnLFxuICAgIExlZnRMaXR0bGVJbnRlcm1lZGlhdGUgPSAnbGVmdExpdHRsZUludGVybWVkaWF0ZScsXG4gICAgTGVmdExpdHRsZVByb3hpbWFsID0gJ2xlZnRMaXR0bGVQcm94aW1hbCcsXG4gICAgTGVmdExvd2VyQXJtID0gJ2xlZnRMb3dlckFybScsXG4gICAgTGVmdExvd2VyTGVnID0gJ2xlZnRMb3dlckxlZycsXG4gICAgTGVmdE1pZGRsZURpc3RhbCA9ICdsZWZ0TWlkZGxlRGlzdGFsJyxcbiAgICBMZWZ0TWlkZGxlSW50ZXJtZWRpYXRlID0gJ2xlZnRNaWRkbGVJbnRlcm1lZGlhdGUnLFxuICAgIExlZnRNaWRkbGVQcm94aW1hbCA9ICdsZWZ0TWlkZGxlUHJveGltYWwnLFxuICAgIExlZnRSaW5nRGlzdGFsID0gJ2xlZnRSaW5nRGlzdGFsJyxcbiAgICBMZWZ0UmluZ0ludGVybWVkaWF0ZSA9ICdsZWZ0UmluZ0ludGVybWVkaWF0ZScsXG4gICAgTGVmdFJpbmdQcm94aW1hbCA9ICdsZWZ0UmluZ1Byb3hpbWFsJyxcbiAgICBMZWZ0U2hvdWxkZXIgPSAnbGVmdFNob3VsZGVyJyxcbiAgICBMZWZ0VGh1bWJEaXN0YWwgPSAnbGVmdFRodW1iRGlzdGFsJyxcbiAgICBMZWZ0VGh1bWJJbnRlcm1lZGlhdGUgPSAnbGVmdFRodW1iSW50ZXJtZWRpYXRlJyxcbiAgICBMZWZ0VGh1bWJQcm94aW1hbCA9ICdsZWZ0VGh1bWJQcm94aW1hbCcsXG4gICAgTGVmdFRvZXMgPSAnbGVmdFRvZXMnLFxuICAgIExlZnRVcHBlckFybSA9ICdsZWZ0VXBwZXJBcm0nLFxuICAgIExlZnRVcHBlckxlZyA9ICdsZWZ0VXBwZXJMZWcnLFxuICAgIE5lY2sgPSAnbmVjaycsXG4gICAgUmlnaHRFeWUgPSAncmlnaHRFeWUnLFxuICAgIFJpZ2h0Rm9vdCA9ICdyaWdodEZvb3QnLFxuICAgIFJpZ2h0SGFuZCA9ICdyaWdodEhhbmQnLFxuICAgIFJpZ2h0SW5kZXhEaXN0YWwgPSAncmlnaHRJbmRleERpc3RhbCcsXG4gICAgUmlnaHRJbmRleEludGVybWVkaWF0ZSA9ICdyaWdodEluZGV4SW50ZXJtZWRpYXRlJyxcbiAgICBSaWdodEluZGV4UHJveGltYWwgPSAncmlnaHRJbmRleFByb3hpbWFsJyxcbiAgICBSaWdodExpdHRsZURpc3RhbCA9ICdyaWdodExpdHRsZURpc3RhbCcsXG4gICAgUmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUgPSAncmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUnLFxuICAgIFJpZ2h0TGl0dGxlUHJveGltYWwgPSAncmlnaHRMaXR0bGVQcm94aW1hbCcsXG4gICAgUmlnaHRMb3dlckFybSA9ICdyaWdodExvd2VyQXJtJyxcbiAgICBSaWdodExvd2VyTGVnID0gJ3JpZ2h0TG93ZXJMZWcnLFxuICAgIFJpZ2h0TWlkZGxlRGlzdGFsID0gJ3JpZ2h0TWlkZGxlRGlzdGFsJyxcbiAgICBSaWdodE1pZGRsZUludGVybWVkaWF0ZSA9ICdyaWdodE1pZGRsZUludGVybWVkaWF0ZScsXG4gICAgUmlnaHRNaWRkbGVQcm94aW1hbCA9ICdyaWdodE1pZGRsZVByb3hpbWFsJyxcbiAgICBSaWdodFJpbmdEaXN0YWwgPSAncmlnaHRSaW5nRGlzdGFsJyxcbiAgICBSaWdodFJpbmdJbnRlcm1lZGlhdGUgPSAncmlnaHRSaW5nSW50ZXJtZWRpYXRlJyxcbiAgICBSaWdodFJpbmdQcm94aW1hbCA9ICdyaWdodFJpbmdQcm94aW1hbCcsXG4gICAgUmlnaHRTaG91bGRlciA9ICdyaWdodFNob3VsZGVyJyxcbiAgICBSaWdodFRodW1iRGlzdGFsID0gJ3JpZ2h0VGh1bWJEaXN0YWwnLFxuICAgIFJpZ2h0VGh1bWJJbnRlcm1lZGlhdGUgPSAncmlnaHRUaHVtYkludGVybWVkaWF0ZScsXG4gICAgUmlnaHRUaHVtYlByb3hpbWFsID0gJ3JpZ2h0VGh1bWJQcm94aW1hbCcsXG4gICAgUmlnaHRUb2VzID0gJ3JpZ2h0VG9lcycsXG4gICAgUmlnaHRVcHBlckFybSA9ICdyaWdodFVwcGVyQXJtJyxcbiAgICBSaWdodFVwcGVyTGVnID0gJ3JpZ2h0VXBwZXJMZWcnLFxuICAgIFNwaW5lID0gJ3NwaW5lJyxcbiAgICBVcHBlckNoZXN0ID0gJ3VwcGVyQ2hlc3QnLFxuICB9XG5cbiAgZXhwb3J0IGludGVyZmFjZSBNYXRlcmlhbCB7XG4gICAgZmxvYXRQcm9wZXJ0aWVzPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICBrZXl3b3JkTWFwPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICBuYW1lPzogc3RyaW5nO1xuICAgIHJlbmRlclF1ZXVlPzogbnVtYmVyO1xuICAgIHNoYWRlcj86IHN0cmluZztcbiAgICB0YWdNYXA/OiB7IFtrZXk6IHN0cmluZ106IGFueSB9O1xuICAgIHRleHR1cmVQcm9wZXJ0aWVzPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgICB2ZWN0b3JQcm9wZXJ0aWVzPzogeyBba2V5OiBzdHJpbmddOiBhbnkgfTtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgTWV0YSB7XG4gICAgLyoqXG4gICAgICogQSBwZXJzb24gd2hvIGNhbiBwZXJmb3JtIHdpdGggdGhpcyBhdmF0YXJcbiAgICAgKi9cbiAgICBhbGxvd2VkVXNlck5hbWU/OiBNZXRhQWxsb3dlZFVzZXJOYW1lO1xuICAgIC8qKlxuICAgICAqIEF1dGhvciBvZiBWUk0gbW9kZWxcbiAgICAgKi9cbiAgICBhdXRob3I/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogRm9yIGNvbW1lcmNpYWwgdXNlXG4gICAgICovXG4gICAgY29tbWVyY2lhbFVzc2FnZU5hbWU/OiBNZXRhVXNzYWdlTmFtZTtcbiAgICAvKipcbiAgICAgKiBDb250YWN0IEluZm9ybWF0aW9uIG9mIFZSTSBtb2RlbCBhdXRob3JcbiAgICAgKi9cbiAgICBjb250YWN0SW5mb3JtYXRpb24/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogTGljZW5zZSB0eXBlXG4gICAgICovXG4gICAgbGljZW5zZU5hbWU/OiBNZXRhTGljZW5zZU5hbWU7XG4gICAgLyoqXG4gICAgICogSWYg4oCcT3RoZXLigJ0gaXMgc2VsZWN0ZWQsIHB1dCB0aGUgVVJMIGxpbmsgb2YgdGhlIGxpY2Vuc2UgZG9jdW1lbnQgaGVyZS5cbiAgICAgKi9cbiAgICBvdGhlckxpY2Vuc2VVcmw/OiBzdHJpbmc7XG4gICAgLyoqXG4gICAgICogSWYgdGhlcmUgYXJlIGFueSBjb25kaXRpb25zIG5vdCBtZW50aW9uZWQgYWJvdmUsIHB1dCB0aGUgVVJMIGxpbmsgb2YgdGhlIGxpY2Vuc2UgZG9jdW1lbnRcbiAgICAgKiBoZXJlLlxuICAgICAqL1xuICAgIG90aGVyUGVybWlzc2lvblVybD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBSZWZlcmVuY2Ugb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgcmVmZXJlbmNlPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFBlcm1pc3Npb24gdG8gcGVyZm9ybSBzZXh1YWwgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAgICovXG4gICAgc2V4dWFsVXNzYWdlTmFtZT86IE1ldGFVc3NhZ2VOYW1lO1xuICAgIC8qKlxuICAgICAqIFRodW1ibmFpbCBvZiBWUk0gbW9kZWxcbiAgICAgKi9cbiAgICB0ZXh0dXJlPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRpdGxlIG9mIFZSTSBtb2RlbFxuICAgICAqL1xuICAgIHRpdGxlPzogc3RyaW5nO1xuICAgIC8qKlxuICAgICAqIFZlcnNpb24gb2YgVlJNIG1vZGVsXG4gICAgICovXG4gICAgdmVyc2lvbj86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBQZXJtaXNzaW9uIHRvIHBlcmZvcm0gdmlvbGVudCBhY3RzIHdpdGggdGhpcyBhdmF0YXJcbiAgICAgKi9cbiAgICB2aW9sZW50VXNzYWdlTmFtZT86IE1ldGFVc3NhZ2VOYW1lO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgcGVyc29uIHdobyBjYW4gcGVyZm9ybSB3aXRoIHRoaXMgYXZhdGFyXG4gICAqL1xuICBleHBvcnQgZW51bSBNZXRhQWxsb3dlZFVzZXJOYW1lIHtcbiAgICBFdmVyeW9uZSA9ICdFdmVyeW9uZScsXG4gICAgRXhwbGljaXRseUxpY2Vuc2VkUGVyc29uID0gJ0V4cGxpY2l0bHlMaWNlbnNlZFBlcnNvbicsXG4gICAgT25seUF1dGhvciA9ICdPbmx5QXV0aG9yJyxcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3IgY29tbWVyY2lhbCB1c2VcbiAgICpcbiAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHNleHVhbCBhY3RzIHdpdGggdGhpcyBhdmF0YXJcbiAgICpcbiAgICogUGVybWlzc2lvbiB0byBwZXJmb3JtIHZpb2xlbnQgYWN0cyB3aXRoIHRoaXMgYXZhdGFyXG4gICAqL1xuICBleHBvcnQgZW51bSBNZXRhVXNzYWdlTmFtZSB7XG4gICAgQWxsb3cgPSAnQWxsb3cnLFxuICAgIERpc2FsbG93ID0gJ0Rpc2FsbG93JyxcbiAgfVxuXG4gIC8qKlxuICAgKiBMaWNlbnNlIHR5cGVcbiAgICovXG4gIGV4cG9ydCBlbnVtIE1ldGFMaWNlbnNlTmFtZSB7XG4gICAgQ2MwID0gJ0NDMCcsXG4gICAgQ2NCeSA9ICdDQ19CWScsXG4gICAgQ2NCeU5jID0gJ0NDX0JZX05DJyxcbiAgICBDY0J5TmNOZCA9ICdDQ19CWV9OQ19ORCcsXG4gICAgQ2NCeU5jU2EgPSAnQ0NfQllfTkNfU0EnLFxuICAgIENjQnlOZCA9ICdDQ19CWV9ORCcsXG4gICAgQ2NCeVNhID0gJ0NDX0JZX1NBJyxcbiAgICBPdGhlciA9ICdPdGhlcicsXG4gICAgUmVkaXN0cmlidXRpb25Qcm9oaWJpdGVkID0gJ1JlZGlzdHJpYnV0aW9uX1Byb2hpYml0ZWQnLFxuICB9XG5cbiAgLyoqXG4gICAqIFRoZSBzZXR0aW5nIG9mIGF1dG9tYXRpYyBhbmltYXRpb24gb2Ygc3RyaW5nLWxpa2Ugb2JqZWN0cyBzdWNoIGFzIHRhaWxzIGFuZCBoYWlycy5cbiAgICovXG4gIGV4cG9ydCBpbnRlcmZhY2UgU2Vjb25kYXJ5QW5pbWF0aW9uIHtcbiAgICBib25lR3JvdXBzPzogU2Vjb25kYXJ5QW5pbWF0aW9uU3ByaW5nW107XG4gICAgY29sbGlkZXJHcm91cHM/OiBTZWNvbmRhcnlBbmltYXRpb25Db2xsaWRlcmdyb3VwW107XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvblNwcmluZyB7XG4gICAgLyoqXG4gICAgICogU3BlY2lmeSB0aGUgbm9kZSBpbmRleCBvZiB0aGUgcm9vdCBib25lIG9mIHRoZSBzd2F5aW5nIG9iamVjdC5cbiAgICAgKi9cbiAgICBib25lcz86IG51bWJlcltdO1xuICAgIC8qKlxuICAgICAqIFRoZSByZWZlcmVuY2UgcG9pbnQgb2YgYSBzd2F5aW5nIG9iamVjdCBjYW4gYmUgc2V0IGF0IGFueSBsb2NhdGlvbiBleGNlcHQgdGhlIG9yaWdpbi5cbiAgICAgKiBXaGVuIGltcGxlbWVudGluZyBVSSBtb3Zpbmcgd2l0aCB3YXJwLCB0aGUgcGFyZW50IG5vZGUgdG8gbW92ZSB3aXRoIHdhcnAgY2FuIGJlIHNwZWNpZmllZFxuICAgICAqIGlmIHlvdSBkb24ndCB3YW50IHRvIG1ha2UgdGhlIG9iamVjdCBzd2F5aW5nIHdpdGggd2FycCBtb3ZlbWVudC5cbiAgICAgKi9cbiAgICBjZW50ZXI/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogU3BlY2lmeSB0aGUgaW5kZXggb2YgdGhlIGNvbGxpZGVyIGdyb3VwIGZvciBjb2xsaXNpb25zIHdpdGggc3dheWluZyBvYmplY3RzLlxuICAgICAqL1xuICAgIGNvbGxpZGVyR3JvdXBzPzogbnVtYmVyW107XG4gICAgLyoqXG4gICAgICogQW5ub3RhdGlvbiBjb21tZW50XG4gICAgICovXG4gICAgY29tbWVudD86IHN0cmluZztcbiAgICAvKipcbiAgICAgKiBUaGUgcmVzaXN0YW5jZSAoZGVjZWxlcmF0aW9uKSBvZiBhdXRvbWF0aWMgYW5pbWF0aW9uLlxuICAgICAqL1xuICAgIGRyYWdGb3JjZT86IG51bWJlcjtcbiAgICAvKipcbiAgICAgKiBUaGUgZGlyZWN0aW9uIG9mIGdyYXZpdHkuIFNldCAoMCwgLTEsIDApIGZvciBzaW11bGF0aW5nIHRoZSBncmF2aXR5LiBTZXQgKDEsIDAsIDApIGZvclxuICAgICAqIHNpbXVsYXRpbmcgdGhlIHdpbmQuXG4gICAgICovXG4gICAgZ3Jhdml0eURpcj86IFZlY3RvcjM7XG4gICAgLyoqXG4gICAgICogVGhlIHN0cmVuZ3RoIG9mIGdyYXZpdHkuXG4gICAgICovXG4gICAgZ3Jhdml0eVBvd2VyPzogbnVtYmVyO1xuICAgIC8qKlxuICAgICAqIFRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSB1c2VkIGZvciB0aGUgY29sbGlzaW9uIGRldGVjdGlvbiB3aXRoIGNvbGxpZGVycy5cbiAgICAgKi9cbiAgICBoaXRSYWRpdXM/OiBudW1iZXI7XG4gICAgLyoqXG4gICAgICogVGhlIHJlc2lsaWVuY2Ugb2YgdGhlIHN3YXlpbmcgb2JqZWN0ICh0aGUgcG93ZXIgb2YgcmV0dXJuaW5nIHRvIHRoZSBpbml0aWFsIHBvc2UpLlxuICAgICAqL1xuICAgIHN0aWZmaW5lc3M/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvbkNvbGxpZGVyZ3JvdXAge1xuICAgIGNvbGxpZGVycz86IFNlY29uZGFyeUFuaW1hdGlvbkNvbGxpZGVyW107XG4gICAgLyoqXG4gICAgICogVGhlIG5vZGUgb2YgdGhlIGNvbGxpZGVyIGdyb3VwIGZvciBzZXR0aW5nIHVwIGNvbGxpc2lvbiBkZXRlY3Rpb25zLlxuICAgICAqL1xuICAgIG5vZGU/OiBudW1iZXI7XG4gIH1cblxuICBleHBvcnQgaW50ZXJmYWNlIFNlY29uZGFyeUFuaW1hdGlvbkNvbGxpZGVyIHtcbiAgICAvKipcbiAgICAgKiBUaGUgbG9jYWwgY29vcmRpbmF0ZSBmcm9tIHRoZSBub2RlIG9mIHRoZSBjb2xsaWRlciBncm91cC5cbiAgICAgKi9cbiAgICBvZmZzZXQ/OiBWZWN0b3IzO1xuICAgIC8qKlxuICAgICAqIFRoZSByYWRpdXMgb2YgdGhlIGNvbGxpZGVyLlxuICAgICAqL1xuICAgIHJhZGl1cz86IG51bWJlcjtcbiAgfVxuXG4gIGV4cG9ydCBpbnRlcmZhY2UgVmVjdG9yMyB7XG4gICAgeD86IG51bWJlcjtcbiAgICB5PzogbnVtYmVyO1xuICAgIHo/OiBudW1iZXI7XG4gIH1cbn1cbiIsImltcG9ydCB0eXBlIHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHR5cGUgeyBHTFRGUHJpbWl0aXZlLCBHTFRGU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuXG5mdW5jdGlvbiBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsKGdsdGY6IEdMVEYsIG5vZGVJbmRleDogbnVtYmVyLCBub2RlOiBUSFJFRS5PYmplY3QzRCk6IEdMVEZQcmltaXRpdmVbXSB8IG51bGwge1xuICAvKipcbiAgICogTGV0J3MgbGlzdCB1cCBldmVyeSBwb3NzaWJsZSBwYXR0ZXJucyB0aGF0IHBhcnNlZCBnbHRmIG5vZGVzIHdpdGggYSBtZXNoIGNhbiBoYXZlLCwsXG4gICAqXG4gICAqIFwiKlwiIGluZGljYXRlcyB0aGF0IHRob3NlIG1lc2hlcyBzaG91bGQgYmUgbGlzdGVkIHVwIHVzaW5nIHRoaXMgZnVuY3Rpb25cbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIGEgc2lnbmxlIHByaW1pdGl2ZSlcbiAgICpcbiAgICogLSBgVEhSRUUuTWVzaGA6IFRoZSBvbmx5IHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICpcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgYSBzaW5nbGUgcHJpbWl0aXZlKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKVxuICAgKlxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcbiAgICogICAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIGEgTUVTSCBPRiBUSEUgQ0hJTERcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGRcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGQgKDIpXG4gICAqXG4gICAqICMjIyBBIG5vZGUgd2l0aCBhIChtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXG4gICAqXG4gICAqIC0gYFRIUkVFLkJvbmVgOiBUaGUgcm9vdCBvZiB0aGUgbm9kZSwgYXMgYSBib25lXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxuICAgKlxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXG4gICAqXG4gICAqIC0gYFRIUkVFLkJvbmVgOiBUaGUgcm9vdCBvZiB0aGUgbm9kZSwgYXMgYSBib25lXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAoMikgKlxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZFxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoIG9mIHRoZSBjaGlsZCAoMilcbiAgICpcbiAgICogLi4uSSB3aWxsIHRha2UgYSBzdHJhdGVneSB0aGF0IHRyYXZlcnNlcyB0aGUgcm9vdCBvZiB0aGUgbm9kZSBhbmQgdGFrZSBmaXJzdCAocHJpbWl0aXZlQ291bnQpIG1lc2hlcy5cbiAgICovXG5cbiAgLy8gTWFrZSBzdXJlIHRoYXQgdGhlIG5vZGUgaGFzIGEgbWVzaFxuICBjb25zdCBzY2hlbWFOb2RlOiBHTFRGU2NoZW1hLk5vZGUgPSBnbHRmLnBhcnNlci5qc29uLm5vZGVzW25vZGVJbmRleF07XG4gIGNvbnN0IG1lc2hJbmRleCA9IHNjaGVtYU5vZGUubWVzaDtcbiAgaWYgKG1lc2hJbmRleCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBIb3cgbWFueSBwcmltaXRpdmVzIHRoZSBtZXNoIGhhcz9cbiAgY29uc3Qgc2NoZW1hTWVzaDogR0xURlNjaGVtYS5NZXNoID0gZ2x0Zi5wYXJzZXIuanNvbi5tZXNoZXNbbWVzaEluZGV4XTtcbiAgY29uc3QgcHJpbWl0aXZlQ291bnQgPSBzY2hlbWFNZXNoLnByaW1pdGl2ZXMubGVuZ3RoO1xuXG4gIC8vIFRyYXZlcnNlIHRoZSBub2RlIGFuZCB0YWtlIGZpcnN0IChwcmltaXRpdmVDb3VudCkgbWVzaGVzXG4gIGNvbnN0IHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXSA9IFtdO1xuICBub2RlLnRyYXZlcnNlKChvYmplY3QpID0+IHtcbiAgICBpZiAocHJpbWl0aXZlcy5sZW5ndGggPCBwcmltaXRpdmVDb3VudCkge1xuICAgICAgaWYgKChvYmplY3QgYXMgYW55KS5pc01lc2gpIHtcbiAgICAgICAgcHJpbWl0aXZlcy5wdXNoKG9iamVjdCBhcyBHTFRGUHJpbWl0aXZlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBwcmltaXRpdmVzO1xufVxuXG4vKipcbiAqIEV4dHJhY3QgcHJpbWl0aXZlcyAoIGBUSFJFRS5NZXNoW11gICkgb2YgYSBub2RlIGZyb20gYSBsb2FkZWQgR0xURi5cbiAqIFRoZSBtYWluIHB1cnBvc2Ugb2YgdGhpcyBmdW5jdGlvbiBpcyB0byBkaXN0aW5ndWlzaCBwcmltaXRpdmVzIGFuZCBjaGlsZHJlbiBmcm9tIGEgbm9kZSB0aGF0IGhhcyBib3RoIG1lc2hlcyBhbmQgY2hpbGRyZW4uXG4gKlxuICogSXQgdXRpbGl6ZXMgdGhlIGJlaGF2aW9yIHRoYXQgR0xURkxvYWRlciBhZGRzIG1lc2ggcHJpbWl0aXZlcyB0byB0aGUgbm9kZSBvYmplY3QgKCBgVEhSRUUuR3JvdXBgICkgZmlyc3QgdGhlbiBhZGRzIGl0cyBjaGlsZHJlbi5cbiAqXG4gKiBAcGFyYW0gZ2x0ZiBBIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxuICogQHBhcmFtIG5vZGVJbmRleCBUaGUgaW5kZXggb2YgdGhlIG5vZGVcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlKGdsdGY6IEdMVEYsIG5vZGVJbmRleDogbnVtYmVyKTogUHJvbWlzZTxHTFRGUHJpbWl0aXZlW10gfCBudWxsPiB7XG4gIGNvbnN0IG5vZGU6IFRIUkVFLk9iamVjdDNEID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIG5vZGVJbmRleCk7XG4gIHJldHVybiBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsKGdsdGYsIG5vZGVJbmRleCwgbm9kZSk7XG59XG5cbi8qKlxuICogRXh0cmFjdCBwcmltaXRpdmVzICggYFRIUkVFLk1lc2hbXWAgKSBvZiBub2RlcyBmcm9tIGEgbG9hZGVkIEdMVEYuXG4gKiBTZWUge0BsaW5rIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlfSBmb3IgbW9yZSBkZXRhaWxzLlxuICpcbiAqIEl0IHJldHVybnMgYSBtYXAgZnJvbSBub2RlIGluZGV4IHRvIGV4dHJhY3Rpb24gcmVzdWx0LlxuICogSWYgYSBub2RlIGRvZXMgbm90IGhhdmUgYSBtZXNoLCB0aGUgZW50cnkgZm9yIHRoZSBub2RlIHdpbGwgbm90IGJlIHB1dCBpbiB0aGUgcmV0dXJuaW5nIG1hcC5cbiAqXG4gKiBAcGFyYW0gZ2x0ZiBBIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzKGdsdGY6IEdMVEYpOiBQcm9taXNlPE1hcDxudW1iZXIsIEdMVEZQcmltaXRpdmVbXT4+IHtcbiAgY29uc3Qgbm9kZXM6IFRIUkVFLk9iamVjdDNEW10gPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmNpZXMoJ25vZGUnKTtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxudW1iZXIsIEdMVEZQcmltaXRpdmVbXT4oKTtcblxuICBub2Rlcy5mb3JFYWNoKChub2RlLCBpbmRleCkgPT4ge1xuICAgIGNvbnN0IHJlc3VsdCA9IGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWwoZ2x0ZiwgaW5kZXgsIG5vZGUpO1xuICAgIGlmIChyZXN1bHQgIT0gbnVsbCkge1xuICAgICAgbWFwLnNldChpbmRleCwgcmVzdWx0KTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBtYXA7XG59XG4iLCJleHBvcnQgZnVuY3Rpb24gcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAobmFtZVswXSAhPT0gJ18nKSB7XG4gICAgY29uc29sZS53YXJuKGByZW5hbWVNYXRlcmlhbFByb3BlcnR5OiBHaXZlbiBwcm9wZXJ0eSBuYW1lIFwiJHtuYW1lfVwiIG1pZ2h0IGJlIGludmFsaWRgKTtcbiAgICByZXR1cm4gbmFtZTtcbiAgfVxuICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoMSk7XG5cbiAgaWYgKCEvW0EtWl0vLnRlc3QobmFtZVswXSkpIHtcbiAgICBjb25zb2xlLndhcm4oYHJlbmFtZU1hdGVyaWFsUHJvcGVydHk6IEdpdmVuIHByb3BlcnR5IG5hbWUgXCIke25hbWV9XCIgbWlnaHQgYmUgaW52YWxpZGApO1xuICAgIHJldHVybiBuYW1lO1xuICB9XG4gIHJldHVybiBuYW1lWzBdLnRvTG93ZXJDYXNlKCkgKyBuYW1lLnN1YnN0cmluZygxKTtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuLyoqXG4gKiBDbGFtcCBhbiBpbnB1dCBudW1iZXIgd2l0aGluIFsgYDAuMGAgLSBgMS4wYCBdLlxuICpcbiAqIEBwYXJhbSB2YWx1ZSBUaGUgaW5wdXQgdmFsdWVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNhdHVyYXRlKHZhbHVlOiBudW1iZXIpOiBudW1iZXIge1xuICByZXR1cm4gTWF0aC5tYXgoTWF0aC5taW4odmFsdWUsIDEuMCksIDAuMCk7XG59XG5cbi8qKlxuICogTWFwIHRoZSByYW5nZSBvZiBhbiBpbnB1dCB2YWx1ZSBmcm9tIFsgYG1pbmAgLSBgbWF4YCBdIHRvIFsgYDAuMGAgLSBgMS4wYCBdLlxuICogSWYgaW5wdXQgdmFsdWUgaXMgbGVzcyB0aGFuIGBtaW5gICwgaXQgcmV0dXJucyBgMC4wYC5cbiAqIElmIGlucHV0IHZhbHVlIGlzIGdyZWF0ZXIgdGhhbiBgbWF4YCAsIGl0IHJldHVybnMgYDEuMGAuXG4gKlxuICogU2VlIGFsc286IGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL21hdGgvTWF0aC5zbW9vdGhzdGVwXG4gKlxuICogQHBhcmFtIHggVGhlIHZhbHVlIHRoYXQgd2lsbCBiZSBtYXBwZWQgaW50byB0aGUgc3BlY2lmaWVkIHJhbmdlXG4gKiBAcGFyYW0gbWluIE1pbmltdW0gdmFsdWUgb2YgdGhlIHJhbmdlXG4gKiBAcGFyYW0gbWF4IE1heGltdW0gdmFsdWUgb2YgdGhlIHJhbmdlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsaW5zdGVwKHg6IG51bWJlciwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyKTogbnVtYmVyIHtcbiAgaWYgKHggPD0gbWluKSByZXR1cm4gMDtcbiAgaWYgKHggPj0gbWF4KSByZXR1cm4gMTtcblxuICByZXR1cm4gKHggLSBtaW4pIC8gKG1heCAtIG1pbik7XG59XG5cbmNvbnN0IF9wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfc2NhbGUgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3JvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuLyoqXG4gKiBFeHRyYWN0IHdvcmxkIHBvc2l0aW9uIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxuICpcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdFxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRXb3JsZFBvc2l0aW9uTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShvdXQsIF9yb3RhdGlvbiwgX3NjYWxlKTtcbiAgcmV0dXJuIG91dDtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHdvcmxkIHNjYWxlIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxuICpcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdFxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRXb3JsZFNjYWxlTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcbiAgb2JqZWN0Lm1hdHJpeFdvcmxkLmRlY29tcG9zZShfcG9zaXRpb24sIF9yb3RhdGlvbiwgb3V0KTtcbiAgcmV0dXJuIG91dDtcbn1cblxuLyoqXG4gKiBFeHRyYWN0IHdvcmxkIHJvdGF0aW9uIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxuICpcbiAqIEBwYXJhbSBvYmplY3QgVGhlIG9iamVjdFxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRXb3JsZFF1YXRlcm5pb25MaXRlKG9iamVjdDogVEhSRUUuT2JqZWN0M0QsIG91dDogVEhSRUUuUXVhdGVybmlvbik6IFRIUkVFLlF1YXRlcm5pb24ge1xuICBvYmplY3QubWF0cml4V29ybGQuZGVjb21wb3NlKF9wb3NpdGlvbiwgb3V0LCBfc2NhbGUpO1xuICByZXR1cm4gb3V0O1xufVxuIiwiaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgc2F0dXJhdGUgfSBmcm9tICcuLi91dGlscy9tYXRoJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVHcm91cCB9IGZyb20gJy4vVlJNQmxlbmRTaGFwZUdyb3VwJztcblxuZXhwb3J0IGNsYXNzIFZSTUJsZW5kU2hhcGVQcm94eSB7XG4gIC8qKlxuICAgKiBMaXN0IG9mIHJlZ2lzdGVyZWQgYmxlbmQgc2hhcGUuXG4gICAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF9ibGVuZFNoYXBlR3JvdXBzOiB7IFtuYW1lOiBzdHJpbmddOiBWUk1CbGVuZFNoYXBlR3JvdXAgfSA9IHt9O1xuXG4gIC8qKlxuICAgKiBBIG1hcCBmcm9tIFtbVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXV0gdG8gaXRzIGFjdHVhbCBibGVuZCBzaGFwZSBuYW1lLlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZVByZXNldE1hcDogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0gPSB7fTtcblxuICAvKipcbiAgICogQSBsaXN0IG9mIG5hbWUgb2YgdW5rbm93biBibGVuZCBzaGFwZXMuXG4gICAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF91bmtub3duR3JvdXBOYW1lczogc3RyaW5nW10gPSBbXTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUJsZW5kU2hhcGUuXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gZG8gbm90aGluZ1xuICB9XG5cbiAgLyoqXG4gICAqIExpc3Qgb2YgbmFtZSBvZiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKi9cbiAgcHVibGljIGdldCBleHByZXNzaW9ucygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbWFwIGZyb20gW1tWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdXSB0byBpdHMgYWN0dWFsIGJsZW5kIHNoYXBlIG5hbWUuXG4gICAqL1xuICBwdWJsaWMgZ2V0IGJsZW5kU2hhcGVQcmVzZXRNYXAoKTogeyBbcHJlc2V0TmFtZSBpbiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWVdPzogc3RyaW5nIH0ge1xuICAgIHJldHVybiB0aGlzLl9ibGVuZFNoYXBlUHJlc2V0TWFwO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgbGlzdCBvZiBuYW1lIG9mIHVua25vd24gYmxlbmQgc2hhcGVzLlxuICAgKi9cbiAgcHVibGljIGdldCB1bmtub3duR3JvdXBOYW1lcygpOiBzdHJpbmdbXSB7XG4gICAgcmV0dXJuIHRoaXMuX3Vua25vd25Hcm91cE5hbWVzO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiByZWdpc3RlcmVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxuICAgKi9cbiAgcHVibGljIGdldEJsZW5kU2hhcGVHcm91cChuYW1lOiBzdHJpbmcgfCBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUpOiBWUk1CbGVuZFNoYXBlR3JvdXAgfCB1bmRlZmluZWQge1xuICAgIGNvbnN0IHByZXNldE5hbWUgPSB0aGlzLl9ibGVuZFNoYXBlUHJlc2V0TWFwW25hbWUgYXMgVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lXTtcbiAgICBjb25zdCBjb250cm9sbGVyID0gcHJlc2V0TmFtZSA/IHRoaXMuX2JsZW5kU2hhcGVHcm91cHNbcHJlc2V0TmFtZV0gOiB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdO1xuICAgIGlmICghY29udHJvbGxlcikge1xuICAgICAgY29uc29sZS53YXJuKGBubyBibGVuZCBzaGFwZSBmb3VuZCBieSAke25hbWV9YCk7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICByZXR1cm4gY29udHJvbGxlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZWdpc3RlciBhIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBnb3J1cFxuICAgKiBAcGFyYW0gY29udHJvbGxlciBWUk1CbGVuZFNoYXBlQ29udHJvbGxlciB0aGF0IGRlc2NyaWJlcyB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICovXG4gIHB1YmxpYyByZWdpc3RlckJsZW5kU2hhcGVHcm91cChcbiAgICBuYW1lOiBzdHJpbmcsXG4gICAgcHJlc2V0TmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgdW5kZWZpbmVkLFxuICAgIGNvbnRyb2xsZXI6IFZSTUJsZW5kU2hhcGVHcm91cCxcbiAgKTogdm9pZCB7XG4gICAgdGhpcy5fYmxlbmRTaGFwZUdyb3Vwc1tuYW1lXSA9IGNvbnRyb2xsZXI7XG4gICAgaWYgKHByZXNldE5hbWUpIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcmVzZXRNYXBbcHJlc2V0TmFtZV0gPSBuYW1lO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl91bmtub3duR3JvdXBOYW1lcy5wdXNoKG5hbWUpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgY3VycmVudCB3ZWlnaHQgb2Ygc3BlY2lmaWVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKlxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBibGVuZCBzaGFwZSBncm91cFxuICAgKi9cbiAgcHVibGljIGdldFZhbHVlKG5hbWU6IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZSB8IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmdldEJsZW5kU2hhcGVHcm91cChuYW1lKTtcbiAgICByZXR1cm4gY29udHJvbGxlcj8ud2VpZ2h0ID8/IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogU2V0IGEgd2VpZ2h0IHRvIHNwZWNpZmllZCBibGVuZCBzaGFwZSBncm91cC5cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYmxlbmQgc2hhcGUgZ3JvdXBcbiAgICogQHBhcmFtIHdlaWdodCBXZWlnaHRcbiAgICovXG4gIHB1YmxpYyBzZXRWYWx1ZShuYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCBzdHJpbmcsIHdlaWdodDogbnVtYmVyKTogdm9pZCB7XG4gICAgY29uc3QgY29udHJvbGxlciA9IHRoaXMuZ2V0QmxlbmRTaGFwZUdyb3VwKG5hbWUpO1xuICAgIGlmIChjb250cm9sbGVyKSB7XG4gICAgICBjb250cm9sbGVyLndlaWdodCA9IHNhdHVyYXRlKHdlaWdodCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEdldCBhIHRyYWNrIG5hbWUgb2Ygc3BlY2lmaWVkIGJsZW5kIHNoYXBlIGdyb3VwLlxuICAgKiBUaGlzIHRyYWNrIG5hbWUgaXMgbmVlZGVkIHRvIG1hbmlwdWxhdGUgaXRzIGJsZW5kIHNoYXBlIGdyb3VwIHZpYSBrZXlmcmFtZSBhbmltYXRpb25zLlxuICAgKlxuICAgKiBAZXhhbXBsZSBNYW5pcHVsYXRlIGEgYmxlbmQgc2hhcGUgZ3JvdXAgdXNpbmcga2V5ZnJhbWUgYW5pbWF0aW9uXG4gICAqIGBgYGpzXG4gICAqIGNvbnN0IHRyYWNrTmFtZSA9IHZybS5ibGVuZFNoYXBlUHJveHkuZ2V0QmxlbmRTaGFwZVRyYWNrTmFtZSggVEhSRUUuVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkJsaW5rICk7XG4gICAqIGNvbnN0IHRyYWNrID0gbmV3IFRIUkVFLk51bWJlcktleWZyYW1lVHJhY2soXG4gICAqICAgbmFtZSxcbiAgICogICBbIDAuMCwgMC41LCAxLjAgXSwgLy8gdGltZXNcbiAgICogICBbIDAuMCwgMS4wLCAwLjAgXSAvLyB2YWx1ZXNcbiAgICogKTtcbiAgICpcbiAgICogY29uc3QgY2xpcCA9IG5ldyBUSFJFRS5BbmltYXRpb25DbGlwKFxuICAgKiAgICdibGluaycsIC8vIG5hbWVcbiAgICogICAxLjAsIC8vIGR1cmF0aW9uXG4gICAqICAgWyB0cmFjayBdIC8vIHRyYWNrc1xuICAgKiApO1xuICAgKlxuICAgKiBjb25zdCBtaXhlciA9IG5ldyBUSFJFRS5BbmltYXRpb25NaXhlciggdnJtLnNjZW5lICk7XG4gICAqIGNvbnN0IGFjdGlvbiA9IG1peGVyLmNsaXBBY3Rpb24oIGNsaXAgKTtcbiAgICogYWN0aW9uLnBsYXkoKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJsZW5kIHNoYXBlIGdyb3VwXG4gICAqL1xuICBwdWJsaWMgZ2V0QmxlbmRTaGFwZVRyYWNrTmFtZShuYW1lOiBWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUgfCBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcbiAgICBjb25zdCBjb250cm9sbGVyID0gdGhpcy5nZXRCbGVuZFNoYXBlR3JvdXAobmFtZSk7XG4gICAgcmV0dXJuIGNvbnRyb2xsZXIgPyBgJHtjb250cm9sbGVyLm5hbWV9LndlaWdodGAgOiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSBldmVyeSBibGVuZCBzaGFwZSBncm91cHMuXG4gICAqL1xuICBwdWJsaWMgdXBkYXRlKCk6IHZvaWQge1xuICAgIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdO1xuICAgICAgY29udHJvbGxlci5jbGVhckFwcGxpZWRXZWlnaHQoKTtcbiAgICB9KTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMuX2JsZW5kU2hhcGVHcm91cHMpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgIGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLl9ibGVuZFNoYXBlR3JvdXBzW25hbWVdO1xuICAgICAgY29udHJvbGxlci5hcHBseVdlaWdodCgpO1xuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBHTFRGU2NoZW1hLCBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSB9IGZyb20gJy4uL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlJztcbmltcG9ydCB7IHJlbmFtZU1hdGVyaWFsUHJvcGVydHkgfSBmcm9tICcuLi91dGlscy9yZW5hbWVNYXRlcmlhbFByb3BlcnR5JztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVHcm91cCB9IGZyb20gJy4vVlJNQmxlbmRTaGFwZUdyb3VwJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4vVlJNQmxlbmRTaGFwZVByb3h5JztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUJsZW5kU2hhcGVdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1CbGVuZFNoYXBlSW1wb3J0ZXIge1xuICAvKipcbiAgICogSW1wb3J0IGEgW1tWUk1CbGVuZFNoYXBlXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTUJsZW5kU2hhcGVQcm94eSB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hQmxlbmRTaGFwZTogVlJNU2NoZW1hLkJsZW5kU2hhcGUgfCB1bmRlZmluZWQgPSB2cm1FeHQuYmxlbmRTaGFwZU1hc3RlcjtcbiAgICBpZiAoIXNjaGVtYUJsZW5kU2hhcGUpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGJsZW5kU2hhcGUgPSBuZXcgVlJNQmxlbmRTaGFwZVByb3h5KCk7XG5cbiAgICBjb25zdCBibGVuZFNoYXBlR3JvdXBzOiBWUk1TY2hlbWEuQmxlbmRTaGFwZUdyb3VwW10gfCB1bmRlZmluZWQgPSBzY2hlbWFCbGVuZFNoYXBlLmJsZW5kU2hhcGVHcm91cHM7XG4gICAgaWYgKCFibGVuZFNoYXBlR3JvdXBzKSB7XG4gICAgICByZXR1cm4gYmxlbmRTaGFwZTtcbiAgICB9XG5cbiAgICBjb25zdCBibGVuZFNoYXBlUHJlc2V0TWFwOiB7IFtwcmVzZXROYW1lIGluIFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZV0/OiBzdHJpbmcgfSA9IHt9O1xuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBibGVuZFNoYXBlR3JvdXBzLm1hcChhc3luYyAoc2NoZW1hR3JvdXApID0+IHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHNjaGVtYUdyb3VwLm5hbWU7XG4gICAgICAgIGlmIChuYW1lID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1ZSTUJsZW5kU2hhcGVJbXBvcnRlcjogT25lIG9mIGJsZW5kU2hhcGVHcm91cHMgaGFzIG5vIG5hbWUnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJlc2V0TmFtZTogVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lIHwgdW5kZWZpbmVkO1xuICAgICAgICBpZiAoXG4gICAgICAgICAgc2NoZW1hR3JvdXAucHJlc2V0TmFtZSAmJlxuICAgICAgICAgIHNjaGVtYUdyb3VwLnByZXNldE5hbWUgIT09IFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Vbmtub3duICYmXG4gICAgICAgICAgIWJsZW5kU2hhcGVQcmVzZXRNYXBbc2NoZW1hR3JvdXAucHJlc2V0TmFtZV1cbiAgICAgICAgKSB7XG4gICAgICAgICAgcHJlc2V0TmFtZSA9IHNjaGVtYUdyb3VwLnByZXNldE5hbWU7XG4gICAgICAgICAgYmxlbmRTaGFwZVByZXNldE1hcFtzY2hlbWFHcm91cC5wcmVzZXROYW1lXSA9IG5hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBncm91cCA9IG5ldyBWUk1CbGVuZFNoYXBlR3JvdXAobmFtZSk7XG4gICAgICAgIGdsdGYuc2NlbmUuYWRkKGdyb3VwKTtcblxuICAgICAgICBncm91cC5pc0JpbmFyeSA9IHNjaGVtYUdyb3VwLmlzQmluYXJ5IHx8IGZhbHNlO1xuXG4gICAgICAgIGlmIChzY2hlbWFHcm91cC5iaW5kcykge1xuICAgICAgICAgIHNjaGVtYUdyb3VwLmJpbmRzLmZvckVhY2goYXN5bmMgKGJpbmQpID0+IHtcbiAgICAgICAgICAgIGlmIChiaW5kLm1lc2ggPT09IHVuZGVmaW5lZCB8fCBiaW5kLmluZGV4ID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBub2Rlc1VzaW5nTWVzaDogbnVtYmVyW10gPSBbXTtcbiAgICAgICAgICAgIChnbHRmLnBhcnNlci5qc29uLm5vZGVzIGFzIEdMVEZTY2hlbWEuTm9kZVtdKS5mb3JFYWNoKChub2RlLCBpKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChub2RlLm1lc2ggPT09IGJpbmQubWVzaCkge1xuICAgICAgICAgICAgICAgIG5vZGVzVXNpbmdNZXNoLnB1c2goaSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zdCBtb3JwaFRhcmdldEluZGV4ID0gYmluZC5pbmRleDtcblxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgIG5vZGVzVXNpbmdNZXNoLm1hcChhc3luYyAobm9kZUluZGV4KSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcHJpbWl0aXZlcyA9IChhd2FpdCBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZShnbHRmLCBub2RlSW5kZXgpKSE7XG5cbiAgICAgICAgICAgICAgICAvLyBjaGVjayBpZiB0aGUgbWVzaCBoYXMgdGhlIHRhcmdldCBtb3JwaCB0YXJnZXRcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAhcHJpbWl0aXZlcy5ldmVyeShcbiAgICAgICAgICAgICAgICAgICAgKHByaW1pdGl2ZSkgPT5cbiAgICAgICAgICAgICAgICAgICAgICBBcnJheS5pc0FycmF5KHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMpICYmXG4gICAgICAgICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCA8IHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMubGVuZ3RoLFxuICAgICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgICAgICBgVlJNQmxlbmRTaGFwZUltcG9ydGVyOiAke3NjaGVtYUdyb3VwLm5hbWV9IGF0dGVtcHRzIHRvIGluZGV4ICR7bW9ycGhUYXJnZXRJbmRleH10aCBtb3JwaCBidXQgbm90IGZvdW5kLmAsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGdyb3VwLmFkZEJpbmQoe1xuICAgICAgICAgICAgICAgICAgbWVzaGVzOiBwcmltaXRpdmVzLFxuICAgICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCxcbiAgICAgICAgICAgICAgICAgIHdlaWdodDogYmluZC53ZWlnaHQgPz8gMTAwLFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBtYXRlcmlhbFZhbHVlcyA9IHNjaGVtYUdyb3VwLm1hdGVyaWFsVmFsdWVzO1xuICAgICAgICBpZiAobWF0ZXJpYWxWYWx1ZXMpIHtcbiAgICAgICAgICBtYXRlcmlhbFZhbHVlcy5mb3JFYWNoKChtYXRlcmlhbFZhbHVlKSA9PiB7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgIG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICAgICAgbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWUgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgICBtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlID09PSB1bmRlZmluZWRcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsczogVEhSRUUuTWF0ZXJpYWxbXSA9IFtdO1xuICAgICAgICAgICAgZ2x0Zi5zY2VuZS50cmF2ZXJzZSgob2JqZWN0KSA9PiB7XG4gICAgICAgICAgICAgIGlmICgob2JqZWN0IGFzIGFueSkubWF0ZXJpYWwpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWxbXSB8IFRIUkVFLk1hdGVyaWFsID0gKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsO1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KG1hdGVyaWFsKSkge1xuICAgICAgICAgICAgICAgICAgbWF0ZXJpYWxzLnB1c2goXG4gICAgICAgICAgICAgICAgICAgIC4uLm1hdGVyaWFsLmZpbHRlcihcbiAgICAgICAgICAgICAgICAgICAgICAobXRsKSA9PiBtdGwubmFtZSA9PT0gbWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbE5hbWUhICYmIG1hdGVyaWFscy5pbmRleE9mKG10bCkgPT09IC0xLFxuICAgICAgICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKG1hdGVyaWFsLm5hbWUgPT09IG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lICYmIG1hdGVyaWFscy5pbmRleE9mKG1hdGVyaWFsKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKG1hdGVyaWFsKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBtYXRlcmlhbHMuZm9yRWFjaCgobWF0ZXJpYWwpID0+IHtcbiAgICAgICAgICAgICAgZ3JvdXAuYWRkTWF0ZXJpYWxWYWx1ZSh7XG4gICAgICAgICAgICAgICAgbWF0ZXJpYWwsXG4gICAgICAgICAgICAgICAgcHJvcGVydHlOYW1lOiByZW5hbWVNYXRlcmlhbFByb3BlcnR5KG1hdGVyaWFsVmFsdWUucHJvcGVydHlOYW1lISksXG4gICAgICAgICAgICAgICAgdGFyZ2V0VmFsdWU6IG1hdGVyaWFsVmFsdWUudGFyZ2V0VmFsdWUhLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgYmxlbmRTaGFwZS5yZWdpc3RlckJsZW5kU2hhcGVHcm91cChuYW1lLCBwcmVzZXROYW1lLCBncm91cCk7XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcmV0dXJuIGJsZW5kU2hhcGU7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEZOb2RlLCBHTFRGUHJpbWl0aXZlIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSB9IGZyb20gJy4uL3V0aWxzL21hdGgnO1xuXG5jb25zdCBWRUNUT1IzX0ZST05UID0gT2JqZWN0LmZyZWV6ZShuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgLTEuMCkpO1xuXG5jb25zdCBfcXVhdCA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5cbmVudW0gRmlyc3RQZXJzb25GbGFnIHtcbiAgQXV0byxcbiAgQm90aCxcbiAgVGhpcmRQZXJzb25Pbmx5LFxuICBGaXJzdFBlcnNvbk9ubHksXG59XG5cbi8qKlxuICogVGhpcyBjbGFzcyByZXByZXNlbnRzIGEgc2luZ2xlIFtgbWVzaEFubm90YXRpb25gXShodHRwczovL2dpdGh1Yi5jb20vdnJtLWMvVW5pVlJNL2Jsb2IvbWFzdGVyL3NwZWNpZmljYXRpb24vMC4wL3NjaGVtYS92cm0uZmlyc3RwZXJzb24ubWVzaGFubm90YXRpb24uc2NoZW1hLmpzb24pIGVudHJ5LlxuICogRWFjaCBtZXNoIHdpbGwgYmUgYXNzaWduZWQgdG8gc3BlY2lmaWVkIGxheWVyIHdoZW4geW91IGNhbGwgW1tWUk1GaXJzdFBlcnNvbi5zZXR1cF1dLlxuICovXG5leHBvcnQgY2xhc3MgVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzIHtcbiAgcHJpdmF0ZSBzdGF0aWMgX3BhcnNlRmlyc3RQZXJzb25GbGFnKGZpcnN0UGVyc29uRmxhZzogc3RyaW5nIHwgdW5kZWZpbmVkKTogRmlyc3RQZXJzb25GbGFnIHtcbiAgICBzd2l0Y2ggKGZpcnN0UGVyc29uRmxhZykge1xuICAgICAgY2FzZSAnQm90aCc6XG4gICAgICAgIHJldHVybiBGaXJzdFBlcnNvbkZsYWcuQm90aDtcbiAgICAgIGNhc2UgJ1RoaXJkUGVyc29uT25seSc6XG4gICAgICAgIHJldHVybiBGaXJzdFBlcnNvbkZsYWcuVGhpcmRQZXJzb25Pbmx5O1xuICAgICAgY2FzZSAnRmlyc3RQZXJzb25Pbmx5JzpcbiAgICAgICAgcmV0dXJuIEZpcnN0UGVyc29uRmxhZy5GaXJzdFBlcnNvbk9ubHk7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gRmlyc3RQZXJzb25GbGFnLkF1dG87XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEEgW1tGaXJzdFBlcnNvbkZsYWddXSBvZiB0aGUgYW5ub3RhdGlvbiBlbnRyeS5cbiAgICovXG4gIHB1YmxpYyBmaXJzdFBlcnNvbkZsYWc6IEZpcnN0UGVyc29uRmxhZztcblxuICAvKipcbiAgICogQSBtZXNoIHByaW1pdGl2ZXMgb2YgdGhlIGFubm90YXRpb24gZW50cnkuXG4gICAqL1xuICBwdWJsaWMgcHJpbWl0aXZlczogR0xURlByaW1pdGl2ZVtdO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgbWVzaCBhbm5vdGF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gZmlyc3RQZXJzb25GbGFnIEEgW1tGaXJzdFBlcnNvbkZsYWddXSBvZiB0aGUgYW5ub3RhdGlvbiBlbnRyeVxuICAgKiBAcGFyYW0gbm9kZSBBIG5vZGUgb2YgdGhlIGFubm90YXRpb24gZW50cnkuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihmaXJzdFBlcnNvbkZsYWc6IHN0cmluZyB8IHVuZGVmaW5lZCwgcHJpbWl0aXZlczogR0xURlByaW1pdGl2ZVtdKSB7XG4gICAgdGhpcy5maXJzdFBlcnNvbkZsYWcgPSBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3MuX3BhcnNlRmlyc3RQZXJzb25GbGFnKGZpcnN0UGVyc29uRmxhZyk7XG4gICAgdGhpcy5wcmltaXRpdmVzID0gcHJpbWl0aXZlcztcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVlJNRmlyc3RQZXJzb24ge1xuICAvKipcbiAgICogQSBkZWZhdWx0IGNhbWVyYSBsYXllciBmb3IgYEZpcnN0UGVyc29uT25seWAgbGF5ZXIuXG4gICAqXG4gICAqIEBzZWUgW1tnZXRGaXJzdFBlcnNvbk9ubHlMYXllcl1dXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBfREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSID0gOTtcblxuICAvKipcbiAgICogQSBkZWZhdWx0IGNhbWVyYSBsYXllciBmb3IgYFRoaXJkUGVyc29uT25seWAgbGF5ZXIuXG4gICAqXG4gICAqIEBzZWUgW1tnZXRUaGlyZFBlcnNvbk9ubHlMYXllcl1dXG4gICAqL1xuICBwcml2YXRlIHN0YXRpYyByZWFkb25seSBfREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSID0gMTA7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfZmlyc3RQZXJzb25Cb25lOiBHTFRGTm9kZTtcbiAgcHJpdmF0ZSByZWFkb25seSBfbWVzaEFubm90YXRpb25zOiBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NbXSA9IFtdO1xuICBwcml2YXRlIHJlYWRvbmx5IF9maXJzdFBlcnNvbkJvbmVPZmZzZXQ6IFRIUkVFLlZlY3RvcjM7XG5cbiAgcHJpdmF0ZSBfZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5fREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSO1xuICBwcml2YXRlIF90aGlyZFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVI7XG5cbiAgcHJpdmF0ZSBfaW5pdGlhbGl6ZWQgPSBmYWxzZTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUZpcnN0UGVyc29uIG9iamVjdC5cbiAgICpcbiAgICogQHBhcmFtIGZpcnN0UGVyc29uQm9uZSBBIGZpcnN0IHBlcnNvbiBib25lXG4gICAqIEBwYXJhbSBmaXJzdFBlcnNvbkJvbmVPZmZzZXQgQW4gb2Zmc2V0IGZyb20gdGhlIHNwZWNpZmllZCBmaXJzdCBwZXJzb24gYm9uZVxuICAgKiBAcGFyYW0gbWVzaEFubm90YXRpb25zIEEgcmVuZGVyZXIgc2V0dGluZ3MuIFNlZSB0aGUgZGVzY3JpcHRpb24gb2YgW1tSZW5kZXJlckZpcnN0UGVyc29uRmxhZ3NdXSBmb3IgbW9yZSBpbmZvXG4gICAqL1xuICBjb25zdHJ1Y3RvcihcbiAgICBmaXJzdFBlcnNvbkJvbmU6IEdMVEZOb2RlLFxuICAgIGZpcnN0UGVyc29uQm9uZU9mZnNldDogVEhSRUUuVmVjdG9yMyxcbiAgICBtZXNoQW5ub3RhdGlvbnM6IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFnc1tdLFxuICApIHtcbiAgICB0aGlzLl9maXJzdFBlcnNvbkJvbmUgPSBmaXJzdFBlcnNvbkJvbmU7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25Cb25lT2Zmc2V0ID0gZmlyc3RQZXJzb25Cb25lT2Zmc2V0O1xuICAgIHRoaXMuX21lc2hBbm5vdGF0aW9ucyA9IG1lc2hBbm5vdGF0aW9ucztcbiAgfVxuXG4gIHB1YmxpYyBnZXQgZmlyc3RQZXJzb25Cb25lKCk6IEdMVEZOb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RQZXJzb25Cb25lO1xuICB9XG5cbiAgcHVibGljIGdldCBtZXNoQW5ub3RhdGlvbnMoKTogVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzW10ge1xuICAgIHJldHVybiB0aGlzLl9tZXNoQW5ub3RhdGlvbnM7XG4gIH1cblxuICBwdWJsaWMgZ2V0Rmlyc3RQZXJzb25Xb3JsZERpcmVjdGlvbih0YXJnZXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcbiAgICByZXR1cm4gdGFyZ2V0LmNvcHkoVkVDVE9SM19GUk9OVCkuYXBwbHlRdWF0ZXJuaW9uKGdldFdvcmxkUXVhdGVybmlvbkxpdGUodGhpcy5fZmlyc3RQZXJzb25Cb25lLCBfcXVhdCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEEgY2FtZXJhIGxheWVyIHJlcHJlc2VudHMgYEZpcnN0UGVyc29uT25seWAgbGF5ZXIuXG4gICAqIE5vdGUgdGhhdCAqKnlvdSBtdXN0IGNhbGwgW1tzZXR1cF1dIGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlKiogb3IgaXQgZG9lcyBub3Qgd29yayBwcm9wZXJseS5cbiAgICpcbiAgICogVGhlIHZhbHVlIGlzIFtbREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSXV0gYnkgZGVmYXVsdCBidXQgeW91IGNhbiBjaGFuZ2UgdGhlIGxheWVyIGJ5IHNwZWNpZnlpbmcgdmlhIFtbc2V0dXBdXSBpZiB5b3UgcHJlZmVyLlxuICAgKlxuICAgKiBAc2VlIGh0dHBzOi8vdnJtLmRldi9lbi91bml2cm0vYXBpL3VuaXZybV91c2VfZmlyc3RwZXJzb24vXG4gICAqIEBzZWUgaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vY29yZS9MYXllcnNcbiAgICovXG4gIHB1YmxpYyBnZXQgZmlyc3RQZXJzb25Pbmx5TGF5ZXIoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXI7XG4gIH1cblxuICAvKipcbiAgICogQSBjYW1lcmEgbGF5ZXIgcmVwcmVzZW50cyBgVGhpcmRQZXJzb25Pbmx5YCBsYXllci5cbiAgICogTm90ZSB0aGF0ICoqeW91IG11c3QgY2FsbCBbW3NldHVwXV0gZmlyc3QgYmVmb3JlIHlvdSB1c2UgdGhlIGxheWVyIGZlYXR1cmUqKiBvciBpdCBkb2VzIG5vdCB3b3JrIHByb3Blcmx5LlxuICAgKlxuICAgKiBUaGUgdmFsdWUgaXMgW1tERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVJdXSBieSBkZWZhdWx0IGJ1dCB5b3UgY2FuIGNoYW5nZSB0aGUgbGF5ZXIgYnkgc3BlY2lmeWluZyB2aWEgW1tzZXR1cF1dIGlmIHlvdSBwcmVmZXIuXG4gICAqXG4gICAqIEBzZWUgaHR0cHM6Ly92cm0uZGV2L2VuL3VuaXZybS9hcGkvdW5pdnJtX3VzZV9maXJzdHBlcnNvbi9cbiAgICogQHNlZSBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9jb3JlL0xheWVyc1xuICAgKi9cbiAgcHVibGljIGdldCB0aGlyZFBlcnNvbk9ubHlMYXllcigpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcjtcbiAgfVxuXG4gIHB1YmxpYyBnZXRGaXJzdFBlcnNvbkJvbmVPZmZzZXQodGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgcmV0dXJuIHRhcmdldC5jb3B5KHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IGN1cnJlbnQgd29ybGQgcG9zaXRpb24gb2YgdGhlIGZpcnN0IHBlcnNvbi5cbiAgICogVGhlIHBvc2l0aW9uIHRha2VzIFtbRmlyc3RQZXJzb25Cb25lXV0gYW5kIFtbRmlyc3RQZXJzb25PZmZzZXRdXSBpbnRvIGFjY291bnQuXG4gICAqXG4gICAqIEBwYXJhbSB2MyB0YXJnZXRcbiAgICogQHJldHVybnMgQ3VycmVudCB3b3JsZCBwb3NpdGlvbiBvZiB0aGUgZmlyc3QgcGVyc29uXG4gICAqL1xuICBwdWJsaWMgZ2V0Rmlyc3RQZXJzb25Xb3JsZFBvc2l0aW9uKHYzOiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgLy8gVW5pVlJNI1ZSTUZpcnN0UGVyc29uRWRpdG9yXG4gICAgLy8gdmFyIHdvcmxkT2Zmc2V0ID0gaGVhZC5sb2NhbFRvV29ybGRNYXRyaXguTXVsdGlwbHlQb2ludChjb21wb25lbnQuRmlyc3RQZXJzb25PZmZzZXQpO1xuICAgIGNvbnN0IG9mZnNldCA9IHRoaXMuX2ZpcnN0UGVyc29uQm9uZU9mZnNldDtcbiAgICBjb25zdCB2NCA9IG5ldyBUSFJFRS5WZWN0b3I0KG9mZnNldC54LCBvZmZzZXQueSwgb2Zmc2V0LnosIDEuMCk7XG4gICAgdjQuYXBwbHlNYXRyaXg0KHRoaXMuX2ZpcnN0UGVyc29uQm9uZS5tYXRyaXhXb3JsZCk7XG4gICAgcmV0dXJuIHYzLnNldCh2NC54LCB2NC55LCB2NC56KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbiB0aGlzIG1ldGhvZCwgaXQgYXNzaWducyBsYXllcnMgZm9yIGV2ZXJ5IG1lc2hlcyBiYXNlZCBvbiBtZXNoIGFubm90YXRpb25zLlxuICAgKiBZb3UgbXVzdCBjYWxsIHRoaXMgbWV0aG9kIGZpcnN0IGJlZm9yZSB5b3UgdXNlIHRoZSBsYXllciBmZWF0dXJlLlxuICAgKlxuICAgKiBUaGlzIGlzIGFuIGVxdWl2YWxlbnQgb2YgW1ZSTUZpcnN0UGVyc29uLlNldHVwXShodHRwczovL2dpdGh1Yi5jb20vdnJtLWMvVW5pVlJNL2Jsb2IvbWFzdGVyL0Fzc2V0cy9WUk0vVW5pVlJNL1NjcmlwdHMvRmlyc3RQZXJzb24vVlJNRmlyc3RQZXJzb24uY3MpIG9mIHRoZSBVbmlWUk0uXG4gICAqXG4gICAqIFRoZSBgY2FtZXJhTGF5ZXJgIHBhcmFtZXRlciBzcGVjaWZpZXMgd2hpY2ggbGF5ZXIgd2lsbCBiZSBhc3NpZ25lZCBmb3IgYEZpcnN0UGVyc29uT25seWAgLyBgVGhpcmRQZXJzb25Pbmx5YC5cbiAgICogSW4gVW5pVlJNLCB3ZSBzcGVjaWZpZWQgdGhvc2UgYnkgbmFtaW5nIGVhY2ggZGVzaXJlZCBsYXllciBhcyBgRklSU1RQRVJTT05fT05MWV9MQVlFUmAgLyBgVEhJUkRQRVJTT05fT05MWV9MQVlFUmBcbiAgICogYnV0IHdlIGFyZSBnb2luZyB0byBzcGVjaWZ5IHRoZXNlIGxheWVycyBhdCBoZXJlIHNpbmNlIHdlIGFyZSB1bmFibGUgdG8gbmFtZSBsYXllcnMgaW4gVGhyZWUuanMuXG4gICAqXG4gICAqIEBwYXJhbSBjYW1lcmFMYXllciBTcGVjaWZ5IHdoaWNoIGxheWVyIHdpbGwgYmUgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIC8gYFRoaXJkUGVyc29uT25seWAuXG4gICAqL1xuICBwdWJsaWMgc2V0dXAoe1xuICAgIGZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uX0RFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUixcbiAgICB0aGlyZFBlcnNvbk9ubHlMYXllciA9IFZSTUZpcnN0UGVyc29uLl9ERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVIsXG4gIH0gPSB7fSk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9pbml0aWFsaXplZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGlzLl9pbml0aWFsaXplZCA9IHRydWU7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBmaXJzdFBlcnNvbk9ubHlMYXllcjtcbiAgICB0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllciA9IHRoaXJkUGVyc29uT25seUxheWVyO1xuXG4gICAgdGhpcy5fbWVzaEFubm90YXRpb25zLmZvckVhY2goKGl0ZW0pID0+IHtcbiAgICAgIGlmIChpdGVtLmZpcnN0UGVyc29uRmxhZyA9PT0gRmlyc3RQZXJzb25GbGFnLkZpcnN0UGVyc29uT25seSkge1xuICAgICAgICBpdGVtLnByaW1pdGl2ZXMuZm9yRWFjaCgocHJpbWl0aXZlKSA9PiB7XG4gICAgICAgICAgcHJpbWl0aXZlLmxheWVycy5zZXQodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAoaXRlbS5maXJzdFBlcnNvbkZsYWcgPT09IEZpcnN0UGVyc29uRmxhZy5UaGlyZFBlcnNvbk9ubHkpIHtcbiAgICAgICAgaXRlbS5wcmltaXRpdmVzLmZvckVhY2goKHByaW1pdGl2ZSkgPT4ge1xuICAgICAgICAgIHByaW1pdGl2ZS5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKGl0ZW0uZmlyc3RQZXJzb25GbGFnID09PSBGaXJzdFBlcnNvbkZsYWcuQXV0bykge1xuICAgICAgICB0aGlzLl9jcmVhdGVIZWFkbGVzc01vZGVsKGl0ZW0ucHJpbWl0aXZlcyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIF9leGNsdWRlVHJpYW5nbGVzKHRyaWFuZ2xlczogbnVtYmVyW10sIGJ3czogbnVtYmVyW11bXSwgc2tpbkluZGV4OiBudW1iZXJbXVtdLCBleGNsdWRlOiBudW1iZXJbXSk6IG51bWJlciB7XG4gICAgbGV0IGNvdW50ID0gMDtcbiAgICBpZiAoYndzICE9IG51bGwgJiYgYndzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJpYW5nbGVzLmxlbmd0aDsgaSArPSAzKSB7XG4gICAgICAgIGNvbnN0IGEgPSB0cmlhbmdsZXNbaV07XG4gICAgICAgIGNvbnN0IGIgPSB0cmlhbmdsZXNbaSArIDFdO1xuICAgICAgICBjb25zdCBjID0gdHJpYW5nbGVzW2kgKyAyXTtcbiAgICAgICAgY29uc3QgYncwID0gYndzW2FdO1xuICAgICAgICBjb25zdCBza2luMCA9IHNraW5JbmRleFthXTtcblxuICAgICAgICBpZiAoYncwWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzBdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzBbMV0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbMV0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MFsyXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFsyXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncwWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzNdKSkgY29udGludWU7XG5cbiAgICAgICAgY29uc3QgYncxID0gYndzW2JdO1xuICAgICAgICBjb25zdCBza2luMSA9IHNraW5JbmRleFtiXTtcbiAgICAgICAgaWYgKGJ3MVswXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVswXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncxWzFdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzFdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzFbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbMl0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MVszXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVszXSkpIGNvbnRpbnVlO1xuXG4gICAgICAgIGNvbnN0IGJ3MiA9IGJ3c1tjXTtcbiAgICAgICAgY29uc3Qgc2tpbjIgPSBza2luSW5kZXhbY107XG4gICAgICAgIGlmIChidzJbMF0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbMF0pKSBjb250aW51ZTtcbiAgICAgICAgaWYgKGJ3MlsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMlsxXSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoYncyWzJdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzJdKSkgY29udGludWU7XG4gICAgICAgIGlmIChidzJbM10gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbM10pKSBjb250aW51ZTtcblxuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBhO1xuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBiO1xuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBjO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY291bnQ7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVFcmFzZWRNZXNoKHNyYzogVEhSRUUuU2tpbm5lZE1lc2gsIGVyYXNpbmdCb25lc0luZGV4OiBudW1iZXJbXSk6IFRIUkVFLlNraW5uZWRNZXNoIHtcbiAgICBjb25zdCBkc3QgPSBuZXcgVEhSRUUuU2tpbm5lZE1lc2goc3JjLmdlb21ldHJ5LmNsb25lKCksIHNyYy5tYXRlcmlhbCk7XG4gICAgZHN0Lm5hbWUgPSBgJHtzcmMubmFtZX0oZXJhc2UpYDtcbiAgICBkc3QuZnJ1c3R1bUN1bGxlZCA9IHNyYy5mcnVzdHVtQ3VsbGVkO1xuICAgIGRzdC5sYXllcnMuc2V0KHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcblxuICAgIGNvbnN0IGdlb21ldHJ5ID0gZHN0Lmdlb21ldHJ5O1xuXG4gICAgY29uc3Qgc2tpbkluZGV4QXR0ciA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbkluZGV4JykuYXJyYXk7XG4gICAgY29uc3Qgc2tpbkluZGV4ID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBza2luSW5kZXhBdHRyLmxlbmd0aDsgaSArPSA0KSB7XG4gICAgICBza2luSW5kZXgucHVzaChbc2tpbkluZGV4QXR0cltpXSwgc2tpbkluZGV4QXR0cltpICsgMV0sIHNraW5JbmRleEF0dHJbaSArIDJdLCBza2luSW5kZXhBdHRyW2kgKyAzXV0pO1xuICAgIH1cblxuICAgIGNvbnN0IHNraW5XZWlnaHRBdHRyID0gZ2VvbWV0cnkuZ2V0QXR0cmlidXRlKCdza2luV2VpZ2h0JykuYXJyYXk7XG4gICAgY29uc3Qgc2tpbldlaWdodCA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2tpbldlaWdodEF0dHIubGVuZ3RoOyBpICs9IDQpIHtcbiAgICAgIHNraW5XZWlnaHQucHVzaChbc2tpbldlaWdodEF0dHJbaV0sIHNraW5XZWlnaHRBdHRyW2kgKyAxXSwgc2tpbldlaWdodEF0dHJbaSArIDJdLCBza2luV2VpZ2h0QXR0cltpICsgM11dKTtcbiAgICB9XG5cbiAgICBjb25zdCBpbmRleCA9IGdlb21ldHJ5LmdldEluZGV4KCk7XG4gICAgaWYgKCFpbmRleCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGdlb21ldHJ5IGRvZXNuJ3QgaGF2ZSBhbiBpbmRleCBidWZmZXJcIik7XG4gICAgfVxuICAgIGNvbnN0IG9sZFRyaWFuZ2xlcyA9IEFycmF5LmZyb20oaW5kZXguYXJyYXkpO1xuXG4gICAgY29uc3QgY291bnQgPSB0aGlzLl9leGNsdWRlVHJpYW5nbGVzKG9sZFRyaWFuZ2xlcywgc2tpbldlaWdodCwgc2tpbkluZGV4LCBlcmFzaW5nQm9uZXNJbmRleCk7XG4gICAgY29uc3QgbmV3VHJpYW5nbGU6IG51bWJlcltdID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICBuZXdUcmlhbmdsZVtpXSA9IG9sZFRyaWFuZ2xlc1tpXTtcbiAgICB9XG4gICAgZ2VvbWV0cnkuc2V0SW5kZXgobmV3VHJpYW5nbGUpO1xuXG4gICAgLy8gbXRvb24gbWF0ZXJpYWwgaW5jbHVkZXMgb25CZWZvcmVSZW5kZXIuIHRoaXMgaXMgdW5zdXBwb3J0ZWQgYXQgU2tpbm5lZE1lc2gjY2xvbmVcbiAgICBpZiAoc3JjLm9uQmVmb3JlUmVuZGVyKSB7XG4gICAgICBkc3Qub25CZWZvcmVSZW5kZXIgPSBzcmMub25CZWZvcmVSZW5kZXI7XG4gICAgfVxuICAgIGRzdC5iaW5kKG5ldyBUSFJFRS5Ta2VsZXRvbihzcmMuc2tlbGV0b24uYm9uZXMsIHNyYy5za2VsZXRvbi5ib25lSW52ZXJzZXMpLCBuZXcgVEhSRUUuTWF0cml4NCgpKTtcbiAgICByZXR1cm4gZHN0O1xuICB9XG5cbiAgcHJpdmF0ZSBfY3JlYXRlSGVhZGxlc3NNb2RlbEZvclNraW5uZWRNZXNoKHBhcmVudDogVEhSRUUuT2JqZWN0M0QsIG1lc2g6IFRIUkVFLlNraW5uZWRNZXNoKTogdm9pZCB7XG4gICAgY29uc3QgZXJhc2VCb25lSW5kZXhlczogbnVtYmVyW10gPSBbXTtcbiAgICBtZXNoLnNrZWxldG9uLmJvbmVzLmZvckVhY2goKGJvbmUsIGluZGV4KSA9PiB7XG4gICAgICBpZiAodGhpcy5faXNFcmFzZVRhcmdldChib25lKSkgZXJhc2VCb25lSW5kZXhlcy5wdXNoKGluZGV4KTtcbiAgICB9KTtcblxuICAgIC8vIFVubGlrZSBVbmlWUk0gd2UgZG9uJ3QgY29weSBtZXNoIGlmIG5vIGludmlzaWJsZSBib25lIHdhcyBmb3VuZFxuICAgIGlmICghZXJhc2VCb25lSW5kZXhlcy5sZW5ndGgpIHtcbiAgICAgIG1lc2gubGF5ZXJzLmVuYWJsZSh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcik7XG4gICAgICBtZXNoLmxheWVycy5lbmFibGUodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBtZXNoLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xuICAgIGNvbnN0IG5ld01lc2ggPSB0aGlzLl9jcmVhdGVFcmFzZWRNZXNoKG1lc2gsIGVyYXNlQm9uZUluZGV4ZXMpO1xuICAgIHBhcmVudC5hZGQobmV3TWVzaCk7XG4gIH1cblxuICBwcml2YXRlIF9jcmVhdGVIZWFkbGVzc01vZGVsKHByaW1pdGl2ZXM6IEdMVEZQcmltaXRpdmVbXSk6IHZvaWQge1xuICAgIHByaW1pdGl2ZXMuZm9yRWFjaCgocHJpbWl0aXZlKSA9PiB7XG4gICAgICBpZiAocHJpbWl0aXZlLnR5cGUgPT09ICdTa2lubmVkTWVzaCcpIHtcbiAgICAgICAgY29uc3Qgc2tpbm5lZE1lc2ggPSBwcmltaXRpdmUgYXMgVEhSRUUuU2tpbm5lZE1lc2g7XG4gICAgICAgIHRoaXMuX2NyZWF0ZUhlYWRsZXNzTW9kZWxGb3JTa2lubmVkTWVzaChza2lubmVkTWVzaC5wYXJlbnQhLCBza2lubmVkTWVzaCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAodGhpcy5faXNFcmFzZVRhcmdldChwcmltaXRpdmUpKSB7XG4gICAgICAgICAgcHJpbWl0aXZlLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogSXQganVzdCBjaGVja3Mgd2hldGhlciB0aGUgbm9kZSBvciBpdHMgcGFyZW50IGlzIHRoZSBmaXJzdCBwZXJzb24gYm9uZSBvciBub3QuXG4gICAqIEBwYXJhbSBib25lIFRoZSB0YXJnZXQgYm9uZVxuICAgKi9cbiAgcHJpdmF0ZSBfaXNFcmFzZVRhcmdldChib25lOiBHTFRGTm9kZSk6IGJvb2xlYW4ge1xuICAgIGlmIChib25lID09PSB0aGlzLl9maXJzdFBlcnNvbkJvbmUpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH0gZWxzZSBpZiAoIWJvbmUucGFyZW50KSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLl9pc0VyYXNlVGFyZ2V0KGJvbmUucGFyZW50KTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi4vaHVtYW5vaWQnO1xuaW1wb3J0IHsgR0xURk5vZGUsIEdMVEZTY2hlbWEsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyB9IGZyb20gJy4uL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlJztcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uLCBWUk1SZW5kZXJlckZpcnN0UGVyc29uRmxhZ3MgfSBmcm9tICcuL1ZSTUZpcnN0UGVyc29uJztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUZpcnN0UGVyc29uXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNRmlyc3RQZXJzb25JbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJbXBvcnQgYSBbW1ZSTUZpcnN0UGVyc29uXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIFtbVlJNSHVtYW5vaWRdXSBpbnN0YW5jZSB0aGF0IHJlcHJlc2VudHMgdGhlIFZSTVxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGLCBodW1hbm9pZDogVlJNSHVtYW5vaWQpOiBQcm9taXNlPFZSTUZpcnN0UGVyc29uIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0UGVyc29uQm9uZUluZGV4ID0gc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lO1xuXG4gICAgbGV0IGZpcnN0UGVyc29uQm9uZTogR0xURk5vZGUgfCBudWxsO1xuICAgIGlmIChmaXJzdFBlcnNvbkJvbmVJbmRleCA9PT0gdW5kZWZpbmVkIHx8IGZpcnN0UGVyc29uQm9uZUluZGV4ID09PSAtMSkge1xuICAgICAgZmlyc3RQZXJzb25Cb25lID0gaHVtYW5vaWQuZ2V0Qm9uZU5vZGUoVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUuSGVhZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGZpcnN0UGVyc29uQm9uZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBmaXJzdFBlcnNvbkJvbmVJbmRleCk7XG4gICAgfVxuXG4gICAgaWYgKCFmaXJzdFBlcnNvbkJvbmUpIHtcbiAgICAgIGNvbnNvbGUud2FybignVlJNRmlyc3RQZXJzb25JbXBvcnRlcjogQ291bGQgbm90IGZpbmQgZmlyc3RQZXJzb25Cb25lIG9mIHRoZSBWUk0nKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGZpcnN0UGVyc29uQm9uZU9mZnNldCA9IHNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZU9mZnNldFxuICAgICAgPyBuZXcgVEhSRUUuVmVjdG9yMyhcbiAgICAgICAgICBzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXQueCxcbiAgICAgICAgICBzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXQueSxcbiAgICAgICAgICAtc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LnohLCAvLyBWUk0gMC4wIHVzZXMgbGVmdC1oYW5kZWQgeS11cFxuICAgICAgICApXG4gICAgICA6IG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wNiwgMC4wKTsgLy8gZmFsbGJhY2ssIHRha2VuIGZyb20gVW5pVlJNIGltcGxlbWVudGF0aW9uXG5cbiAgICBjb25zdCBtZXNoQW5ub3RhdGlvbnM6IFZSTVJlbmRlcmVyRmlyc3RQZXJzb25GbGFnc1tdID0gW107XG4gICAgY29uc3Qgbm9kZVByaW1pdGl2ZXNNYXAgPSBhd2FpdCBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMoZ2x0Zik7XG5cbiAgICBBcnJheS5mcm9tKG5vZGVQcmltaXRpdmVzTWFwLmVudHJpZXMoKSkuZm9yRWFjaCgoW25vZGVJbmRleCwgcHJpbWl0aXZlc10pID0+IHtcbiAgICAgIGNvbnN0IHNjaGVtYU5vZGU6IEdMVEZTY2hlbWEuTm9kZSA9IGdsdGYucGFyc2VyLmpzb24ubm9kZXNbbm9kZUluZGV4XTtcblxuICAgICAgY29uc3QgZmxhZyA9IHNjaGVtYUZpcnN0UGVyc29uLm1lc2hBbm5vdGF0aW9uc1xuICAgICAgICA/IHNjaGVtYUZpcnN0UGVyc29uLm1lc2hBbm5vdGF0aW9ucy5maW5kKChhKSA9PiBhLm1lc2ggPT09IHNjaGVtYU5vZGUubWVzaClcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgICBtZXNoQW5ub3RhdGlvbnMucHVzaChuZXcgVlJNUmVuZGVyZXJGaXJzdFBlcnNvbkZsYWdzKGZsYWc/LmZpcnN0UGVyc29uRmxhZywgcHJpbWl0aXZlcykpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIG5ldyBWUk1GaXJzdFBlcnNvbihmaXJzdFBlcnNvbkJvbmUsIGZpcnN0UGVyc29uQm9uZU9mZnNldCwgbWVzaEFubm90YXRpb25zKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgR0xURk5vZGUgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1IdW1hbkxpbWl0IH0gZnJvbSAnLi9WUk1IdW1hbkxpbWl0JztcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgYSBzaW5nbGUgYGh1bWFuQm9uZWAgb2YgYSBWUk0uXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1IdW1hbkJvbmUge1xuICAvKipcbiAgICogQSBbW0dMVEZOb2RlXV0gKHRoYXQgYWN0dWFsbHkgaXMgYSBgVEhSRUUuT2JqZWN0M0RgKSB0aGF0IHJlcHJlc2VudHMgdGhlIGJvbmUuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgbm9kZTogR0xURk5vZGU7XG5cbiAgLyoqXG4gICAqIEEgW1tWUk1IdW1hbkxpbWl0XV0gb2JqZWN0IHRoYXQgcmVwcmVzZW50cyBwcm9wZXJ0aWVzIG9mIHRoZSBib25lLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGh1bWFuTGltaXQ6IFZSTUh1bWFuTGltaXQ7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1IdW1hbkJvbmUuXG4gICAqXG4gICAqIEBwYXJhbSBub2RlIEEgW1tHTFRGTm9kZV1dIHRoYXQgcmVwcmVzZW50cyB0aGUgbmV3IGJvbmVcbiAgICogQHBhcmFtIGh1bWFuTGltaXQgQSBbW1ZSTUh1bWFuTGltaXRdXSBvYmplY3QgdGhhdCByZXByZXNlbnRzIHByb3BlcnRpZXMgb2YgdGhlIG5ldyBib25lXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3Iobm9kZTogR0xURk5vZGUsIGh1bWFuTGltaXQ6IFZSTUh1bWFuTGltaXQpIHtcbiAgICB0aGlzLm5vZGUgPSBub2RlO1xuICAgIHRoaXMuaHVtYW5MaW1pdCA9IGh1bWFuTGltaXQ7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuLyoqXG4gKiBBIGNvbXBhdCBmdW5jdGlvbiBmb3IgYFF1YXRlcm5pb24uaW52ZXJ0KClgIC8gYFF1YXRlcm5pb24uaW52ZXJzZSgpYC5cbiAqIGBRdWF0ZXJuaW9uLmludmVydCgpYCBpcyBpbnRyb2R1Y2VkIGluIHIxMjMgYW5kIGBRdWF0ZXJuaW9uLmludmVyc2UoKWAgZW1pdHMgYSB3YXJuaW5nLlxuICogV2UgYXJlIGdvaW5nIHRvIHVzZSB0aGlzIGNvbXBhdCBmb3IgYSB3aGlsZS5cbiAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgcXVhdGVybmlvblxuICovXG5leHBvcnQgZnVuY3Rpb24gcXVhdEludmVydENvbXBhdDxUIGV4dGVuZHMgVEhSRUUuUXVhdGVybmlvbj4odGFyZ2V0OiBUKTogVCB7XG4gIGlmICgodGFyZ2V0IGFzIGFueSkuaW52ZXJ0KSB7XG4gICAgdGFyZ2V0LmludmVydCgpO1xuICB9IGVsc2Uge1xuICAgICh0YXJnZXQgYXMgYW55KS5pbnZlcnNlKCk7XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0O1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURk5vZGUsIFJhd1ZlY3RvcjMsIFJhd1ZlY3RvcjQsIFZSTVBvc2UsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IHF1YXRJbnZlcnRDb21wYXQgfSBmcm9tICcuLi91dGlscy9xdWF0SW52ZXJ0Q29tcGF0JztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lJztcbmltcG9ydCB7IFZSTUh1bWFuQm9uZUFycmF5IH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVBcnJheSc7XG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVzIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVzJztcbmltcG9ydCB7IFZSTUh1bWFuRGVzY3JpcHRpb24gfSBmcm9tICcuL1ZSTUh1bWFuRGVzY3JpcHRpb24nO1xuXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF9xdWF0QSA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XG5cbi8qKlxuICogQSBjbGFzcyByZXByZXNlbnRzIGh1bWFub2lkIG9mIGEgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWQge1xuICAvKipcbiAgICogQSBbW1ZSTUh1bWFuQm9uZXNdXSB0aGF0IGNvbnRhaW5zIGFsbCB0aGUgaHVtYW4gYm9uZXMgb2YgdGhlIFZSTS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gZ2V0IHRoZXNlIGJvbmVzIHVzaW5nIFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZV1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGh1bWFuQm9uZXM6IFZSTUh1bWFuQm9uZXM7XG5cbiAgLyoqXG4gICAqIEEgW1tWUk1IdW1hbkRlc2NyaXB0aW9uXV0gdGhhdCByZXByZXNlbnRzIHByb3BlcnRpZXMgb2YgdGhlIGh1bWFub2lkLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGh1bWFuRGVzY3JpcHRpb246IFZSTUh1bWFuRGVzY3JpcHRpb247XG5cbiAgLyoqXG4gICAqIEEgW1tWUk1Qb3NlXV0gdGhhdCBpcyBpdHMgZGVmYXVsdCBzdGF0ZS5cbiAgICogTm90ZSB0aGF0IGl0J3Mgbm90IGNvbXBhdGlibGUgd2l0aCBgc2V0UG9zZWAgYW5kIGBnZXRQb3NlYCwgc2luY2UgaXQgY29udGFpbnMgbm9uLXJlbGF0aXZlIHZhbHVlcyBvZiBlYWNoIGxvY2FsIHRyYW5zZm9ybXMuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgcmVzdFBvc2U6IFZSTVBvc2UgPSB7fTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNSHVtYW5vaWRdXS5cbiAgICogQHBhcmFtIGJvbmVBcnJheSBBIFtbVlJNSHVtYW5Cb25lQXJyYXldXSBjb250YWlucyBhbGwgdGhlIGJvbmVzIG9mIHRoZSBuZXcgaHVtYW5vaWRcbiAgICogQHBhcmFtIGh1bWFuRGVzY3JpcHRpb24gQSBbW1ZSTUh1bWFuRGVzY3JpcHRpb25dXSB0aGF0IHJlcHJlc2VudHMgcHJvcGVydGllcyBvZiB0aGUgbmV3IGh1bWFub2lkXG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3IoYm9uZUFycmF5OiBWUk1IdW1hbkJvbmVBcnJheSwgaHVtYW5EZXNjcmlwdGlvbjogVlJNSHVtYW5EZXNjcmlwdGlvbikge1xuICAgIHRoaXMuaHVtYW5Cb25lcyA9IHRoaXMuX2NyZWF0ZUh1bWFuQm9uZXMoYm9uZUFycmF5KTtcbiAgICB0aGlzLmh1bWFuRGVzY3JpcHRpb24gPSBodW1hbkRlc2NyaXB0aW9uO1xuXG4gICAgdGhpcy5yZXN0UG9zZSA9IHRoaXMuZ2V0UG9zZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiB0aGUgY3VycmVudCBwb3NlIG9mIHRoaXMgaHVtYW5vaWQgYXMgYSBbW1ZSTVBvc2VdXS5cbiAgICpcbiAgICogRWFjaCB0cmFuc2Zvcm0gaXMgYSBsb2NhbCB0cmFuc2Zvcm0gcmVsYXRpdmUgZnJvbSByZXN0IHBvc2UgKFQtcG9zZSkuXG4gICAqL1xuICBwdWJsaWMgZ2V0UG9zZSgpOiBWUk1Qb3NlIHtcbiAgICBjb25zdCBwb3NlOiBWUk1Qb3NlID0ge307XG4gICAgT2JqZWN0LmtleXModGhpcy5odW1hbkJvbmVzKS5mb3JFYWNoKCh2cm1Cb25lTmFtZSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Qm9uZU5vZGUodnJtQm9uZU5hbWUgYXMgVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpITtcblxuICAgICAgLy8gSWdub3JlIHdoZW4gdGhlcmUgYXJlIG5vIGJvbmUgb24gdGhlIFZSTUh1bWFub2lkXG4gICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBXaGVuIHRoZXJlIGFyZSB0d28gb3IgbW9yZSBib25lcyBpbiBhIHNhbWUgbmFtZSwgd2UgYXJlIG5vdCBnb2luZyB0byBvdmVyd3JpdGUgZXhpc3Rpbmcgb25lXG4gICAgICBpZiAocG9zZVt2cm1Cb25lTmFtZV0pIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBUYWtlIGEgZGlmZiBmcm9tIHJlc3RQb3NlXG4gICAgICAvLyBub3RlIHRoYXQgcmVzdFBvc2UgYWxzbyB3aWxsIHVzZSBnZXRQb3NlIHRvIGluaXRpYWxpemUgaXRzZWxmXG4gICAgICBfdjNBLnNldCgwLCAwLCAwKTtcbiAgICAgIF9xdWF0QS5pZGVudGl0eSgpO1xuXG4gICAgICBjb25zdCByZXN0U3RhdGUgPSB0aGlzLnJlc3RQb3NlW3ZybUJvbmVOYW1lXTtcbiAgICAgIGlmIChyZXN0U3RhdGU/LnBvc2l0aW9uKSB7XG4gICAgICAgIF92M0EuZnJvbUFycmF5KHJlc3RTdGF0ZS5wb3NpdGlvbikubmVnYXRlKCk7XG4gICAgICB9XG4gICAgICBpZiAocmVzdFN0YXRlPy5yb3RhdGlvbikge1xuICAgICAgICBxdWF0SW52ZXJ0Q29tcGF0KF9xdWF0QS5mcm9tQXJyYXkocmVzdFN0YXRlLnJvdGF0aW9uKSk7XG4gICAgICB9XG5cbiAgICAgIC8vIEdldCB0aGUgcG9zaXRpb24gLyByb3RhdGlvbiBmcm9tIHRoZSBub2RlXG4gICAgICBfdjNBLmFkZChub2RlLnBvc2l0aW9uKTtcbiAgICAgIF9xdWF0QS5wcmVtdWx0aXBseShub2RlLnF1YXRlcm5pb24pO1xuXG4gICAgICBwb3NlW3ZybUJvbmVOYW1lXSA9IHtcbiAgICAgICAgcG9zaXRpb246IF92M0EudG9BcnJheSgpIGFzIFJhd1ZlY3RvcjMsXG4gICAgICAgIHJvdGF0aW9uOiBfcXVhdEEudG9BcnJheSgpIGFzIFJhd1ZlY3RvcjQsXG4gICAgICB9O1xuICAgIH0sIHt9IGFzIFZSTVBvc2UpO1xuICAgIHJldHVybiBwb3NlO1xuICB9XG5cbiAgLyoqXG4gICAqIExldCB0aGUgaHVtYW5vaWQgZG8gYSBzcGVjaWZpZWQgcG9zZS5cbiAgICpcbiAgICogRWFjaCB0cmFuc2Zvcm0gaGF2ZSB0byBiZSBhIGxvY2FsIHRyYW5zZm9ybSByZWxhdGl2ZSBmcm9tIHJlc3QgcG9zZSAoVC1wb3NlKS5cbiAgICogWW91IGNhbiBwYXNzIHdoYXQgeW91IGdvdCBmcm9tIHtAbGluayBnZXRQb3NlfS5cbiAgICpcbiAgICogQHBhcmFtIHBvc2VPYmplY3QgQSBbW1ZSTVBvc2VdXSB0aGF0IHJlcHJlc2VudHMgYSBzaW5nbGUgcG9zZVxuICAgKi9cbiAgcHVibGljIHNldFBvc2UocG9zZU9iamVjdDogVlJNUG9zZSk6IHZvaWQge1xuICAgIE9iamVjdC5rZXlzKHBvc2VPYmplY3QpLmZvckVhY2goKGJvbmVOYW1lKSA9PiB7XG4gICAgICBjb25zdCBzdGF0ZSA9IHBvc2VPYmplY3RbYm9uZU5hbWVdITtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKGJvbmVOYW1lIGFzIFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTtcblxuICAgICAgLy8gSWdub3JlIHdoZW4gdGhlcmUgYXJlIG5vIGJvbmUgdGhhdCBpcyBkZWZpbmVkIGluIHRoZSBwb3NlIG9uIHRoZSBWUk1IdW1hbm9pZFxuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgcmVzdFN0YXRlID0gdGhpcy5yZXN0UG9zZVtib25lTmFtZV07XG4gICAgICBpZiAoIXJlc3RTdGF0ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChzdGF0ZS5wb3NpdGlvbikge1xuICAgICAgICBub2RlLnBvc2l0aW9uLmZyb21BcnJheShzdGF0ZS5wb3NpdGlvbik7XG5cbiAgICAgICAgaWYgKHJlc3RTdGF0ZS5wb3NpdGlvbikge1xuICAgICAgICAgIG5vZGUucG9zaXRpb24uYWRkKF92M0EuZnJvbUFycmF5KHJlc3RTdGF0ZS5wb3NpdGlvbikpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChzdGF0ZS5yb3RhdGlvbikge1xuICAgICAgICBub2RlLnF1YXRlcm5pb24uZnJvbUFycmF5KHN0YXRlLnJvdGF0aW9uKTtcblxuICAgICAgICBpZiAocmVzdFN0YXRlLnJvdGF0aW9uKSB7XG4gICAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLm11bHRpcGx5KF9xdWF0QS5mcm9tQXJyYXkocmVzdFN0YXRlLnJvdGF0aW9uKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNldCB0aGUgaHVtYW5vaWQgdG8gaXRzIHJlc3QgcG9zZS5cbiAgICovXG4gIHB1YmxpYyByZXNldFBvc2UoKTogdm9pZCB7XG4gICAgT2JqZWN0LmVudHJpZXModGhpcy5yZXN0UG9zZSkuZm9yRWFjaCgoW2JvbmVOYW1lLCByZXN0XSkgPT4ge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Qm9uZU5vZGUoYm9uZU5hbWUgYXMgVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpO1xuXG4gICAgICBpZiAoIW5vZGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVzdD8ucG9zaXRpb24pIHtcbiAgICAgICAgbm9kZS5wb3NpdGlvbi5mcm9tQXJyYXkocmVzdC5wb3NpdGlvbik7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXN0Py5yb3RhdGlvbikge1xuICAgICAgICBub2RlLnF1YXRlcm5pb24uZnJvbUFycmF5KHJlc3Qucm90YXRpb24pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIGJvbmUgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYSBbW1ZSTUh1bWFuQm9uZV1dLlxuICAgKlxuICAgKiBTZWUgYWxzbzogW1tWUk1IdW1hbm9pZC5nZXRCb25lc11dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogVlJNSHVtYW5Cb25lIHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdWzBdID8/IHVuZGVmaW5lZDtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm4gYm9uZXMgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYW4gYXJyYXkgb2YgW1tWUk1IdW1hbkJvbmVdXS5cbiAgICogSWYgdGhlcmUgYXJlIG5vIGJvbmVzIGJvdW5kIHRvIHRoZSBzcGVjaWZpZWQgSHVtYW5Cb25lLCBpdCB3aWxsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZV1dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lcyhuYW1lOiBWUk1TY2hlbWEuSHVtYW5vaWRCb25lTmFtZSk6IFZSTUh1bWFuQm9uZVtdIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdID8/IFtdO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBhIGJvbmUgYm91bmQgdG8gYSBzcGVjaWZpZWQgW1tIdW1hbkJvbmVdXSwgYXMgYSBUSFJFRS5PYmplY3QzRC5cbiAgICpcbiAgICogU2VlIGFsc286IFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZU5vZGVzXV1cbiAgICpcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgYm9uZSB5b3Ugd2FudFxuICAgKi9cbiAgcHVibGljIGdldEJvbmVOb2RlKG5hbWU6IFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lKTogR0xURk5vZGUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdWzBdPy5ub2RlID8/IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJuIGJvbmVzIGJvdW5kIHRvIGEgc3BlY2lmaWVkIFtbSHVtYW5Cb25lXV0sIGFzIGFuIGFycmF5IG9mIFRIUkVFLk9iamVjdDNELlxuICAgKiBJZiB0aGVyZSBhcmUgbm8gYm9uZXMgYm91bmQgdG8gdGhlIHNwZWNpZmllZCBIdW1hbkJvbmUsIGl0IHdpbGwgcmV0dXJuIGFuIGVtcHR5IGFycmF5LlxuICAgKlxuICAgKiBTZWUgYWxzbzogW1tWUk1IdW1hbm9pZC5nZXRCb25lTm9kZV1dXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcbiAgICovXG4gIHB1YmxpYyBnZXRCb25lTm9kZXMobmFtZTogVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpOiBHTFRGTm9kZVtdIHtcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdPy5tYXAoKGJvbmUpID0+IGJvbmUubm9kZSkgPz8gW107XG4gIH1cblxuICAvKipcbiAgICogUHJlcGFyZSBhIFtbVlJNSHVtYW5Cb25lc11dIGZyb20gYSBbW1ZSTUh1bWFuQm9uZUFycmF5XV0uXG4gICAqL1xuICBwcml2YXRlIF9jcmVhdGVIdW1hbkJvbmVzKGJvbmVBcnJheTogVlJNSHVtYW5Cb25lQXJyYXkpOiBWUk1IdW1hbkJvbmVzIHtcbiAgICBjb25zdCBib25lczogVlJNSHVtYW5Cb25lcyA9IE9iamVjdC52YWx1ZXMoVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUpLnJlZHVjZSgoYWNjdW0sIG5hbWUpID0+IHtcbiAgICAgIGFjY3VtW25hbWVdID0gW107XG4gICAgICByZXR1cm4gYWNjdW07XG4gICAgfSwge30gYXMgUGFydGlhbDxWUk1IdW1hbkJvbmVzPikgYXMgVlJNSHVtYW5Cb25lcztcblxuICAgIGJvbmVBcnJheS5mb3JFYWNoKChib25lKSA9PiB7XG4gICAgICBib25lc1tib25lLm5hbWVdLnB1c2goYm9uZS5ib25lKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBib25lcztcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNSHVtYW5Cb25lIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmUnO1xuaW1wb3J0IHsgVlJNSHVtYW5Cb25lQXJyYXkgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZUFycmF5JztcbmltcG9ydCB7IFZSTUh1bWFuRGVzY3JpcHRpb24gfSBmcm9tICcuL1ZSTUh1bWFuRGVzY3JpcHRpb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuL1ZSTUh1bWFub2lkJztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUh1bWFub2lkXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWRJbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJbXBvcnQgYSBbW1ZSTUh1bWFub2lkXV0gZnJvbSBhIFZSTS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTUh1bWFub2lkIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFIdW1hbm9pZDogVlJNU2NoZW1hLkh1bWFub2lkIHwgdW5kZWZpbmVkID0gdnJtRXh0Lmh1bWFub2lkO1xuICAgIGlmICghc2NoZW1hSHVtYW5vaWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGh1bWFuQm9uZUFycmF5OiBWUk1IdW1hbkJvbmVBcnJheSA9IFtdO1xuICAgIGlmIChzY2hlbWFIdW1hbm9pZC5odW1hbkJvbmVzKSB7XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgICAgc2NoZW1hSHVtYW5vaWQuaHVtYW5Cb25lcy5tYXAoYXN5bmMgKGJvbmUpID0+IHtcbiAgICAgICAgICBpZiAoIWJvbmUuYm9uZSB8fCBib25lLm5vZGUgPT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG5vZGUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgYm9uZS5ub2RlKTtcbiAgICAgICAgICBodW1hbkJvbmVBcnJheS5wdXNoKHtcbiAgICAgICAgICAgIG5hbWU6IGJvbmUuYm9uZSxcbiAgICAgICAgICAgIGJvbmU6IG5ldyBWUk1IdW1hbkJvbmUobm9kZSwge1xuICAgICAgICAgICAgICBheGlzTGVuZ3RoOiBib25lLmF4aXNMZW5ndGgsXG4gICAgICAgICAgICAgIGNlbnRlcjogYm9uZS5jZW50ZXIgJiYgbmV3IFRIUkVFLlZlY3RvcjMoYm9uZS5jZW50ZXIueCwgYm9uZS5jZW50ZXIueSwgYm9uZS5jZW50ZXIueiksXG4gICAgICAgICAgICAgIG1heDogYm9uZS5tYXggJiYgbmV3IFRIUkVFLlZlY3RvcjMoYm9uZS5tYXgueCwgYm9uZS5tYXgueSwgYm9uZS5tYXgueiksXG4gICAgICAgICAgICAgIG1pbjogYm9uZS5taW4gJiYgbmV3IFRIUkVFLlZlY3RvcjMoYm9uZS5taW4ueCwgYm9uZS5taW4ueSwgYm9uZS5taW4ueiksXG4gICAgICAgICAgICAgIHVzZURlZmF1bHRWYWx1ZXM6IGJvbmUudXNlRGVmYXVsdFZhbHVlcyxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgaHVtYW5EZXNjcmlwdGlvbjogVlJNSHVtYW5EZXNjcmlwdGlvbiA9IHtcbiAgICAgIGFybVN0cmV0Y2g6IHNjaGVtYUh1bWFub2lkLmFybVN0cmV0Y2gsXG4gICAgICBsZWdTdHJldGNoOiBzY2hlbWFIdW1hbm9pZC5sZWdTdHJldGNoLFxuICAgICAgdXBwZXJBcm1Ud2lzdDogc2NoZW1hSHVtYW5vaWQudXBwZXJBcm1Ud2lzdCxcbiAgICAgIGxvd2VyQXJtVHdpc3Q6IHNjaGVtYUh1bWFub2lkLmxvd2VyQXJtVHdpc3QsXG4gICAgICB1cHBlckxlZ1R3aXN0OiBzY2hlbWFIdW1hbm9pZC51cHBlckxlZ1R3aXN0LFxuICAgICAgbG93ZXJMZWdUd2lzdDogc2NoZW1hSHVtYW5vaWQubG93ZXJMZWdUd2lzdCxcbiAgICAgIGZlZXRTcGFjaW5nOiBzY2hlbWFIdW1hbm9pZC5mZWV0U3BhY2luZyxcbiAgICAgIGhhc1RyYW5zbGF0aW9uRG9GOiBzY2hlbWFIdW1hbm9pZC5oYXNUcmFuc2xhdGlvbkRvRixcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBWUk1IdW1hbm9pZChodW1hbkJvbmVBcnJheSwgaHVtYW5EZXNjcmlwdGlvbik7XG4gIH1cbn1cbiIsIi8qKlxuICogRXZhbHVhdGUgYSBoZXJtaXRlIHNwbGluZS5cbiAqXG4gKiBAcGFyYW0geTAgeSBvbiBzdGFydFxuICogQHBhcmFtIHkxIHkgb24gZW5kXG4gKiBAcGFyYW0gdDAgZGVsdGEgeSBvbiBzdGFydFxuICogQHBhcmFtIHQxIGRlbHRhIHkgb24gZW5kXG4gKiBAcGFyYW0geCBpbnB1dCB2YWx1ZVxuICovXG5jb25zdCBoZXJtaXRlU3BsaW5lID0gKHkwOiBudW1iZXIsIHkxOiBudW1iZXIsIHQwOiBudW1iZXIsIHQxOiBudW1iZXIsIHg6IG51bWJlcik6IG51bWJlciA9PiB7XG4gIGNvbnN0IHhjID0geCAqIHggKiB4O1xuICBjb25zdCB4cyA9IHggKiB4O1xuICBjb25zdCBkeSA9IHkxIC0geTA7XG4gIGNvbnN0IGgwMSA9IC0yLjAgKiB4YyArIDMuMCAqIHhzO1xuICBjb25zdCBoMTAgPSB4YyAtIDIuMCAqIHhzICsgeDtcbiAgY29uc3QgaDExID0geGMgLSB4cztcbiAgcmV0dXJuIHkwICsgZHkgKiBoMDEgKyB0MCAqIGgxMCArIHQxICogaDExO1xufTtcblxuLyoqXG4gKiBFdmFsdWF0ZSBhbiBBbmltYXRpb25DdXJ2ZSBhcnJheS4gU2VlIEFuaW1hdGlvbkN1cnZlIGNsYXNzIG9mIFVuaXR5IGZvciBpdHMgZGV0YWlscy5cbiAqXG4gKiBTZWU6IGh0dHBzOi8vZG9jcy51bml0eTNkLmNvbS9qYS9jdXJyZW50L1NjcmlwdFJlZmVyZW5jZS9BbmltYXRpb25DdXJ2ZS5odG1sXG4gKlxuICogQHBhcmFtIGFyciBBbiBhcnJheSByZXByZXNlbnRzIGEgY3VydmVcbiAqIEBwYXJhbSB4IEFuIGlucHV0IHZhbHVlXG4gKi9cbmNvbnN0IGV2YWx1YXRlQ3VydmUgPSAoYXJyOiBudW1iZXJbXSwgeDogbnVtYmVyKTogbnVtYmVyID0+IHtcbiAgLy8gLS0gc2FuaXR5IGNoZWNrIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGlmIChhcnIubGVuZ3RoIDwgOCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZXZhbHVhdGVDdXJ2ZTogSW52YWxpZCBjdXJ2ZSBkZXRlY3RlZCEgKEFycmF5IGxlbmd0aCBtdXN0IGJlIDggYXQgbGVhc3QpJyk7XG4gIH1cbiAgaWYgKGFyci5sZW5ndGggJSA0ICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdldmFsdWF0ZUN1cnZlOiBJbnZhbGlkIGN1cnZlIGRldGVjdGVkISAoQXJyYXkgbGVuZ3RoIG11c3QgYmUgbXVsdGlwbGVzIG9mIDQnKTtcbiAgfVxuXG4gIC8vIC0tIGNoZWNrIHJhbmdlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBsZXQgb3V0Tm9kZTtcbiAgZm9yIChvdXROb2RlID0gMDsgOyBvdXROb2RlKyspIHtcbiAgICBpZiAoYXJyLmxlbmd0aCA8PSA0ICogb3V0Tm9kZSkge1xuICAgICAgcmV0dXJuIGFycls0ICogb3V0Tm9kZSAtIDNdOyAvLyB0b28gZnVydGhlciEhIGFzc3VtZSBhcyBcIkNsYW1wXCJcbiAgICB9IGVsc2UgaWYgKHggPD0gYXJyWzQgKiBvdXROb2RlXSkge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgaW5Ob2RlID0gb3V0Tm9kZSAtIDE7XG4gIGlmIChpbk5vZGUgPCAwKSB7XG4gICAgcmV0dXJuIGFycls0ICogaW5Ob2RlICsgNV07IC8vIHRvbyBiZWhpbmQhISBhc3N1bWUgYXMgXCJDbGFtcFwiXG4gIH1cblxuICAvLyAtLSBjYWxjdWxhdGUgbG9jYWwgeCAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgY29uc3QgeDAgPSBhcnJbNCAqIGluTm9kZV07XG4gIGNvbnN0IHgxID0gYXJyWzQgKiBvdXROb2RlXTtcbiAgY29uc3QgeEhlcm1pdGUgPSAoeCAtIHgwKSAvICh4MSAtIHgwKTtcblxuICAvLyAtLSBmaW5hbGx5IGRvIHRoZSBoZXJtaXRlIHNwbGluZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgY29uc3QgeTAgPSBhcnJbNCAqIGluTm9kZSArIDFdO1xuICBjb25zdCB5MSA9IGFycls0ICogb3V0Tm9kZSArIDFdO1xuICBjb25zdCB0MCA9IGFycls0ICogaW5Ob2RlICsgM107XG4gIGNvbnN0IHQxID0gYXJyWzQgKiBvdXROb2RlICsgMl07XG4gIHJldHVybiBoZXJtaXRlU3BsaW5lKHkwLCB5MSwgdDAsIHQxLCB4SGVybWl0ZSk7XG59O1xuXG4vKipcbiAqIFRoaXMgaXMgYW4gZXF1aXZhbGVudCBvZiBDdXJ2ZU1hcHBlciBjbGFzcyBkZWZpbmVkIGluIFVuaVZSTS5cbiAqIFdpbGwgYmUgdXNlZCBmb3IgW1tWUk1Mb29rQXRBcHBseWVyXV1zLCB0byBkZWZpbmUgYmVoYXZpb3Igb2YgTG9va0F0LlxuICpcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL1VuaVZSTS9ibG9iL21hc3Rlci9Bc3NldHMvVlJNL1VuaVZSTS9TY3JpcHRzL0xvb2tBdC9DdXJ2ZU1hcHBlci5jc1xuICovXG5leHBvcnQgY2xhc3MgVlJNQ3VydmVNYXBwZXIge1xuICAvKipcbiAgICogQW4gYXJyYXkgcmVwcmVzZW50cyB0aGUgY3VydmUuIFNlZSBBbmltYXRpb25DdXJ2ZSBjbGFzcyBvZiBVbml0eSBmb3IgaXRzIGRldGFpbHMuXG4gICAqXG4gICAqIFNlZTogaHR0cHM6Ly9kb2NzLnVuaXR5M2QuY29tL2phL2N1cnJlbnQvU2NyaXB0UmVmZXJlbmNlL0FuaW1hdGlvbkN1cnZlLmh0bWxcbiAgICovXG4gIHB1YmxpYyBjdXJ2ZTogbnVtYmVyW10gPSBbMC4wLCAwLjAsIDAuMCwgMS4wLCAxLjAsIDEuMCwgMS4wLCAwLjBdO1xuXG4gIC8qKlxuICAgKiBUaGUgbWF4aW11bSBpbnB1dCByYW5nZSBvZiB0aGUgW1tWUk1DdXJ2ZU1hcHBlcl1dLlxuICAgKi9cbiAgcHVibGljIGN1cnZlWFJhbmdlRGVncmVlID0gOTAuMDtcblxuICAvKipcbiAgICogVGhlIG1heGltdW0gb3V0cHV0IHZhbHVlIG9mIHRoZSBbW1ZSTUN1cnZlTWFwcGVyXV0uXG4gICAqL1xuICBwdWJsaWMgY3VydmVZUmFuZ2VEZWdyZWUgPSAxMC4wO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgW1tWUk1DdXJ2ZU1hcHBlcl1dLlxuICAgKlxuICAgKiBAcGFyYW0geFJhbmdlIFRoZSBtYXhpbXVtIGlucHV0IHJhbmdlXG4gICAqIEBwYXJhbSB5UmFuZ2UgVGhlIG1heGltdW0gb3V0cHV0IHZhbHVlXG4gICAqIEBwYXJhbSBjdXJ2ZSBBbiBhcnJheSByZXByZXNlbnRzIHRoZSBjdXJ2ZVxuICAgKi9cbiAgY29uc3RydWN0b3IoeFJhbmdlPzogbnVtYmVyLCB5UmFuZ2U/OiBudW1iZXIsIGN1cnZlPzogbnVtYmVyW10pIHtcbiAgICBpZiAoeFJhbmdlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuY3VydmVYUmFuZ2VEZWdyZWUgPSB4UmFuZ2U7XG4gICAgfVxuXG4gICAgaWYgKHlSYW5nZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmN1cnZlWVJhbmdlRGVncmVlID0geVJhbmdlO1xuICAgIH1cblxuICAgIGlmIChjdXJ2ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmN1cnZlID0gY3VydmU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEV2YWx1YXRlIGFuIGlucHV0IHZhbHVlIGFuZCBvdXRwdXQgYSBtYXBwZWQgdmFsdWUuXG4gICAqXG4gICAqIEBwYXJhbSBzcmMgVGhlIGlucHV0IHZhbHVlXG4gICAqL1xuICBwdWJsaWMgbWFwKHNyYzogbnVtYmVyKTogbnVtYmVyIHtcbiAgICBjb25zdCBjbGFtcGVkU3JjID0gTWF0aC5taW4oTWF0aC5tYXgoc3JjLCAwLjApLCB0aGlzLmN1cnZlWFJhbmdlRGVncmVlKTtcbiAgICBjb25zdCB4ID0gY2xhbXBlZFNyYyAvIHRoaXMuY3VydmVYUmFuZ2VEZWdyZWU7XG4gICAgcmV0dXJuIHRoaXMuY3VydmVZUmFuZ2VEZWdyZWUgKiBldmFsdWF0ZUN1cnZlKHRoaXMuY3VydmUsIHgpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpcyB1c2VkIGJ5IFtbVlJNTG9va0F0SGVhZF1dLCBhcHBsaWVzIGxvb2sgYXQgZGlyZWN0aW9uLlxuICogVGhlcmUgYXJlIGN1cnJlbnRseSB0d28gdmFyaWFudCBvZiBhcHBsaWVyOiBbW1ZSTUxvb2tBdEJvbmVBcHBseWVyXV0gYW5kIFtbVlJNTG9va0F0QmxlbmRTaGFwZUFwcGx5ZXJdXS5cbiAqL1xuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFZSTUxvb2tBdEFwcGx5ZXIge1xuICAvKipcbiAgICogSXQgcmVwcmVzZW50cyBpdHMgdHlwZSBvZiBhcHBsaWVyLlxuICAgKi9cbiAgcHVibGljIGFic3RyYWN0IHJlYWRvbmx5IHR5cGU6IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lO1xuXG4gIC8qKlxuICAgKiBBcHBseSBsb29rIGF0IGRpcmVjdGlvbiB0byBpdHMgYXNzb2NpYXRlZCBWUk0gbW9kZWwuXG4gICAqXG4gICAqIEBwYXJhbSBldWxlciBgVEhSRUUuRXVsZXJgIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgdGhlIGxvb2sgYXQgZGlyZWN0aW9uXG4gICAqL1xuICBwdWJsaWMgYWJzdHJhY3QgbG9va0F0KGV1bGVyOiBUSFJFRS5FdWxlcik6IHZvaWQ7XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuLi9ibGVuZHNoYXBlJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUN1cnZlTWFwcGVyIH0gZnJvbSAnLi9WUk1DdXJ2ZU1hcHBlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcblxuLyoqXG4gKiBUaGlzIGNsYXNzIGlzIHVzZWQgYnkgW1tWUk1Mb29rQXRIZWFkXV0sIGFwcGxpZXMgbG9vayBhdCBkaXJlY3Rpb24gdG8gZXllIGJsZW5kIHNoYXBlcyBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyIGV4dGVuZHMgVlJNTG9va0F0QXBwbHllciB7XG4gIHB1YmxpYyByZWFkb25seSB0eXBlID0gVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQmxlbmRTaGFwZTtcblxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZUhvcml6b250YWw6IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsRG93bjogVlJNQ3VydmVNYXBwZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnZlVmVydGljYWxVcDogVlJNQ3VydmVNYXBwZXI7XG5cbiAgcHJpdmF0ZSByZWFkb25seSBfYmxlbmRTaGFwZVByb3h5OiBWUk1CbGVuZFNoYXBlUHJveHk7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllci5cbiAgICpcbiAgICogQHBhcmFtIGJsZW5kU2hhcGVQcm94eSBBIFtbVlJNQmxlbmRTaGFwZVByb3h5XV0gdXNlZCBieSB0aGlzIGFwcGxpZXJcbiAgICogQHBhcmFtIGN1cnZlSG9yaXpvbnRhbCBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxuICAgKiBAcGFyYW0gY3VydmVWZXJ0aWNhbERvd24gQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgZG93biBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxVcCBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciB1cCBkaXJlY3Rpb25cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGN1cnZlSG9yaXpvbnRhbDogVlJNQ3VydmVNYXBwZXIsXG4gICAgY3VydmVWZXJ0aWNhbERvd246IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlVmVydGljYWxVcDogVlJNQ3VydmVNYXBwZXIsXG4gICkge1xuICAgIHN1cGVyKCk7XG5cbiAgICB0aGlzLl9jdXJ2ZUhvcml6b250YWwgPSBjdXJ2ZUhvcml6b250YWw7XG4gICAgdGhpcy5fY3VydmVWZXJ0aWNhbERvd24gPSBjdXJ2ZVZlcnRpY2FsRG93bjtcbiAgICB0aGlzLl9jdXJ2ZVZlcnRpY2FsVXAgPSBjdXJ2ZVZlcnRpY2FsVXA7XG5cbiAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkgPSBibGVuZFNoYXBlUHJveHk7XG4gIH1cblxuICBwdWJsaWMgbmFtZSgpOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZSB7XG4gICAgcmV0dXJuIFZSTVNjaGVtYS5GaXJzdFBlcnNvbkxvb2tBdFR5cGVOYW1lLkJsZW5kU2hhcGU7XG4gIH1cblxuICBwdWJsaWMgbG9va0F0KGV1bGVyOiBUSFJFRS5FdWxlcik6IHZvaWQge1xuICAgIGNvbnN0IHNyY1ggPSBldWxlci54O1xuICAgIGNvbnN0IHNyY1kgPSBldWxlci55O1xuXG4gICAgaWYgKHNyY1ggPCAwLjApIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va3VwLCAwLjApO1xuICAgICAgdGhpcy5fYmxlbmRTaGFwZVByb3h5LnNldFZhbHVlKFZSTVNjaGVtYS5CbGVuZFNoYXBlUHJlc2V0TmFtZS5Mb29rZG93biwgdGhpcy5fY3VydmVWZXJ0aWNhbERvd24ubWFwKC1zcmNYKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2Rvd24sIDAuMCk7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2t1cCwgdGhpcy5fY3VydmVWZXJ0aWNhbFVwLm1hcChzcmNYKSk7XG4gICAgfVxuXG4gICAgaWYgKHNyY1kgPCAwLjApIHtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2xlZnQsIDAuMCk7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tyaWdodCwgdGhpcy5fY3VydmVIb3Jpem9udGFsLm1hcCgtc3JjWSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9ibGVuZFNoYXBlUHJveHkuc2V0VmFsdWUoVlJNU2NoZW1hLkJsZW5kU2hhcGVQcmVzZXROYW1lLkxvb2tyaWdodCwgMC4wKTtcbiAgICAgIHRoaXMuX2JsZW5kU2hhcGVQcm94eS5zZXRWYWx1ZShWUk1TY2hlbWEuQmxlbmRTaGFwZVByZXNldE5hbWUuTG9va2xlZnQsIHRoaXMuX2N1cnZlSG9yaXpvbnRhbC5tYXAoc3JjWSkpO1xuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbi9WUk1GaXJzdFBlcnNvbic7XG5pbXBvcnQgeyBnZXRXb3JsZFF1YXRlcm5pb25MaXRlIH0gZnJvbSAnLi4vdXRpbHMvbWF0aCc7XG5pbXBvcnQgeyBxdWF0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvcXVhdEludmVydENvbXBhdCc7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcblxuY29uc3QgVkVDVE9SM19GUk9OVCA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLlZlY3RvcjMoMC4wLCAwLjAsIC0xLjApKTtcblxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF92M0MgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3F1YXQgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG4vKipcbiAqIEEgY2xhc3MgcmVwcmVzZW50cyBsb29rIGF0IG9mIGEgVlJNLlxuICovXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0SGVhZCB7XG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgRVVMRVJfT1JERVIgPSAnWVhaJzsgLy8geWF3LXBpdGNoLXJvbGxcblxuICAvKipcbiAgICogQXNzb2NpYXRlZCBbW1ZSTUZpcnN0UGVyc29uXV0sIHdpbGwgYmUgdXNlZCBmb3IgZGlyZWN0aW9uIGNhbGN1bGF0aW9uLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbjtcblxuICAvKipcbiAgICogQXNzb2NpYXRlZCBbW1ZSTUxvb2tBdEFwcGx5ZXJdXSwgaXRzIGxvb2sgYXQgZGlyZWN0aW9uIHdpbGwgYmUgYXBwbGllZCB0byB0aGUgbW9kZWwgdXNpbmcgdGhpcyBhcHBsaWVyLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGFwcGx5ZXI/OiBWUk1Mb29rQXRBcHBseWVyO1xuXG4gIC8qKlxuICAgKiBJZiB0aGlzIGlzIHRydWUsIGl0cyBsb29rIGF0IGRpcmVjdGlvbiB3aWxsIGJlIHVwZGF0ZWQgYXV0b21hdGljYWxseSBieSBjYWxsaW5nIFtbVlJNTG9va0F0SGVhZC51cGRhdGVdXSAod2hpY2ggaXMgY2FsbGVkIGZyb20gW1tWUk0udXBkYXRlXV0pLlxuICAgKlxuICAgKiBTZWUgYWxzbzogW1tWUk1Mb29rQXRIZWFkLnRhcmdldF1dXG4gICAqL1xuICBwdWJsaWMgYXV0b1VwZGF0ZSA9IHRydWU7XG5cbiAgLyoqXG4gICAqIFRoZSB0YXJnZXQgb2JqZWN0IG9mIHRoZSBsb29rIGF0LlxuICAgKiBOb3RlIHRoYXQgaXQgZG9lcyBub3QgbWFrZSBhbnkgc2Vuc2UgaWYgW1tWUk1Mb29rQXRIZWFkLmF1dG9VcGRhdGVdXSBpcyBkaXNhYmxlZC5cbiAgICovXG4gIHB1YmxpYyB0YXJnZXQ/OiBUSFJFRS5PYmplY3QzRDtcblxuICBwcm90ZWN0ZWQgX2V1bGVyOiBUSFJFRS5FdWxlciA9IG5ldyBUSFJFRS5FdWxlcigwLjAsIDAuMCwgMC4wLCBWUk1Mb29rQXRIZWFkLkVVTEVSX09SREVSKTtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUxvb2tBdEhlYWQuXG4gICAqXG4gICAqIEBwYXJhbSBmaXJzdFBlcnNvbiBBIFtbVlJNRmlyc3RQZXJzb25dXSB0aGF0IHdpbGwgYmUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbmV3IFZSTUxvb2tBdEhlYWRcbiAgICogQHBhcmFtIGFwcGx5ZXIgQSBbW1ZSTUxvb2tBdEFwcGx5ZXJdXSB0aGF0IHdpbGwgYmUgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbmV3IFZSTUxvb2tBdEhlYWRcbiAgICovXG4gIGNvbnN0cnVjdG9yKGZpcnN0UGVyc29uOiBWUk1GaXJzdFBlcnNvbiwgYXBwbHllcj86IFZSTUxvb2tBdEFwcGx5ZXIpIHtcbiAgICB0aGlzLmZpcnN0UGVyc29uID0gZmlyc3RQZXJzb247XG4gICAgdGhpcy5hcHBseWVyID0gYXBwbHllcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgaXRzIGxvb2sgYXQgZGlyZWN0aW9uIGluIHdvcmxkIGNvb3JkaW5hdGUuXG4gICAqXG4gICAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgYFRIUkVFLlZlY3RvcjNgXG4gICAqL1xuICBwdWJsaWMgZ2V0TG9va0F0V29ybGREaXJlY3Rpb24odGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XG4gICAgY29uc3Qgcm90ID0gZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZSwgX3F1YXQpO1xuICAgIHJldHVybiB0YXJnZXQuY29weShWRUNUT1IzX0ZST05UKS5hcHBseUV1bGVyKHRoaXMuX2V1bGVyKS5hcHBseVF1YXRlcm5pb24ocm90KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgaXRzIGxvb2sgYXQgcG9zaXRpb24uXG4gICAqIE5vdGUgdGhhdCBpdHMgcmVzdWx0IHdpbGwgYmUgaW5zdGFudGx5IG92ZXJ3cml0dGVuIGlmIFtbVlJNTG9va0F0SGVhZC5hdXRvVXBkYXRlXV0gaXMgZW5hYmxlZC5cbiAgICpcbiAgICogQHBhcmFtIHBvc2l0aW9uIEEgdGFyZ2V0IHBvc2l0aW9uXG4gICAqL1xuICBwdWJsaWMgbG9va0F0KHBvc2l0aW9uOiBUSFJFRS5WZWN0b3IzKTogdm9pZCB7XG4gICAgdGhpcy5fY2FsY0V1bGVyKHRoaXMuX2V1bGVyLCBwb3NpdGlvbik7XG5cbiAgICBpZiAodGhpcy5hcHBseWVyKSB7XG4gICAgICB0aGlzLmFwcGx5ZXIubG9va0F0KHRoaXMuX2V1bGVyKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHRoZSBWUk1Mb29rQXRIZWFkLlxuICAgKiBJZiBbW1ZSTUxvb2tBdEhlYWQuYXV0b1VwZGF0ZV1dIGlzIGRpc2FibGVkLCBpdCB3aWxsIGRvIG5vdGhpbmcuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICh0aGlzLnRhcmdldCAmJiB0aGlzLmF1dG9VcGRhdGUpIHtcbiAgICAgIHRoaXMubG9va0F0KHRoaXMudGFyZ2V0LmdldFdvcmxkUG9zaXRpb24oX3YzQSkpO1xuXG4gICAgICBpZiAodGhpcy5hcHBseWVyKSB7XG4gICAgICAgIHRoaXMuYXBwbHllci5sb29rQXQodGhpcy5fZXVsZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCBfY2FsY0V1bGVyKHRhcmdldDogVEhSRUUuRXVsZXIsIHBvc2l0aW9uOiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuRXVsZXIge1xuICAgIGNvbnN0IGhlYWRQb3NpdGlvbiA9IHRoaXMuZmlyc3RQZXJzb24uZ2V0Rmlyc3RQZXJzb25Xb3JsZFBvc2l0aW9uKF92M0IpO1xuXG4gICAgLy8gTG9vayBhdCBkaXJlY3Rpb24gaW4gd29ybGQgY29vcmRpbmF0ZVxuICAgIGNvbnN0IGxvb2tBdERpciA9IF92M0MuY29weShwb3NpdGlvbikuc3ViKGhlYWRQb3NpdGlvbikubm9ybWFsaXplKCk7XG5cbiAgICAvLyBUcmFuc2Zvcm0gdGhlIGRpcmVjdGlvbiBpbnRvIGxvY2FsIGNvb3JkaW5hdGUgZnJvbSB0aGUgZmlyc3QgcGVyc29uIGJvbmVcbiAgICBsb29rQXREaXIuYXBwbHlRdWF0ZXJuaW9uKHF1YXRJbnZlcnRDb21wYXQoZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSh0aGlzLmZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZSwgX3F1YXQpKSk7XG5cbiAgICAvLyBjb252ZXJ0IHRoZSBkaXJlY3Rpb24gaW50byBldWxlclxuICAgIHRhcmdldC54ID0gTWF0aC5hdGFuMihsb29rQXREaXIueSwgTWF0aC5zcXJ0KGxvb2tBdERpci54ICogbG9va0F0RGlyLnggKyBsb29rQXREaXIueiAqIGxvb2tBdERpci56KSk7XG4gICAgdGFyZ2V0LnkgPSBNYXRoLmF0YW4yKC1sb29rQXREaXIueCwgLWxvb2tBdERpci56KTtcblxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi4vaHVtYW5vaWQnO1xuaW1wb3J0IHsgR0xURk5vZGUsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUN1cnZlTWFwcGVyIH0gZnJvbSAnLi9WUk1DdXJ2ZU1hcHBlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWQnO1xuXG5jb25zdCBfZXVsZXIgPSBuZXcgVEhSRUUuRXVsZXIoMC4wLCAwLjAsIDAuMCwgVlJNTG9va0F0SGVhZC5FVUxFUl9PUkRFUik7XG5cbi8qKlxuICogVGhpcyBjbGFzcyBpcyB1c2VkIGJ5IFtbVlJNTG9va0F0SGVhZF1dLCBhcHBsaWVzIGxvb2sgYXQgZGlyZWN0aW9uIHRvIGV5ZSBib25lcyBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEJvbmVBcHBseWVyIGV4dGVuZHMgVlJNTG9va0F0QXBwbHllciB7XG4gIHB1YmxpYyByZWFkb25seSB0eXBlID0gVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQm9uZTtcblxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZUhvcml6b250YWxJbm5lcjogVlJNQ3VydmVNYXBwZXI7XG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnZlSG9yaXpvbnRhbE91dGVyOiBWUk1DdXJ2ZU1hcHBlcjtcbiAgcHJpdmF0ZSByZWFkb25seSBfY3VydmVWZXJ0aWNhbERvd246IFZSTUN1cnZlTWFwcGVyO1xuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyO1xuXG4gIHByaXZhdGUgcmVhZG9ubHkgX2xlZnRFeWU6IEdMVEZOb2RlIHwgbnVsbDtcbiAgcHJpdmF0ZSByZWFkb25seSBfcmlnaHRFeWU6IEdMVEZOb2RlIHwgbnVsbDtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFZSTUxvb2tBdEJvbmVBcHBseWVyLlxuICAgKlxuICAgKiBAcGFyYW0gaHVtYW5vaWQgQSBbW1ZSTUh1bWFub2lkXV0gdXNlZCBieSB0aGlzIGFwcGxpZXJcbiAgICogQHBhcmFtIGN1cnZlSG9yaXpvbnRhbElubmVyIEEgW1tWUk1DdXJ2ZU1hcHBlcl1dIHVzZWQgZm9yIGlubmVyIHRyYW5zdmVyc2UgZGlyZWN0aW9uXG4gICAqIEBwYXJhbSBjdXJ2ZUhvcml6b250YWxPdXRlciBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciBvdXRlciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxuICAgKiBAcGFyYW0gY3VydmVWZXJ0aWNhbERvd24gQSBbW1ZSTUN1cnZlTWFwcGVyXV0gdXNlZCBmb3IgZG93biBkaXJlY3Rpb25cbiAgICogQHBhcmFtIGN1cnZlVmVydGljYWxVcCBBIFtbVlJNQ3VydmVNYXBwZXJdXSB1c2VkIGZvciB1cCBkaXJlY3Rpb25cbiAgICovXG4gIGNvbnN0cnVjdG9yKFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgICBjdXJ2ZUhvcml6b250YWxJbm5lcjogVlJNQ3VydmVNYXBwZXIsXG4gICAgY3VydmVIb3Jpem9udGFsT3V0ZXI6IFZSTUN1cnZlTWFwcGVyLFxuICAgIGN1cnZlVmVydGljYWxEb3duOiBWUk1DdXJ2ZU1hcHBlcixcbiAgICBjdXJ2ZVZlcnRpY2FsVXA6IFZSTUN1cnZlTWFwcGVyLFxuICApIHtcbiAgICBzdXBlcigpO1xuXG4gICAgdGhpcy5fY3VydmVIb3Jpem9udGFsSW5uZXIgPSBjdXJ2ZUhvcml6b250YWxJbm5lcjtcbiAgICB0aGlzLl9jdXJ2ZUhvcml6b250YWxPdXRlciA9IGN1cnZlSG9yaXpvbnRhbE91dGVyO1xuICAgIHRoaXMuX2N1cnZlVmVydGljYWxEb3duID0gY3VydmVWZXJ0aWNhbERvd247XG4gICAgdGhpcy5fY3VydmVWZXJ0aWNhbFVwID0gY3VydmVWZXJ0aWNhbFVwO1xuXG4gICAgdGhpcy5fbGVmdEV5ZSA9IGh1bWFub2lkLmdldEJvbmVOb2RlKFZSTVNjaGVtYS5IdW1hbm9pZEJvbmVOYW1lLkxlZnRFeWUpO1xuICAgIHRoaXMuX3JpZ2h0RXllID0gaHVtYW5vaWQuZ2V0Qm9uZU5vZGUoVlJNU2NoZW1hLkh1bWFub2lkQm9uZU5hbWUuUmlnaHRFeWUpO1xuICB9XG5cbiAgcHVibGljIGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkIHtcbiAgICBjb25zdCBzcmNYID0gZXVsZXIueDtcbiAgICBjb25zdCBzcmNZID0gZXVsZXIueTtcblxuICAgIC8vIGxlZnRcbiAgICBpZiAodGhpcy5fbGVmdEV5ZSkge1xuICAgICAgaWYgKHNyY1ggPCAwLjApIHtcbiAgICAgICAgX2V1bGVyLnggPSAtdGhpcy5fY3VydmVWZXJ0aWNhbERvd24ubWFwKC1zcmNYKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF9ldWxlci54ID0gdGhpcy5fY3VydmVWZXJ0aWNhbFVwLm1hcChzcmNYKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHNyY1kgPCAwLjApIHtcbiAgICAgICAgX2V1bGVyLnkgPSAtdGhpcy5fY3VydmVIb3Jpem9udGFsSW5uZXIubWFwKC1zcmNZKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIF9ldWxlci55ID0gdGhpcy5fY3VydmVIb3Jpem9udGFsT3V0ZXIubWFwKHNyY1kpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLl9sZWZ0RXllLnF1YXRlcm5pb24uc2V0RnJvbUV1bGVyKF9ldWxlcik7XG4gICAgfVxuXG4gICAgLy8gcmlnaHRcbiAgICBpZiAodGhpcy5fcmlnaHRFeWUpIHtcbiAgICAgIGlmIChzcmNYIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci54ID0gLXRoaXMuX2N1cnZlVmVydGljYWxEb3duLm1hcCgtc3JjWCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueCA9IHRoaXMuX2N1cnZlVmVydGljYWxVcC5tYXAoc3JjWCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzcmNZIDwgMC4wKSB7XG4gICAgICAgIF9ldWxlci55ID0gLXRoaXMuX2N1cnZlSG9yaXpvbnRhbE91dGVyLm1hcCgtc3JjWSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBfZXVsZXIueSA9IHRoaXMuX2N1cnZlSG9yaXpvbnRhbElubmVyLm1hcChzcmNZKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5fcmlnaHRFeWUucXVhdGVybmlvbi5zZXRGcm9tRXVsZXIoX2V1bGVyKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4uL2JsZW5kc2hhcGUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbic7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IFZSTUN1cnZlTWFwcGVyIH0gZnJvbSAnLi9WUk1DdXJ2ZU1hcHBlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBseWVyJztcbmltcG9ydCB7IFZSTUxvb2tBdEJsZW5kU2hhcGVBcHBseWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRCb25lQXBwbHllciB9IGZyb20gJy4vVlJNTG9va0F0Qm9uZUFwcGx5ZXInO1xuaW1wb3J0IHsgVlJNTG9va0F0SGVhZCB9IGZyb20gJy4vVlJNTG9va0F0SGVhZCc7XG5cbi8vIFRIUkVFLk1hdGggaGFzIGJlZW4gcmVuYW1lZCB0byBUSFJFRS5NYXRoVXRpbHMgc2luY2UgcjExMy5cbi8vIFdlIGFyZSBnb2luZyB0byBkZWZpbmUgdGhlIERFRzJSQUQgYnkgb3Vyc2VsdmVzIGZvciBhIHdoaWxlXG4vLyBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMTgyNzBcbmNvbnN0IERFRzJSQUQgPSBNYXRoLlBJIC8gMTgwOyAvLyBUSFJFRS5NYXRoVXRpbHMuREVHMlJBRDtcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTUxvb2tBdEhlYWRdXSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRJbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJbXBvcnQgYSBbW1ZSTUxvb2tBdEhlYWRdXSBmcm9tIGEgVlJNLlxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICogQHBhcmFtIGJsZW5kU2hhcGVQcm94eSBBIFtbVlJNQmxlbmRTaGFwZVByb3h5XV0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cbiAgICogQHBhcmFtIGh1bWFub2lkIEEgW1tWUk1IdW1hbm9pZF1dIGluc3RhbmNlIHRoYXQgcmVwcmVzZW50cyB0aGUgVlJNXG4gICAqL1xuICBwdWJsaWMgaW1wb3J0KFxuICAgIGdsdGY6IEdMVEYsXG4gICAgZmlyc3RQZXJzb246IFZSTUZpcnN0UGVyc29uLFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgKTogVlJNTG9va0F0SGVhZCB8IG51bGwge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGFwcGx5ZXIgPSB0aGlzLl9pbXBvcnRBcHBseWVyKHNjaGVtYUZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKTtcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdEhlYWQoZmlyc3RQZXJzb24sIGFwcGx5ZXIgfHwgdW5kZWZpbmVkKTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfaW1wb3J0QXBwbHllcihcbiAgICBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uLFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgKTogVlJNTG9va0F0QXBwbHllciB8IG51bGwge1xuICAgIGNvbnN0IGxvb2tBdEhvcml6b250YWxJbm5lciA9IHNjaGVtYUZpcnN0UGVyc29uLmxvb2tBdEhvcml6b250YWxJbm5lcjtcbiAgICBjb25zdCBsb29rQXRIb3Jpem9udGFsT3V0ZXIgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRIb3Jpem9udGFsT3V0ZXI7XG4gICAgY29uc3QgbG9va0F0VmVydGljYWxEb3duID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VmVydGljYWxEb3duO1xuICAgIGNvbnN0IGxvb2tBdFZlcnRpY2FsVXAgPSBzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRWZXJ0aWNhbFVwO1xuXG4gICAgc3dpdGNoIChzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRUeXBlTmFtZSkge1xuICAgICAgY2FzZSBWUk1TY2hlbWEuRmlyc3RQZXJzb25Mb29rQXRUeXBlTmFtZS5Cb25lOiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBsb29rQXRIb3Jpem9udGFsSW5uZXIgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGxvb2tBdEhvcml6b250YWxPdXRlciA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgbG9va0F0VmVydGljYWxEb3duID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBsb29rQXRWZXJ0aWNhbFVwID09PSB1bmRlZmluZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRCb25lQXBwbHllcihcbiAgICAgICAgICAgIGh1bWFub2lkLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCb25lKGxvb2tBdEhvcml6b250YWxJbm5lciksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobG9va0F0SG9yaXpvbnRhbE91dGVyKSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQm9uZShsb29rQXRWZXJ0aWNhbERvd24pLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCb25lKGxvb2tBdFZlcnRpY2FsVXApLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGNhc2UgVlJNU2NoZW1hLkZpcnN0UGVyc29uTG9va0F0VHlwZU5hbWUuQmxlbmRTaGFwZToge1xuICAgICAgICBpZiAobG9va0F0SG9yaXpvbnRhbE91dGVyID09PSB1bmRlZmluZWQgfHwgbG9va0F0VmVydGljYWxEb3duID09PSB1bmRlZmluZWQgfHwgbG9va0F0VmVydGljYWxVcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIG5ldyBWUk1Mb29rQXRCbGVuZFNoYXBlQXBwbHllcihcbiAgICAgICAgICAgIGJsZW5kU2hhcGVQcm94eSxcbiAgICAgICAgICAgIHRoaXMuX2ltcG9ydEN1cnZlTWFwcGVyQmxlbmRTaGFwZShsb29rQXRIb3Jpem9udGFsT3V0ZXIpLFxuICAgICAgICAgICAgdGhpcy5faW1wb3J0Q3VydmVNYXBwZXJCbGVuZFNoYXBlKGxvb2tBdFZlcnRpY2FsRG93biksXG4gICAgICAgICAgICB0aGlzLl9pbXBvcnRDdXJ2ZU1hcHBlckJsZW5kU2hhcGUobG9va0F0VmVydGljYWxVcCksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZGVmYXVsdDoge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9pbXBvcnRDdXJ2ZU1hcHBlckJvbmUobWFwOiBWUk1TY2hlbWEuRmlyc3RQZXJzb25EZWdyZWVNYXApOiBWUk1DdXJ2ZU1hcHBlciB7XG4gICAgcmV0dXJuIG5ldyBWUk1DdXJ2ZU1hcHBlcihcbiAgICAgIHR5cGVvZiBtYXAueFJhbmdlID09PSAnbnVtYmVyJyA/IERFRzJSQUQgKiBtYXAueFJhbmdlIDogdW5kZWZpbmVkLFxuICAgICAgdHlwZW9mIG1hcC55UmFuZ2UgPT09ICdudW1iZXInID8gREVHMlJBRCAqIG1hcC55UmFuZ2UgOiB1bmRlZmluZWQsXG4gICAgICBtYXAuY3VydmUsXG4gICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgX2ltcG9ydEN1cnZlTWFwcGVyQmxlbmRTaGFwZShtYXA6IFZSTVNjaGVtYS5GaXJzdFBlcnNvbkRlZ3JlZU1hcCk6IFZSTUN1cnZlTWFwcGVyIHtcbiAgICByZXR1cm4gbmV3IFZSTUN1cnZlTWFwcGVyKHR5cGVvZiBtYXAueFJhbmdlID09PSAnbnVtYmVyJyA/IERFRzJSQUQgKiBtYXAueFJhbmdlIDogdW5kZWZpbmVkLCBtYXAueVJhbmdlLCBtYXAuY3VydmUpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5cbi8vIFNpbmNlIHRoZXNlIGNvbnN0YW50cyBhcmUgZGVsZXRlZCBpbiByMTM2IHdlIGhhdmUgdG8gZGVmaW5lIGJ5IG91cnNlbHZlc1xuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXG5jb25zdCBSR0JFRW5jb2RpbmcgPSAzMDAyO1xuY29uc3QgUkdCTTdFbmNvZGluZyA9IDMwMDQ7XG5jb25zdCBSR0JNMTZFbmNvZGluZyA9IDMwMDU7XG5jb25zdCBSR0JERW5jb2RpbmcgPSAzMDA2O1xuY29uc3QgR2FtbWFFbmNvZGluZyA9IDMwMDc7XG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xuXG4vKipcbiAqIENPTVBBVDogcHJlLXIxMzdcbiAqIFJlZjogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9ibG9iL3IxMzYvc3JjL3JlbmRlcmVycy93ZWJnbC9XZWJHTFByb2dyYW0uanMjTDIyXG4gKi9cbmV4cG9ydCBjb25zdCBnZXRFbmNvZGluZ0NvbXBvbmVudHMgPSAoZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZyk6IFtzdHJpbmcsIHN0cmluZ10gPT4ge1xuICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA+PSAxMzYpIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlIFRIUkVFLkxpbmVhckVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydMaW5lYXInLCAnKCB2YWx1ZSApJ107XG4gICAgICBjYXNlIFRIUkVFLnNSR0JFbmNvZGluZzpcbiAgICAgICAgcmV0dXJuIFsnc1JHQicsICcoIHZhbHVlICknXTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGNvbnNvbGUud2FybignVEhSRUUuV2ViR0xQcm9ncmFtOiBVbnN1cHBvcnRlZCBlbmNvZGluZzonLCBlbmNvZGluZyk7XG4gICAgICAgIHJldHVybiBbJ0xpbmVhcicsICcoIHZhbHVlICknXTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgLy8gQ09NUEFUOiBwcmUtcjEzNlxuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgVEhSRUUuTGluZWFyRW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ0xpbmVhcicsICcoIHZhbHVlICknXTtcbiAgICAgIGNhc2UgVEhSRUUuc1JHQkVuY29kaW5nOlxuICAgICAgICByZXR1cm4gWydzUkdCJywgJyggdmFsdWUgKSddO1xuICAgICAgY2FzZSBSR0JFRW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ1JHQkUnLCAnKCB2YWx1ZSApJ107XG4gICAgICBjYXNlIFJHQk03RW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ1JHQk0nLCAnKCB2YWx1ZSwgNy4wICknXTtcbiAgICAgIGNhc2UgUkdCTTE2RW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ1JHQk0nLCAnKCB2YWx1ZSwgMTYuMCApJ107XG4gICAgICBjYXNlIFJHQkRFbmNvZGluZzpcbiAgICAgICAgcmV0dXJuIFsnUkdCRCcsICcoIHZhbHVlLCAyNTYuMCApJ107XG4gICAgICBjYXNlIEdhbW1hRW5jb2Rpbmc6XG4gICAgICAgIHJldHVybiBbJ0dhbW1hJywgJyggdmFsdWUsIGZsb2F0KCBHQU1NQV9GQUNUT1IgKSApJ107XG4gICAgICBkZWZhdWx0OlxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpO1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBDT01QQVQ6IHByZS1yMTM3XG4gKiBUaGlzIGZ1bmN0aW9uIGlzIG5vIGxvbmdlciByZXF1aXJlZCBiZWdpbm5pbmcgZnJvbSByMTM3XG4gKlxuICogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9ibG9iL3IxMzYvc3JjL3JlbmRlcmVycy93ZWJnbC9XZWJHTFByb2dyYW0uanMjTDUyXG4gKi9cbmV4cG9ydCBjb25zdCBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24gPSAoZnVuY3Rpb25OYW1lOiBzdHJpbmcsIGVuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2RpbmcpOiBzdHJpbmcgPT4ge1xuICBjb25zdCBjb21wb25lbnRzID0gZ2V0RW5jb2RpbmdDb21wb25lbnRzKGVuY29kaW5nKTtcbiAgcmV0dXJuICd2ZWM0ICcgKyBmdW5jdGlvbk5hbWUgKyAnKCB2ZWM0IHZhbHVlICkgeyByZXR1cm4gJyArIGNvbXBvbmVudHNbMF0gKyAnVG9MaW5lYXInICsgY29tcG9uZW50c1sxXSArICc7IH0nO1xufTtcbiIsIi8qIHRzbGludDpkaXNhYmxlOm1lbWJlci1vcmRlcmluZyAqL1xuXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgdmVydGV4U2hhZGVyIGZyb20gJy4vc2hhZGVycy9tdG9vbi52ZXJ0JztcbmltcG9ydCBmcmFnbWVudFNoYWRlciBmcm9tICcuL3NoYWRlcnMvbXRvb24uZnJhZyc7XG5pbXBvcnQgeyBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24gfSBmcm9tICcuL2dldFRleGVsRGVjb2RpbmdGdW5jdGlvbic7XG5cbmNvbnN0IFRBVSA9IDIuMCAqIE1hdGguUEk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTVRvb25QYXJhbWV0ZXJzIGV4dGVuZHMgVEhSRUUuU2hhZGVyTWF0ZXJpYWxQYXJhbWV0ZXJzIHtcbiAgbVRvb25WZXJzaW9uPzogbnVtYmVyOyAvLyBfTVRvb25WZXJzaW9uXG5cbiAgY3V0b2ZmPzogbnVtYmVyOyAvLyBfQ3V0b2ZmXG4gIGNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gcmdiIG9mIF9Db2xvclxuICBzaGFkZUNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gX1NoYWRlQ29sb3JcbiAgbWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX01haW5UZXhcbiAgbWFpblRleD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4ICh3aWxsIGJlIHJlbmFtZWQgdG8gbWFwKVxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gIG1haW5UZXhfU1Q/OiBUSFJFRS5WZWN0b3I0OyAvLyBfTWFpblRleF9TVFxuICBzaGFkZVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU2hhZGVUZXh0dXJlXG4gIGJ1bXBTY2FsZT86IG51bWJlcjsgLy8gX0J1bXBTY2FsZSAod2lsbCBiZSBjb252ZXJ0ZWQgdG8gbm9ybWFsU2NhbGUpXG4gIG5vcm1hbE1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9CdW1wTWFwXG4gIG5vcm1hbE1hcFR5cGU/OiBUSFJFRS5Ob3JtYWxNYXBUeXBlczsgLy8gVGhyZWUuanMgc3BlY2lmaWMgdmFsdWVcbiAgbm9ybWFsU2NhbGU/OiBUSFJFRS5WZWN0b3IyOyAvLyBfQnVtcFNjYWxlIGluIFRocmVlLmpzIGZhc2hpb25cbiAgYnVtcE1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9CdW1wTWFwICh3aWxsIGJlIHJlbmFtZWQgdG8gbm9ybWFsTWFwKVxuICByZWNlaXZlU2hhZG93UmF0ZT86IG51bWJlcjsgLy8gX1JlY2VpdmVTaGFkb3dSYXRlXG4gIHJlY2VpdmVTaGFkb3dUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1JlY2VpdmVTaGFkb3dUZXh0dXJlXG4gIHNoYWRpbmdHcmFkZVJhdGU/OiBudW1iZXI7IC8vIF9TaGFkaW5nR3JhZGVSYXRlXG4gIHNoYWRpbmdHcmFkZVRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfU2hhZGluZ0dyYWRlVGV4dHVyZVxuICBzaGFkZVNoaWZ0PzogbnVtYmVyOyAvLyBfU2hhZGVTaGlmdFxuICBzaGFkZVRvb255PzogbnVtYmVyOyAvLyBfU2hhZGVUb29ueVxuICBsaWdodENvbG9yQXR0ZW51YXRpb24/OiBudW1iZXI7IC8vIF9MaWdodENvbG9yQXR0ZW51YXRpb25cbiAgaW5kaXJlY3RMaWdodEludGVuc2l0eT86IG51bWJlcjsgLy8gX0luZGlyZWN0TGlnaHRJbnRlbnNpdHlcbiAgcmltVGV4dHVyZT86IFRIUkVFLlRleHR1cmU7IC8vIF9SaW1UZXh0dXJlXG4gIHJpbUNvbG9yPzogVEhSRUUuVmVjdG9yNDsgLy8gX1JpbUNvbG9yXG4gIHJpbUxpZ2h0aW5nTWl4PzogbnVtYmVyOyAvLyBfUmltTGlnaHRpbmdNaXhcbiAgcmltRnJlc25lbFBvd2VyPzogbnVtYmVyOyAvLyBfUmltRnJlc25lbFBvd2VyXG4gIHJpbUxpZnQ/OiBudW1iZXI7IC8vIF9SaW1MaWZ0XG4gIHNwaGVyZUFkZD86IFRIUkVFLlRleHR1cmU7IC8vIF9TcGhlcmVBZGRcbiAgZW1pc3Npb25Db2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9FbWlzc2lvbkNvbG9yXG4gIGVtaXNzaXZlTWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX0VtaXNzaW9uTWFwXG4gIGVtaXNzaW9uTWFwPzogVEhSRUUuVGV4dHVyZTsgLy8gX0VtaXNzaW9uTWFwICh3aWxsIGJlIHJlbmFtZWQgdG8gZW1pc3NpdmVNYXApXG4gIG91dGxpbmVXaWR0aFRleHR1cmU/OiBUSFJFRS5UZXh0dXJlOyAvLyBfT3V0bGluZVdpZHRoVGV4dHVyZVxuICBvdXRsaW5lV2lkdGg/OiBudW1iZXI7IC8vIF9PdXRsaW5lV2lkdGhcbiAgb3V0bGluZVNjYWxlZE1heERpc3RhbmNlPzogbnVtYmVyOyAvLyBfT3V0bGluZVNjYWxlZE1heERpc3RhbmNlXG4gIG91dGxpbmVDb2xvcj86IFRIUkVFLlZlY3RvcjQ7IC8vIF9PdXRsaW5lQ29sb3JcbiAgb3V0bGluZUxpZ2h0aW5nTWl4PzogbnVtYmVyOyAvLyBfT3V0bGluZUxpZ2h0aW5nTWl4XG4gIHV2QW5pbU1hc2tUZXh0dXJlPzogVEhSRUUuVGV4dHVyZTsgLy8gX1V2QW5pbU1hc2tUZXh0dXJlXG4gIHV2QW5pbVNjcm9sbFg/OiBudW1iZXI7IC8vIF9VdkFuaW1TY3JvbGxYXG4gIHV2QW5pbVNjcm9sbFk/OiBudW1iZXI7IC8vIF9VdkFuaW1TY3JvbGxZXG4gIHV2QW5pbVJvdGF0aW9uPzogbnVtYmVyOyAvLyBfdXZBbmltUm90YXRpb25cblxuICBkZWJ1Z01vZGU/OiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHwgbnVtYmVyOyAvLyBfRGVidWdNb2RlXG4gIGJsZW5kTW9kZT86IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHwgbnVtYmVyOyAvLyBfQmxlbmRNb2RlXG4gIG91dGxpbmVXaWR0aE1vZGU/OiBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSB8IG51bWJlcjsgLy8gT3V0bGluZVdpZHRoTW9kZVxuICBvdXRsaW5lQ29sb3JNb2RlPzogTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUgfCBudW1iZXI7IC8vIE91dGxpbmVDb2xvck1vZGVcbiAgY3VsbE1vZGU/OiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUgfCBudW1iZXI7IC8vIF9DdWxsTW9kZVxuICBvdXRsaW5lQ3VsbE1vZGU/OiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUgfCBudW1iZXI7IC8vIF9PdXRsaW5lQ3VsbE1vZGVcbiAgc3JjQmxlbmQ/OiBudW1iZXI7IC8vIF9TcmNCbGVuZFxuICBkc3RCbGVuZD86IG51bWJlcjsgLy8gX0RzdEJsZW5kXG4gIHpXcml0ZT86IG51bWJlcjsgLy8gX1pXcml0ZSAod2lsbCBiZSByZW5hbWVkIHRvIGRlcHRoV3JpdGUpXG5cbiAgaXNPdXRsaW5lPzogYm9vbGVhbjtcblxuICAvKipcbiAgICogU3BlY2lmeSB0aGUgZW5jb2Rpbmcgb2YgaW5wdXQgdW5pZm9ybSBjb2xvcnMuXG4gICAqXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuc1JHQkVuY29kaW5nYCwgdXNlIGBUSFJFRS5zUkdCRW5jb2RpbmdgLlxuICAgKlxuICAgKiBFbmNvZGluZ3Mgb2YgdGV4dHVyZXMgc2hvdWxkIGJlIHNldCBpbmRlcGVuZGVudGx5IG9uIHRleHR1cmVzLlxuICAgKlxuICAgKiBUaGlzIHdpbGwgdXNlIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AgaWYgdGhpcyBvcHRpb24gaXNuJ3Qgc3BlY2lmaWVkLlxuICAgKlxuICAgKiBTZWUgYWxzbzogaHR0cHM6Ly90aHJlZWpzLm9yZy9kb2NzLyNhcGkvZW4vcmVuZGVyZXJzL1dlYkdMUmVuZGVyZXIub3V0cHV0RW5jb2RpbmdcbiAgICovXG4gIGVuY29kaW5nPzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUge1xuICBPZmYsXG4gIEZyb250LFxuICBCYWNrLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIHtcbiAgTm9uZSxcbiAgTm9ybWFsLFxuICBMaXRTaGFkZVJhdGUsXG4gIFVWLFxufVxuXG5leHBvcnQgZW51bSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZSB7XG4gIEZpeGVkQ29sb3IsXG4gIE1peGVkTGlnaHRpbmcsXG59XG5cbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcbiAgTm9uZSxcbiAgV29ybGRDb29yZGluYXRlcyxcbiAgU2NyZWVuQ29vcmRpbmF0ZXMsXG59XG5cbmV4cG9ydCBlbnVtIE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIHtcbiAgT3BhcXVlLFxuICBDdXRvdXQsXG4gIFRyYW5zcGFyZW50LFxuICBUcmFuc3BhcmVudFdpdGhaV3JpdGUsXG59XG5cbi8qKlxuICogTVRvb24gaXMgYSBtYXRlcmlhbCBzcGVjaWZpY2F0aW9uIHRoYXQgaGFzIHZhcmlvdXMgZmVhdHVyZXMuXG4gKiBUaGUgc3BlYyBhbmQgaW1wbGVtZW50YXRpb24gYXJlIG9yaWdpbmFsbHkgZm91bmRlZCBmb3IgVW5pdHkgZW5naW5lIGFuZCB0aGlzIGlzIGEgcG9ydCBvZiB0aGUgbWF0ZXJpYWwuXG4gKlxuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vU2FudGFyaC9NVG9vblxuICovXG5leHBvcnQgY2xhc3MgTVRvb25NYXRlcmlhbCBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsIHtcbiAgLyoqXG4gICAqIFJlYWRvbmx5IGJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhpcyBpcyBhIFtbTVRvb25NYXRlcmlhbF1dLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGlzTVRvb25NYXRlcmlhbDogYm9vbGVhbiA9IHRydWU7XG5cbiAgcHVibGljIGN1dG9mZiA9IDAuNTsgLy8gX0N1dG9mZlxuICBwdWJsaWMgY29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgxLjAsIDEuMCwgMS4wLCAxLjApOyAvLyBfQ29sb3JcbiAgcHVibGljIHNoYWRlQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjk3LCAwLjgxLCAwLjg2LCAxLjApOyAvLyBfU2hhZGVDb2xvclxuICBwdWJsaWMgbWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9NYWluVGV4XG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cbiAgcHVibGljIG1haW5UZXhfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfTWFpblRleF9TVFxuICBwdWJsaWMgc2hhZGVUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9TaGFkZVRleHR1cmVcbiAgLy8gcHVibGljIHNoYWRlVGV4dHVyZV9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9TaGFkZVRleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIG5vcm1hbE1hcDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfQnVtcE1hcC4gYWdhaW4sIFRISVMgSVMgX0J1bXBNYXBcbiAgcHVibGljIG5vcm1hbE1hcFR5cGUgPSBUSFJFRS5UYW5nZW50U3BhY2VOb3JtYWxNYXA7IC8vIFRocmVlLmpzIHJlcXVpcmVzIHRoaXNcbiAgcHVibGljIG5vcm1hbFNjYWxlID0gbmV3IFRIUkVFLlZlY3RvcjIoMS4wLCAxLjApOyAvLyBfQnVtcFNjYWxlLCBpbiBWZWN0b3IyXG4gIC8vIHB1YmxpYyBidW1wTWFwX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX0J1bXBNYXBfU1QgKHVudXNlZClcbiAgcHVibGljIHJlY2VpdmVTaGFkb3dSYXRlID0gMS4wOyAvLyBfUmVjZWl2ZVNoYWRvd1JhdGVcbiAgcHVibGljIHJlY2VpdmVTaGFkb3dUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9SZWNlaXZlU2hhZG93VGV4dHVyZVxuICAvLyBwdWJsaWMgcmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfUmVjZWl2ZVNoYWRvd1RleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIHNoYWRpbmdHcmFkZVJhdGUgPSAxLjA7IC8vIF9TaGFkaW5nR3JhZGVSYXRlXG4gIHB1YmxpYyBzaGFkaW5nR3JhZGVUZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9TaGFkaW5nR3JhZGVUZXh0dXJlXG4gIC8vIHB1YmxpYyBzaGFkaW5nR3JhZGVUZXh0dXJlX1NUID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDEuMCwgMS4wKTsgLy8gX1NoYWRpbmdHcmFkZVRleHR1cmVfU1QgKHVudXNlZClcbiAgcHVibGljIHNoYWRlU2hpZnQgPSAwLjA7IC8vIF9TaGFkZVNoaWZ0XG4gIHB1YmxpYyBzaGFkZVRvb255ID0gMC45OyAvLyBfU2hhZGVUb29ueVxuICBwdWJsaWMgbGlnaHRDb2xvckF0dGVudWF0aW9uID0gMC4wOyAvLyBfTGlnaHRDb2xvckF0dGVudWF0aW9uXG4gIHB1YmxpYyBpbmRpcmVjdExpZ2h0SW50ZW5zaXR5ID0gMC4xOyAvLyBfSW5kaXJlY3RMaWdodEludGVuc2l0eVxuICBwdWJsaWMgcmltVGV4dHVyZTogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfUmltVGV4dHVyZVxuICBwdWJsaWMgcmltQ29sb3IgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMC4wLCAxLjApOyAvLyBfUmltQ29sb3JcbiAgcHVibGljIHJpbUxpZ2h0aW5nTWl4ID0gMC4wOyAvLyBfUmltTGlnaHRpbmdNaXhcbiAgcHVibGljIHJpbUZyZXNuZWxQb3dlciA9IDEuMDsgLy8gX1JpbUZyZXNuZWxQb3dlclxuICBwdWJsaWMgcmltTGlmdCA9IDAuMDsgLy8gX1JpbUxpZnRcbiAgcHVibGljIHNwaGVyZUFkZDogVEhSRUUuVGV4dHVyZSB8IG51bGwgPSBudWxsOyAvLyBfU3BoZXJlQWRkXG4gIC8vIHB1YmxpYyBzcGhlcmVBZGRfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfU3BoZXJlQWRkX1NUICh1bnVzZWQpXG4gIHB1YmxpYyBlbWlzc2lvbkNvbG9yID0gbmV3IFRIUkVFLlZlY3RvcjQoMC4wLCAwLjAsIDAuMCwgMS4wKTsgLy8gX0VtaXNzaW9uQ29sb3JcbiAgcHVibGljIGVtaXNzaXZlTWFwOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCA9IG51bGw7IC8vIF9FbWlzc2lvbk1hcFxuICAvLyBwdWJsaWMgZW1pc3Npb25NYXBfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfRW1pc3Npb25NYXBfU1QgKHVudXNlZClcbiAgcHVibGljIG91dGxpbmVXaWR0aFRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX091dGxpbmVXaWR0aFRleHR1cmVcbiAgLy8gcHVibGljIG91dGxpbmVXaWR0aFRleHR1cmVfU1QgPSBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApOyAvLyBfT3V0bGluZVdpZHRoVGV4dHVyZV9TVCAodW51c2VkKVxuICBwdWJsaWMgb3V0bGluZVdpZHRoID0gMC41OyAvLyBfT3V0bGluZVdpZHRoXG4gIHB1YmxpYyBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2UgPSAxLjA7IC8vIF9PdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2VcbiAgcHVibGljIG91dGxpbmVDb2xvciA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAwLjAsIDEuMCk7IC8vIF9PdXRsaW5lQ29sb3JcbiAgcHVibGljIG91dGxpbmVMaWdodGluZ01peCA9IDEuMDsgLy8gX091dGxpbmVMaWdodGluZ01peFxuICBwdWJsaWMgdXZBbmltTWFza1RleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX1V2QW5pbU1hc2tUZXh0dXJlXG4gIHB1YmxpYyB1dkFuaW1TY3JvbGxYID0gMC4wOyAvLyBfVXZBbmltU2Nyb2xsWFxuICBwdWJsaWMgdXZBbmltU2Nyb2xsWSA9IDAuMDsgLy8gX1V2QW5pbVNjcm9sbFlcbiAgcHVibGljIHV2QW5pbVJvdGF0aW9uID0gMC4wOyAvLyBfdXZBbmltUm90YXRpb25cblxuICBwdWJsaWMgc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7IC8vIHdoZW4gdGhpcyBpcyB0cnVlLCBhcHBseVVuaWZvcm1zIGVmZmVjdHNcblxuICAvKipcbiAgICogVGhlIGVuY29kaW5nIG9mIGlucHV0IHVuaWZvcm0gY29sb3JzLlxuICAgKlxuICAgKiBXaGVuIHlvdXIgYHJlbmRlcmVyLm91dHB1dEVuY29kaW5nYCBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgLCB1c2UgYFRIUkVFLkxpbmVhckVuY29kaW5nYC5cbiAgICogV2hlbiB5b3VyIGByZW5kZXJlci5vdXRwdXRFbmNvZGluZ2AgaXMgYFRIUkVFLnNSR0JFbmNvZGluZ2AsIHVzZSBgVEhSRUUuc1JHQkVuY29kaW5nYC5cbiAgICpcbiAgICogRW5jb2RpbmdzIG9mIHRleHR1cmVzIGFyZSBzZXQgaW5kZXBlbmRlbnRseSBvbiB0ZXh0dXJlcy5cbiAgICpcbiAgICogVGhpcyBpcyBgVEhSRUUuTGluZWFyRW5jb2RpbmdgIGJ5IGRlZmF1bHQuXG4gICAqXG4gICAqIFNlZSBhbHNvOiBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9yZW5kZXJlcnMvV2ViR0xSZW5kZXJlci5vdXRwdXRFbmNvZGluZ1xuICAgKi9cbiAgcHVibGljIGVuY29kaW5nOiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmc7XG5cbiAgcHJpdmF0ZSBfZGVidWdNb2RlID0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5Ob25lOyAvLyBfRGVidWdNb2RlXG4gIHByaXZhdGUgX2JsZW5kTW9kZSA9IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLk9wYXF1ZTsgLy8gX0JsZW5kTW9kZVxuICBwcml2YXRlIF9vdXRsaW5lV2lkdGhNb2RlID0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuTm9uZTsgLy8gX091dGxpbmVXaWR0aE1vZGVcbiAgcHJpdmF0ZSBfb3V0bGluZUNvbG9yTW9kZSA9IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlLkZpeGVkQ29sb3I7IC8vIF9PdXRsaW5lQ29sb3JNb2RlXG4gIHByaXZhdGUgX2N1bGxNb2RlID0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLkJhY2s7IC8vIF9DdWxsTW9kZVxuICBwcml2YXRlIF9vdXRsaW5lQ3VsbE1vZGUgPSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQ7IC8vIF9PdXRsaW5lQ3VsbE1vZGVcbiAgLy8gcHVibGljIHNyY0JsZW5kID0gMS4wOyAvLyBfU3JjQmxlbmQgKGlzIG5vdCBzdXBwb3J0ZWQpXG4gIC8vIHB1YmxpYyBkc3RCbGVuZCA9IDAuMDsgLy8gX0RzdEJsZW5kIChpcyBub3Qgc3VwcG9ydGVkKVxuICAvLyBwdWJsaWMgeldyaXRlID0gMS4wOyAvLyBfWldyaXRlICh3aWxsIGJlIGNvbnZlcnRlZCB0byBkZXB0aFdyaXRlKVxuXG4gIHByaXZhdGUgX2lzT3V0bGluZSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgX3V2QW5pbU9mZnNldFggPSAwLjA7XG4gIHByaXZhdGUgX3V2QW5pbU9mZnNldFkgPSAwLjA7XG4gIHByaXZhdGUgX3V2QW5pbVBoYXNlID0gMC4wO1xuXG4gIGNvbnN0cnVjdG9yKHBhcmFtZXRlcnM6IE1Ub29uUGFyYW1ldGVycyA9IHt9KSB7XG4gICAgc3VwZXIoKTtcblxuICAgIHRoaXMuZW5jb2RpbmcgPSBwYXJhbWV0ZXJzLmVuY29kaW5nIHx8IFRIUkVFLkxpbmVhckVuY29kaW5nO1xuICAgIGlmICh0aGlzLmVuY29kaW5nICE9PSBUSFJFRS5MaW5lYXJFbmNvZGluZyAmJiB0aGlzLmVuY29kaW5nICE9PSBUSFJFRS5zUkdCRW5jb2RpbmcpIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgJ1RoZSBzcGVjaWZpZWQgY29sb3IgZW5jb2RpbmcgZG9lcyBub3Qgd29yayBwcm9wZXJseSB3aXRoIE1Ub29uTWF0ZXJpYWwuIFlvdSBtaWdodCB3YW50IHRvIHVzZSBUSFJFRS5zUkdCRW5jb2RpbmcgaW5zdGVhZC4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyA9PSB0aGVzZSBwYXJhbWV0ZXIgaGFzIG5vIGNvbXBhdGliaWxpdHkgd2l0aCB0aGlzIGltcGxlbWVudGF0aW9uID09PT09PT09XG4gICAgW1xuICAgICAgJ21Ub29uVmVyc2lvbicsXG4gICAgICAnc2hhZGVUZXh0dXJlX1NUJyxcbiAgICAgICdidW1wTWFwX1NUJyxcbiAgICAgICdyZWNlaXZlU2hhZG93VGV4dHVyZV9TVCcsXG4gICAgICAnc2hhZGluZ0dyYWRlVGV4dHVyZV9TVCcsXG4gICAgICAncmltVGV4dHVyZV9TVCcsXG4gICAgICAnc3BoZXJlQWRkX1NUJyxcbiAgICAgICdlbWlzc2lvbk1hcF9TVCcsXG4gICAgICAnb3V0bGluZVdpZHRoVGV4dHVyZV9TVCcsXG4gICAgICAndXZBbmltTWFza1RleHR1cmVfU1QnLFxuICAgICAgJ3NyY0JsZW5kJyxcbiAgICAgICdkc3RCbGVuZCcsXG4gICAgXS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICAgIGlmICgocGFyYW1ldGVycyBhcyBhbnkpW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAvLyBjb25zb2xlLndhcm4oYFRIUkVFLiR7dGhpcy50eXBlfTogVGhlIHBhcmFtZXRlciBcIiR7a2V5fVwiIGlzIG5vdCBzdXBwb3J0ZWQuYCk7XG4gICAgICAgIGRlbGV0ZSAocGFyYW1ldGVycyBhcyBhbnkpW2tleV07XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyA9PSBlbmFibGluZyBidW5jaCBvZiBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgcGFyYW1ldGVycy5mb2cgPSB0cnVlO1xuICAgIHBhcmFtZXRlcnMubGlnaHRzID0gdHJ1ZTtcbiAgICBwYXJhbWV0ZXJzLmNsaXBwaW5nID0gdHJ1ZTtcblxuICAgIC8vIENPTVBBVDogcHJlLXIxMjlcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMTc4OFxuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTI5KSB7XG4gICAgICAocGFyYW1ldGVycyBhcyBhbnkpLnNraW5uaW5nID0gKHBhcmFtZXRlcnMgYXMgYW55KS5za2lubmluZyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBDT01QQVQ6IHByZS1yMTMxXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjIxNjlcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEzMSkge1xuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaFRhcmdldHMgPSAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoVGFyZ2V0cyB8fCBmYWxzZTtcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhOb3JtYWxzID0gKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaE5vcm1hbHMgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gPT0gdW5pZm9ybXMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHBhcmFtZXRlcnMudW5pZm9ybXMgPSBUSFJFRS5Vbmlmb3Jtc1V0aWxzLm1lcmdlKFtcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmNvbW1vbiwgLy8gbWFwXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5ub3JtYWxtYXAsIC8vIG5vcm1hbE1hcFxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuZW1pc3NpdmVtYXAsIC8vIGVtaXNzaXZlTWFwXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5mb2csXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5saWdodHMsXG4gICAgICB7XG4gICAgICAgIGN1dG9mZjogeyB2YWx1ZTogMC41IH0sXG4gICAgICAgIGNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMS4wLCAxLjAsIDEuMCkgfSxcbiAgICAgICAgY29sb3JBbHBoYTogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHNoYWRlQ29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjk3LCAwLjgxLCAwLjg2KSB9LFxuICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG4gICAgICAgIG1haW5UZXhfU1Q6IHsgdmFsdWU6IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCkgfSxcbiAgICAgICAgc2hhZGVUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXG4gICAgICAgIHJlY2VpdmVTaGFkb3dSYXRlOiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgcmVjZWl2ZVNoYWRvd1RleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgc2hhZGluZ0dyYWRlUmF0ZTogeyB2YWx1ZTogMS4wIH0sXG4gICAgICAgIHNoYWRpbmdHcmFkZVRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcbiAgICAgICAgc2hhZGVTaGlmdDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHNoYWRlVG9vbnk6IHsgdmFsdWU6IDAuOSB9LFxuICAgICAgICBsaWdodENvbG9yQXR0ZW51YXRpb246IHsgdmFsdWU6IDAuMCB9LFxuICAgICAgICBpbmRpcmVjdExpZ2h0SW50ZW5zaXR5OiB7IHZhbHVlOiAwLjEgfSxcbiAgICAgICAgcmltVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICByaW1Db2xvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuMCwgMC4wLCAwLjApIH0sXG4gICAgICAgIHJpbUxpZ2h0aW5nTWl4OiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgICAgcmltRnJlc25lbFBvd2VyOiB7IHZhbHVlOiAxLjAgfSxcbiAgICAgICAgcmltTGlmdDogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHNwaGVyZUFkZDogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICBlbWlzc2lvbkNvbG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcbiAgICAgICAgb3V0bGluZVdpZHRoVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICBvdXRsaW5lV2lkdGg6IHsgdmFsdWU6IDAuNSB9LFxuICAgICAgICBvdXRsaW5lU2NhbGVkTWF4RGlzdGFuY2U6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICBvdXRsaW5lQ29sb3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjAsIDAuMCwgMC4wKSB9LFxuICAgICAgICBvdXRsaW5lTGlnaHRpbmdNaXg6IHsgdmFsdWU6IDEuMCB9LFxuICAgICAgICB1dkFuaW1NYXNrVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxuICAgICAgICB1dkFuaW1PZmZzZXRYOiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgICAgdXZBbmltT2Zmc2V0WTogeyB2YWx1ZTogMC4wIH0sXG4gICAgICAgIHV2QW5pbVRoZXRhOiB7IHZhbHVlOiAwLjAgfSxcbiAgICAgIH0sXG4gICAgXSk7XG5cbiAgICAvLyA9PSBmaW5hbGx5IGNvbXBpbGUgdGhlIHNoYWRlciBwcm9ncmFtID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5zZXRWYWx1ZXMocGFyYW1ldGVycyk7XG5cbiAgICAvLyA9PSB1cGRhdGUgc2hhZGVyIHN0dWZmID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcbiAgfVxuXG4gIGdldCBtYWluVGV4KCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5tYXA7XG4gIH1cblxuICBzZXQgbWFpblRleCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xuICAgIHRoaXMubWFwID0gdDtcbiAgfVxuXG4gIGdldCBidW1wTWFwKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcbiAgICByZXR1cm4gdGhpcy5ub3JtYWxNYXA7XG4gIH1cblxuICBzZXQgYnVtcE1hcCh0OiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xuICAgIHRoaXMubm9ybWFsTWFwID0gdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXR0aW5nIHRoZSBgYnVtcFNjYWxlYCByZXV0cm5zIGl0cyB4IGNvbXBvbmVudCBvZiBgbm9ybWFsU2NhbGVgIChhc3N1bWluZyB4IGFuZCB5IGNvbXBvbmVudCBvZiBgbm9ybWFsU2NhbGVgIGFyZSBzYW1lKS5cbiAgICovXG4gIGdldCBidW1wU2NhbGUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5ub3JtYWxTY2FsZS54O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHRpbmcgdGhlIGBidW1wU2NhbGVgIHdpbGwgYmUgY29udmVydCB0aGUgdmFsdWUgaW50byBWZWN0b3IyIGBub3JtYWxTY2FsZWAgLlxuICAgKi9cbiAgc2V0IGJ1bXBTY2FsZSh0OiBudW1iZXIpIHtcbiAgICB0aGlzLm5vcm1hbFNjYWxlLnNldCh0LCB0KTtcbiAgfVxuXG4gIGdldCBlbWlzc2lvbk1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMuZW1pc3NpdmVNYXA7XG4gIH1cblxuICBzZXQgZW1pc3Npb25NYXAodDogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcbiAgICB0aGlzLmVtaXNzaXZlTWFwID0gdDtcbiAgfVxuXG4gIGdldCBibGVuZE1vZGUoKTogTVRvb25NYXRlcmlhbFJlbmRlck1vZGUge1xuICAgIHJldHVybiB0aGlzLl9ibGVuZE1vZGU7XG4gIH1cblxuICBzZXQgYmxlbmRNb2RlKG06IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlKSB7XG4gICAgdGhpcy5fYmxlbmRNb2RlID0gbTtcblxuICAgIHRoaXMuZGVwdGhXcml0ZSA9IHRoaXMuX2JsZW5kTW9kZSAhPT0gTVRvb25NYXRlcmlhbFJlbmRlck1vZGUuVHJhbnNwYXJlbnQ7XG4gICAgdGhpcy50cmFuc3BhcmVudCA9XG4gICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50IHx8XG4gICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50V2l0aFpXcml0ZTtcbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICBnZXQgZGVidWdNb2RlKCk6IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUge1xuICAgIHJldHVybiB0aGlzLl9kZWJ1Z01vZGU7XG4gIH1cblxuICBzZXQgZGVidWdNb2RlKG06IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUpIHtcbiAgICB0aGlzLl9kZWJ1Z01vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlU2hhZGVyQ29kZSgpO1xuICB9XG5cbiAgZ2V0IG91dGxpbmVXaWR0aE1vZGUoKTogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUge1xuICAgIHJldHVybiB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlO1xuICB9XG5cbiAgc2V0IG91dGxpbmVXaWR0aE1vZGUobTogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUpIHtcbiAgICB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlID0gbTtcblxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgfVxuXG4gIGdldCBvdXRsaW5lQ29sb3JNb2RlKCk6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0bGluZUNvbG9yTW9kZTtcbiAgfVxuXG4gIHNldCBvdXRsaW5lQ29sb3JNb2RlKG06IE1Ub29uTWF0ZXJpYWxPdXRsaW5lQ29sb3JNb2RlKSB7XG4gICAgdGhpcy5fb3V0bGluZUNvbG9yTW9kZSA9IG07XG5cbiAgICB0aGlzLl91cGRhdGVTaGFkZXJDb2RlKCk7XG4gIH1cblxuICBnZXQgY3VsbE1vZGUoKTogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fY3VsbE1vZGU7XG4gIH1cblxuICBzZXQgY3VsbE1vZGUobTogTVRvb25NYXRlcmlhbEN1bGxNb2RlKSB7XG4gICAgdGhpcy5fY3VsbE1vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIGdldCBvdXRsaW5lQ3VsbE1vZGUoKTogTVRvb25NYXRlcmlhbEN1bGxNb2RlIHtcbiAgICByZXR1cm4gdGhpcy5fb3V0bGluZUN1bGxNb2RlO1xuICB9XG5cbiAgc2V0IG91dGxpbmVDdWxsTW9kZShtOiBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUpIHtcbiAgICB0aGlzLl9vdXRsaW5lQ3VsbE1vZGUgPSBtO1xuXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIGdldCB6V3JpdGUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5kZXB0aFdyaXRlID8gMSA6IDA7XG4gIH1cblxuICBzZXQgeldyaXRlKGk6IG51bWJlcikge1xuICAgIHRoaXMuZGVwdGhXcml0ZSA9IDAuNSA8PSBpO1xuICB9XG5cbiAgZ2V0IGlzT3V0bGluZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5faXNPdXRsaW5lO1xuICB9XG5cbiAgc2V0IGlzT3V0bGluZShiOiBib29sZWFuKSB7XG4gICAgdGhpcy5faXNPdXRsaW5lID0gYjtcblxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgICB0aGlzLl91cGRhdGVDdWxsRmFjZSgpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGlzIG1hdGVyaWFsLlxuICAgKiBVc3VhbGx5IHRoaXMgd2lsbCBiZSBjYWxsZWQgdmlhIFtbVlJNLnVwZGF0ZV1dIHNvIHlvdSBkb24ndCBoYXZlIHRvIGNhbGwgdGhpcyBtYW51YWxseS5cbiAgICpcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZSBzaW5jZSBsYXN0IHVwZGF0ZVxuICAgKi9cbiAgcHVibGljIHVwZGF0ZVZSTU1hdGVyaWFscyhkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgdGhpcy5fdXZBbmltT2Zmc2V0WCA9IHRoaXMuX3V2QW5pbU9mZnNldFggKyBkZWx0YSAqIHRoaXMudXZBbmltU2Nyb2xsWDtcbiAgICB0aGlzLl91dkFuaW1PZmZzZXRZID0gdGhpcy5fdXZBbmltT2Zmc2V0WSAtIGRlbHRhICogdGhpcy51dkFuaW1TY3JvbGxZOyAvLyBOZWdhdGl2ZSBzaW5jZSB0IGF4aXMgb2YgdXZzIGFyZSBvcHBvc2l0ZSBmcm9tIFVuaXR5J3Mgb25lXG4gICAgdGhpcy5fdXZBbmltUGhhc2UgPSB0aGlzLl91dkFuaW1QaGFzZSArIGRlbHRhICogdGhpcy51dkFuaW1Sb3RhdGlvbjtcblxuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcbiAgfVxuXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogdGhpcyk6IHRoaXMge1xuICAgIHN1cGVyLmNvcHkoc291cmNlKTtcblxuICAgIC8vID09IGNvcHkgbWVtYmVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLmN1dG9mZiA9IHNvdXJjZS5jdXRvZmY7XG4gICAgdGhpcy5jb2xvci5jb3B5KHNvdXJjZS5jb2xvcik7XG4gICAgdGhpcy5zaGFkZUNvbG9yLmNvcHkoc291cmNlLnNoYWRlQ29sb3IpO1xuICAgIHRoaXMubWFwID0gc291cmNlLm1hcDtcbiAgICB0aGlzLm1haW5UZXhfU1QuY29weShzb3VyY2UubWFpblRleF9TVCk7XG4gICAgdGhpcy5zaGFkZVRleHR1cmUgPSBzb3VyY2Uuc2hhZGVUZXh0dXJlO1xuICAgIHRoaXMubm9ybWFsTWFwID0gc291cmNlLm5vcm1hbE1hcDtcbiAgICB0aGlzLm5vcm1hbE1hcFR5cGUgPSBzb3VyY2Uubm9ybWFsTWFwVHlwZTtcbiAgICB0aGlzLm5vcm1hbFNjYWxlLmNvcHkodGhpcy5ub3JtYWxTY2FsZSk7XG4gICAgdGhpcy5yZWNlaXZlU2hhZG93UmF0ZSA9IHNvdXJjZS5yZWNlaXZlU2hhZG93UmF0ZTtcbiAgICB0aGlzLnJlY2VpdmVTaGFkb3dUZXh0dXJlID0gc291cmNlLnJlY2VpdmVTaGFkb3dUZXh0dXJlO1xuICAgIHRoaXMuc2hhZGluZ0dyYWRlUmF0ZSA9IHNvdXJjZS5zaGFkaW5nR3JhZGVSYXRlO1xuICAgIHRoaXMuc2hhZGluZ0dyYWRlVGV4dHVyZSA9IHNvdXJjZS5zaGFkaW5nR3JhZGVUZXh0dXJlO1xuICAgIHRoaXMuc2hhZGVTaGlmdCA9IHNvdXJjZS5zaGFkZVNoaWZ0O1xuICAgIHRoaXMuc2hhZGVUb29ueSA9IHNvdXJjZS5zaGFkZVRvb255O1xuICAgIHRoaXMubGlnaHRDb2xvckF0dGVudWF0aW9uID0gc291cmNlLmxpZ2h0Q29sb3JBdHRlbnVhdGlvbjtcbiAgICB0aGlzLmluZGlyZWN0TGlnaHRJbnRlbnNpdHkgPSBzb3VyY2UuaW5kaXJlY3RMaWdodEludGVuc2l0eTtcbiAgICB0aGlzLnJpbVRleHR1cmUgPSBzb3VyY2UucmltVGV4dHVyZTtcbiAgICB0aGlzLnJpbUNvbG9yLmNvcHkoc291cmNlLnJpbUNvbG9yKTtcbiAgICB0aGlzLnJpbUxpZ2h0aW5nTWl4ID0gc291cmNlLnJpbUxpZ2h0aW5nTWl4O1xuICAgIHRoaXMucmltRnJlc25lbFBvd2VyID0gc291cmNlLnJpbUZyZXNuZWxQb3dlcjtcbiAgICB0aGlzLnJpbUxpZnQgPSBzb3VyY2UucmltTGlmdDtcbiAgICB0aGlzLnNwaGVyZUFkZCA9IHNvdXJjZS5zcGhlcmVBZGQ7XG4gICAgdGhpcy5lbWlzc2lvbkNvbG9yLmNvcHkoc291cmNlLmVtaXNzaW9uQ29sb3IpO1xuICAgIHRoaXMuZW1pc3NpdmVNYXAgPSBzb3VyY2UuZW1pc3NpdmVNYXA7XG4gICAgdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlID0gc291cmNlLm91dGxpbmVXaWR0aFRleHR1cmU7XG4gICAgdGhpcy5vdXRsaW5lV2lkdGggPSBzb3VyY2Uub3V0bGluZVdpZHRoO1xuICAgIHRoaXMub3V0bGluZVNjYWxlZE1heERpc3RhbmNlID0gc291cmNlLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZTtcbiAgICB0aGlzLm91dGxpbmVDb2xvci5jb3B5KHNvdXJjZS5vdXRsaW5lQ29sb3IpO1xuICAgIHRoaXMub3V0bGluZUxpZ2h0aW5nTWl4ID0gc291cmNlLm91dGxpbmVMaWdodGluZ01peDtcbiAgICB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlID0gc291cmNlLnV2QW5pbU1hc2tUZXh0dXJlO1xuICAgIHRoaXMudXZBbmltU2Nyb2xsWCA9IHNvdXJjZS51dkFuaW1TY3JvbGxYO1xuICAgIHRoaXMudXZBbmltU2Nyb2xsWSA9IHNvdXJjZS51dkFuaW1TY3JvbGxZO1xuICAgIHRoaXMudXZBbmltUm90YXRpb24gPSBzb3VyY2UudXZBbmltUm90YXRpb247XG5cbiAgICB0aGlzLmRlYnVnTW9kZSA9IHNvdXJjZS5kZWJ1Z01vZGU7XG4gICAgdGhpcy5ibGVuZE1vZGUgPSBzb3VyY2UuYmxlbmRNb2RlO1xuICAgIHRoaXMub3V0bGluZVdpZHRoTW9kZSA9IHNvdXJjZS5vdXRsaW5lV2lkdGhNb2RlO1xuICAgIHRoaXMub3V0bGluZUNvbG9yTW9kZSA9IHNvdXJjZS5vdXRsaW5lQ29sb3JNb2RlO1xuICAgIHRoaXMuY3VsbE1vZGUgPSBzb3VyY2UuY3VsbE1vZGU7XG4gICAgdGhpcy5vdXRsaW5lQ3VsbE1vZGUgPSBzb3VyY2Uub3V0bGluZUN1bGxNb2RlO1xuXG4gICAgdGhpcy5pc091dGxpbmUgPSBzb3VyY2UuaXNPdXRsaW5lO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQXBwbHkgdXBkYXRlZCB1bmlmb3JtIHZhcmlhYmxlcy5cbiAgICovXG4gIHByaXZhdGUgX2FwcGx5VW5pZm9ybXMoKTogdm9pZCB7XG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1PZmZzZXRYLnZhbHVlID0gdGhpcy5fdXZBbmltT2Zmc2V0WDtcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbU9mZnNldFkudmFsdWUgPSB0aGlzLl91dkFuaW1PZmZzZXRZO1xuICAgIHRoaXMudW5pZm9ybXMudXZBbmltVGhldGEudmFsdWUgPSBUQVUgKiB0aGlzLl91dkFuaW1QaGFzZTtcblxuICAgIGlmICghdGhpcy5zaG91bGRBcHBseVVuaWZvcm1zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IGZhbHNlO1xuXG4gICAgdGhpcy51bmlmb3Jtcy5jdXRvZmYudmFsdWUgPSB0aGlzLmN1dG9mZjtcbiAgICB0aGlzLnVuaWZvcm1zLmNvbG9yLnZhbHVlLnNldFJHQih0aGlzLmNvbG9yLngsIHRoaXMuY29sb3IueSwgdGhpcy5jb2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLmNvbG9yQWxwaGEudmFsdWUgPSB0aGlzLmNvbG9yLnc7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkZUNvbG9yLnZhbHVlLnNldFJHQih0aGlzLnNoYWRlQ29sb3IueCwgdGhpcy5zaGFkZUNvbG9yLnksIHRoaXMuc2hhZGVDb2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLm1hcC52YWx1ZSA9IHRoaXMubWFwO1xuICAgIHRoaXMudW5pZm9ybXMubWFpblRleF9TVC52YWx1ZS5jb3B5KHRoaXMubWFpblRleF9TVCk7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkZVRleHR1cmUudmFsdWUgPSB0aGlzLnNoYWRlVGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLm5vcm1hbE1hcC52YWx1ZSA9IHRoaXMubm9ybWFsTWFwO1xuICAgIHRoaXMudW5pZm9ybXMubm9ybWFsU2NhbGUudmFsdWUuY29weSh0aGlzLm5vcm1hbFNjYWxlKTtcbiAgICB0aGlzLnVuaWZvcm1zLnJlY2VpdmVTaGFkb3dSYXRlLnZhbHVlID0gdGhpcy5yZWNlaXZlU2hhZG93UmF0ZTtcbiAgICB0aGlzLnVuaWZvcm1zLnJlY2VpdmVTaGFkb3dUZXh0dXJlLnZhbHVlID0gdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZTtcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRpbmdHcmFkZVJhdGUudmFsdWUgPSB0aGlzLnNoYWRpbmdHcmFkZVJhdGU7XG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkaW5nR3JhZGVUZXh0dXJlLnZhbHVlID0gdGhpcy5zaGFkaW5nR3JhZGVUZXh0dXJlO1xuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVTaGlmdC52YWx1ZSA9IHRoaXMuc2hhZGVTaGlmdDtcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlVG9vbnkudmFsdWUgPSB0aGlzLnNoYWRlVG9vbnk7XG4gICAgdGhpcy51bmlmb3Jtcy5saWdodENvbG9yQXR0ZW51YXRpb24udmFsdWUgPSB0aGlzLmxpZ2h0Q29sb3JBdHRlbnVhdGlvbjtcbiAgICB0aGlzLnVuaWZvcm1zLmluZGlyZWN0TGlnaHRJbnRlbnNpdHkudmFsdWUgPSB0aGlzLmluZGlyZWN0TGlnaHRJbnRlbnNpdHk7XG4gICAgdGhpcy51bmlmb3Jtcy5yaW1UZXh0dXJlLnZhbHVlID0gdGhpcy5yaW1UZXh0dXJlO1xuICAgIHRoaXMudW5pZm9ybXMucmltQ29sb3IudmFsdWUuc2V0UkdCKHRoaXMucmltQ29sb3IueCwgdGhpcy5yaW1Db2xvci55LCB0aGlzLnJpbUNvbG9yLnopO1xuICAgIHRoaXMudW5pZm9ybXMucmltTGlnaHRpbmdNaXgudmFsdWUgPSB0aGlzLnJpbUxpZ2h0aW5nTWl4O1xuICAgIHRoaXMudW5pZm9ybXMucmltRnJlc25lbFBvd2VyLnZhbHVlID0gdGhpcy5yaW1GcmVzbmVsUG93ZXI7XG4gICAgdGhpcy51bmlmb3Jtcy5yaW1MaWZ0LnZhbHVlID0gdGhpcy5yaW1MaWZ0O1xuICAgIHRoaXMudW5pZm9ybXMuc3BoZXJlQWRkLnZhbHVlID0gdGhpcy5zcGhlcmVBZGQ7XG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2lvbkNvbG9yLnZhbHVlLnNldFJHQih0aGlzLmVtaXNzaW9uQ29sb3IueCwgdGhpcy5lbWlzc2lvbkNvbG9yLnksIHRoaXMuZW1pc3Npb25Db2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLmVtaXNzaXZlTWFwLnZhbHVlID0gdGhpcy5lbWlzc2l2ZU1hcDtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVXaWR0aFRleHR1cmUudmFsdWUgPSB0aGlzLm91dGxpbmVXaWR0aFRleHR1cmU7XG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGgudmFsdWUgPSB0aGlzLm91dGxpbmVXaWR0aDtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVTY2FsZWRNYXhEaXN0YW5jZS52YWx1ZSA9IHRoaXMub3V0bGluZVNjYWxlZE1heERpc3RhbmNlO1xuICAgIHRoaXMudW5pZm9ybXMub3V0bGluZUNvbG9yLnZhbHVlLnNldFJHQih0aGlzLm91dGxpbmVDb2xvci54LCB0aGlzLm91dGxpbmVDb2xvci55LCB0aGlzLm91dGxpbmVDb2xvci56KTtcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVMaWdodGluZ01peC52YWx1ZSA9IHRoaXMub3V0bGluZUxpZ2h0aW5nTWl4O1xuICAgIHRoaXMudW5pZm9ybXMudXZBbmltTWFza1RleHR1cmUudmFsdWUgPSB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlO1xuXG4gICAgLy8gYXBwbHkgY29sb3Igc3BhY2UgdG8gdW5pZm9ybSBjb2xvcnNcbiAgICBpZiAodGhpcy5lbmNvZGluZyA9PT0gVEhSRUUuc1JHQkVuY29kaW5nKSB7XG4gICAgICB0aGlzLnVuaWZvcm1zLmNvbG9yLnZhbHVlLmNvbnZlcnRTUkdCVG9MaW5lYXIoKTtcbiAgICAgIHRoaXMudW5pZm9ybXMuc2hhZGVDb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLnJpbUNvbG9yLnZhbHVlLmNvbnZlcnRTUkdCVG9MaW5lYXIoKTtcbiAgICAgIHRoaXMudW5pZm9ybXMuZW1pc3Npb25Db2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvci52YWx1ZS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XG4gICAgfVxuXG4gICAgdGhpcy5fdXBkYXRlQ3VsbEZhY2UoKTtcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZVNoYWRlckNvZGUoKTogdm9pZCB7XG4gICAgY29uc3QgdXNlVXZJblZlcnQgPSB0aGlzLm91dGxpbmVXaWR0aFRleHR1cmUgIT09IG51bGw7XG4gICAgY29uc3QgdXNlVXZJbkZyYWcgPVxuICAgICAgdGhpcy5tYXAgIT09IG51bGwgfHxcbiAgICAgIHRoaXMuc2hhZGVUZXh0dXJlICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnJlY2VpdmVTaGFkb3dUZXh0dXJlICE9PSBudWxsIHx8XG4gICAgICB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgIT09IG51bGwgfHxcbiAgICAgIHRoaXMucmltVGV4dHVyZSAhPT0gbnVsbCB8fFxuICAgICAgdGhpcy51dkFuaW1NYXNrVGV4dHVyZSAhPT0gbnVsbDtcblxuICAgIHRoaXMuZGVmaW5lcyA9IHtcbiAgICAgIC8vIFVzZWQgZm9yIGNvbXBhdHNcbiAgICAgIFRIUkVFX1ZSTV9USFJFRV9SRVZJU0lPTjogcGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSxcblxuICAgICAgT1VUTElORTogdGhpcy5faXNPdXRsaW5lLFxuICAgICAgQkxFTkRNT0RFX09QQVFVRTogdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5PcGFxdWUsXG4gICAgICBCTEVORE1PREVfQ1VUT1VUOiB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLkN1dG91dCxcbiAgICAgIEJMRU5ETU9ERV9UUkFOU1BBUkVOVDpcbiAgICAgICAgdGhpcy5fYmxlbmRNb2RlID09PSBNVG9vbk1hdGVyaWFsUmVuZGVyTW9kZS5UcmFuc3BhcmVudCB8fFxuICAgICAgICB0aGlzLl9ibGVuZE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlLlRyYW5zcGFyZW50V2l0aFpXcml0ZSxcbiAgICAgIE1UT09OX1VTRV9VVjogdXNlVXZJblZlcnQgfHwgdXNlVXZJbkZyYWcsIC8vIHdlIGNhbid0IHVzZSBgVVNFX1VWYCAsIGl0IHdpbGwgYmUgcmVkZWZpbmVkIGluIFdlYkdMUHJvZ3JhbS5qc1xuICAgICAgTVRPT05fVVZTX1ZFUlRFWF9PTkxZOiB1c2VVdkluVmVydCAmJiAhdXNlVXZJbkZyYWcsXG4gICAgICBVU0VfU0hBREVURVhUVVJFOiB0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9SRUNFSVZFU0hBRE9XVEVYVFVSRTogdGhpcy5yZWNlaXZlU2hhZG93VGV4dHVyZSAhPT0gbnVsbCxcbiAgICAgIFVTRV9TSEFESU5HR1JBREVURVhUVVJFOiB0aGlzLnNoYWRpbmdHcmFkZVRleHR1cmUgIT09IG51bGwsXG4gICAgICBVU0VfUklNVEVYVFVSRTogdGhpcy5yaW1UZXh0dXJlICE9PSBudWxsLFxuICAgICAgVVNFX1NQSEVSRUFERDogdGhpcy5zcGhlcmVBZGQgIT09IG51bGwsXG4gICAgICBVU0VfT1VUTElORVdJRFRIVEVYVFVSRTogdGhpcy5vdXRsaW5lV2lkdGhUZXh0dXJlICE9PSBudWxsLFxuICAgICAgVVNFX1VWQU5JTU1BU0tURVhUVVJFOiB0aGlzLnV2QW5pbU1hc2tUZXh0dXJlICE9PSBudWxsLFxuICAgICAgREVCVUdfTk9STUFMOiB0aGlzLl9kZWJ1Z01vZGUgPT09IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTm9ybWFsLFxuICAgICAgREVCVUdfTElUU0hBREVSQVRFOiB0aGlzLl9kZWJ1Z01vZGUgPT09IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTGl0U2hhZGVSYXRlLFxuICAgICAgREVCVUdfVVY6IHRoaXMuX2RlYnVnTW9kZSA9PT0gTVRvb25NYXRlcmlhbERlYnVnTW9kZS5VVixcbiAgICAgIE9VVExJTkVfV0lEVEhfV09STEQ6IHRoaXMuX291dGxpbmVXaWR0aE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLldvcmxkQ29vcmRpbmF0ZXMsXG4gICAgICBPVVRMSU5FX1dJRFRIX1NDUkVFTjogdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuU2NyZWVuQ29vcmRpbmF0ZXMsXG4gICAgICBPVVRMSU5FX0NPTE9SX0ZJWEVEOiB0aGlzLl9vdXRsaW5lQ29sb3JNb2RlID09PSBNVG9vbk1hdGVyaWFsT3V0bGluZUNvbG9yTW9kZS5GaXhlZENvbG9yLFxuICAgICAgT1VUTElORV9DT0xPUl9NSVhFRDogdGhpcy5fb3V0bGluZUNvbG9yTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUuTWl4ZWRMaWdodGluZyxcbiAgICB9O1xuXG4gICAgLy8gPT0gZ2VuZXJhdGUgc2hhZGVyIGNvZGUgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMudmVydGV4U2hhZGVyID0gdmVydGV4U2hhZGVyO1xuICAgIHRoaXMuZnJhZ21lbnRTaGFkZXIgPSBmcmFnbWVudFNoYWRlcjtcblxuICAgIC8vID09IHRleHR1cmUgZW5jb2RpbmdzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDT01QQVQ6IHByZS1yMTM3XG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMzcpIHtcbiAgICAgIGNvbnN0IGVuY29kaW5ncyA9XG4gICAgICAgICh0aGlzLnNoYWRlVGV4dHVyZSAhPT0gbnVsbFxuICAgICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKCdzaGFkZVRleHR1cmVUZXhlbFRvTGluZWFyJywgdGhpcy5zaGFkZVRleHR1cmUuZW5jb2RpbmcpICsgJ1xcbidcbiAgICAgICAgICA6ICcnKSArXG4gICAgICAgICh0aGlzLnNwaGVyZUFkZCAhPT0gbnVsbFxuICAgICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKCdzcGhlcmVBZGRUZXhlbFRvTGluZWFyJywgdGhpcy5zcGhlcmVBZGQuZW5jb2RpbmcpICsgJ1xcbidcbiAgICAgICAgICA6ICcnKSArXG4gICAgICAgICh0aGlzLnJpbVRleHR1cmUgIT09IG51bGxcbiAgICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbigncmltVGV4dHVyZVRleGVsVG9MaW5lYXInLCB0aGlzLnJpbVRleHR1cmUuZW5jb2RpbmcpICsgJ1xcbidcbiAgICAgICAgICA6ICcnKTtcbiAgICAgIHRoaXMuZnJhZ21lbnRTaGFkZXIgPSBlbmNvZGluZ3MgKyBmcmFnbWVudFNoYWRlcjtcbiAgICB9XG5cbiAgICAvLyA9PSBzZXQgbmVlZHNVcGRhdGUgZmxhZyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVDdWxsRmFjZSgpOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuaXNPdXRsaW5lKSB7XG4gICAgICBpZiAodGhpcy5jdWxsTW9kZSA9PT0gTVRvb25NYXRlcmlhbEN1bGxNb2RlLk9mZikge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Eb3VibGVTaWRlO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQpIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuQmFja1NpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuY3VsbE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxDdWxsTW9kZS5CYWNrKSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkZyb250U2lkZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuT2ZmKSB7XG4gICAgICAgIHRoaXMuc2lkZSA9IFRIUkVFLkRvdWJsZVNpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuRnJvbnQpIHtcbiAgICAgICAgdGhpcy5zaWRlID0gVEhSRUUuQmFja1NpZGU7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3V0bGluZUN1bGxNb2RlID09PSBNVG9vbk1hdGVyaWFsQ3VsbE1vZGUuQmFjaykge1xuICAgICAgICB0aGlzLnNpZGUgPSBUSFJFRS5Gcm9udFNpZGU7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCIvKiB0c2xpbnQ6ZGlzYWJsZTptZW1iZXItb3JkZXJpbmcgKi9cblxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHZlcnRleFNoYWRlciBmcm9tICcuL3NoYWRlcnMvdW5saXQudmVydCc7XG5pbXBvcnQgZnJhZ21lbnRTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL3VubGl0LmZyYWcnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFZSTVVubGl0TWF0ZXJpYWxQYXJhbWV0ZXJzIGV4dGVuZHMgVEhSRUUuU2hhZGVyTWF0ZXJpYWxQYXJhbWV0ZXJzIHtcbiAgY3V0b2ZmPzogbnVtYmVyOyAvLyBfQ3V0b2ZmXG4gIG1hcD86IFRIUkVFLlRleHR1cmU7IC8vIF9NYWluVGV4XG4gIG1haW5UZXg/OiBUSFJFRS5UZXh0dXJlOyAvLyBfTWFpblRleCAod2lsbCBiZSByZW5hbWVkIHRvIG1hcClcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICBtYWluVGV4X1NUPzogVEhSRUUuVmVjdG9yNDsgLy8gX01haW5UZXhfU1RcblxuICByZW5kZXJUeXBlPzogVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUgfCBudW1iZXI7XG59XG5cbmV4cG9ydCBlbnVtIFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlIHtcbiAgT3BhcXVlLFxuICBDdXRvdXQsXG4gIFRyYW5zcGFyZW50LFxuICBUcmFuc3BhcmVudFdpdGhaV3JpdGUsXG59XG5cbi8qKlxuICogVGhpcyBpcyBhIG1hdGVyaWFsIHRoYXQgaXMgYW4gZXF1aXZhbGVudCBvZiBcIlZSTS9VbmxpdCoqKlwiIG9uIFZSTSBzcGVjLCB0aG9zZSBtYXRlcmlhbHMgYXJlIGFscmVhZHkga2luZGEgZGVwcmVjYXRlZCB0aG91Z2guLi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVVubGl0TWF0ZXJpYWwgZXh0ZW5kcyBUSFJFRS5TaGFkZXJNYXRlcmlhbCB7XG4gIC8qKlxuICAgKiBSZWFkb25seSBib29sZWFuIHRoYXQgaW5kaWNhdGVzIHRoaXMgaXMgYSBbW1ZSTVVubGl0TWF0ZXJpYWxdXS5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBpc1ZSTVVubGl0TWF0ZXJpYWw6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIHB1YmxpYyBjdXRvZmYgPSAwLjU7XG4gIHB1YmxpYyBtYXA6IFRIUkVFLlRleHR1cmUgfCBudWxsID0gbnVsbDsgLy8gX01haW5UZXhcbiAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICBwdWJsaWMgbWFpblRleF9TVCA9IG5ldyBUSFJFRS5WZWN0b3I0KDAuMCwgMC4wLCAxLjAsIDEuMCk7IC8vIF9NYWluVGV4X1NUXG4gIHByaXZhdGUgX3JlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5PcGFxdWU7XG5cbiAgcHVibGljIHNob3VsZEFwcGx5VW5pZm9ybXMgPSB0cnVlOyAvLyB3aGVuIHRoaXMgaXMgdHJ1ZSwgYXBwbHlVbmlmb3JtcyBlZmZlY3RzXG5cbiAgY29uc3RydWN0b3IocGFyYW1ldGVycz86IFZSTVVubGl0TWF0ZXJpYWxQYXJhbWV0ZXJzKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIGlmIChwYXJhbWV0ZXJzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmFtZXRlcnMgPSB7fTtcbiAgICB9XG5cbiAgICAvLyA9PSBlbmFibGluZyBidW5jaCBvZiBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgcGFyYW1ldGVycy5mb2cgPSB0cnVlO1xuICAgIHBhcmFtZXRlcnMuY2xpcHBpbmcgPSB0cnVlO1xuXG4gICAgLy8gQ09NUEFUOiBwcmUtcjEyOVxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIxNzg4XG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMjkpIHtcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkuc2tpbm5pbmcgPSAocGFyYW1ldGVycyBhcyBhbnkpLnNraW5uaW5nIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENPTVBBVDogcHJlLXIxMzFcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMjE2OVxuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTMxKSB7XG4gICAgICAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoVGFyZ2V0cyA9IChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhUYXJnZXRzIHx8IGZhbHNlO1xuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaE5vcm1hbHMgPSAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoTm9ybWFscyB8fCBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyA9PSB1bmlmb3JtcyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgcGFyYW1ldGVycy51bmlmb3JtcyA9IFRIUkVFLlVuaWZvcm1zVXRpbHMubWVyZ2UoW1xuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuY29tbW9uLCAvLyBtYXBcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmZvZyxcbiAgICAgIHtcbiAgICAgICAgY3V0b2ZmOiB7IHZhbHVlOiAwLjUgfSxcbiAgICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuICAgICAgICBtYWluVGV4X1NUOiB7IHZhbHVlOiBuZXcgVEhSRUUuVmVjdG9yNCgwLjAsIDAuMCwgMS4wLCAxLjApIH0sXG4gICAgICB9LFxuICAgIF0pO1xuXG4gICAgLy8gPT0gZmluYWxseSBjb21waWxlIHRoZSBzaGFkZXIgcHJvZ3JhbSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuc2V0VmFsdWVzKHBhcmFtZXRlcnMpO1xuXG4gICAgLy8gPT0gdXBkYXRlIHNoYWRlciBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgICB0aGlzLl9hcHBseVVuaWZvcm1zKCk7XG4gIH1cblxuICBnZXQgbWFpblRleCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XG4gICAgcmV0dXJuIHRoaXMubWFwO1xuICB9XG5cbiAgc2V0IG1haW5UZXgodDogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcbiAgICB0aGlzLm1hcCA9IHQ7XG4gIH1cblxuICBnZXQgcmVuZGVyVHlwZSgpOiBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZSB7XG4gICAgcmV0dXJuIHRoaXMuX3JlbmRlclR5cGU7XG4gIH1cblxuICBzZXQgcmVuZGVyVHlwZSh0OiBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZSkge1xuICAgIHRoaXMuX3JlbmRlclR5cGUgPSB0O1xuXG4gICAgdGhpcy5kZXB0aFdyaXRlID0gdGhpcy5fcmVuZGVyVHlwZSAhPT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQ7XG4gICAgdGhpcy50cmFuc3BhcmVudCA9XG4gICAgICB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudCB8fFxuICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnRXaXRoWldyaXRlO1xuICAgIHRoaXMuX3VwZGF0ZVNoYWRlckNvZGUoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhpcyBtYXRlcmlhbC5cbiAgICogVXN1YWxseSB0aGlzIHdpbGwgYmUgY2FsbGVkIHZpYSBbW1ZSTS51cGRhdGVdXSBzbyB5b3UgZG9uJ3QgaGF2ZSB0byBjYWxsIHRoaXMgbWFudWFsbHkuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWUgc2luY2UgbGFzdCB1cGRhdGVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGVWUk1NYXRlcmlhbHMoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIHRoaXMuX2FwcGx5VW5pZm9ybXMoKTtcbiAgfVxuXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogdGhpcyk6IHRoaXMge1xuICAgIHN1cGVyLmNvcHkoc291cmNlKTtcblxuICAgIC8vID09IGNvcHkgbWVtYmVycyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICB0aGlzLmN1dG9mZiA9IHNvdXJjZS5jdXRvZmY7XG4gICAgdGhpcy5tYXAgPSBzb3VyY2UubWFwO1xuICAgIHRoaXMubWFpblRleF9TVC5jb3B5KHNvdXJjZS5tYWluVGV4X1NUKTtcbiAgICB0aGlzLnJlbmRlclR5cGUgPSBzb3VyY2UucmVuZGVyVHlwZTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGx5IHVwZGF0ZWQgdW5pZm9ybSB2YXJpYWJsZXMuXG4gICAqL1xuICBwcml2YXRlIF9hcHBseVVuaWZvcm1zKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5zaG91bGRBcHBseVVuaWZvcm1zKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHRoaXMuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IGZhbHNlO1xuXG4gICAgdGhpcy51bmlmb3Jtcy5jdXRvZmYudmFsdWUgPSB0aGlzLmN1dG9mZjtcbiAgICB0aGlzLnVuaWZvcm1zLm1hcC52YWx1ZSA9IHRoaXMubWFwO1xuICAgIHRoaXMudW5pZm9ybXMubWFpblRleF9TVC52YWx1ZS5jb3B5KHRoaXMubWFpblRleF9TVCk7XG4gIH1cblxuICBwcml2YXRlIF91cGRhdGVTaGFkZXJDb2RlKCk6IHZvaWQge1xuICAgIHRoaXMuZGVmaW5lcyA9IHtcbiAgICAgIFJFTkRFUlRZUEVfT1BBUVVFOiB0aGlzLl9yZW5kZXJUeXBlID09PSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5PcGFxdWUsXG4gICAgICBSRU5ERVJUWVBFX0NVVE9VVDogdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuQ3V0b3V0LFxuICAgICAgUkVOREVSVFlQRV9UUkFOU1BBUkVOVDpcbiAgICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnQgfHxcbiAgICAgICAgdGhpcy5fcmVuZGVyVHlwZSA9PT0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnRXaXRoWldyaXRlLFxuICAgIH07XG5cbiAgICB0aGlzLnZlcnRleFNoYWRlciA9IHZlcnRleFNoYWRlcjtcbiAgICB0aGlzLmZyYWdtZW50U2hhZGVyID0gZnJhZ21lbnRTaGFkZXI7XG5cbiAgICAvLyA9PSBzZXQgbmVlZHNVcGRhdGUgZmxhZyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IEdMVEZTY2hlbWEsIFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyB9IGZyb20gJy4uL3V0aWxzL2dsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlJztcbmltcG9ydCB7IE1Ub29uTWF0ZXJpYWwsIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIH0gZnJvbSAnLi9NVG9vbk1hdGVyaWFsJztcbmltcG9ydCB7IFZSTVVubGl0TWF0ZXJpYWwsIFZSTVVubGl0TWF0ZXJpYWxSZW5kZXJUeXBlIH0gZnJvbSAnLi9WUk1VbmxpdE1hdGVyaWFsJztcblxuLyoqXG4gKiBPcHRpb25zIGZvciBhIFtbVlJNTWF0ZXJpYWxJbXBvcnRlcl1dIGluc3RhbmNlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFZSTU1hdGVyaWFsSW1wb3J0ZXJPcHRpb25zIHtcbiAgLyoqXG4gICAqIFNwZWNpZnkgdGhlIGVuY29kaW5nIG9mIGlucHV0IHVuaWZvcm0gY29sb3JzIGFuZCB0ZXh0dXJlcy5cbiAgICpcbiAgICogV2hlbiB5b3VyIGByZW5kZXJlci5vdXRwdXRFbmNvZGluZ2AgaXMgYFRIUkVFLkxpbmVhckVuY29kaW5nYCwgdXNlIGBUSFJFRS5MaW5lYXJFbmNvZGluZ2AuXG4gICAqIFdoZW4geW91ciBgcmVuZGVyZXIub3V0cHV0RW5jb2RpbmdgIGlzIGBUSFJFRS5zUkdCRW5jb2RpbmdgLCB1c2UgYFRIUkVFLnNSR0JFbmNvZGluZ2AuXG4gICAqXG4gICAqIFRoZSBpbXBvcnRlciB3aWxsIHVzZSBgVEhSRUUuTGluZWFyRW5jb2RpbmdgIGlmIHRoaXMgb3B0aW9uIGlzbid0IHNwZWNpZmllZC5cbiAgICpcbiAgICogU2VlIGFsc286IGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL3JlbmRlcmVycy9XZWJHTFJlbmRlcmVyLm91dHB1dEVuY29kaW5nXG4gICAqL1xuICBlbmNvZGluZz86IFRIUkVFLlRleHR1cmVFbmNvZGluZztcblxuICAvKipcbiAgICogQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSBgUHJvbWlzZWAgb2YgZW52aXJvbm1lbnQgbWFwIHRleHR1cmUuXG4gICAqIFRoZSBpbXBvcnRlciB3aWxsIGF0dGVtcHQgdG8gY2FsbCB0aGlzIGZ1bmN0aW9uIHdoZW4gaXQgaGF2ZSB0byB1c2UgYW4gZW52bWFwLlxuICAgKi9cbiAgcmVxdWVzdEVudk1hcD86ICgpID0+IFByb21pc2U8VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xufVxuXG4vKipcbiAqIEFuIGltcG9ydGVyIHRoYXQgaW1wb3J0cyBWUk0gbWF0ZXJpYWxzIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTU1hdGVyaWFsSW1wb3J0ZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IF9lbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nO1xuICBwcml2YXRlIHJlYWRvbmx5IF9yZXF1ZXN0RW52TWFwPzogKCkgPT4gUHJvbWlzZTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1NYXRlcmlhbEltcG9ydGVyLlxuICAgKlxuICAgKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIG9mIHRoZSBWUk1NYXRlcmlhbEltcG9ydGVyXG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBWUk1NYXRlcmlhbEltcG9ydGVyT3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy5fZW5jb2RpbmcgPSBvcHRpb25zLmVuY29kaW5nIHx8IFRIUkVFLkxpbmVhckVuY29kaW5nO1xuICAgIGlmICh0aGlzLl9lbmNvZGluZyAhPT0gVEhSRUUuTGluZWFyRW5jb2RpbmcgJiYgdGhpcy5fZW5jb2RpbmcgIT09IFRIUkVFLnNSR0JFbmNvZGluZykge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAnVGhlIHNwZWNpZmllZCBjb2xvciBlbmNvZGluZyBtaWdodCBub3Qgd29yayBwcm9wZXJseSB3aXRoIFZSTU1hdGVyaWFsSW1wb3J0ZXIuIFlvdSBtaWdodCB3YW50IHRvIHVzZSBUSFJFRS5zUkdCRW5jb2RpbmcgaW5zdGVhZC4nLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLl9yZXF1ZXN0RW52TWFwID0gb3B0aW9ucy5yZXF1ZXN0RW52TWFwO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYWxsIHRoZSBtYXRlcmlhbHMgb2YgZ2l2ZW4gR0xURiBiYXNlZCBvbiBWUk0gZXh0ZW5zaW9uIGZpZWxkIGBtYXRlcmlhbFByb3BlcnRpZXNgLlxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICovXG4gIHB1YmxpYyBhc3luYyBjb252ZXJ0R0xURk1hdGVyaWFscyhnbHRmOiBHTFRGKTogUHJvbWlzZTxUSFJFRS5NYXRlcmlhbFtdIHwgbnVsbD4ge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRlcmlhbFByb3BlcnRpZXM6IFZSTVNjaGVtYS5NYXRlcmlhbFtdIHwgdW5kZWZpbmVkID0gdnJtRXh0Lm1hdGVyaWFsUHJvcGVydGllcztcbiAgICBpZiAoIW1hdGVyaWFsUHJvcGVydGllcykge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgbm9kZVByaW1pdGl2ZXNNYXAgPSBhd2FpdCBnbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZXMoZ2x0Zik7XG4gICAgY29uc3QgbWF0ZXJpYWxMaXN0OiB7IFt2cm1NYXRlcmlhbEluZGV4OiBudW1iZXJdOiB7IHN1cmZhY2U6IFRIUkVFLk1hdGVyaWFsOyBvdXRsaW5lPzogVEhSRUUuTWF0ZXJpYWwgfSB9ID0ge307XG4gICAgY29uc3QgbWF0ZXJpYWxzOiBUSFJFRS5NYXRlcmlhbFtdID0gW107IC8vIHJlc3VsdFxuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBBcnJheS5mcm9tKG5vZGVQcmltaXRpdmVzTWFwLmVudHJpZXMoKSkubWFwKGFzeW5jIChbbm9kZUluZGV4LCBwcmltaXRpdmVzXSkgPT4ge1xuICAgICAgICBjb25zdCBzY2hlbWFOb2RlOiBHTFRGU2NoZW1hLk5vZGUgPSBnbHRmLnBhcnNlci5qc29uLm5vZGVzW25vZGVJbmRleF07XG4gICAgICAgIGNvbnN0IHNjaGVtYU1lc2g6IEdMVEZTY2hlbWEuTWVzaCA9IGdsdGYucGFyc2VyLmpzb24ubWVzaGVzW3NjaGVtYU5vZGUubWVzaCFdO1xuXG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgIHByaW1pdGl2ZXMubWFwKGFzeW5jIChwcmltaXRpdmUsIHByaW1pdGl2ZUluZGV4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBzY2hlbWFQcmltaXRpdmUgPSBzY2hlbWFNZXNoLnByaW1pdGl2ZXNbcHJpbWl0aXZlSW5kZXhdO1xuXG4gICAgICAgICAgICAvLyBzb21lIGdsVEYgbWlnaHQgaGF2ZSBib3RoIGBub2RlLm1lc2hgIGFuZCBgbm9kZS5jaGlsZHJlbmAgYXQgb25jZVxuICAgICAgICAgICAgLy8gYW5kIEdMVEZMb2FkZXIgaGFuZGxlcyBib3RoIG1lc2ggcHJpbWl0aXZlcyBhbmQgXCJjaGlsZHJlblwiIGluIGdsVEYgYXMgXCJjaGlsZHJlblwiIGluIFRIUkVFXG4gICAgICAgICAgICAvLyBJdCBzZWVtcyBHTFRGTG9hZGVyIGhhbmRsZXMgcHJpbWl0aXZlcyBmaXJzdCB0aGVuIGhhbmRsZXMgXCJjaGlsZHJlblwiIGluIGdsVEYgKGl0J3MgbHVja3khKVxuICAgICAgICAgICAgLy8gc28gd2Ugc2hvdWxkIGlnbm9yZSAocHJpbWl0aXZlcy5sZW5ndGgpdGggYW5kIGZvbGxvd2luZyBjaGlsZHJlbiBvZiBgbWVzaC5jaGlsZHJlbmBcbiAgICAgICAgICAgIC8vIFRPRE86IHNhbml0aXplIHRoaXMgYWZ0ZXIgR0xURkxvYWRlciBwbHVnaW4gc3lzdGVtIGdldHMgaW50cm9kdWNlZCA6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8xODQyMVxuICAgICAgICAgICAgaWYgKCFzY2hlbWFQcmltaXRpdmUpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBwcmltaXRpdmVHZW9tZXRyeSA9IHByaW1pdGl2ZS5nZW9tZXRyeTtcbiAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZVZlcnRpY2VzID0gcHJpbWl0aXZlR2VvbWV0cnkuaW5kZXhcbiAgICAgICAgICAgICAgPyBwcmltaXRpdmVHZW9tZXRyeS5pbmRleC5jb3VudFxuICAgICAgICAgICAgICA6IHByaW1pdGl2ZUdlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb24uY291bnQgLyAzO1xuXG4gICAgICAgICAgICAvLyBpZiBwcmltaXRpdmVzIG1hdGVyaWFsIGlzIG5vdCBhbiBhcnJheSwgbWFrZSBpdCBhbiBhcnJheVxuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHByaW1pdGl2ZS5tYXRlcmlhbCkpIHtcbiAgICAgICAgICAgICAgcHJpbWl0aXZlLm1hdGVyaWFsID0gW3ByaW1pdGl2ZS5tYXRlcmlhbF07XG4gICAgICAgICAgICAgIHByaW1pdGl2ZUdlb21ldHJ5LmFkZEdyb3VwKDAsIHByaW1pdGl2ZVZlcnRpY2VzLCAwKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gY3JlYXRlIC8gcHVzaCB0byBjYWNoZSAob3IgcG9wIGZyb20gY2FjaGUpIHZybSBtYXRlcmlhbHNcbiAgICAgICAgICAgIGNvbnN0IHZybU1hdGVyaWFsSW5kZXggPSBzY2hlbWFQcmltaXRpdmUubWF0ZXJpYWwhO1xuXG4gICAgICAgICAgICBsZXQgcHJvcHMgPSBtYXRlcmlhbFByb3BlcnRpZXNbdnJtTWF0ZXJpYWxJbmRleF07XG4gICAgICAgICAgICBpZiAoIXByb3BzKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgICAgICBgVlJNTWF0ZXJpYWxJbXBvcnRlcjogVGhlcmUgYXJlIG5vIG1hdGVyaWFsIGRlZmluaXRpb24gZm9yIG1hdGVyaWFsICMke3ZybU1hdGVyaWFsSW5kZXh9IG9uIFZSTSBleHRlbnNpb24uYCxcbiAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgcHJvcHMgPSB7IHNoYWRlcjogJ1ZSTV9VU0VfR0xURlNIQURFUicgfTsgLy8gZmFsbGJhY2tcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGV0IHZybU1hdGVyaWFsczogeyBzdXJmYWNlOiBUSFJFRS5NYXRlcmlhbDsgb3V0bGluZT86IFRIUkVFLk1hdGVyaWFsIH07XG4gICAgICAgICAgICBpZiAobWF0ZXJpYWxMaXN0W3ZybU1hdGVyaWFsSW5kZXhdKSB7XG4gICAgICAgICAgICAgIHZybU1hdGVyaWFscyA9IG1hdGVyaWFsTGlzdFt2cm1NYXRlcmlhbEluZGV4XTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHZybU1hdGVyaWFscyA9IGF3YWl0IHRoaXMuY3JlYXRlVlJNTWF0ZXJpYWxzKHByaW1pdGl2ZS5tYXRlcmlhbFswXSwgcHJvcHMsIGdsdGYpO1xuICAgICAgICAgICAgICBtYXRlcmlhbExpc3RbdnJtTWF0ZXJpYWxJbmRleF0gPSB2cm1NYXRlcmlhbHM7XG5cbiAgICAgICAgICAgICAgbWF0ZXJpYWxzLnB1c2godnJtTWF0ZXJpYWxzLnN1cmZhY2UpO1xuICAgICAgICAgICAgICBpZiAodnJtTWF0ZXJpYWxzLm91dGxpbmUpIHtcbiAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaCh2cm1NYXRlcmlhbHMub3V0bGluZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gc3VyZmFjZVxuICAgICAgICAgICAgcHJpbWl0aXZlLm1hdGVyaWFsWzBdID0gdnJtTWF0ZXJpYWxzLnN1cmZhY2U7XG5cbiAgICAgICAgICAgIC8vIGVudm1hcFxuICAgICAgICAgICAgaWYgKHRoaXMuX3JlcXVlc3RFbnZNYXAgJiYgKHZybU1hdGVyaWFscy5zdXJmYWNlIGFzIGFueSkuaXNNZXNoU3RhbmRhcmRNYXRlcmlhbCkge1xuICAgICAgICAgICAgICB0aGlzLl9yZXF1ZXN0RW52TWFwKCkudGhlbigoZW52TWFwKSA9PiB7XG4gICAgICAgICAgICAgICAgKHZybU1hdGVyaWFscy5zdXJmYWNlIGFzIGFueSkuZW52TWFwID0gZW52TWFwO1xuICAgICAgICAgICAgICAgIHZybU1hdGVyaWFscy5zdXJmYWNlLm5lZWRzVXBkYXRlID0gdHJ1ZTtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHJlbmRlciBvcmRlclxuICAgICAgICAgICAgcHJpbWl0aXZlLnJlbmRlck9yZGVyID0gcHJvcHMucmVuZGVyUXVldWUgfHwgMjAwMDtcblxuICAgICAgICAgICAgLy8gb3V0bGluZSAoXCIyIHBhc3Mgc2hhZGluZyB1c2luZyBncm91cHNcIiB0cmljayBoZXJlKVxuICAgICAgICAgICAgaWYgKHZybU1hdGVyaWFscy5vdXRsaW5lKSB7XG4gICAgICAgICAgICAgIHByaW1pdGl2ZS5tYXRlcmlhbFsxXSA9IHZybU1hdGVyaWFscy5vdXRsaW5lO1xuICAgICAgICAgICAgICBwcmltaXRpdmVHZW9tZXRyeS5hZGRHcm91cCgwLCBwcmltaXRpdmVWZXJ0aWNlcywgMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSksXG4gICAgICAgICk7XG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgcmV0dXJuIG1hdGVyaWFscztcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBjcmVhdGVWUk1NYXRlcmlhbHMoXG4gICAgb3JpZ2luYWxNYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWwsXG4gICAgdnJtUHJvcHM6IFZSTVNjaGVtYS5NYXRlcmlhbCxcbiAgICBnbHRmOiBHTFRGLFxuICApOiBQcm9taXNlPHtcbiAgICBzdXJmYWNlOiBUSFJFRS5NYXRlcmlhbDtcbiAgICBvdXRsaW5lPzogVEhSRUUuTWF0ZXJpYWw7XG4gIH0+IHtcbiAgICBsZXQgbmV3U3VyZmFjZTogVEhSRUUuTWF0ZXJpYWwgfCB1bmRlZmluZWQ7XG4gICAgbGV0IG5ld091dGxpbmU6IFRIUkVFLk1hdGVyaWFsIHwgdW5kZWZpbmVkO1xuXG4gICAgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9NVG9vbicpIHtcbiAgICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IHRoaXMuX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMob3JpZ2luYWxNYXRlcmlhbCwgdnJtUHJvcHMsIGdsdGYpO1xuXG4gICAgICAvLyB3ZSBuZWVkIHRvIGdldCByaWQgb2YgdGhlc2UgcHJvcGVydGllc1xuICAgICAgWydzcmNCbGVuZCcsICdkc3RCbGVuZCcsICdpc0ZpcnN0U2V0dXAnXS5mb3JFYWNoKChuYW1lKSA9PiB7XG4gICAgICAgIGlmIChwYXJhbXNbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGRlbGV0ZSBwYXJhbXNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyB0aGVzZSB0ZXh0dXJlcyBtdXN0IGJlIHNSR0IgRW5jb2RpbmcsIGRlcGVuZHMgb24gY3VycmVudCBjb2xvcnNwYWNlXG4gICAgICBbJ21haW5UZXgnLCAnc2hhZGVUZXh0dXJlJywgJ2VtaXNzaW9uTWFwJywgJ3NwaGVyZUFkZCcsICdyaW1UZXh0dXJlJ10uZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgICBpZiAocGFyYW1zW25hbWVdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBwYXJhbXNbbmFtZV0uZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIHNwZWNpZnkgdW5pZm9ybSBjb2xvciBlbmNvZGluZ3NcbiAgICAgIHBhcmFtcy5lbmNvZGluZyA9IHRoaXMuX2VuY29kaW5nO1xuXG4gICAgICAvLyBkb25lXG4gICAgICBuZXdTdXJmYWNlID0gbmV3IE1Ub29uTWF0ZXJpYWwocGFyYW1zKTtcblxuICAgICAgLy8gb3V0bGluZVxuICAgICAgaWYgKHBhcmFtcy5vdXRsaW5lV2lkdGhNb2RlICE9PSBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZS5Ob25lKSB7XG4gICAgICAgIHBhcmFtcy5pc091dGxpbmUgPSB0cnVlO1xuICAgICAgICBuZXdPdXRsaW5lID0gbmV3IE1Ub29uTWF0ZXJpYWwocGFyYW1zKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHZybVByb3BzLnNoYWRlciA9PT0gJ1ZSTS9VbmxpdFRleHR1cmUnKSB7XG4gICAgICAvLyB0aGlzIGlzIHZlcnkgbGVnYWN5XG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcbiAgICAgIHBhcmFtcy5yZW5kZXJUeXBlID0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuT3BhcXVlO1xuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBWUk1VbmxpdE1hdGVyaWFsKHBhcmFtcyk7XG4gICAgfSBlbHNlIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vVW5saXRDdXRvdXQnKSB7XG4gICAgICAvLyB0aGlzIGlzIHZlcnkgbGVnYWN5XG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcbiAgICAgIHBhcmFtcy5yZW5kZXJUeXBlID0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuQ3V0b3V0O1xuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBWUk1VbmxpdE1hdGVyaWFsKHBhcmFtcyk7XG4gICAgfSBlbHNlIGlmICh2cm1Qcm9wcy5zaGFkZXIgPT09ICdWUk0vVW5saXRUcmFuc3BhcmVudCcpIHtcbiAgICAgIC8vIHRoaXMgaXMgdmVyeSBsZWdhY3lcbiAgICAgIGNvbnN0IHBhcmFtcyA9IGF3YWl0IHRoaXMuX2V4dHJhY3RNYXRlcmlhbFByb3BlcnRpZXMob3JpZ2luYWxNYXRlcmlhbCwgdnJtUHJvcHMsIGdsdGYpO1xuICAgICAgcGFyYW1zLnJlbmRlclR5cGUgPSBWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZS5UcmFuc3BhcmVudDtcbiAgICAgIG5ld1N1cmZhY2UgPSBuZXcgVlJNVW5saXRNYXRlcmlhbChwYXJhbXMpO1xuICAgIH0gZWxzZSBpZiAodnJtUHJvcHMuc2hhZGVyID09PSAnVlJNL1VubGl0VHJhbnNwYXJlbnRaV3JpdGUnKSB7XG4gICAgICAvLyB0aGlzIGlzIHZlcnkgbGVnYWN5XG4gICAgICBjb25zdCBwYXJhbXMgPSBhd2FpdCB0aGlzLl9leHRyYWN0TWF0ZXJpYWxQcm9wZXJ0aWVzKG9yaWdpbmFsTWF0ZXJpYWwsIHZybVByb3BzLCBnbHRmKTtcbiAgICAgIHBhcmFtcy5yZW5kZXJUeXBlID0gVlJNVW5saXRNYXRlcmlhbFJlbmRlclR5cGUuVHJhbnNwYXJlbnRXaXRoWldyaXRlO1xuICAgICAgbmV3U3VyZmFjZSA9IG5ldyBWUk1VbmxpdE1hdGVyaWFsKHBhcmFtcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh2cm1Qcm9wcy5zaGFkZXIgIT09ICdWUk1fVVNFX0dMVEZTSEFERVInKSB7XG4gICAgICAgIGNvbnNvbGUud2FybihgVW5rbm93biBzaGFkZXIgZGV0ZWN0ZWQ6IFwiJHt2cm1Qcm9wcy5zaGFkZXJ9XCJgKTtcbiAgICAgICAgLy8gdGhlbiBwcmVzdW1lIGFzIFZSTV9VU0VfR0xURlNIQURFUlxuICAgICAgfVxuXG4gICAgICBuZXdTdXJmYWNlID0gdGhpcy5fY29udmVydEdMVEZNYXRlcmlhbChvcmlnaW5hbE1hdGVyaWFsLmNsb25lKCkpO1xuICAgIH1cblxuICAgIG5ld1N1cmZhY2UubmFtZSA9IG9yaWdpbmFsTWF0ZXJpYWwubmFtZTtcbiAgICBuZXdTdXJmYWNlLnVzZXJEYXRhID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvcmlnaW5hbE1hdGVyaWFsLnVzZXJEYXRhKSk7XG4gICAgbmV3U3VyZmFjZS51c2VyRGF0YS52cm1NYXRlcmlhbFByb3BlcnRpZXMgPSB2cm1Qcm9wcztcblxuICAgIGlmIChuZXdPdXRsaW5lKSB7XG4gICAgICBuZXdPdXRsaW5lLm5hbWUgPSBvcmlnaW5hbE1hdGVyaWFsLm5hbWUgKyAnIChPdXRsaW5lKSc7XG4gICAgICBuZXdPdXRsaW5lLnVzZXJEYXRhID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeShvcmlnaW5hbE1hdGVyaWFsLnVzZXJEYXRhKSk7XG4gICAgICBuZXdPdXRsaW5lLnVzZXJEYXRhLnZybU1hdGVyaWFsUHJvcGVydGllcyA9IHZybVByb3BzO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBzdXJmYWNlOiBuZXdTdXJmYWNlLFxuICAgICAgb3V0bGluZTogbmV3T3V0bGluZSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmIChuYW1lWzBdICE9PSAnXycpIHtcbiAgICAgIGNvbnNvbGUud2FybihgVlJNTWF0ZXJpYWxzOiBHaXZlbiBwcm9wZXJ0eSBuYW1lIFwiJHtuYW1lfVwiIG1pZ2h0IGJlIGludmFsaWRgKTtcbiAgICAgIHJldHVybiBuYW1lO1xuICAgIH1cbiAgICBuYW1lID0gbmFtZS5zdWJzdHJpbmcoMSk7XG5cbiAgICBpZiAoIS9bQS1aXS8udGVzdChuYW1lWzBdKSkge1xuICAgICAgY29uc29sZS53YXJuKGBWUk1NYXRlcmlhbHM6IEdpdmVuIHByb3BlcnR5IG5hbWUgXCIke25hbWV9XCIgbWlnaHQgYmUgaW52YWxpZGApO1xuICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfVxuICAgIHJldHVybiBuYW1lWzBdLnRvTG93ZXJDYXNlKCkgKyBuYW1lLnN1YnN0cmluZygxKTtcbiAgfVxuXG4gIHByaXZhdGUgX2NvbnZlcnRHTFRGTWF0ZXJpYWwobWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsKTogVEhSRUUuTWF0ZXJpYWwge1xuICAgIGlmICgobWF0ZXJpYWwgYXMgYW55KS5pc01lc2hTdGFuZGFyZE1hdGVyaWFsKSB7XG4gICAgICBjb25zdCBtdGwgPSBtYXRlcmlhbCBhcyBUSFJFRS5NZXNoU3RhbmRhcmRNYXRlcmlhbDtcblxuICAgICAgaWYgKG10bC5tYXApIHtcbiAgICAgICAgbXRsLm1hcC5lbmNvZGluZyA9IHRoaXMuX2VuY29kaW5nO1xuICAgICAgfVxuICAgICAgaWYgKG10bC5lbWlzc2l2ZU1hcCkge1xuICAgICAgICBtdGwuZW1pc3NpdmVNYXAuZW5jb2RpbmcgPSB0aGlzLl9lbmNvZGluZztcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMuX2VuY29kaW5nID09PSBUSFJFRS5MaW5lYXJFbmNvZGluZykge1xuICAgICAgICBtdGwuY29sb3IuY29udmVydExpbmVhclRvU1JHQigpO1xuICAgICAgICBtdGwuZW1pc3NpdmUuY29udmVydExpbmVhclRvU1JHQigpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICgobWF0ZXJpYWwgYXMgYW55KS5pc01lc2hCYXNpY01hdGVyaWFsKSB7XG4gICAgICBjb25zdCBtdGwgPSBtYXRlcmlhbCBhcyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbDtcblxuICAgICAgaWYgKG10bC5tYXApIHtcbiAgICAgICAgbXRsLm1hcC5lbmNvZGluZyA9IHRoaXMuX2VuY29kaW5nO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5fZW5jb2RpbmcgPT09IFRIUkVFLkxpbmVhckVuY29kaW5nKSB7XG4gICAgICAgIG10bC5jb2xvci5jb252ZXJ0TGluZWFyVG9TUkdCKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG1hdGVyaWFsO1xuICB9XG5cbiAgcHJpdmF0ZSBfZXh0cmFjdE1hdGVyaWFsUHJvcGVydGllcyhcbiAgICBvcmlnaW5hbE1hdGVyaWFsOiBUSFJFRS5NYXRlcmlhbCxcbiAgICB2cm1Qcm9wczogVlJNU2NoZW1hLk1hdGVyaWFsLFxuICAgIGdsdGY6IEdMVEYsXG4gICk6IFByb21pc2U8YW55PiB7XG4gICAgY29uc3QgdGFza0xpc3Q6IEFycmF5PFByb21pc2U8YW55Pj4gPSBbXTtcbiAgICBjb25zdCBwYXJhbXM6IGFueSA9IHt9O1xuXG4gICAgLy8gZXh0cmFjdCB0ZXh0dXJlIHByb3BlcnRpZXNcbiAgICBpZiAodnJtUHJvcHMudGV4dHVyZVByb3BlcnRpZXMpIHtcbiAgICAgIGZvciAoY29uc3QgbmFtZSBvZiBPYmplY3Qua2V5cyh2cm1Qcm9wcy50ZXh0dXJlUHJvcGVydGllcykpIHtcbiAgICAgICAgY29uc3QgbmV3TmFtZSA9IHRoaXMuX3JlbmFtZU1hdGVyaWFsUHJvcGVydHkobmFtZSk7XG4gICAgICAgIGNvbnN0IHRleHR1cmVJbmRleCA9IHZybVByb3BzLnRleHR1cmVQcm9wZXJ0aWVzW25hbWVdO1xuXG4gICAgICAgIHRhc2tMaXN0LnB1c2goXG4gICAgICAgICAgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgndGV4dHVyZScsIHRleHR1cmVJbmRleCkudGhlbigodGV4dHVyZTogVEhSRUUuVGV4dHVyZSkgPT4ge1xuICAgICAgICAgICAgcGFyYW1zW25ld05hbWVdID0gdGV4dHVyZTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBleHRyYWN0IGZsb2F0IHByb3BlcnRpZXNcbiAgICBpZiAodnJtUHJvcHMuZmxvYXRQcm9wZXJ0aWVzKSB7XG4gICAgICBmb3IgKGNvbnN0IG5hbWUgb2YgT2JqZWN0LmtleXModnJtUHJvcHMuZmxvYXRQcm9wZXJ0aWVzKSkge1xuICAgICAgICBjb25zdCBuZXdOYW1lID0gdGhpcy5fcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShuYW1lKTtcbiAgICAgICAgcGFyYW1zW25ld05hbWVdID0gdnJtUHJvcHMuZmxvYXRQcm9wZXJ0aWVzW25hbWVdO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGV4dHJhY3QgdmVjdG9yIChjb2xvciB0YmgpIHByb3BlcnRpZXNcbiAgICBpZiAodnJtUHJvcHMudmVjdG9yUHJvcGVydGllcykge1xuICAgICAgZm9yIChjb25zdCBuYW1lIG9mIE9iamVjdC5rZXlzKHZybVByb3BzLnZlY3RvclByb3BlcnRpZXMpKSB7XG4gICAgICAgIGxldCBuZXdOYW1lID0gdGhpcy5fcmVuYW1lTWF0ZXJpYWxQcm9wZXJ0eShuYW1lKTtcblxuICAgICAgICAvLyBpZiB0aGlzIGlzIHRleHR1cmVTVCAoc2FtZSBuYW1lIGFzIHRleHR1cmUgbmFtZSBpdHNlbGYpLCBhZGQgJ19TVCdcbiAgICAgICAgY29uc3QgaXNUZXh0dXJlU1QgPSBbXG4gICAgICAgICAgJ19NYWluVGV4JyxcbiAgICAgICAgICAnX1NoYWRlVGV4dHVyZScsXG4gICAgICAgICAgJ19CdW1wTWFwJyxcbiAgICAgICAgICAnX1JlY2VpdmVTaGFkb3dUZXh0dXJlJyxcbiAgICAgICAgICAnX1NoYWRpbmdHcmFkZVRleHR1cmUnLFxuICAgICAgICAgICdfUmltVGV4dHVyZScsXG4gICAgICAgICAgJ19TcGhlcmVBZGQnLFxuICAgICAgICAgICdfRW1pc3Npb25NYXAnLFxuICAgICAgICAgICdfT3V0bGluZVdpZHRoVGV4dHVyZScsXG4gICAgICAgICAgJ19VdkFuaW1NYXNrVGV4dHVyZScsXG4gICAgICAgIF0uc29tZSgodGV4dHVyZU5hbWUpID0+IG5hbWUgPT09IHRleHR1cmVOYW1lKTtcbiAgICAgICAgaWYgKGlzVGV4dHVyZVNUKSB7XG4gICAgICAgICAgbmV3TmFtZSArPSAnX1NUJztcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcmFtc1tuZXdOYW1lXSA9IG5ldyBUSFJFRS5WZWN0b3I0KC4uLnZybVByb3BzLnZlY3RvclByb3BlcnRpZXNbbmFtZV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIENPTVBBVDogcHJlLXIxMjlcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMTc4OFxuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTI5KSB7XG4gICAgICBwYXJhbXMuc2tpbm5pbmcgPSAob3JpZ2luYWxNYXRlcmlhbCBhcyBhbnkpLnNraW5uaW5nIHx8IGZhbHNlO1xuICAgIH1cblxuICAgIC8vIENPTVBBVDogcHJlLXIxMzFcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMjE2OVxuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTMxKSB7XG4gICAgICBwYXJhbXMubW9ycGhUYXJnZXRzID0gKG9yaWdpbmFsTWF0ZXJpYWwgYXMgYW55KS5tb3JwaFRhcmdldHMgfHwgZmFsc2U7XG4gICAgICBwYXJhbXMubW9ycGhOb3JtYWxzID0gKG9yaWdpbmFsTWF0ZXJpYWwgYXMgYW55KS5tb3JwaE5vcm1hbHMgfHwgZmFsc2U7XG4gICAgfVxuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHRhc2tMaXN0KS50aGVuKCgpID0+IHBhcmFtcyk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTVNjaGVtYSB9IGZyb20gJy4uL3R5cGVzJztcbmltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTU1ldGEgfSBmcm9tICcuL1ZSTU1ldGEnO1xuaW1wb3J0IHsgVlJNTWV0YUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4vVlJNTWV0YUltcG9ydGVyT3B0aW9ucyc7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEge0BsaW5rIFZSTU1ldGF9IGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTU1ldGFJbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJZiBgdHJ1ZWAsIGl0IHdvbid0IGxvYWQgaXRzIHRodW1ibmFpbCB0ZXh0dXJlICh7QGxpbmsgVlJNTWV0YS50ZXh0dXJlfSkuIGBmYWxzZWAgYnkgZGVmYXVsdC5cbiAgICovXG4gIHB1YmxpYyBpZ25vcmVUZXh0dXJlOiBib29sZWFuO1xuXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnM/OiBWUk1NZXRhSW1wb3J0ZXJPcHRpb25zKSB7XG4gICAgdGhpcy5pZ25vcmVUZXh0dXJlID0gb3B0aW9ucz8uaWdub3JlVGV4dHVyZSA/PyBmYWxzZTtcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNTWV0YSB8IG51bGw+IHtcbiAgICBjb25zdCB2cm1FeHQ6IFZSTVNjaGVtYS5WUk0gfCB1bmRlZmluZWQgPSBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnM/LlZSTTtcbiAgICBpZiAoIXZybUV4dCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3Qgc2NoZW1hTWV0YTogVlJNU2NoZW1hLk1ldGEgfCB1bmRlZmluZWQgPSB2cm1FeHQubWV0YTtcbiAgICBpZiAoIXNjaGVtYU1ldGEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGxldCB0ZXh0dXJlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB8IHVuZGVmaW5lZDtcbiAgICBpZiAoIXRoaXMuaWdub3JlVGV4dHVyZSAmJiBzY2hlbWFNZXRhLnRleHR1cmUgIT0gbnVsbCAmJiBzY2hlbWFNZXRhLnRleHR1cmUgIT09IC0xKSB7XG4gICAgICB0ZXh0dXJlID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgndGV4dHVyZScsIHNjaGVtYU1ldGEudGV4dHVyZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIGFsbG93ZWRVc2VyTmFtZTogc2NoZW1hTWV0YS5hbGxvd2VkVXNlck5hbWUsXG4gICAgICBhdXRob3I6IHNjaGVtYU1ldGEuYXV0aG9yLFxuICAgICAgY29tbWVyY2lhbFVzc2FnZU5hbWU6IHNjaGVtYU1ldGEuY29tbWVyY2lhbFVzc2FnZU5hbWUsXG4gICAgICBjb250YWN0SW5mb3JtYXRpb246IHNjaGVtYU1ldGEuY29udGFjdEluZm9ybWF0aW9uLFxuICAgICAgbGljZW5zZU5hbWU6IHNjaGVtYU1ldGEubGljZW5zZU5hbWUsXG4gICAgICBvdGhlckxpY2Vuc2VVcmw6IHNjaGVtYU1ldGEub3RoZXJMaWNlbnNlVXJsLFxuICAgICAgb3RoZXJQZXJtaXNzaW9uVXJsOiBzY2hlbWFNZXRhLm90aGVyUGVybWlzc2lvblVybCxcbiAgICAgIHJlZmVyZW5jZTogc2NoZW1hTWV0YS5yZWZlcmVuY2UsXG4gICAgICBzZXh1YWxVc3NhZ2VOYW1lOiBzY2hlbWFNZXRhLnNleHVhbFVzc2FnZU5hbWUsXG4gICAgICB0ZXh0dXJlOiB0ZXh0dXJlID8/IHVuZGVmaW5lZCxcbiAgICAgIHRpdGxlOiBzY2hlbWFNZXRhLnRpdGxlLFxuICAgICAgdmVyc2lvbjogc2NoZW1hTWV0YS52ZXJzaW9uLFxuICAgICAgdmlvbGVudFVzc2FnZU5hbWU6IHNjaGVtYU1ldGEudmlvbGVudFVzc2FnZU5hbWUsXG4gICAgfTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuXG5jb25zdCBfbWF0QSA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XG5cbi8qKlxuICogQSBjb21wYXQgZnVuY3Rpb24gZm9yIGBNYXRyaXg0LmludmVydCgpYCAvIGBNYXRyaXg0LmdldEludmVyc2UoKWAuXG4gKiBgTWF0cml4NC5pbnZlcnQoKWAgaXMgaW50cm9kdWNlZCBpbiByMTIzIGFuZCBgTWF0cml4NC5nZXRJbnZlcnNlKClgIGVtaXRzIGEgd2FybmluZy5cbiAqIFdlIGFyZSBnb2luZyB0byB1c2UgdGhpcyBjb21wYXQgZm9yIGEgd2hpbGUuXG4gKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IG1hdHJpeFxuICovXG5leHBvcnQgZnVuY3Rpb24gbWF0NEludmVydENvbXBhdDxUIGV4dGVuZHMgVEhSRUUuTWF0cml4ND4odGFyZ2V0OiBUKTogVCB7XG4gIGlmICgodGFyZ2V0IGFzIGFueSkuaW52ZXJ0KSB7XG4gICAgdGFyZ2V0LmludmVydCgpO1xuICB9IGVsc2Uge1xuICAgICh0YXJnZXQgYXMgYW55KS5nZXRJbnZlcnNlKF9tYXRBLmNvcHkodGFyZ2V0KSk7XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0O1xufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgbWF0NEludmVydENvbXBhdCB9IGZyb20gJy4vbWF0NEludmVydENvbXBhdCc7XG5cbmV4cG9ydCBjbGFzcyBNYXRyaXg0SW52ZXJzZUNhY2hlIHtcbiAgLyoqXG4gICAqIFRoZSB0YXJnZXQgbWF0cml4LlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG1hdHJpeDogVEhSRUUuTWF0cml4NDtcblxuICAvKipcbiAgICogQSBjYWNoZSBvZiBpbnZlcnNlIG9mIGN1cnJlbnQgbWF0cml4LlxuICAgKi9cbiAgcHJpdmF0ZSByZWFkb25seSBfaW52ZXJzZUNhY2hlID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcblxuICAvKipcbiAgICogQSBmbGFnIHRoYXQgbWFrZXMgaXQgd2FudCB0byByZWNhbGN1bGF0ZSBpdHMge0BsaW5rIF9pbnZlcnNlQ2FjaGV9LlxuICAgKiBXaWxsIGJlIHNldCBgdHJ1ZWAgd2hlbiBgZWxlbWVudHNgIGFyZSBtdXRhdGVkIGFuZCBiZSB1c2VkIGluIGBnZXRJbnZlcnNlYC5cbiAgICovXG4gIHByaXZhdGUgX3Nob3VsZFVwZGF0ZUludmVyc2UgPSB0cnVlO1xuXG4gIC8qKlxuICAgKiBUaGUgb3JpZ2luYWwgb2YgYG1hdHJpeC5lbGVtZW50c2BcbiAgICovXG4gIHByaXZhdGUgcmVhZG9ubHkgX29yaWdpbmFsRWxlbWVudHM6IG51bWJlcltdO1xuXG4gIC8qKlxuICAgKiBJbnZlcnNlIG9mIGdpdmVuIG1hdHJpeC5cbiAgICogTm90ZSB0aGF0IGl0IHdpbGwgcmV0dXJuIGl0cyBpbnRlcm5hbCBwcml2YXRlIGluc3RhbmNlLlxuICAgKiBNYWtlIHN1cmUgY29weWluZyB0aGlzIGJlZm9yZSBtdXRhdGUgdGhpcy5cbiAgICovXG4gIHB1YmxpYyBnZXQgaW52ZXJzZSgpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICBpZiAodGhpcy5fc2hvdWxkVXBkYXRlSW52ZXJzZSkge1xuICAgICAgbWF0NEludmVydENvbXBhdCh0aGlzLl9pbnZlcnNlQ2FjaGUuY29weSh0aGlzLm1hdHJpeCkpO1xuICAgICAgdGhpcy5fc2hvdWxkVXBkYXRlSW52ZXJzZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLl9pbnZlcnNlQ2FjaGU7XG4gIH1cblxuICBwdWJsaWMgY29uc3RydWN0b3IobWF0cml4OiBUSFJFRS5NYXRyaXg0KSB7XG4gICAgdGhpcy5tYXRyaXggPSBtYXRyaXg7XG5cbiAgICBjb25zdCBoYW5kbGVyOiBQcm94eUhhbmRsZXI8bnVtYmVyW10+ID0ge1xuICAgICAgc2V0OiAob2JqLCBwcm9wOiBhbnksIG5ld1ZhbCkgPT4ge1xuICAgICAgICB0aGlzLl9zaG91bGRVcGRhdGVJbnZlcnNlID0gdHJ1ZTtcbiAgICAgICAgb2JqW3Byb3BdID0gbmV3VmFsO1xuXG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSxcbiAgICB9O1xuXG4gICAgdGhpcy5fb3JpZ2luYWxFbGVtZW50cyA9IG1hdHJpeC5lbGVtZW50cztcbiAgICBtYXRyaXguZWxlbWVudHMgPSBuZXcgUHJveHkobWF0cml4LmVsZW1lbnRzLCBoYW5kbGVyKTtcbiAgfVxuXG4gIHB1YmxpYyByZXZlcnQoKTogdm9pZCB7XG4gICAgdGhpcy5tYXRyaXguZWxlbWVudHMgPSB0aGlzLl9vcmlnaW5hbEVsZW1lbnRzO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBtYXQ0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvbWF0NEludmVydENvbXBhdCc7XG5pbXBvcnQgeyBnZXRXb3JsZFF1YXRlcm5pb25MaXRlIH0gZnJvbSAnLi4vdXRpbHMvbWF0aCc7XG5pbXBvcnQgeyBNYXRyaXg0SW52ZXJzZUNhY2hlIH0gZnJvbSAnLi4vdXRpbHMvTWF0cml4NEludmVyc2VDYWNoZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuLy8gYmFzZWQgb25cbi8vIGh0dHA6Ly9yb2NrZXRqdW1wLnNrci5qcC91bml0eTNkLzEwOS9cbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kd2FuZ28vVW5pVlJNL2Jsb2IvbWFzdGVyL1NjcmlwdHMvU3ByaW5nQm9uZS9WUk1TcHJpbmdCb25lLmNzXG5cbmNvbnN0IElERU5USVRZX01BVFJJWDQgPSBPYmplY3QuZnJlZXplKG5ldyBUSFJFRS5NYXRyaXg0KCkpO1xuY29uc3QgSURFTlRJVFlfUVVBVEVSTklPTiA9IE9iamVjdC5mcmVlemUobmV3IFRIUkVFLlF1YXRlcm5pb24oKSk7XG5cbi8vIOioiOeul+S4reOBruS4gOaZguS/neWtmOeUqOWkieaVsO+8iOS4gOW6puOCpOODs+OCueOCv+ODs+OCueOCkuS9nOOBo+OBn+OCieOBguOBqOOBr+S9v+OBhOWbnuOBme+8iVxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcbmNvbnN0IF92M0MgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcbmNvbnN0IF9tYXRBID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcbmNvbnN0IF9tYXRCID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcblxuLyoqXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgYSBzaW5nbGUgc3ByaW5nIGJvbmUgb2YgYSBWUk0uXG4gKiBJdCBzaG91bGQgYmUgbWFuYWdlZCBieSBhIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmUge1xuICAvKipcbiAgICogUmFkaXVzIG9mIHRoZSBib25lLCB3aWxsIGJlIHVzZWQgZm9yIGNvbGxpc2lvbi5cbiAgICovXG4gIHB1YmxpYyByYWRpdXM6IG51bWJlcjtcblxuICAvKipcbiAgICogU3RpZmZuZXNzIGZvcmNlIG9mIHRoZSBib25lLiBJbmNyZWFzaW5nIHRoZSB2YWx1ZSA9IGZhc3RlciBjb252ZXJnZW5jZSAoZmVlbHMgXCJoYXJkZXJcIikuXG4gICAqIE9uIFVuaVZSTSwgaXRzIHJhbmdlIG9uIEdVSSBpcyBiZXR3ZWVuIGAwLjBgIGFuZCBgNC4wYCAuXG4gICAqL1xuICBwdWJsaWMgc3RpZmZuZXNzRm9yY2U6IG51bWJlcjtcblxuICAvKipcbiAgICogUG93ZXIgb2YgdGhlIGdyYXZpdHkgYWdhaW5zdCB0aGlzIGJvbmUuXG4gICAqIFRoZSBcInBvd2VyXCIgdXNlZCBpbiBoZXJlIGlzIHZlcnkgZmFyIGZyb20gc2NpZW50aWZpYyBwaHlzaWNzIHRlcm0uLi5cbiAgICovXG4gIHB1YmxpYyBncmF2aXR5UG93ZXI6IG51bWJlcjtcblxuICAvKipcbiAgICogRGlyZWN0aW9uIG9mIHRoZSBncmF2aXR5IGFnYWluc3QgdGhpcyBib25lLlxuICAgKiBVc3VhbGx5IGl0IHNob3VsZCBiZSBub3JtYWxpemVkLlxuICAgKi9cbiAgcHVibGljIGdyYXZpdHlEaXI6IFRIUkVFLlZlY3RvcjM7XG5cbiAgLyoqXG4gICAqIERyYWcgZm9yY2Ugb2YgdGhlIGJvbmUuIEluY3JlYXNpbmcgdGhlIHZhbHVlID0gbGVzcyBvc2NpbGxhdGlvbiAoZmVlbHMgXCJoZWF2aWVyXCIpLlxuICAgKiBPbiBVbmlWUk0sIGl0cyByYW5nZSBvbiBHVUkgaXMgYmV0d2VlbiBgMC4wYCBhbmQgYDEuMGAgLlxuICAgKi9cbiAgcHVibGljIGRyYWdGb3JjZTogbnVtYmVyO1xuXG4gIC8qKlxuICAgKiBDb2xsaWRlciBncm91cHMgYXR0YWNoZWQgdG8gdGhpcyBib25lLlxuICAgKi9cbiAgcHVibGljIGNvbGxpZGVyczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaFtdO1xuXG4gIC8qKlxuICAgKiBBbiBPYmplY3QzRCBhdHRhY2hlZCB0byB0aGlzIGJvbmUuXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYm9uZTogVEhSRUUuT2JqZWN0M0Q7XG5cbiAgLyoqXG4gICAqIEN1cnJlbnQgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgX2N1cnJlbnRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogUHJldmlvdXMgcG9zaXRpb24gb2YgY2hpbGQgdGFpbCwgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXG4gICAqL1xuICBwcm90ZWN0ZWQgX3ByZXZUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogTmV4dCBwb3NpdGlvbiBvZiBjaGlsZCB0YWlsLCBpbiB3b3JsZCB1bml0LiBXaWxsIGJlIHVzZWQgZm9yIHZlcmxldCBpbnRlZ3JhdGlvbi5cbiAgICogQWN0dWFsbHkgdXNlZCBvbmx5IGluIFtbdXBkYXRlXV0gYW5kIGl0J3Mga2luZCBvZiB0ZW1wb3JhcnkgdmFyaWFibGUuXG4gICAqL1xuICBwcm90ZWN0ZWQgX25leHRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBheGlzIG9mIHRoZSBib25lLCBpbiBsb2NhbCB1bml0LlxuICAgKi9cbiAgcHJvdGVjdGVkIF9ib25lQXhpcyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIExlbmd0aCBvZiB0aGUgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSB1bml0LiBXaWxsIGJlIHVzZWQgZm9yIG5vcm1hbGl6YXRpb24gaW4gdXBkYXRlIGxvb3AuXG4gICAqIEl0J3Mgc2FtZSBhcyBsb2NhbCB1bml0IGxlbmd0aCB1bmxlc3MgdGhlcmUgYXJlIHNjYWxlIHRyYW5zZm9ybWF0aW9uIGluIHdvcmxkIG1hdHJpeC5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyU3BhY2VCb25lTGVuZ3RoOiBudW1iZXI7XG5cbiAgLyoqXG4gICAqIFBvc2l0aW9uIG9mIHRoaXMgYm9uZSBpbiByZWxhdGl2ZSBzcGFjZSwga2luZCBvZiBhIHRlbXBvcmFyeSB2YXJpYWJsZS5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyU3BhY2VQb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIFRoaXMgc3ByaW5nYm9uZSB3aWxsIGJlIGNhbGN1bGF0ZWQgYmFzZWQgb24gdGhlIHNwYWNlIHJlbGF0aXZlIGZyb20gdGhpcyBvYmplY3QuXG4gICAqIElmIHRoaXMgaXMgYG51bGxgLCBzcHJpbmdib25lIHdpbGwgYmUgY2FsY3VsYXRlZCBpbiB3b3JsZCBzcGFjZS5cbiAgICovXG4gIHByb3RlY3RlZCBfY2VudGVyOiBUSFJFRS5PYmplY3QzRCB8IG51bGwgPSBudWxsO1xuICBwdWJsaWMgZ2V0IGNlbnRlcigpOiBUSFJFRS5PYmplY3QzRCB8IG51bGwge1xuICAgIHJldHVybiB0aGlzLl9jZW50ZXI7XG4gIH1cbiAgcHVibGljIHNldCBjZW50ZXIoY2VudGVyOiBUSFJFRS5PYmplY3QzRCB8IG51bGwpIHtcbiAgICAvLyBjb252ZXJ0IHRhaWxzIHRvIHdvcmxkIHNwYWNlXG4gICAgdGhpcy5fZ2V0TWF0cml4Q2VudGVyVG9Xb3JsZChfbWF0QSk7XG5cbiAgICB0aGlzLl9jdXJyZW50VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuICAgIHRoaXMuX3ByZXZUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG4gICAgdGhpcy5fbmV4dFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcblxuICAgIC8vIHVuaW5zdGFsbCBpbnZlcnNlIGNhY2hlXG4gICAgaWYgKHRoaXMuX2NlbnRlcj8udXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkpIHtcbiAgICAgICh0aGlzLl9jZW50ZXIudXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkgYXMgTWF0cml4NEludmVyc2VDYWNoZSkucmV2ZXJ0KCk7XG4gICAgICBkZWxldGUgdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5O1xuICAgIH1cblxuICAgIC8vIGNoYW5nZSB0aGUgY2VudGVyXG4gICAgdGhpcy5fY2VudGVyID0gY2VudGVyO1xuXG4gICAgLy8gaW5zdGFsbCBpbnZlcnNlIGNhY2hlXG4gICAgaWYgKHRoaXMuX2NlbnRlcikge1xuICAgICAgaWYgKCF0aGlzLl9jZW50ZXIudXNlckRhdGEuaW52ZXJzZUNhY2hlUHJveHkpIHtcbiAgICAgICAgdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5ID0gbmV3IE1hdHJpeDRJbnZlcnNlQ2FjaGUodGhpcy5fY2VudGVyLm1hdHJpeFdvcmxkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBjb252ZXJ0IHRhaWxzIHRvIGNlbnRlciBzcGFjZVxuICAgIHRoaXMuX2dldE1hdHJpeFdvcmxkVG9DZW50ZXIoX21hdEEpO1xuXG4gICAgdGhpcy5fY3VycmVudFRhaWwuYXBwbHlNYXRyaXg0KF9tYXRBKTtcbiAgICB0aGlzLl9wcmV2VGFpbC5hcHBseU1hdHJpeDQoX21hdEEpO1xuICAgIHRoaXMuX25leHRUYWlsLmFwcGx5TWF0cml4NChfbWF0QSk7XG5cbiAgICAvLyBjb252ZXJ0IGNlbnRlciBzcGFjZSBkZXBlbmRhbnQgc3RhdGVcbiAgICBfbWF0QS5tdWx0aXBseSh0aGlzLmJvbmUubWF0cml4V29ybGQpOyAvLyDwn5SlID8/XG5cbiAgICB0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbihfbWF0QSk7XG5cbiAgICB0aGlzLl9jZW50ZXJTcGFjZUJvbmVMZW5ndGggPSBfdjNBXG4gICAgICAuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKVxuICAgICAgLmFwcGx5TWF0cml4NChfbWF0QSlcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgIC5sZW5ndGgoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSb3RhdGlvbiBvZiBwYXJlbnQgYm9uZSwgaW4gd29ybGQgdW5pdC5cbiAgICogV2Ugc2hvdWxkIHVwZGF0ZSB0aGlzIGNvbnN0YW50bHkgaW4gW1t1cGRhdGVdXS5cbiAgICovXG4gIHByaXZhdGUgX3BhcmVudFdvcmxkUm90YXRpb24gPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsIHN0YXRlIG9mIHRoZSBsb2NhbCBtYXRyaXggb2YgdGhlIGJvbmUuXG4gICAqL1xuICBwcml2YXRlIF9pbml0aWFsTG9jYWxNYXRyaXggPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xuXG4gIC8qKlxuICAgKiBJbml0aWFsIHN0YXRlIG9mIHRoZSByb3RhdGlvbiBvZiB0aGUgYm9uZS5cbiAgICovXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbFJvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcblxuICAvKipcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgcG9zaXRpb24gb2YgaXRzIGNoaWxkLlxuICAgKi9cbiAgcHJpdmF0ZSBfaW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1TcHJpbmdCb25lLlxuICAgKlxuICAgKiBAcGFyYW0gYm9uZSBBbiBPYmplY3QzRCB0aGF0IHdpbGwgYmUgYXR0YWNoZWQgdG8gdGhpcyBib25lXG4gICAqIEBwYXJhbSBwYXJhbXMgU2V2ZXJhbCBwYXJhbWV0ZXJzIHJlbGF0ZWQgdG8gYmVoYXZpb3Igb2YgdGhlIHNwcmluZyBib25lXG4gICAqL1xuICBjb25zdHJ1Y3Rvcihib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyA9IHt9KSB7XG4gICAgdGhpcy5ib25lID0gYm9uZTsgLy8gdW5pVlJN44Gn44GuIHBhcmVudFxuICAgIHRoaXMuYm9uZS5tYXRyaXhBdXRvVXBkYXRlID0gZmFsc2U7IC8vIHVwZGF0ZeOBq+OCiOOCiuioiOeul+OBleOCjOOCi+OBruOBp3RocmVlLmpz5YaF44Gn44Gu6Ieq5YuV5Yem55CG44Gv5LiN6KaBXG5cbiAgICB0aGlzLnJhZGl1cyA9IHBhcmFtcy5yYWRpdXMgPz8gMC4wMjtcbiAgICB0aGlzLnN0aWZmbmVzc0ZvcmNlID0gcGFyYW1zLnN0aWZmbmVzc0ZvcmNlID8/IDEuMDtcbiAgICB0aGlzLmdyYXZpdHlEaXIgPSBwYXJhbXMuZ3Jhdml0eURpclxuICAgICAgPyBuZXcgVEhSRUUuVmVjdG9yMygpLmNvcHkocGFyYW1zLmdyYXZpdHlEaXIpXG4gICAgICA6IG5ldyBUSFJFRS5WZWN0b3IzKCkuc2V0KDAuMCwgLTEuMCwgMC4wKTtcbiAgICB0aGlzLmdyYXZpdHlQb3dlciA9IHBhcmFtcy5ncmF2aXR5UG93ZXIgPz8gMC4wO1xuICAgIHRoaXMuZHJhZ0ZvcmNlID0gcGFyYW1zLmRyYWdGb3JjZSA/PyAwLjQ7XG4gICAgdGhpcy5jb2xsaWRlcnMgPSBwYXJhbXMuY29sbGlkZXJzID8/IFtdO1xuXG4gICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbi5zZXRGcm9tTWF0cml4UG9zaXRpb24odGhpcy5ib25lLm1hdHJpeFdvcmxkKTtcblxuICAgIHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeC5jb3B5KHRoaXMuYm9uZS5tYXRyaXgpO1xuICAgIHRoaXMuX2luaXRpYWxMb2NhbFJvdGF0aW9uLmNvcHkodGhpcy5ib25lLnF1YXRlcm5pb24pO1xuXG4gICAgaWYgKHRoaXMuYm9uZS5jaGlsZHJlbi5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIOacq+err+OBruODnOODvOODs+OAguWtkOODnOODvOODs+OBjOOBhOOBquOBhOOBn+OCgeOAjOiHquWIhuOBruWwkeOBl+WFiOOAjeOBjOWtkOODnOODvOODs+OBqOOBhOOBhuOBk+OBqOOBq+OBmeOCi1xuICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL2R3YW5nby9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9TcHJpbmdCb25lL1ZSTVNwcmluZ0JvbmUuY3MjTDI0NlxuICAgICAgdGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbi5jb3B5KHRoaXMuYm9uZS5wb3NpdGlvbikubm9ybWFsaXplKCkubXVsdGlwbHlTY2FsYXIoMC4wNyk7IC8vIHZybTAgcmVxdWlyZXMgYSA3Y20gZml4ZWQgYm9uZSBsZW5ndGggZm9yIHRoZSBmaW5hbCBub2RlIGluIGEgY2hhaW4gLSBzZWUgaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL3ZybS1zcGVjaWZpY2F0aW9uL3RyZWUvbWFzdGVyL3NwZWNpZmljYXRpb24vVlJNQ19zcHJpbmdCb25lLTEuMC1iZXRhI2Fib3V0LXNwcmluZy1jb25maWd1cmF0aW9uXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGZpcnN0Q2hpbGQgPSB0aGlzLmJvbmUuY2hpbGRyZW5bMF07XG4gICAgICB0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uLmNvcHkoZmlyc3RDaGlsZC5wb3NpdGlvbik7XG4gICAgfVxuXG4gICAgLy8gQXBwbHkgdXBkYXRlZCBwb3NpdGlvbiB0byB0YWlsIHN0YXRlc1xuICAgIHRoaXMuYm9uZS5sb2NhbFRvV29ybGQodGhpcy5fY3VycmVudFRhaWwuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKSk7XG4gICAgdGhpcy5fcHJldlRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XG4gICAgdGhpcy5fbmV4dFRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XG5cbiAgICB0aGlzLl9ib25lQXhpcy5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuICAgIHRoaXMuX2NlbnRlclNwYWNlQm9uZUxlbmd0aCA9IF92M0FcbiAgICAgIC5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pXG4gICAgICAuYXBwbHlNYXRyaXg0KHRoaXMuYm9uZS5tYXRyaXhXb3JsZClcbiAgICAgIC5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbilcbiAgICAgIC5sZW5ndGgoKTtcblxuICAgIHRoaXMuY2VudGVyID0gcGFyYW1zLmNlbnRlciA/PyBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlc2V0IHRoZSBzdGF0ZSBvZiB0aGlzIGJvbmUuXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGNhbGwgW1tWUk1TcHJpbmdCb25lTWFuYWdlci5yZXNldF1dIGluc3RlYWQuXG4gICAqL1xuICBwdWJsaWMgcmVzZXQoKTogdm9pZCB7XG4gICAgdGhpcy5ib25lLnF1YXRlcm5pb24uY29weSh0aGlzLl9pbml0aWFsTG9jYWxSb3RhdGlvbik7XG5cbiAgICAvLyBXZSBuZWVkIHRvIHVwZGF0ZSBpdHMgbWF0cml4V29ybGQgbWFudWFsbHksIHNpbmNlIHdlIHR3ZWFrZWQgdGhlIGJvbmUgYnkgb3VyIGhhbmRcbiAgICB0aGlzLmJvbmUudXBkYXRlTWF0cml4KCk7XG4gICAgdGhpcy5ib25lLm1hdHJpeFdvcmxkLm11bHRpcGx5TWF0cmljZXModGhpcy5fZ2V0UGFyZW50TWF0cml4V29ybGQoKSwgdGhpcy5ib25lLm1hdHJpeCk7XG4gICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbi5zZXRGcm9tTWF0cml4UG9zaXRpb24odGhpcy5ib25lLm1hdHJpeFdvcmxkKTtcblxuICAgIC8vIEFwcGx5IHVwZGF0ZWQgcG9zaXRpb24gdG8gdGFpbCBzdGF0ZXNcbiAgICB0aGlzLmJvbmUubG9jYWxUb1dvcmxkKHRoaXMuX2N1cnJlbnRUYWlsLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbikpO1xuICAgIHRoaXMuX3ByZXZUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xuICAgIHRoaXMuX25leHRUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFVwZGF0ZSB0aGUgc3RhdGUgb2YgdGhpcyBib25lLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjYWxsIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXIudXBkYXRlXV0gaW5zdGVhZC5cbiAgICpcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxuICAgKi9cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgaWYgKGRlbHRhIDw9IDApIHJldHVybjtcblxuICAgIGlmICh0aGlzLmJvbmUucGFyZW50KSB7XG4gICAgICAvLyBTcHJpbmdCb25l44Gv6Kaq44GL44KJ6aCG44Gr5Yem55CG44GV44KM44Gm44GE44GP44Gf44KB44CBXG4gICAgICAvLyDopqrjga5tYXRyaXhXb3JsZOOBr+acgOaWsOeKtuaFi+OBruWJjeaPkOOBp3dvcmxkTWF0cml444GL44KJcXVhdGVybmlvbuOCkuWPluOCiuWHuuOBmeOAglxuICAgICAgLy8g5Yi26ZmQ44Gv44GC44KL44GR44KM44Gp44CB6KiI566X44Gv5bCR44Gq44GE44Gu44GnZ2V0V29ybGRRdWF0ZXJuaW9u44Gn44Gv44Gq44GP44GT44Gu5pa55rOV44KS5Y+W44KL44CCXG4gICAgICBnZXRXb3JsZFF1YXRlcm5pb25MaXRlKHRoaXMuYm9uZS5wYXJlbnQsIHRoaXMuX3BhcmVudFdvcmxkUm90YXRpb24pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9wYXJlbnRXb3JsZFJvdGF0aW9uLmNvcHkoSURFTlRJVFlfUVVBVEVSTklPTik7XG4gICAgfVxuXG4gICAgLy8gR2V0IGJvbmUgcG9zaXRpb24gaW4gY2VudGVyIHNwYWNlXG4gICAgdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0QSk7XG4gICAgX21hdEEubXVsdGlwbHkodGhpcy5ib25lLm1hdHJpeFdvcmxkKTsgLy8g8J+UpSA/P1xuICAgIHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24uc2V0RnJvbU1hdHJpeFBvc2l0aW9uKF9tYXRBKTtcblxuICAgIC8vIEdldCBwYXJlbnQgcG9zaXRpb24gaW4gY2VudGVyIHNwYWNlXG4gICAgdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0Qik7XG4gICAgX21hdEIubXVsdGlwbHkodGhpcy5fZ2V0UGFyZW50TWF0cml4V29ybGQoKSk7XG5cbiAgICAvLyBzZXZlcmFsIHBhcmFtZXRlcnNcbiAgICBjb25zdCBzdGlmZm5lc3MgPSB0aGlzLnN0aWZmbmVzc0ZvcmNlICogZGVsdGE7XG4gICAgY29uc3QgZXh0ZXJuYWwgPSBfdjNCLmNvcHkodGhpcy5ncmF2aXR5RGlyKS5tdWx0aXBseVNjYWxhcih0aGlzLmdyYXZpdHlQb3dlciAqIGRlbHRhKTtcblxuICAgIC8vIHZlcmxldOepjeWIhuOBp+asoeOBruS9jee9ruOCkuioiOeul1xuICAgIHRoaXMuX25leHRUYWlsXG4gICAgICAuY29weSh0aGlzLl9jdXJyZW50VGFpbClcbiAgICAgIC5hZGQoXG4gICAgICAgIF92M0FcbiAgICAgICAgICAuY29weSh0aGlzLl9jdXJyZW50VGFpbClcbiAgICAgICAgICAuc3ViKHRoaXMuX3ByZXZUYWlsKVxuICAgICAgICAgIC5tdWx0aXBseVNjYWxhcigxIC0gdGhpcy5kcmFnRm9yY2UpLFxuICAgICAgKSAvLyDliY3jg5Xjg6zjg7zjg6Djga7np7vli5XjgpLntpnntprjgZnjgoso5rib6KGw44KC44GC44KL44KIKVxuICAgICAgLmFkZChcbiAgICAgICAgX3YzQVxuICAgICAgICAgIC5jb3B5KHRoaXMuX2JvbmVBeGlzKVxuICAgICAgICAgIC5hcHBseU1hdHJpeDQodGhpcy5faW5pdGlhbExvY2FsTWF0cml4KVxuICAgICAgICAgIC5hcHBseU1hdHJpeDQoX21hdEIpXG4gICAgICAgICAgLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKVxuICAgICAgICAgIC5ub3JtYWxpemUoKVxuICAgICAgICAgIC5tdWx0aXBseVNjYWxhcihzdGlmZm5lc3MpLFxuICAgICAgKSAvLyDopqrjga7lm57ou6LjgavjgojjgovlrZDjg5zjg7zjg7Pjga7np7vli5Xnm67mqJlcbiAgICAgIC5hZGQoZXh0ZXJuYWwpOyAvLyDlpJblipvjgavjgojjgovnp7vli5Xph49cblxuICAgIC8vIG5vcm1hbGl6ZSBib25lIGxlbmd0aFxuICAgIHRoaXMuX25leHRUYWlsXG4gICAgICAuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pXG4gICAgICAubm9ybWFsaXplKClcbiAgICAgIC5tdWx0aXBseVNjYWxhcih0aGlzLl9jZW50ZXJTcGFjZUJvbmVMZW5ndGgpXG4gICAgICAuYWRkKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pO1xuXG4gICAgLy8gQ29sbGlzaW9u44Gn56e75YuVXG4gICAgdGhpcy5fY29sbGlzaW9uKHRoaXMuX25leHRUYWlsKTtcblxuICAgIHRoaXMuX3ByZXZUYWlsLmNvcHkodGhpcy5fY3VycmVudFRhaWwpO1xuICAgIHRoaXMuX2N1cnJlbnRUYWlsLmNvcHkodGhpcy5fbmV4dFRhaWwpO1xuXG4gICAgLy8gQXBwbHkgcm90YXRpb24sIGNvbnZlcnQgdmVjdG9yMyB0aGluZyBpbnRvIGFjdHVhbCBxdWF0ZXJuaW9uXG4gICAgLy8gT3JpZ2luYWwgVW5pVlJNIGlzIGRvaW5nIHdvcmxkIHVuaXQgY2FsY3VsdXMgYXQgaGVyZSBidXQgd2UncmUgZ29ubmEgZG8gdGhpcyBvbiBsb2NhbCB1bml0XG4gICAgLy8gc2luY2UgVGhyZWUuanMgaXMgbm90IGdvb2QgYXQgd29ybGQgY29vcmRpbmF0aW9uIHN0dWZmXG4gICAgY29uc3QgaW5pdGlhbENlbnRlclNwYWNlTWF0cml4SW52ID0gbWF0NEludmVydENvbXBhdChfbWF0QS5jb3B5KF9tYXRCLm11bHRpcGx5KHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeCkpKTtcbiAgICBjb25zdCBhcHBseVJvdGF0aW9uID0gX3F1YXRBLnNldEZyb21Vbml0VmVjdG9ycyhcbiAgICAgIHRoaXMuX2JvbmVBeGlzLFxuICAgICAgX3YzQS5jb3B5KHRoaXMuX25leHRUYWlsKS5hcHBseU1hdHJpeDQoaW5pdGlhbENlbnRlclNwYWNlTWF0cml4SW52KS5ub3JtYWxpemUoKSxcbiAgICApO1xuXG4gICAgdGhpcy5ib25lLnF1YXRlcm5pb24uY29weSh0aGlzLl9pbml0aWFsTG9jYWxSb3RhdGlvbikubXVsdGlwbHkoYXBwbHlSb3RhdGlvbik7XG5cbiAgICAvLyBXZSBuZWVkIHRvIHVwZGF0ZSBpdHMgbWF0cml4V29ybGQgbWFudWFsbHksIHNpbmNlIHdlIHR3ZWFrZWQgdGhlIGJvbmUgYnkgb3VyIGhhbmRcbiAgICB0aGlzLmJvbmUudXBkYXRlTWF0cml4KCk7XG4gICAgdGhpcy5ib25lLm1hdHJpeFdvcmxkLm11bHRpcGx5TWF0cmljZXModGhpcy5fZ2V0UGFyZW50TWF0cml4V29ybGQoKSwgdGhpcy5ib25lLm1hdHJpeCk7XG4gIH1cblxuICAvKipcbiAgICogRG8gY29sbGlzaW9uIG1hdGggYWdhaW5zdCBldmVyeSBjb2xsaWRlcnMgYXR0YWNoZWQgdG8gdGhpcyBib25lLlxuICAgKlxuICAgKiBAcGFyYW0gdGFpbCBUaGUgdGFpbCB5b3Ugd2FudCB0byBwcm9jZXNzXG4gICAqL1xuICBwcml2YXRlIF9jb2xsaXNpb24odGFpbDogVEhSRUUuVmVjdG9yMyk6IHZvaWQge1xuICAgIHRoaXMuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XG4gICAgICB0aGlzLl9nZXRNYXRyaXhXb3JsZFRvQ2VudGVyKF9tYXRBKTtcbiAgICAgIF9tYXRBLm11bHRpcGx5KGNvbGxpZGVyLm1hdHJpeFdvcmxkKTtcbiAgICAgIGNvbnN0IGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbiA9IF92M0Euc2V0RnJvbU1hdHJpeFBvc2l0aW9uKF9tYXRBKTtcbiAgICAgIGNvbnN0IGNvbGxpZGVyUmFkaXVzID0gY29sbGlkZXIuZ2VvbWV0cnkuYm91bmRpbmdTcGhlcmUhLnJhZGl1czsgLy8gdGhlIGJvdW5kaW5nIHNwaGVyZSBpcyBndWFyYW50ZWVkIHRvIGJlIGV4aXN0IGJ5IFZSTVNwcmluZ0JvbmVJbXBvcnRlci5fY3JlYXRlQ29sbGlkZXJNZXNoXG4gICAgICBjb25zdCByID0gdGhpcy5yYWRpdXMgKyBjb2xsaWRlclJhZGl1cztcblxuICAgICAgaWYgKHRhaWwuZGlzdGFuY2VUb1NxdWFyZWQoY29sbGlkZXJDZW50ZXJTcGFjZVBvc2l0aW9uKSA8PSByICogcikge1xuICAgICAgICAvLyDjg5Ljg4Pjg4jjgIJDb2xsaWRlcuOBruWNiuW+hOaWueWQkeOBq+aKvOOBl+WHuuOBmVxuICAgICAgICBjb25zdCBub3JtYWwgPSBfdjNCLnN1YlZlY3RvcnModGFpbCwgY29sbGlkZXJDZW50ZXJTcGFjZVBvc2l0aW9uKS5ub3JtYWxpemUoKTtcbiAgICAgICAgY29uc3QgcG9zRnJvbUNvbGxpZGVyID0gX3YzQy5hZGRWZWN0b3JzKGNvbGxpZGVyQ2VudGVyU3BhY2VQb3NpdGlvbiwgbm9ybWFsLm11bHRpcGx5U2NhbGFyKHIpKTtcblxuICAgICAgICAvLyBub3JtYWxpemUgYm9uZSBsZW5ndGhcbiAgICAgICAgdGFpbC5jb3B5KFxuICAgICAgICAgIHBvc0Zyb21Db2xsaWRlclxuICAgICAgICAgICAgLnN1Yih0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKVxuICAgICAgICAgICAgLm5vcm1hbGl6ZSgpXG4gICAgICAgICAgICAubXVsdGlwbHlTY2FsYXIodGhpcy5fY2VudGVyU3BhY2VCb25lTGVuZ3RoKVxuICAgICAgICAgICAgLmFkZCh0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKSxcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBtYXRyaXggdGhhdCBjb252ZXJ0cyBjZW50ZXIgc3BhY2UgaW50byB3b3JsZCBzcGFjZS5cbiAgICogQHBhcmFtIHRhcmdldCBUYXJnZXQgbWF0cml4XG4gICAqL1xuICBwcml2YXRlIF9nZXRNYXRyaXhDZW50ZXJUb1dvcmxkKHRhcmdldDogVEhSRUUuTWF0cml4NCk6IFRIUkVFLk1hdHJpeDQge1xuICAgIGlmICh0aGlzLl9jZW50ZXIpIHtcbiAgICAgIHRhcmdldC5jb3B5KHRoaXMuX2NlbnRlci5tYXRyaXhXb3JsZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldC5pZGVudGl0eSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0YXJnZXQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGEgbWF0cml4IHRoYXQgY29udmVydHMgd29ybGQgc3BhY2UgaW50byBjZW50ZXIgc3BhY2UuXG4gICAqIEBwYXJhbSB0YXJnZXQgVGFyZ2V0IG1hdHJpeFxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0TWF0cml4V29ybGRUb0NlbnRlcih0YXJnZXQ6IFRIUkVFLk1hdHJpeDQpOiBUSFJFRS5NYXRyaXg0IHtcbiAgICBpZiAodGhpcy5fY2VudGVyKSB7XG4gICAgICB0YXJnZXQuY29weSgodGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5IGFzIE1hdHJpeDRJbnZlcnNlQ2FjaGUpLmludmVyc2UpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXQuaWRlbnRpdHkoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGFyZ2V0O1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHdvcmxkIG1hdHJpeCBvZiBpdHMgcGFyZW50IG9iamVjdC5cbiAgICovXG4gIHByaXZhdGUgX2dldFBhcmVudE1hdHJpeFdvcmxkKCk6IFRIUkVFLk1hdHJpeDQge1xuICAgIHJldHVybiB0aGlzLmJvbmUucGFyZW50ID8gdGhpcy5ib25lLnBhcmVudC5tYXRyaXhXb3JsZCA6IElERU5USVRZX01BVFJJWDQ7XG4gIH1cbn1cbiIsImltcG9ydCB7IFZSTVNwcmluZ0JvbmUgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmUnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwJztcblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgc2luZ2xlIHNwcmluZyBib25lIGdyb3VwIG9mIGEgVlJNLlxuICovXG5leHBvcnQgdHlwZSBWUk1TcHJpbmdCb25lR3JvdXAgPSBWUk1TcHJpbmdCb25lW107XG5cbi8qKlxuICogQSBjbGFzcyBtYW5hZ2VzIGV2ZXJ5IHNwcmluZyBib25lcyBvbiBhIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVNYW5hZ2VyIHtcbiAgcHVibGljIHJlYWRvbmx5IGNvbGxpZGVyR3JvdXBzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdID0gW107XG4gIHB1YmxpYyByZWFkb25seSBzcHJpbmdCb25lR3JvdXBMaXN0OiBWUk1TcHJpbmdCb25lR3JvdXBbXSA9IFtdO1xuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgW1tWUk1TcHJpbmdCb25lTWFuYWdlcl1dXG4gICAqXG4gICAqIEBwYXJhbSBzcHJpbmdCb25lR3JvdXBMaXN0IEFuIGFycmF5IG9mIFtbVlJNU3ByaW5nQm9uZUdyb3VwXV1cbiAgICovXG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSwgc3ByaW5nQm9uZUdyb3VwTGlzdDogVlJNU3ByaW5nQm9uZUdyb3VwW10pIHtcbiAgICB0aGlzLmNvbGxpZGVyR3JvdXBzID0gY29sbGlkZXJHcm91cHM7XG4gICAgdGhpcy5zcHJpbmdCb25lR3JvdXBMaXN0ID0gc3ByaW5nQm9uZUdyb3VwTGlzdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXQgYWxsIGJvbmVzIGJlIGNhbGN1bGF0ZWQgYmFzZWQgb24gdGhlIHNwYWNlIHJlbGF0aXZlIGZyb20gdGhpcyBvYmplY3QuXG4gICAqIElmIGBudWxsYCBpcyBnaXZlbiwgc3ByaW5nYm9uZSB3aWxsIGJlIGNhbGN1bGF0ZWQgaW4gd29ybGQgc3BhY2UuXG4gICAqIEBwYXJhbSByb290IFJvb3Qgb2JqZWN0LCBvciBgbnVsbGBcbiAgICovXG4gIHB1YmxpYyBzZXRDZW50ZXIocm9vdDogVEhSRUUuT2JqZWN0M0QgfCBudWxsKTogdm9pZCB7XG4gICAgdGhpcy5zcHJpbmdCb25lR3JvdXBMaXN0LmZvckVhY2goKHNwcmluZ0JvbmVHcm91cCkgPT4ge1xuICAgICAgc3ByaW5nQm9uZUdyb3VwLmZvckVhY2goKHNwcmluZ0JvbmUpID0+IHtcbiAgICAgICAgc3ByaW5nQm9uZS5jZW50ZXIgPSByb290O1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIGV2ZXJ5IHNwcmluZyBib25lIGF0dGFjaGVkIHRvIHRoaXMgbWFuYWdlci5cbiAgICpcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxuICAgKi9cbiAgcHVibGljIGxhdGVVcGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIGNvbnN0IHVwZGF0ZWRPYmplY3RTZXQgPSBuZXcgU2V0PFRIUkVFLk9iamVjdDNEPigpO1xuXG4gICAgdGhpcy5zcHJpbmdCb25lR3JvdXBMaXN0LmZvckVhY2goKHNwcmluZ0JvbmVHcm91cCkgPT4ge1xuICAgICAgc3ByaW5nQm9uZUdyb3VwLmZvckVhY2goKHNwcmluZ0JvbmUpID0+IHtcbiAgICAgICAgdGhpcy5fdXBkYXRlV29ybGRNYXRyaXgodXBkYXRlZE9iamVjdFNldCwgc3ByaW5nQm9uZS5ib25lKTtcbiAgICAgICAgc3ByaW5nQm9uZS51cGRhdGUoZGVsdGEpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogUmVzZXQgZXZlcnkgc3ByaW5nIGJvbmUgYXR0YWNoZWQgdG8gdGhpcyBtYW5hZ2VyLlxuICAgKi9cbiAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xuICAgIGNvbnN0IHVwZGF0ZWRPYmplY3RTZXQgPSBuZXcgU2V0PFRIUkVFLk9iamVjdDNEPigpO1xuXG4gICAgdGhpcy5zcHJpbmdCb25lR3JvdXBMaXN0LmZvckVhY2goKHNwcmluZ0JvbmVHcm91cCkgPT4ge1xuICAgICAgc3ByaW5nQm9uZUdyb3VwLmZvckVhY2goKHNwcmluZ0JvbmUpID0+IHtcbiAgICAgICAgdGhpcy5fdXBkYXRlV29ybGRNYXRyaXgodXBkYXRlZE9iamVjdFNldCwgc3ByaW5nQm9uZS5ib25lKTtcbiAgICAgICAgc3ByaW5nQm9uZS5yZXNldCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlIHdvcmxkTWF0cml4IG9mIGdpdmVuIG9iamVjdCwgcmVzcGVjdGluZyBpdHMgYW5jZXN0b3JzLlxuICAgKiBjYWxsZWQgYmVmb3JlIHVwZGF0ZSBzcHJpbmdib25lLlxuICAgKiBAcGFyYW0gdXBkYXRlZE9iamVjdFNldCBTZXQgb2Ygbm9kZSB3aGljaCB3b3JsZE1hdHJpeCBpcyB1cGRhdGVkLlxuICAgKiBAcGFyYW0gbm9kZSB0YXJnZXQgYm9uZSBub2RlLlxuICAgKi9cbiAgcHJpdmF0ZSBfdXBkYXRlV29ybGRNYXRyaXgodXBkYXRlZE9iamVjdFNldDogU2V0PFRIUkVFLk9iamVjdDNEPiwgbm9kZTogVEhSRUUuT2JqZWN0M0QpOiB2b2lkIHtcbiAgICBpZiAodXBkYXRlZE9iamVjdFNldC5oYXMobm9kZSkpIHJldHVybjtcblxuICAgIGlmIChub2RlLnBhcmVudCkgdGhpcy5fdXBkYXRlV29ybGRNYXRyaXgodXBkYXRlZE9iamVjdFNldCwgbm9kZS5wYXJlbnQpO1xuICAgIG5vZGUudXBkYXRlV29ybGRNYXRyaXgoZmFsc2UsIGZhbHNlKTtcblxuICAgIHVwZGF0ZWRPYmplY3RTZXQuYWRkKG5vZGUpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBHTFRGTm9kZSwgVlJNU2NoZW1hIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZSB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCwgVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaCB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUdyb3VwLCBWUk1TcHJpbmdCb25lTWFuYWdlciB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZU1hbmFnZXInO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzJztcblxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbmNvbnN0IF9jb2xsaWRlck1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHsgdmlzaWJsZTogZmFsc2UgfSk7XG5cbi8qKlxuICogQW4gaW1wb3J0ZXIgdGhhdCBpbXBvcnRzIGEgW1tWUk1TcHJpbmdCb25lTWFuYWdlcl1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVJbXBvcnRlciB7XG4gIC8qKlxuICAgKiBJbXBvcnQgYSBbW1ZSTUxvb2tBdEhlYWRdXSBmcm9tIGEgVlJNLlxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICovXG4gIHB1YmxpYyBhc3luYyBpbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNU3ByaW5nQm9uZU1hbmFnZXIgfCBudWxsPiB7XG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XG4gICAgaWYgKCF2cm1FeHQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uIHwgdW5kZWZpbmVkID0gdnJtRXh0LnNlY29uZGFyeUFuaW1hdGlvbjtcbiAgICBpZiAoIXNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbikgcmV0dXJuIG51bGw7XG5cbiAgICAvLyDooZ3nqoHliKTlrprnkIPkvZPjg6Hjg4Pjgrfjg6XjgIJcbiAgICBjb25zdCBjb2xsaWRlckdyb3VwcyA9IGF3YWl0IHRoaXMuX2ltcG9ydENvbGxpZGVyTWVzaEdyb3VwcyhnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24pO1xuXG4gICAgLy8g5ZCM44GY5bGe5oCn77yIc3RpZmZpbmVzc+OChGRyYWdGb3JjZeOBjOWQjOOBmO+8ieOBruODnOODvOODs+OBr2JvbmVHcm91cOOBq+OBvuOBqOOCgeOCieOCjOOBpuOBhOOCi+OAglxuICAgIC8vIOS4gOWIl+OBoOOBkeOBp+OBr+OBquOBhOOBk+OBqOOBq+azqOaEj+OAglxuICAgIGNvbnN0IHNwcmluZ0JvbmVHcm91cExpc3QgPSBhd2FpdCB0aGlzLl9pbXBvcnRTcHJpbmdCb25lR3JvdXBMaXN0KGdsdGYsIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbiwgY29sbGlkZXJHcm91cHMpO1xuXG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lTWFuYWdlcihjb2xsaWRlckdyb3Vwcywgc3ByaW5nQm9uZUdyb3VwTGlzdCk7XG4gIH1cblxuICBwcm90ZWN0ZWQgX2NyZWF0ZVNwcmluZ0JvbmUoYm9uZTogVEhSRUUuT2JqZWN0M0QsIHBhcmFtczogVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMgPSB7fSk6IFZSTVNwcmluZ0JvbmUge1xuICAgIHJldHVybiBuZXcgVlJNU3ByaW5nQm9uZShib25lLCBwYXJhbXMpO1xuICB9XG5cbiAgcHJvdGVjdGVkIGFzeW5jIF9pbXBvcnRTcHJpbmdCb25lR3JvdXBMaXN0KFxuICAgIGdsdGY6IEdMVEYsXG4gICAgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uLFxuICAgIGNvbGxpZGVyR3JvdXBzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdLFxuICApOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVHcm91cFtdPiB7XG4gICAgY29uc3Qgc3ByaW5nQm9uZUdyb3VwczogVlJNU2NoZW1hLlNlY29uZGFyeUFuaW1hdGlvblNwcmluZ1tdID0gc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uLmJvbmVHcm91cHMgfHwgW107XG5cbiAgICBjb25zdCBzcHJpbmdCb25lR3JvdXBMaXN0OiBWUk1TcHJpbmdCb25lR3JvdXBbXSA9IFtdO1xuXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICBzcHJpbmdCb25lR3JvdXBzLm1hcChhc3luYyAodnJtQm9uZUdyb3VwKSA9PiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuc3RpZmZpbmVzcyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnggPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnkgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLnogPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5UG93ZXIgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5kcmFnRm9yY2UgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5oaXRSYWRpdXMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIHZybUJvbmVHcm91cC5jb2xsaWRlckdyb3VwcyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmJvbmVzID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICB2cm1Cb25lR3JvdXAuY2VudGVyID09PSB1bmRlZmluZWRcbiAgICAgICAgKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc3RpZmZuZXNzRm9yY2UgPSB2cm1Cb25lR3JvdXAuc3RpZmZpbmVzcztcbiAgICAgICAgY29uc3QgZ3Jhdml0eURpciA9IG5ldyBUSFJFRS5WZWN0b3IzKFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ncmF2aXR5RGlyLngsXG4gICAgICAgICAgdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueSxcbiAgICAgICAgICAtdnJtQm9uZUdyb3VwLmdyYXZpdHlEaXIueiwgLy8gVlJNIDAuMCB1c2VzIGxlZnQtaGFuZGVkIHktdXBcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgZ3Jhdml0eVBvd2VyID0gdnJtQm9uZUdyb3VwLmdyYXZpdHlQb3dlcjtcbiAgICAgICAgY29uc3QgZHJhZ0ZvcmNlID0gdnJtQm9uZUdyb3VwLmRyYWdGb3JjZTtcbiAgICAgICAgY29uc3QgcmFkaXVzID0gdnJtQm9uZUdyb3VwLmhpdFJhZGl1cztcblxuICAgICAgICBjb25zdCBjb2xsaWRlcnM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlck1lc2hbXSA9IFtdO1xuICAgICAgICB2cm1Cb25lR3JvdXAuY29sbGlkZXJHcm91cHMuZm9yRWFjaCgoY29sbGlkZXJJbmRleCkgPT4ge1xuICAgICAgICAgIGNvbGxpZGVycy5wdXNoKC4uLmNvbGxpZGVyR3JvdXBzW2NvbGxpZGVySW5kZXhdLmNvbGxpZGVycyk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHNwcmluZ0JvbmVHcm91cDogVlJNU3ByaW5nQm9uZUdyb3VwID0gW107XG4gICAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICAgIHZybUJvbmVHcm91cC5ib25lcy5tYXAoYXN5bmMgKG5vZGVJbmRleCkgPT4ge1xuICAgICAgICAgICAgLy8gVlJN44Gu5oOF5aCx44GL44KJ44CM5o+644KM44Oi44OO44CN44Oc44O844Oz44Gu44Or44O844OI44GM5Y+W44KM44KLXG4gICAgICAgICAgICBjb25zdCBzcHJpbmdSb290Qm9uZTogR0xURk5vZGUgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgbm9kZUluZGV4KTtcblxuICAgICAgICAgICAgY29uc3QgY2VudGVyOiBHTFRGTm9kZSA9XG4gICAgICAgICAgICAgIHZybUJvbmVHcm91cC5jZW50ZXIhICE9PSAtMSA/IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCB2cm1Cb25lR3JvdXAuY2VudGVyISkgOiBudWxsO1xuXG4gICAgICAgICAgICAvLyBpdCdzIHdlaXJkIGJ1dCB0aGVyZSBtaWdodCBiZSBjYXNlcyB3ZSBjYW4ndCBmaW5kIHRoZSByb290IGJvbmVcbiAgICAgICAgICAgIGlmICghc3ByaW5nUm9vdEJvbmUpIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzcHJpbmdSb290Qm9uZS50cmF2ZXJzZSgoYm9uZSkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBzcHJpbmdCb25lID0gdGhpcy5fY3JlYXRlU3ByaW5nQm9uZShib25lLCB7XG4gICAgICAgICAgICAgICAgcmFkaXVzLFxuICAgICAgICAgICAgICAgIHN0aWZmbmVzc0ZvcmNlLFxuICAgICAgICAgICAgICAgIGdyYXZpdHlEaXIsXG4gICAgICAgICAgICAgICAgZ3Jhdml0eVBvd2VyLFxuICAgICAgICAgICAgICAgIGRyYWdGb3JjZSxcbiAgICAgICAgICAgICAgICBjb2xsaWRlcnMsXG4gICAgICAgICAgICAgICAgY2VudGVyLFxuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgc3ByaW5nQm9uZUdyb3VwLnB1c2goc3ByaW5nQm9uZSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgKTtcblxuICAgICAgICBzcHJpbmdCb25lR3JvdXBMaXN0LnB1c2goc3ByaW5nQm9uZUdyb3VwKTtcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICByZXR1cm4gc3ByaW5nQm9uZUdyb3VwTGlzdDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYW4gYXJyYXkgb2YgW1tWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cF1dLlxuICAgKlxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcbiAgICogQHBhcmFtIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbiBBIGBzZWNvbmRhcnlBbmltYXRpb25gIGZpZWxkIG9mIFZSTVxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIF9pbXBvcnRDb2xsaWRlck1lc2hHcm91cHMoXG4gICAgZ2x0ZjogR0xURixcbiAgICBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb246IFZSTVNjaGVtYS5TZWNvbmRhcnlBbmltYXRpb24sXG4gICk6IFByb21pc2U8VlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXT4ge1xuICAgIGNvbnN0IHZybUNvbGxpZGVyR3JvdXBzID0gc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uLmNvbGxpZGVyR3JvdXBzO1xuICAgIGlmICh2cm1Db2xsaWRlckdyb3VwcyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gW107XG5cbiAgICBjb25zdCBjb2xsaWRlckdyb3VwczogVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXBbXSA9IFtdO1xuICAgIHZybUNvbGxpZGVyR3JvdXBzLmZvckVhY2goYXN5bmMgKGNvbGxpZGVyR3JvdXApID0+IHtcbiAgICAgIGlmIChjb2xsaWRlckdyb3VwLm5vZGUgPT09IHVuZGVmaW5lZCB8fCBjb2xsaWRlckdyb3VwLmNvbGxpZGVycyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYm9uZSA9IGF3YWl0IGdsdGYucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBjb2xsaWRlckdyb3VwLm5vZGUpO1xuICAgICAgY29uc3QgY29sbGlkZXJzOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJNZXNoW10gPSBbXTtcbiAgICAgIGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldC54ID09PSB1bmRlZmluZWQgfHxcbiAgICAgICAgICBjb2xsaWRlci5vZmZzZXQueSA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgICAgY29sbGlkZXIub2Zmc2V0LnogPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgIGNvbGxpZGVyLnJhZGl1cyA9PT0gdW5kZWZpbmVkXG4gICAgICAgICkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IG9mZnNldCA9IF92M0Euc2V0KFxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldC54LFxuICAgICAgICAgIGNvbGxpZGVyLm9mZnNldC55LFxuICAgICAgICAgIC1jb2xsaWRlci5vZmZzZXQueiwgLy8gVlJNIDAuMCB1c2VzIGxlZnQtaGFuZGVkIHktdXBcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgY29sbGlkZXJNZXNoID0gdGhpcy5fY3JlYXRlQ29sbGlkZXJNZXNoKGNvbGxpZGVyLnJhZGl1cywgb2Zmc2V0KTtcblxuICAgICAgICBib25lLmFkZChjb2xsaWRlck1lc2gpO1xuICAgICAgICBjb2xsaWRlcnMucHVzaChjb2xsaWRlck1lc2gpO1xuICAgICAgfSk7XG5cbiAgICAgIGNvbnN0IGNvbGxpZGVyTWVzaEdyb3VwID0ge1xuICAgICAgICBub2RlOiBjb2xsaWRlckdyb3VwLm5vZGUsXG4gICAgICAgIGNvbGxpZGVycyxcbiAgICAgIH07XG4gICAgICBjb2xsaWRlckdyb3Vwcy5wdXNoKGNvbGxpZGVyTWVzaEdyb3VwKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBjb2xsaWRlckdyb3VwcztcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBjb2xsaWRlciBtZXNoLlxuICAgKlxuICAgKiBAcGFyYW0gcmFkaXVzIFJhZGl1cyBvZiB0aGUgbmV3IGNvbGxpZGVyIG1lc2hcbiAgICogQHBhcmFtIG9mZnNldCBPZmZlc3Qgb2YgdGhlIG5ldyBjb2xsaWRlciBtZXNoXG4gICAqL1xuICBwcm90ZWN0ZWQgX2NyZWF0ZUNvbGxpZGVyTWVzaChyYWRpdXM6IG51bWJlciwgb2Zmc2V0OiBUSFJFRS5WZWN0b3IzKTogVlJNU3ByaW5nQm9uZUNvbGxpZGVyTWVzaCB7XG4gICAgY29uc3QgY29sbGlkZXJNZXNoID0gbmV3IFRIUkVFLk1lc2gobmV3IFRIUkVFLlNwaGVyZUJ1ZmZlckdlb21ldHJ5KHJhZGl1cywgOCwgNCksIF9jb2xsaWRlck1hdGVyaWFsKTtcblxuICAgIGNvbGxpZGVyTWVzaC5wb3NpdGlvbi5jb3B5KG9mZnNldCk7XG5cbiAgICAvLyB0aGUgbmFtZSBoYXZlIHRvIGJlIHRoaXMgaW4gb3JkZXIgdG8gZXhjbHVkZSBjb2xsaWRlcnMgZnJvbSBib3VuZGluZyBib3hcbiAgICAvLyAoU2VlIFZpZXdlci50cywgc2VhcmNoIGZvciBjaGlsZC5uYW1lID09PSAndnJtQ29sbGlkZXJTcGhlcmUnKVxuICAgIGNvbGxpZGVyTWVzaC5uYW1lID0gJ3ZybUNvbGxpZGVyU3BoZXJlJztcblxuICAgIC8vIFdlIHdpbGwgdXNlIHRoZSByYWRpdXMgb2YgdGhlIHNwaGVyZSBmb3IgY29sbGlzaW9uIHZzIGJvbmVzLlxuICAgIC8vIGBib3VuZGluZ1NwaGVyZWAgbXVzdCBiZSBjcmVhdGVkIHRvIGNvbXB1dGUgdGhlIHJhZGl1cy5cbiAgICBjb2xsaWRlck1lc2guZ2VvbWV0cnkuY29tcHV0ZUJvdW5kaW5nU3BoZXJlKCk7XG5cbiAgICByZXR1cm4gY29sbGlkZXJNZXNoO1xuICB9XG59XG4iLCJpbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlSW1wb3J0ZXIgfSBmcm9tICcuL2JsZW5kc2hhcGUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb25JbXBvcnRlciB9IGZyb20gJy4vZmlyc3RwZXJzb24nO1xuaW1wb3J0IHsgVlJNSHVtYW5vaWRJbXBvcnRlciB9IGZyb20gJy4vaHVtYW5vaWQvVlJNSHVtYW5vaWRJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlciB9IGZyb20gJy4vbG9va2F0L1ZSTUxvb2tBdEltcG9ydGVyJztcbmltcG9ydCB7IFZSTU1hdGVyaWFsSW1wb3J0ZXIgfSBmcm9tICcuL21hdGVyaWFsJztcbmltcG9ydCB7IFZSTU1ldGFJbXBvcnRlciB9IGZyb20gJy4vbWV0YS9WUk1NZXRhSW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUltcG9ydGVyIH0gZnJvbSAnLi9zcHJpbmdib25lL1ZSTVNwcmluZ0JvbmVJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk0gfSBmcm9tICcuL1ZSTSc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgVlJNSW1wb3J0ZXJPcHRpb25zIHtcbiAgbWV0YUltcG9ydGVyPzogVlJNTWV0YUltcG9ydGVyO1xuICBsb29rQXRJbXBvcnRlcj86IFZSTUxvb2tBdEltcG9ydGVyO1xuICBodW1hbm9pZEltcG9ydGVyPzogVlJNSHVtYW5vaWRJbXBvcnRlcjtcbiAgYmxlbmRTaGFwZUltcG9ydGVyPzogVlJNQmxlbmRTaGFwZUltcG9ydGVyO1xuICBmaXJzdFBlcnNvbkltcG9ydGVyPzogVlJNRmlyc3RQZXJzb25JbXBvcnRlcjtcbiAgbWF0ZXJpYWxJbXBvcnRlcj86IFZSTU1hdGVyaWFsSW1wb3J0ZXI7XG4gIHNwcmluZ0JvbmVJbXBvcnRlcj86IFZSTVNwcmluZ0JvbmVJbXBvcnRlcjtcbn1cblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTV1dIGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUltcG9ydGVyIHtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9tZXRhSW1wb3J0ZXI6IFZSTU1ldGFJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9ibGVuZFNoYXBlSW1wb3J0ZXI6IFZSTUJsZW5kU2hhcGVJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9sb29rQXRJbXBvcnRlcjogVlJNTG9va0F0SW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfaHVtYW5vaWRJbXBvcnRlcjogVlJNSHVtYW5vaWRJbXBvcnRlcjtcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9maXJzdFBlcnNvbkltcG9ydGVyOiBWUk1GaXJzdFBlcnNvbkltcG9ydGVyO1xuICBwcm90ZWN0ZWQgcmVhZG9ubHkgX21hdGVyaWFsSW1wb3J0ZXI6IFZSTU1hdGVyaWFsSW1wb3J0ZXI7XG4gIHByb3RlY3RlZCByZWFkb25seSBfc3ByaW5nQm9uZUltcG9ydGVyOiBWUk1TcHJpbmdCb25lSW1wb3J0ZXI7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk1JbXBvcnRlci5cbiAgICpcbiAgICogQHBhcmFtIG9wdGlvbnMgW1tWUk1JbXBvcnRlck9wdGlvbnNdXSwgb3B0aW9uYWxseSBjb250YWlucyBpbXBvcnRlcnMgZm9yIGVhY2ggY29tcG9uZW50XG4gICAqL1xuICBwdWJsaWMgY29uc3RydWN0b3Iob3B0aW9uczogVlJNSW1wb3J0ZXJPcHRpb25zID0ge30pIHtcbiAgICB0aGlzLl9tZXRhSW1wb3J0ZXIgPSBvcHRpb25zLm1ldGFJbXBvcnRlciB8fCBuZXcgVlJNTWV0YUltcG9ydGVyKCk7XG4gICAgdGhpcy5fYmxlbmRTaGFwZUltcG9ydGVyID0gb3B0aW9ucy5ibGVuZFNoYXBlSW1wb3J0ZXIgfHwgbmV3IFZSTUJsZW5kU2hhcGVJbXBvcnRlcigpO1xuICAgIHRoaXMuX2xvb2tBdEltcG9ydGVyID0gb3B0aW9ucy5sb29rQXRJbXBvcnRlciB8fCBuZXcgVlJNTG9va0F0SW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9odW1hbm9pZEltcG9ydGVyID0gb3B0aW9ucy5odW1hbm9pZEltcG9ydGVyIHx8IG5ldyBWUk1IdW1hbm9pZEltcG9ydGVyKCk7XG4gICAgdGhpcy5fZmlyc3RQZXJzb25JbXBvcnRlciA9IG9wdGlvbnMuZmlyc3RQZXJzb25JbXBvcnRlciB8fCBuZXcgVlJNRmlyc3RQZXJzb25JbXBvcnRlcigpO1xuICAgIHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIgPSBvcHRpb25zLm1hdGVyaWFsSW1wb3J0ZXIgfHwgbmV3IFZSTU1hdGVyaWFsSW1wb3J0ZXIoKTtcbiAgICB0aGlzLl9zcHJpbmdCb25lSW1wb3J0ZXIgPSBvcHRpb25zLnNwcmluZ0JvbmVJbXBvcnRlciB8fCBuZXcgVlJNU3ByaW5nQm9uZUltcG9ydGVyKCk7XG4gIH1cblxuICAvKipcbiAgICogUmVjZWl2ZSBhIEdMVEYgb2JqZWN0IHJldHJpZXZlZCBmcm9tIGBUSFJFRS5HTFRGTG9hZGVyYCBhbmQgY3JlYXRlIGEgbmV3IFtbVlJNXV0gaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKi9cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk0+IHtcbiAgICBpZiAoZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zID09PSB1bmRlZmluZWQgfHwgZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zLlZSTSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIFZSTSBleHRlbnNpb24gb24gdGhlIEdMVEYnKTtcbiAgICB9XG4gICAgY29uc3Qgc2NlbmUgPSBnbHRmLnNjZW5lO1xuXG4gICAgc2NlbmUudXBkYXRlTWF0cml4V29ybGQoZmFsc2UpO1xuXG4gICAgLy8gU2tpbm5lZCBvYmplY3Qgc2hvdWxkIG5vdCBiZSBmcnVzdHVtQ3VsbGVkXG4gICAgLy8gU2luY2UgcHJlLXNraW5uZWQgcG9zaXRpb24gbWlnaHQgYmUgb3V0c2lkZSBvZiB2aWV3XG4gICAgc2NlbmUudHJhdmVyc2UoKG9iamVjdDNkKSA9PiB7XG4gICAgICBpZiAoKG9iamVjdDNkIGFzIGFueSkuaXNNZXNoKSB7XG4gICAgICAgIG9iamVjdDNkLmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGNvbnN0IG1ldGEgPSAoYXdhaXQgdGhpcy5fbWV0YUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgbWF0ZXJpYWxzID0gKGF3YWl0IHRoaXMuX21hdGVyaWFsSW1wb3J0ZXIuY29udmVydEdMVEZNYXRlcmlhbHMoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGh1bWFub2lkID0gKGF3YWl0IHRoaXMuX2h1bWFub2lkSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBmaXJzdFBlcnNvbiA9IGh1bWFub2lkID8gKGF3YWl0IHRoaXMuX2ZpcnN0UGVyc29uSW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgYmxlbmRTaGFwZVByb3h5ID0gKGF3YWl0IHRoaXMuX2JsZW5kU2hhcGVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGxvb2tBdCA9XG4gICAgICBmaXJzdFBlcnNvbiAmJiBibGVuZFNoYXBlUHJveHkgJiYgaHVtYW5vaWRcbiAgICAgICAgPyAoYXdhaXQgdGhpcy5fbG9va0F0SW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKSkgfHwgdW5kZWZpbmVkXG4gICAgICAgIDogdW5kZWZpbmVkO1xuXG4gICAgY29uc3Qgc3ByaW5nQm9uZU1hbmFnZXIgPSAoYXdhaXQgdGhpcy5fc3ByaW5nQm9uZUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgcmV0dXJuIG5ldyBWUk0oe1xuICAgICAgc2NlbmU6IGdsdGYuc2NlbmUsXG4gICAgICBtZXRhLFxuICAgICAgbWF0ZXJpYWxzLFxuICAgICAgaHVtYW5vaWQsXG4gICAgICBmaXJzdFBlcnNvbixcbiAgICAgIGJsZW5kU2hhcGVQcm94eSxcbiAgICAgIGxvb2tBdCxcbiAgICAgIHNwcmluZ0JvbmVNYW5hZ2VyLFxuICAgIH0pO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBHTFRGIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XG5pbXBvcnQgeyBWUk1CbGVuZFNoYXBlUHJveHkgfSBmcm9tICcuL2JsZW5kc2hhcGUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuL2ZpcnN0cGVyc29uJztcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi9odW1hbm9pZCc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkIH0gZnJvbSAnLi9sb29rYXQnO1xuaW1wb3J0IHsgVlJNTWV0YSB9IGZyb20gJy4vbWV0YS9WUk1NZXRhJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVNYW5hZ2VyIH0gZnJvbSAnLi9zcHJpbmdib25lJztcbmltcG9ydCB7IGRlZXBEaXNwb3NlIH0gZnJvbSAnLi91dGlscy9kaXNwb3Nlcic7XG5pbXBvcnQgeyBWUk1JbXBvcnRlciwgVlJNSW1wb3J0ZXJPcHRpb25zIH0gZnJvbSAnLi9WUk1JbXBvcnRlcic7XG5cbi8qKlxuICogUGFyYW1ldGVycyBmb3IgYSBbW1ZSTV1dIGNsYXNzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFZSTVBhcmFtZXRlcnMge1xuICBzY2VuZTogVEhSRUUuU2NlbmUgfCBUSFJFRS5Hcm91cDsgLy8gQ09NUEFUOiBgR0xURi5zY2VuZWAgaXMgZ29pbmcgdG8gYmUgYFRIUkVFLkdyb3VwYCBpbiByMTE0XG4gIGh1bWFub2lkPzogVlJNSHVtYW5vaWQ7XG4gIGJsZW5kU2hhcGVQcm94eT86IFZSTUJsZW5kU2hhcGVQcm94eTtcbiAgZmlyc3RQZXJzb24/OiBWUk1GaXJzdFBlcnNvbjtcbiAgbG9va0F0PzogVlJNTG9va0F0SGVhZDtcbiAgbWF0ZXJpYWxzPzogVEhSRUUuTWF0ZXJpYWxbXTtcbiAgc3ByaW5nQm9uZU1hbmFnZXI/OiBWUk1TcHJpbmdCb25lTWFuYWdlcjtcbiAgbWV0YT86IFZSTU1ldGE7XG59XG5cbi8qKlxuICogQSBjbGFzcyB0aGF0IHJlcHJlc2VudHMgYSBzaW5nbGUgVlJNIG1vZGVsLlxuICogU2VlIHRoZSBkb2N1bWVudGF0aW9uIG9mIFtbVlJNLmZyb21dXSBmb3IgdGhlIG1vc3QgYmFzaWMgdXNlIG9mIFZSTS5cbiAqL1xuZXhwb3J0IGNsYXNzIFZSTSB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNIGZyb20gYSBwYXJzZWQgcmVzdWx0IG9mIEdMVEYgdGFrZW4gZnJvbSBHTFRGTG9hZGVyLlxuICAgKiBJdCdzIHByb2JhYmx5IGEgdGhpbmcgd2hhdCB5b3Ugd2FudCB0byBnZXQgc3RhcnRlZCB3aXRoIFZSTXMuXG4gICAqXG4gICAqIEBleGFtcGxlIE1vc3QgYmFzaWMgdXNlIG9mIFZSTVxuICAgKiBgYGBcbiAgICogY29uc3Qgc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcbiAgICpcbiAgICogbmV3IFRIUkVFLkdMVEZMb2FkZXIoKS5sb2FkKCAnbW9kZWxzL3RocmVlLXZybS1naXJsLnZybScsICggZ2x0ZiApID0+IHtcbiAgICpcbiAgICogICBUSFJFRS5WUk0uZnJvbSggZ2x0ZiApLnRoZW4oICggdnJtICkgPT4ge1xuICAgKlxuICAgKiAgICAgc2NlbmUuYWRkKCB2cm0uc2NlbmUgKTtcbiAgICpcbiAgICogICB9ICk7XG4gICAqXG4gICAqIH0gKTtcbiAgICogYGBgXG4gICAqXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxuICAgKiBAcGFyYW0gb3B0aW9ucyBPcHRpb25zIHRoYXQgd2lsbCBiZSB1c2VkIGluIGltcG9ydGVyXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGZyb20oZ2x0ZjogR0xURiwgb3B0aW9uczogVlJNSW1wb3J0ZXJPcHRpb25zID0ge30pOiBQcm9taXNlPFZSTT4ge1xuICAgIGNvbnN0IGltcG9ydGVyID0gbmV3IFZSTUltcG9ydGVyKG9wdGlvbnMpO1xuICAgIHJldHVybiBhd2FpdCBpbXBvcnRlci5pbXBvcnQoZ2x0Zik7XG4gIH1cbiAgLyoqXG4gICAqIGBUSFJFRS5TY2VuZWAgb3IgYFRIUkVFLkdyb3VwYCAoZGVwZW5kcyBvbiB5b3VyIHRocmVlLmpzIHJldmlzaW9uKSB0aGF0IGNvbnRhaW5zIHRoZSBlbnRpcmUgVlJNLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHNjZW5lOiBUSFJFRS5TY2VuZSB8IFRIUkVFLkdyb3VwOyAvLyBDT01QQVQ6IGBHTFRGLnNjZW5lYCBpcyBnb2luZyB0byBiZSBgVEhSRUUuR3JvdXBgIGluIHIxMTRcblxuICAvKipcbiAgICogQ29udGFpbnMgW1tWUk1IdW1hbm9pZF1dIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBjYW4gY29udHJvbCBlYWNoIGJvbmVzIHVzaW5nIFtbVlJNSHVtYW5vaWQuZ2V0Qm9uZU5vZGVdXS5cbiAgICpcbiAgICogQFRPRE8gQWRkIGEgbGluayB0byBWUk0gc3BlY1xuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGh1bWFub2lkPzogVlJNSHVtYW5vaWQ7XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIFtbVlJNQmxlbmRTaGFwZVByb3h5XV0gb2YgdGhlIFZSTS5cbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gY29udHJvbCB0aGVzZSBmYWNpYWwgZXhwcmVzc2lvbnMgdmlhIFtbVlJNQmxlbmRTaGFwZVByb3h5LnNldFZhbHVlXV0uXG4gICAqL1xuICBwdWJsaWMgcmVhZG9ubHkgYmxlbmRTaGFwZVByb3h5PzogVlJNQmxlbmRTaGFwZVByb3h5O1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBbW1ZSTUZpcnN0UGVyc29uXV0gb2YgdGhlIFZSTS5cbiAgICogWW91IGNhbiB1c2UgdmFyaW91cyBmZWF0dXJlIG9mIHRoZSBmaXJzdFBlcnNvbiBmaWVsZC5cbiAgICovXG4gIHB1YmxpYyByZWFkb25seSBmaXJzdFBlcnNvbj86IFZSTUZpcnN0UGVyc29uO1xuXG4gIC8qKlxuICAgKiBDb250YWlucyBbW1ZSTUxvb2tBdEhlYWRdXSBvZiB0aGUgVlJNLlxuICAgKiBZb3UgbWlnaHQgd2FudCB0byB1c2UgW1tWUk1Mb29rQXRIZWFkLnRhcmdldF1dIHRvIGNvbnRyb2wgdGhlIGV5ZSBkaXJlY3Rpb24gb2YgeW91ciBWUk1zLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IGxvb2tBdD86IFZSTUxvb2tBdEhlYWQ7XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIG1hdGVyaWFscyBvZiB0aGUgVlJNLlxuICAgKiBgdXBkYXRlVlJNTWF0ZXJpYWxzYCBtZXRob2Qgb2YgdGhlc2UgbWF0ZXJpYWxzIHdpbGwgYmUgY2FsbGVkIHZpYSBpdHMgW1tWUk0udXBkYXRlXV0gbWV0aG9kLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG1hdGVyaWFscz86IFRIUkVFLk1hdGVyaWFsW107XG5cbiAgLyoqXG4gICAqIENvbnRhaW5zIG1ldGEgZmllbGRzIG9mIHRoZSBWUk0uXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIHJlZmVyIHRoZXNlIGxpY2Vuc2UgZmllbGRzIGJlZm9yZSB1c2UgeW91ciBWUk1zLlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IG1ldGE/OiBWUk1NZXRhO1xuXG4gIC8qKlxuICAgKiBBIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXJdXSBtYW5pcHVsYXRlcyBhbGwgc3ByaW5nIGJvbmVzIGF0dGFjaGVkIG9uIHRoZSBWUk0uXG4gICAqIFVzdWFsbHkgeW91IGRvbid0IGhhdmUgdG8gY2FyZSBhYm91dCB0aGlzIHByb3BlcnR5LlxuICAgKi9cbiAgcHVibGljIHJlYWRvbmx5IHNwcmluZ0JvbmVNYW5hZ2VyPzogVlJNU3ByaW5nQm9uZU1hbmFnZXI7XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBWUk0gaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSBwYXJhbXMgW1tWUk1QYXJhbWV0ZXJzXV0gdGhhdCByZXByZXNlbnRzIGNvbXBvbmVudHMgb2YgdGhlIFZSTVxuICAgKi9cbiAgcHVibGljIGNvbnN0cnVjdG9yKHBhcmFtczogVlJNUGFyYW1ldGVycykge1xuICAgIHRoaXMuc2NlbmUgPSBwYXJhbXMuc2NlbmU7XG4gICAgdGhpcy5odW1hbm9pZCA9IHBhcmFtcy5odW1hbm9pZDtcbiAgICB0aGlzLmJsZW5kU2hhcGVQcm94eSA9IHBhcmFtcy5ibGVuZFNoYXBlUHJveHk7XG4gICAgdGhpcy5maXJzdFBlcnNvbiA9IHBhcmFtcy5maXJzdFBlcnNvbjtcbiAgICB0aGlzLmxvb2tBdCA9IHBhcmFtcy5sb29rQXQ7XG4gICAgdGhpcy5tYXRlcmlhbHMgPSBwYXJhbXMubWF0ZXJpYWxzO1xuICAgIHRoaXMuc3ByaW5nQm9uZU1hbmFnZXIgPSBwYXJhbXMuc3ByaW5nQm9uZU1hbmFnZXI7XG4gICAgdGhpcy5tZXRhID0gcGFyYW1zLm1ldGE7XG4gIH1cblxuICAvKipcbiAgICogKipZb3UgbmVlZCB0byBjYWxsIHRoaXMgb24geW91ciB1cGRhdGUgbG9vcC4qKlxuICAgKlxuICAgKiBUaGlzIGZ1bmN0aW9uIHVwZGF0ZXMgZXZlcnkgVlJNIGNvbXBvbmVudHMuXG4gICAqXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcbiAgICovXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICh0aGlzLmxvb2tBdCkge1xuICAgICAgdGhpcy5sb29rQXQudXBkYXRlKGRlbHRhKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5ibGVuZFNoYXBlUHJveHkpIHtcbiAgICAgIHRoaXMuYmxlbmRTaGFwZVByb3h5LnVwZGF0ZSgpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLnNwcmluZ0JvbmVNYW5hZ2VyKSB7XG4gICAgICB0aGlzLnNwcmluZ0JvbmVNYW5hZ2VyLmxhdGVVcGRhdGUoZGVsdGEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLm1hdGVyaWFscykge1xuICAgICAgdGhpcy5tYXRlcmlhbHMuZm9yRWFjaCgobWF0ZXJpYWw6IGFueSkgPT4ge1xuICAgICAgICBpZiAobWF0ZXJpYWwudXBkYXRlVlJNTWF0ZXJpYWxzKSB7XG4gICAgICAgICAgbWF0ZXJpYWwudXBkYXRlVlJNTWF0ZXJpYWxzKGRlbHRhKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIERpc3Bvc2UgZXZlcnl0aGluZyBhYm91dCB0aGUgVlJNIGluc3RhbmNlLlxuICAgKi9cbiAgcHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG4gICAgY29uc3Qgc2NlbmUgPSB0aGlzLnNjZW5lO1xuICAgIGlmIChzY2VuZSkge1xuICAgICAgZGVlcERpc3Bvc2Uoc2NlbmUpO1xuICAgIH1cblxuICAgIHRoaXMubWV0YT8udGV4dHVyZT8uZGlzcG9zZSgpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk0gfSBmcm9tICcuLi9WUk0nO1xuXG5jb25zdCBfdjJBID0gbmV3IFRIUkVFLlZlY3RvcjIoKTtcblxuY29uc3QgX2NhbWVyYSA9IG5ldyBUSFJFRS5PcnRob2dyYXBoaWNDYW1lcmEoLTEsIDEsIC0xLCAxLCAtMSwgMSk7XG5jb25zdCBfbWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoeyBjb2xvcjogMHhmZmZmZmYsIHNpZGU6IFRIUkVFLkRvdWJsZVNpZGUgfSk7XG5jb25zdCBfcGxhbmUgPSBuZXcgVEhSRUUuTWVzaChuZXcgVEhSRUUuUGxhbmVCdWZmZXJHZW9tZXRyeSgyLCAyKSwgX21hdGVyaWFsKTtcbmNvbnN0IF9zY2VuZSA9IG5ldyBUSFJFRS5TY2VuZSgpO1xuX3NjZW5lLmFkZChfcGxhbmUpO1xuXG4vKipcbiAqIEV4dHJhY3QgYSB0aHVtYm5haWwgaW1hZ2UgYmxvYiBmcm9tIGEge0BsaW5rIFZSTX0uXG4gKiBJZiB0aGUgdnJtIGRvZXMgbm90IGhhdmUgYSB0aHVtYm5haWwsIGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gKiBAcGFyYW0gcmVuZGVyZXIgUmVuZGVyZXJcbiAqIEBwYXJhbSB2cm0gVlJNIHdpdGggYSB0aHVtYm5haWxcbiAqIEBwYXJhbSBzaXplIHdpZHRoIC8gaGVpZ2h0IG9mIHRoZSBpbWFnZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFRodW1ibmFpbEJsb2IocmVuZGVyZXI6IFRIUkVFLldlYkdMUmVuZGVyZXIsIHZybTogVlJNLCBzaXplID0gNTEyKTogUHJvbWlzZTxCbG9iPiB7XG4gIC8vIGdldCB0aGUgdGV4dHVyZVxuICBjb25zdCB0ZXh0dXJlID0gdnJtLm1ldGE/LnRleHR1cmU7XG4gIGlmICghdGV4dHVyZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignZXh0cmFjdFRodW1ibmFpbEJsb2I6IFRoaXMgVlJNIGRvZXMgbm90IGhhdmUgYSB0aHVtYm5haWwnKTtcbiAgfVxuXG4gIGNvbnN0IGNhbnZhcyA9IHJlbmRlcmVyLmdldENvbnRleHQoKS5jYW52YXM7XG5cbiAgLy8gc3RvcmUgdGhlIGN1cnJlbnQgcmVzb2x1dGlvblxuICByZW5kZXJlci5nZXRTaXplKF92MkEpO1xuICBjb25zdCBwcmV2V2lkdGggPSBfdjJBLng7XG4gIGNvbnN0IHByZXZIZWlnaHQgPSBfdjJBLnk7XG5cbiAgLy8gb3ZlcndyaXRlIHRoZSByZXNvbHV0aW9uXG4gIHJlbmRlcmVyLnNldFNpemUoc2l6ZSwgc2l6ZSwgZmFsc2UpO1xuXG4gIC8vIGFzc2lnbiB0aGUgdGV4dHVyZSB0byBwbGFuZVxuICBfbWF0ZXJpYWwubWFwID0gdGV4dHVyZTtcblxuICAvLyByZW5kZXJcbiAgcmVuZGVyZXIucmVuZGVyKF9zY2VuZSwgX2NhbWVyYSk7XG5cbiAgLy8gdW5hc3NpZ24gdGhlIHRleHR1cmVcbiAgX21hdGVyaWFsLm1hcCA9IG51bGw7XG5cbiAgLy8gZ2V0IGJsb2JcbiAgaWYgKGNhbnZhcyBpbnN0YW5jZW9mIE9mZnNjcmVlbkNhbnZhcykge1xuICAgIHJldHVybiBjYW52YXMuY29udmVydFRvQmxvYigpLmZpbmFsbHkoKCkgPT4ge1xuICAgICAgLy8gcmV2ZXJ0IHRvIHByZXZpb3VzIHJlc29sdXRpb25cbiAgICAgIHJlbmRlcmVyLnNldFNpemUocHJldldpZHRoLCBwcmV2SGVpZ2h0LCBmYWxzZSk7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNhbnZhcy50b0Jsb2IoKGJsb2IpID0+IHtcbiAgICAgIC8vIHJldmVydCB0byBwcmV2aW91cyByZXNvbHV0aW9uXG4gICAgICByZW5kZXJlci5zZXRTaXplKHByZXZXaWR0aCwgcHJldkhlaWdodCwgZmFsc2UpO1xuXG4gICAgICBpZiAoYmxvYiA9PSBudWxsKSB7XG4gICAgICAgIHJlamVjdCgnZXh0cmFjdFRodW1ibmFpbEJsb2I6IEZhaWxlZCB0byBjcmVhdGUgYSBibG9iJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNvbHZlKGJsb2IpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcblxuLyoqXG4gKiBUcmF2ZXJzZSBnaXZlbiBvYmplY3QgYW5kIHJlbW92ZSB1bm5lY2Vzc2FyaWx5IGJvdW5kIGpvaW50cyBmcm9tIGV2ZXJ5IGBUSFJFRS5Ta2lubmVkTWVzaGAuXG4gKiBTb21lIGVudmlyb25tZW50cyBsaWtlIG1vYmlsZSBkZXZpY2VzIGhhdmUgYSBsb3dlciBsaW1pdCBvZiBib25lcyBhbmQgbWlnaHQgYmUgdW5hYmxlIHRvIHBlcmZvcm0gbWVzaCBza2lubmluZywgdGhpcyBmdW5jdGlvbiBtaWdodCByZXNvbHZlIHN1Y2ggYW4gaXNzdWUuXG4gKiBBbHNvIHRoaXMgZnVuY3Rpb24gbWlnaHQgZ3JlYXRseSBpbXByb3ZlIHRoZSBwZXJmb3JtYW5jZSBvZiBtZXNoIHNraW5uaW5nLlxuICpcbiAqIEBwYXJhbSByb290IFJvb3Qgb2JqZWN0IHRoYXQgd2lsbCBiZSB0cmF2ZXJzZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVVubmVjZXNzYXJ5Sm9pbnRzKHJvb3Q6IFRIUkVFLk9iamVjdDNEKTogdm9pZCB7XG4gIC8vIHNvbWUgbWVzaGVzIG1pZ2h0IHNoYXJlIGEgc2FtZSBza2luSW5kZXggYXR0cmlidXRlIGFuZCB0aGlzIG1hcCBwcmV2ZW50cyB0byBjb252ZXJ0IHRoZSBhdHRyaWJ1dGUgdHdpY2VcbiAgY29uc3Qgc2tlbGV0b25MaXN0OiBNYXA8VEhSRUUuQnVmZmVyQXR0cmlidXRlLCBUSFJFRS5Ta2VsZXRvbj4gPSBuZXcgTWFwKCk7XG5cbiAgLy8gVHJhdmVyc2UgYW4gZW50aXJlIHRyZWVcbiAgcm9vdC50cmF2ZXJzZSgob2JqKSA9PiB7XG4gICAgaWYgKG9iai50eXBlICE9PSAnU2tpbm5lZE1lc2gnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgbWVzaCA9IG9iaiBhcyBUSFJFRS5Ta2lubmVkTWVzaDtcbiAgICBjb25zdCBnZW9tZXRyeSA9IG1lc2guZ2VvbWV0cnk7XG4gICAgY29uc3QgYXR0cmlidXRlID0gZ2VvbWV0cnkuZ2V0QXR0cmlidXRlKCdza2luSW5kZXgnKSBhcyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XG5cbiAgICAvLyBsb29rIGZvciBleGlzdGluZyBza2VsZXRvblxuICAgIGxldCBza2VsZXRvbiA9IHNrZWxldG9uTGlzdC5nZXQoYXR0cmlidXRlKTtcblxuICAgIGlmICghc2tlbGV0b24pIHtcbiAgICAgIC8vIGdlbmVyYXRlIHJlZHVjZWQgYm9uZSBsaXN0XG4gICAgICBjb25zdCBib25lczogVEhSRUUuQm9uZVtdID0gW107IC8vIG5ldyBsaXN0IG9mIGJvbmVcbiAgICAgIGNvbnN0IGJvbmVJbnZlcnNlczogVEhSRUUuTWF0cml4NFtdID0gW107IC8vIG5ldyBsaXN0IG9mIGJvbmVJbnZlcnNlXG4gICAgICBjb25zdCBib25lSW5kZXhNYXA6IHsgW2luZGV4OiBudW1iZXJdOiBudW1iZXIgfSA9IHt9OyAvLyBtYXAgb2Ygb2xkIGJvbmUgaW5kZXggdnMuIG5ldyBib25lIGluZGV4XG5cbiAgICAgIC8vIGNyZWF0ZSBhIG5ldyBib25lIG1hcFxuICAgICAgY29uc3QgYXJyYXkgPSBhdHRyaWJ1dGUuYXJyYXkgYXMgbnVtYmVyW107XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGluZGV4ID0gYXJyYXlbaV07XG5cbiAgICAgICAgLy8gbmV3IHNraW5JbmRleCBidWZmZXJcbiAgICAgICAgaWYgKGJvbmVJbmRleE1hcFtpbmRleF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIGJvbmVJbmRleE1hcFtpbmRleF0gPSBib25lcy5sZW5ndGg7XG4gICAgICAgICAgYm9uZXMucHVzaChtZXNoLnNrZWxldG9uLmJvbmVzW2luZGV4XSk7XG4gICAgICAgICAgYm9uZUludmVyc2VzLnB1c2gobWVzaC5za2VsZXRvbi5ib25lSW52ZXJzZXNbaW5kZXhdKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGFycmF5W2ldID0gYm9uZUluZGV4TWFwW2luZGV4XTtcbiAgICAgIH1cblxuICAgICAgLy8gcmVwbGFjZSB3aXRoIG5ldyBpbmRpY2VzXG4gICAgICBhdHRyaWJ1dGUuY29weUFycmF5KGFycmF5KTtcbiAgICAgIGF0dHJpYnV0ZS5uZWVkc1VwZGF0ZSA9IHRydWU7XG5cbiAgICAgIC8vIHJlcGxhY2Ugd2l0aCBuZXcgaW5kaWNlc1xuICAgICAgc2tlbGV0b24gPSBuZXcgVEhSRUUuU2tlbGV0b24oYm9uZXMsIGJvbmVJbnZlcnNlcyk7XG4gICAgICBza2VsZXRvbkxpc3Quc2V0KGF0dHJpYnV0ZSwgc2tlbGV0b24pO1xuICAgIH1cblxuICAgIG1lc2guYmluZChza2VsZXRvbiwgbmV3IFRIUkVFLk1hdHJpeDQoKSk7XG4gICAgLy8gICAgICAgICAgICAgICAgICBeXl5eXl5eXl5eXl5eXl5eXl5eIHRyYW5zZm9ybSBvZiBtZXNoZXMgc2hvdWxkIGJlIGlnbm9yZWRcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9LaHJvbm9zR3JvdXAvZ2xURi90cmVlL21hc3Rlci9zcGVjaWZpY2F0aW9uLzIuMCNza2luc1xuICB9KTtcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IEJ1ZmZlckF0dHJpYnV0ZSB9IGZyb20gJ3RocmVlJztcblxuLyoqXG4gKiBUcmF2ZXJzZSBnaXZlbiBvYmplY3QgYW5kIHJlbW92ZSB1bm5lY2Vzc2FyeSB2ZXJ0aWNlcyBmcm9tIGV2ZXJ5IEJ1ZmZlckdlb21ldHJpZXMuXG4gKiBUaGlzIG9ubHkgcHJvY2Vzc2VzIGJ1ZmZlciBnZW9tZXRyaWVzIHdpdGggaW5kZXggYnVmZmVyLlxuICpcbiAqIFRocmVlLmpzIGNyZWF0ZXMgbW9ycGggdGV4dHVyZXMgZm9yIGVhY2ggZ2VvbWV0cmllcyBhbmQgaXQgc29tZXRpbWVzIGNvbnN1bWVzIHVubmVjZXNzYXJ5IGFtb3VudCBvZiBWUkFNIGZvciBjZXJ0YWluIG1vZGVscy5cbiAqIFRoaXMgZnVuY3Rpb24gd2lsbCBvcHRpbWl6ZSBnZW9tZXRyaWVzIHRvIHJlZHVjZSB0aGUgc2l6ZSBvZiBtb3JwaCB0ZXh0dXJlLlxuICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2lzc3Vlcy8yMzA5NVxuICpcbiAqIEBwYXJhbSByb290IFJvb3Qgb2JqZWN0IHRoYXQgd2lsbCBiZSB0cmF2ZXJzZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZVVubmVjZXNzYXJ5VmVydGljZXMocm9vdDogVEhSRUUuT2JqZWN0M0QpOiB2b2lkIHtcbiAgY29uc3QgZ2VvbWV0cnlNYXAgPSBuZXcgTWFwPFRIUkVFLkJ1ZmZlckdlb21ldHJ5LCBUSFJFRS5CdWZmZXJHZW9tZXRyeT4oKTtcblxuICAvLyBUcmF2ZXJzZSBhbiBlbnRpcmUgdHJlZVxuICByb290LnRyYXZlcnNlKChvYmopID0+IHtcbiAgICBpZiAoIShvYmogYXMgYW55KS5pc01lc2gpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNoID0gb2JqIGFzIFRIUkVFLk1lc2g7XG4gICAgY29uc3QgZ2VvbWV0cnkgPSBtZXNoLmdlb21ldHJ5O1xuXG4gICAgLy8gaWYgdGhlIGdlb21ldHJ5IGRvZXMgbm90IGhhdmUgYW4gaW5kZXggYnVmZmVyIGl0IGRvZXMgbm90IG5lZWQgdG8gcHJvY2Vzc1xuICAgIGNvbnN0IG9yaWdpYW5sSW5kZXggPSBnZW9tZXRyeS5pbmRleDtcbiAgICBpZiAob3JpZ2lhbmxJbmRleCA9PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gc2tpcCBhbHJlYWR5IHByb2Nlc3NlZCBnZW9tZXRyeVxuICAgIGNvbnN0IG5ld0dlb21ldHJ5QWxyZWFkeUV4aXN0ZWQgPSBnZW9tZXRyeU1hcC5nZXQoZ2VvbWV0cnkpO1xuICAgIGlmIChuZXdHZW9tZXRyeUFscmVhZHlFeGlzdGVkICE9IG51bGwpIHtcbiAgICAgIG1lc2guZ2VvbWV0cnkgPSBuZXdHZW9tZXRyeUFscmVhZHlFeGlzdGVkO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG5ld0dlb21ldHJ5ID0gbmV3IFRIUkVFLkJ1ZmZlckdlb21ldHJ5KCk7XG5cbiAgICAvLyBjb3B5IHZhcmlvdXMgcHJvcGVydGllc1xuICAgIC8vIFJlZjogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9ibG9iLzFhMjQxZWYxMDA0ODc3MGQ1NmUwNmQ2Y2Q2YTY0Yzc2Y2M3MjBmOTUvc3JjL2NvcmUvQnVmZmVyR2VvbWV0cnkuanMjTDEwMTFcbiAgICBuZXdHZW9tZXRyeS5uYW1lID0gZ2VvbWV0cnkubmFtZTtcblxuICAgIG5ld0dlb21ldHJ5Lm1vcnBoVGFyZ2V0c1JlbGF0aXZlID0gZ2VvbWV0cnkubW9ycGhUYXJnZXRzUmVsYXRpdmU7XG5cbiAgICBnZW9tZXRyeS5ncm91cHMuZm9yRWFjaCgoZ3JvdXApID0+IHtcbiAgICAgIG5ld0dlb21ldHJ5LmFkZEdyb3VwKGdyb3VwLnN0YXJ0LCBncm91cC5jb3VudCwgZ3JvdXAubWF0ZXJpYWxJbmRleCk7XG4gICAgfSk7XG5cbiAgICBuZXdHZW9tZXRyeS5ib3VuZGluZ0JveCA9IGdlb21ldHJ5LmJvdW5kaW5nQm94Py5jbG9uZSgpID8/IG51bGw7XG4gICAgbmV3R2VvbWV0cnkuYm91bmRpbmdTcGhlcmUgPSBnZW9tZXRyeS5ib3VuZGluZ1NwaGVyZT8uY2xvbmUoKSA/PyBudWxsO1xuXG4gICAgbmV3R2VvbWV0cnkuc2V0RHJhd1JhbmdlKGdlb21ldHJ5LmRyYXdSYW5nZS5zdGFydCwgZ2VvbWV0cnkuZHJhd1JhbmdlLmNvdW50KTtcblxuICAgIG5ld0dlb21ldHJ5LnVzZXJEYXRhID0gZ2VvbWV0cnkudXNlckRhdGE7XG5cbiAgICAvLyBzZXQgdG8gZ2VvbWV0cnlNYXBcbiAgICBnZW9tZXRyeU1hcC5zZXQoZ2VvbWV0cnksIG5ld0dlb21ldHJ5KTtcblxuICAgIC8qKiBmcm9tIG9yaWdpbmFsIGluZGV4IHRvIG5ldyBpbmRleCAqL1xuICAgIGNvbnN0IG9yaWdpbmFsSW5kZXhOZXdJbmRleE1hcDogbnVtYmVyW10gPSBbXTtcblxuICAgIC8qKiBmcm9tIG5ldyBpbmRleCB0byBvcmlnaW5hbCBpbmRleCAqL1xuICAgIGNvbnN0IG5ld0luZGV4T3JpZ2luYWxJbmRleE1hcDogbnVtYmVyW10gPSBbXTtcblxuICAgIC8vIHJlb3JnYW5pemUgaW5kaWNlc1xuICAgIHtcbiAgICAgIGNvbnN0IG9yaWdpbmFsSW5kZXhBcnJheSA9IG9yaWdpYW5sSW5kZXguYXJyYXk7XG4gICAgICBjb25zdCBuZXdJbmRleEFycmF5ID0gbmV3IChvcmlnaW5hbEluZGV4QXJyYXkuY29uc3RydWN0b3IgYXMgYW55KShvcmlnaW5hbEluZGV4QXJyYXkubGVuZ3RoKTtcblxuICAgICAgbGV0IGluZGV4SGVhZCA9IDA7XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3JpZ2luYWxJbmRleEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsSW5kZXggPSBvcmlnaW5hbEluZGV4QXJyYXlbaV07XG5cbiAgICAgICAgbGV0IG5ld0luZGV4ID0gb3JpZ2luYWxJbmRleE5ld0luZGV4TWFwW29yaWdpbmFsSW5kZXhdO1xuICAgICAgICBpZiAobmV3SW5kZXggPT0gbnVsbCkge1xuICAgICAgICAgIG9yaWdpbmFsSW5kZXhOZXdJbmRleE1hcFtvcmlnaW5hbEluZGV4XSA9IGluZGV4SGVhZDtcbiAgICAgICAgICBuZXdJbmRleE9yaWdpbmFsSW5kZXhNYXBbaW5kZXhIZWFkXSA9IG9yaWdpbmFsSW5kZXg7XG4gICAgICAgICAgbmV3SW5kZXggPSBpbmRleEhlYWQ7XG4gICAgICAgICAgaW5kZXhIZWFkKys7XG4gICAgICAgIH1cbiAgICAgICAgbmV3SW5kZXhBcnJheVtpXSA9IG5ld0luZGV4O1xuICAgICAgfVxuXG4gICAgICBuZXdHZW9tZXRyeS5zZXRJbmRleChuZXcgQnVmZmVyQXR0cmlidXRlKG5ld0luZGV4QXJyYXksIDEsIGZhbHNlKSk7XG4gICAgfVxuXG4gICAgLy8gcmVvcmdhbml6ZSBhdHRyaWJ1dGVzXG4gICAgT2JqZWN0LmtleXMoZ2VvbWV0cnkuYXR0cmlidXRlcykuZm9yRWFjaCgoYXR0cmlidXRlTmFtZSkgPT4ge1xuICAgICAgY29uc3Qgb3JpZ2luYWxBdHRyaWJ1dGUgPSBnZW9tZXRyeS5hdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdIGFzIFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcblxuICAgICAgaWYgKChvcmlnaW5hbEF0dHJpYnV0ZSBhcyBhbnkpLmlzSW50ZXJsZWF2ZWRCdWZmZXJBdHRyaWJ1dGUpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZW1vdmVVbm5lY2Vzc2FyeVZlcnRpY2VzOiBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSBpcyBub3Qgc3VwcG9ydGVkJyk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG9yaWdpbmFsQXR0cmlidXRlQXJyYXkgPSBvcmlnaW5hbEF0dHJpYnV0ZS5hcnJheTtcbiAgICAgIGNvbnN0IHsgaXRlbVNpemUsIG5vcm1hbGl6ZWQgfSA9IG9yaWdpbmFsQXR0cmlidXRlO1xuXG4gICAgICBjb25zdCBuZXdBdHRyaWJ1dGVBcnJheSA9IG5ldyAob3JpZ2luYWxBdHRyaWJ1dGVBcnJheS5jb25zdHJ1Y3RvciBhcyBhbnkpKFxuICAgICAgICBuZXdJbmRleE9yaWdpbmFsSW5kZXhNYXAubGVuZ3RoICogaXRlbVNpemUsXG4gICAgICApO1xuXG4gICAgICBuZXdJbmRleE9yaWdpbmFsSW5kZXhNYXAuZm9yRWFjaCgob3JpZ2luYWxJbmRleCwgaSkgPT4ge1xuICAgICAgICBmb3IgKGxldCBqID0gMDsgaiA8IGl0ZW1TaXplOyBqKyspIHtcbiAgICAgICAgICBuZXdBdHRyaWJ1dGVBcnJheVtpICogaXRlbVNpemUgKyBqXSA9IG9yaWdpbmFsQXR0cmlidXRlQXJyYXlbb3JpZ2luYWxJbmRleCAqIGl0ZW1TaXplICsgal07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBuZXdHZW9tZXRyeS5zZXRBdHRyaWJ1dGUoYXR0cmlidXRlTmFtZSwgbmV3IEJ1ZmZlckF0dHJpYnV0ZShuZXdBdHRyaWJ1dGVBcnJheSwgaXRlbVNpemUsIG5vcm1hbGl6ZWQpKTtcbiAgICB9KTtcblxuICAgIC8vIHJlb3JnYW5pemUgbW9ycGggYXR0cmlidXRlc1xuICAgIC8qKiBUcnVlIGlmIGFsbCBtb3JwaHMgYXJlIHplcm8uICovXG4gICAgbGV0IGlzTnVsbE1vcnBoID0gdHJ1ZTtcblxuICAgIE9iamVjdC5rZXlzKGdlb21ldHJ5Lm1vcnBoQXR0cmlidXRlcykuZm9yRWFjaCgoYXR0cmlidXRlTmFtZSkgPT4ge1xuICAgICAgbmV3R2VvbWV0cnkubW9ycGhBdHRyaWJ1dGVzW2F0dHJpYnV0ZU5hbWVdID0gW107XG5cbiAgICAgIGNvbnN0IG1vcnBocyA9IGdlb21ldHJ5Lm1vcnBoQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXTtcbiAgICAgIGZvciAobGV0IGlNb3JwaCA9IDA7IGlNb3JwaCA8IG1vcnBocy5sZW5ndGg7IGlNb3JwaCsrKSB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsQXR0cmlidXRlID0gbW9ycGhzW2lNb3JwaF0gYXMgVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xuXG4gICAgICAgIGlmICgob3JpZ2luYWxBdHRyaWJ1dGUgYXMgYW55KS5pc0ludGVybGVhdmVkQnVmZmVyQXR0cmlidXRlKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdyZW1vdmVVbm5lY2Vzc2FyeVZlcnRpY2VzOiBJbnRlcmxlYXZlZEJ1ZmZlckF0dHJpYnV0ZSBpcyBub3Qgc3VwcG9ydGVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvcmlnaW5hbEF0dHJpYnV0ZUFycmF5ID0gb3JpZ2luYWxBdHRyaWJ1dGUuYXJyYXk7XG4gICAgICAgIGNvbnN0IHsgaXRlbVNpemUsIG5vcm1hbGl6ZWQgfSA9IG9yaWdpbmFsQXR0cmlidXRlO1xuXG4gICAgICAgIGNvbnN0IG5ld0F0dHJpYnV0ZUFycmF5ID0gbmV3IChvcmlnaW5hbEF0dHJpYnV0ZUFycmF5LmNvbnN0cnVjdG9yIGFzIGFueSkoXG4gICAgICAgICAgbmV3SW5kZXhPcmlnaW5hbEluZGV4TWFwLmxlbmd0aCAqIGl0ZW1TaXplLFxuICAgICAgICApO1xuXG4gICAgICAgIG5ld0luZGV4T3JpZ2luYWxJbmRleE1hcC5mb3JFYWNoKChvcmlnaW5hbEluZGV4LCBpKSA9PiB7XG4gICAgICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCBpdGVtU2l6ZTsgaisrKSB7XG4gICAgICAgICAgICBuZXdBdHRyaWJ1dGVBcnJheVtpICogaXRlbVNpemUgKyBqXSA9IG9yaWdpbmFsQXR0cmlidXRlQXJyYXlbb3JpZ2luYWxJbmRleCAqIGl0ZW1TaXplICsgal07XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpc051bGxNb3JwaCA9IGlzTnVsbE1vcnBoICYmIG5ld0F0dHJpYnV0ZUFycmF5LmV2ZXJ5KCh2OiBudW1iZXIpID0+IHYgPT09IDApO1xuXG4gICAgICAgIG5ld0dlb21ldHJ5Lm1vcnBoQXR0cmlidXRlc1thdHRyaWJ1dGVOYW1lXVtpTW9ycGhdID0gbmV3IEJ1ZmZlckF0dHJpYnV0ZShcbiAgICAgICAgICBuZXdBdHRyaWJ1dGVBcnJheSxcbiAgICAgICAgICBpdGVtU2l6ZSxcbiAgICAgICAgICBub3JtYWxpemVkLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gSWYgYWxsIG1vcnBocyBhcmUgemVybywganVzdCBkaXNjYXJkIHRoZSBtb3JwaCBhdHRyaWJ1dGVzIHdlJ3ZlIGp1c3QgbWFkZVxuICAgIGlmIChpc051bGxNb3JwaCkge1xuICAgICAgbmV3R2VvbWV0cnkubW9ycGhBdHRyaWJ1dGVzID0ge307XG4gICAgfVxuXG4gICAgbWVzaC5nZW9tZXRyeSA9IG5ld0dlb21ldHJ5O1xuICB9KTtcblxuICBBcnJheS5mcm9tKGdlb21ldHJ5TWFwLmtleXMoKSkuZm9yRWFjaCgob3JpZ2luYWxHZW9tZXRyeSkgPT4ge1xuICAgIG9yaWdpbmFsR2VvbWV0cnkuZGlzcG9zZSgpO1xuICB9KTtcbn1cbiIsImltcG9ydCB7IGV4dHJhY3RUaHVtYm5haWxCbG9iIH0gZnJvbSAnLi9leHRyYWN0VGh1bWJuYWlsQmxvYic7XG5pbXBvcnQgeyByZW1vdmVVbm5lY2Vzc2FyeUpvaW50cyB9IGZyb20gJy4vcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMnO1xuaW1wb3J0IHsgcmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlcyB9IGZyb20gJy4vcmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlcyc7XG5cbmV4cG9ydCBjbGFzcyBWUk1VdGlscyB7XG4gIHByaXZhdGUgY29uc3RydWN0b3IoKSB7XG4gICAgLy8gdGhpcyBjbGFzcyBpcyBub3QgbWVhbnQgdG8gYmUgaW5zdGFudGlhdGVkXG4gIH1cblxuICBwdWJsaWMgc3RhdGljIGV4dHJhY3RUaHVtYm5haWxCbG9iID0gZXh0cmFjdFRodW1ibmFpbEJsb2I7XG4gIHB1YmxpYyBzdGF0aWMgcmVtb3ZlVW5uZWNlc3NhcnlKb2ludHMgPSByZW1vdmVVbm5lY2Vzc2FyeUpvaW50cztcbiAgcHVibGljIHN0YXRpYyByZW1vdmVVbm5lY2Vzc2FyeVZlcnRpY2VzID0gcmVtb3ZlVW5uZWNlc3NhcnlWZXJ0aWNlcztcbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuLi9sb29rYXQvVlJNTG9va0F0SGVhZCc7XG5pbXBvcnQgeyBWUk1EZWJ1Z09wdGlvbnMgfSBmcm9tICcuL1ZSTURlYnVnT3B0aW9ucyc7XG5cbmNvbnN0IF92MyA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRIZWFkRGVidWcgZXh0ZW5kcyBWUk1Mb29rQXRIZWFkIHtcbiAgcHJpdmF0ZSBfZmFjZURpcmVjdGlvbkhlbHBlcj86IFRIUkVFLkFycm93SGVscGVyO1xuXG4gIHB1YmxpYyBzZXR1cEhlbHBlcihzY2VuZTogVEhSRUUuT2JqZWN0M0QsIGRlYnVnT3B0aW9uOiBWUk1EZWJ1Z09wdGlvbnMpOiB2b2lkIHtcbiAgICBpZiAoIWRlYnVnT3B0aW9uLmRpc2FibGVGYWNlRGlyZWN0aW9uSGVscGVyKSB7XG4gICAgICB0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyID0gbmV3IFRIUkVFLkFycm93SGVscGVyKFxuICAgICAgICBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAtMSksXG4gICAgICAgIG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDApLFxuICAgICAgICAwLjUsXG4gICAgICAgIDB4ZmYwMGZmLFxuICAgICAgKTtcbiAgICAgIHNjZW5lLmFkZCh0aGlzLl9mYWNlRGlyZWN0aW9uSGVscGVyKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBzdXBlci51cGRhdGUoZGVsdGEpO1xuXG4gICAgaWYgKHRoaXMuX2ZhY2VEaXJlY3Rpb25IZWxwZXIpIHtcbiAgICAgIHRoaXMuZmlyc3RQZXJzb24uZ2V0Rmlyc3RQZXJzb25Xb3JsZFBvc2l0aW9uKHRoaXMuX2ZhY2VEaXJlY3Rpb25IZWxwZXIucG9zaXRpb24pO1xuICAgICAgdGhpcy5fZmFjZURpcmVjdGlvbkhlbHBlci5zZXREaXJlY3Rpb24odGhpcy5nZXRMb29rQXRXb3JsZERpcmVjdGlvbihfdjMpKTtcbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IEdMVEYgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcbmltcG9ydCB7IFZSTUJsZW5kU2hhcGVQcm94eSB9IGZyb20gJy4uL2JsZW5kc2hhcGUnO1xuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb24gfSBmcm9tICcuLi9maXJzdHBlcnNvbic7XG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcbmltcG9ydCB7IFZSTUxvb2tBdEhlYWQgfSBmcm9tICcuLi9sb29rYXQvVlJNTG9va0F0SGVhZCc7XG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlciB9IGZyb20gJy4uL2xvb2thdC9WUk1Mb29rQXRJbXBvcnRlcic7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkRGVidWcgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWREZWJ1Zyc7XG5cbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRJbXBvcnRlckRlYnVnIGV4dGVuZHMgVlJNTG9va0F0SW1wb3J0ZXIge1xuICBwdWJsaWMgaW1wb3J0KFxuICAgIGdsdGY6IEdMVEYsXG4gICAgZmlyc3RQZXJzb246IFZSTUZpcnN0UGVyc29uLFxuICAgIGJsZW5kU2hhcGVQcm94eTogVlJNQmxlbmRTaGFwZVByb3h5LFxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcbiAgKTogVlJNTG9va0F0SGVhZCB8IG51bGwge1xuICAgIGNvbnN0IHZybUV4dDogVlJNU2NoZW1hLlZSTSB8IHVuZGVmaW5lZCA9IGdsdGYucGFyc2VyLmpzb24uZXh0ZW5zaW9ucz8uVlJNO1xuICAgIGlmICghdnJtRXh0KSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVlJNU2NoZW1hLkZpcnN0UGVyc29uIHwgdW5kZWZpbmVkID0gdnJtRXh0LmZpcnN0UGVyc29uO1xuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGFwcGx5ZXIgPSB0aGlzLl9pbXBvcnRBcHBseWVyKHNjaGVtYUZpcnN0UGVyc29uLCBibGVuZFNoYXBlUHJveHksIGh1bWFub2lkKTtcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdEhlYWREZWJ1ZyhmaXJzdFBlcnNvbiwgYXBwbHllciB8fCB1bmRlZmluZWQpO1xuICB9XG59XG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lTWFuYWdlciB9IGZyb20gJy4uL3NwcmluZ2JvbmUnO1xuaW1wb3J0IHsgVlJNRGVidWdPcHRpb25zIH0gZnJvbSAnLi9WUk1EZWJ1Z09wdGlvbnMnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZURlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lRGVidWcnO1xuaW1wb3J0IHsgVlJNX0dJWk1PX1JFTkRFUl9PUkRFUiB9IGZyb20gJy4vVlJNRGVidWcnO1xuXG5jb25zdCBfY29sbGlkZXJHaXptb01hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcbiAgY29sb3I6IDB4ZmYwMGZmLFxuICB3aXJlZnJhbWU6IHRydWUsXG4gIHRyYW5zcGFyZW50OiB0cnVlLFxuICBkZXB0aFRlc3Q6IGZhbHNlLFxufSk7XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHNpbmdsZSBzcHJpbmcgYm9uZSBncm91cCBvZiBhIFZSTS5cbiAqL1xuZXhwb3J0IHR5cGUgVlJNU3ByaW5nQm9uZUdyb3VwRGVidWcgPSBWUk1TcHJpbmdCb25lRGVidWdbXTtcblxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcgZXh0ZW5kcyBWUk1TcHJpbmdCb25lTWFuYWdlciB7XG4gIHB1YmxpYyBzZXR1cEhlbHBlcihzY2VuZTogVEhSRUUuT2JqZWN0M0QsIGRlYnVnT3B0aW9uOiBWUk1EZWJ1Z09wdGlvbnMpOiB2b2lkIHtcbiAgICBpZiAoZGVidWdPcHRpb24uZGlzYWJsZVNwcmluZ0JvbmVIZWxwZXIpIHJldHVybjtcblxuICAgIHRoaXMuc3ByaW5nQm9uZUdyb3VwTGlzdC5mb3JFYWNoKChzcHJpbmdCb25lR3JvdXApID0+IHtcbiAgICAgIHNwcmluZ0JvbmVHcm91cC5mb3JFYWNoKChzcHJpbmdCb25lKSA9PiB7XG4gICAgICAgIGlmICgoc3ByaW5nQm9uZSBhcyBhbnkpLmdldEdpem1vKSB7XG4gICAgICAgICAgY29uc3QgZ2l6bW8gPSAoc3ByaW5nQm9uZSBhcyBWUk1TcHJpbmdCb25lRGVidWcpLmdldEdpem1vKCk7XG4gICAgICAgICAgc2NlbmUuYWRkKGdpem1vKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB0aGlzLmNvbGxpZGVyR3JvdXBzLmZvckVhY2goKGNvbGxpZGVyR3JvdXApID0+IHtcbiAgICAgIGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XG4gICAgICAgIGNvbGxpZGVyLm1hdGVyaWFsID0gX2NvbGxpZGVyR2l6bW9NYXRlcmlhbDtcbiAgICAgICAgY29sbGlkZXIucmVuZGVyT3JkZXIgPSBWUk1fR0laTU9fUkVOREVSX09SREVSO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbn1cbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmUgfSBmcm9tICcuLi9zcHJpbmdib25lJztcbmltcG9ydCB7IFZSTV9HSVpNT19SRU5ERVJfT1JERVIgfSBmcm9tICcuL1ZSTURlYnVnJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVQYXJhbWV0ZXJzIH0gZnJvbSAnLi4vc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lUGFyYW1ldGVycyc7XG5cbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZURlYnVnIGV4dGVuZHMgVlJNU3ByaW5nQm9uZSB7XG4gIHByaXZhdGUgX2dpem1vPzogVEhSRUUuQXJyb3dIZWxwZXI7XG5cbiAgY29uc3RydWN0b3IoYm9uZTogVEhSRUUuT2JqZWN0M0QsIHBhcmFtczogVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMpIHtcbiAgICBzdXBlcihib25lLCBwYXJhbXMpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybiBzcHJpbmcgYm9uZSBnaXptbywgYXMgYFRIUkVFLkFycm93SGVscGVyYC5cbiAgICogVXNlZnVsIGZvciBkZWJ1Z2dpbmcgc3ByaW5nIGJvbmVzLlxuICAgKi9cbiAgcHVibGljIGdldEdpem1vKCk6IFRIUkVFLkFycm93SGVscGVyIHtcbiAgICAvLyByZXR1cm4gaWYgZ2l6bW8gaXMgYWxyZWFkeSBleGlzdGVkXG4gICAgaWYgKHRoaXMuX2dpem1vKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2l6bW87XG4gICAgfVxuXG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZSA9IF92M0EuY29weSh0aGlzLl9uZXh0VGFpbCkuc3ViKHRoaXMuX2NlbnRlclNwYWNlUG9zaXRpb24pO1xuICAgIGNvbnN0IG5leHRUYWlsUmVsYXRpdmVMZW5ndGggPSBuZXh0VGFpbFJlbGF0aXZlLmxlbmd0aCgpO1xuXG4gICAgdGhpcy5fZ2l6bW8gPSBuZXcgVEhSRUUuQXJyb3dIZWxwZXIoXG4gICAgICBuZXh0VGFpbFJlbGF0aXZlLm5vcm1hbGl6ZSgpLFxuICAgICAgdGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbixcbiAgICAgIG5leHRUYWlsUmVsYXRpdmVMZW5ndGgsXG4gICAgICAweGZmZmYwMCxcbiAgICAgIHRoaXMucmFkaXVzLFxuICAgICAgdGhpcy5yYWRpdXMsXG4gICAgKTtcblxuICAgIC8vIGl0IHNob3VsZCBiZSBhbHdheXMgdmlzaWJsZVxuICAgIHRoaXMuX2dpem1vLmxpbmUucmVuZGVyT3JkZXIgPSBWUk1fR0laTU9fUkVOREVSX09SREVSO1xuICAgIHRoaXMuX2dpem1vLmNvbmUucmVuZGVyT3JkZXIgPSBWUk1fR0laTU9fUkVOREVSX09SREVSO1xuICAgICh0aGlzLl9naXptby5saW5lLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAodGhpcy5fZ2l6bW8ubGluZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkudHJhbnNwYXJlbnQgPSB0cnVlO1xuICAgICh0aGlzLl9naXptby5jb25lLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kZXB0aFRlc3QgPSBmYWxzZTtcbiAgICAodGhpcy5fZ2l6bW8uY29uZS5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkudHJhbnNwYXJlbnQgPSB0cnVlO1xuXG4gICAgcmV0dXJuIHRoaXMuX2dpem1vO1xuICB9XG5cbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XG4gICAgc3VwZXIudXBkYXRlKGRlbHRhKTtcbiAgICAvLyBsYXN0bHkgd2UncmUgZ29ubmEgdXBkYXRlIGdpem1vXG4gICAgdGhpcy5fdXBkYXRlR2l6bW8oKTtcbiAgfVxuXG4gIHByaXZhdGUgX3VwZGF0ZUdpem1vKCk6IHZvaWQge1xuICAgIGlmICghdGhpcy5fZ2l6bW8pIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBuZXh0VGFpbFJlbGF0aXZlID0gX3YzQS5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKS5zdWIodGhpcy5fY2VudGVyU3BhY2VQb3NpdGlvbik7XG4gICAgY29uc3QgbmV4dFRhaWxSZWxhdGl2ZUxlbmd0aCA9IG5leHRUYWlsUmVsYXRpdmUubGVuZ3RoKCk7XG5cbiAgICB0aGlzLl9naXptby5zZXREaXJlY3Rpb24obmV4dFRhaWxSZWxhdGl2ZS5ub3JtYWxpemUoKSk7XG4gICAgdGhpcy5fZ2l6bW8uc2V0TGVuZ3RoKG5leHRUYWlsUmVsYXRpdmVMZW5ndGgsIHRoaXMucmFkaXVzLCB0aGlzLnJhZGl1cyk7XG4gICAgdGhpcy5fZ2l6bW8ucG9zaXRpb24uY29weSh0aGlzLl9jZW50ZXJTcGFjZVBvc2l0aW9uKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUltcG9ydGVyIH0gZnJvbSAnLi4vc3ByaW5nYm9uZS9WUk1TcHJpbmdCb25lSW1wb3J0ZXInO1xuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1ZyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZU1hbmFnZXJEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TY2hlbWEgfSBmcm9tICcuLi90eXBlcyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lRGVidWcgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyB9IGZyb20gJy4uL3NwcmluZ2JvbmUvVlJNU3ByaW5nQm9uZVBhcmFtZXRlcnMnO1xuXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUltcG9ydGVyRGVidWcgZXh0ZW5kcyBWUk1TcHJpbmdCb25lSW1wb3J0ZXIge1xuICBwdWJsaWMgYXN5bmMgaW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTVNwcmluZ0JvbmVNYW5hZ2VyRGVidWcgfCBudWxsPiB7XG4gICAgY29uc3QgdnJtRXh0OiBWUk1TY2hlbWEuVlJNIHwgdW5kZWZpbmVkID0gZ2x0Zi5wYXJzZXIuanNvbi5leHRlbnNpb25zPy5WUk07XG4gICAgaWYgKCF2cm1FeHQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3Qgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uOiBWUk1TY2hlbWEuU2Vjb25kYXJ5QW5pbWF0aW9uIHwgdW5kZWZpbmVkID0gdnJtRXh0LnNlY29uZGFyeUFuaW1hdGlvbjtcbiAgICBpZiAoIXNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbikgcmV0dXJuIG51bGw7XG5cbiAgICAvLyDooZ3nqoHliKTlrprnkIPkvZPjg6Hjg4Pjgrfjg6XjgIJcbiAgICBjb25zdCBjb2xsaWRlckdyb3VwcyA9IGF3YWl0IHRoaXMuX2ltcG9ydENvbGxpZGVyTWVzaEdyb3VwcyhnbHRmLCBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24pO1xuXG4gICAgLy8g5ZCM44GY5bGe5oCn77yIc3RpZmZpbmVzc+OChGRyYWdGb3JjZeOBjOWQjOOBmO+8ieOBruODnOODvOODs+OBr2JvbmVHcm91cOOBq+OBvuOBqOOCgeOCieOCjOOBpuOBhOOCi+OAglxuICAgIC8vIOS4gOWIl+OBoOOBkeOBp+OBr+OBquOBhOOBk+OBqOOBq+azqOaEj+OAglxuICAgIGNvbnN0IHNwcmluZ0JvbmVHcm91cExpc3QgPSBhd2FpdCB0aGlzLl9pbXBvcnRTcHJpbmdCb25lR3JvdXBMaXN0KGdsdGYsIHNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbiwgY29sbGlkZXJHcm91cHMpO1xuXG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnKGNvbGxpZGVyR3JvdXBzLCBzcHJpbmdCb25lR3JvdXBMaXN0KTtcbiAgfVxuXG4gIHByb3RlY3RlZCBfY3JlYXRlU3ByaW5nQm9uZShib25lOiBUSFJFRS5PYmplY3QzRCwgcGFyYW1zOiBWUk1TcHJpbmdCb25lUGFyYW1ldGVycyk6IFZSTVNwcmluZ0JvbmVEZWJ1ZyB7XG4gICAgcmV0dXJuIG5ldyBWUk1TcHJpbmdCb25lRGVidWcoYm9uZSwgcGFyYW1zKTtcbiAgfVxufVxuIiwiaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNSW1wb3J0ZXIsIFZSTUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4uL1ZSTUltcG9ydGVyJztcbmltcG9ydCB7IFZSTURlYnVnIH0gZnJvbSAnLi9WUk1EZWJ1Zyc7XG5pbXBvcnQgeyBWUk1EZWJ1Z09wdGlvbnMgfSBmcm9tICcuL1ZSTURlYnVnT3B0aW9ucyc7XG5pbXBvcnQgeyBWUk1Mb29rQXRIZWFkRGVidWcgfSBmcm9tICcuL1ZSTUxvb2tBdEhlYWREZWJ1Zyc7XG5pbXBvcnQgeyBWUk1Mb29rQXRJbXBvcnRlckRlYnVnIH0gZnJvbSAnLi9WUk1Mb29rQXRJbXBvcnRlckRlYnVnJztcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVJbXBvcnRlckRlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1Zyc7XG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnJztcblxuLyoqXG4gKiBBbiBpbXBvcnRlciB0aGF0IGltcG9ydHMgYSBbW1ZSTURlYnVnXV0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxuICovXG5leHBvcnQgY2xhc3MgVlJNSW1wb3J0ZXJEZWJ1ZyBleHRlbmRzIFZSTUltcG9ydGVyIHtcbiAgcHVibGljIGNvbnN0cnVjdG9yKG9wdGlvbnM6IFZSTUltcG9ydGVyT3B0aW9ucyA9IHt9KSB7XG4gICAgb3B0aW9ucy5sb29rQXRJbXBvcnRlciA9IG9wdGlvbnMubG9va0F0SW1wb3J0ZXIgfHwgbmV3IFZSTUxvb2tBdEltcG9ydGVyRGVidWcoKTtcbiAgICBvcHRpb25zLnNwcmluZ0JvbmVJbXBvcnRlciA9IG9wdGlvbnMuc3ByaW5nQm9uZUltcG9ydGVyIHx8IG5ldyBWUk1TcHJpbmdCb25lSW1wb3J0ZXJEZWJ1ZygpO1xuICAgIHN1cGVyKG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIGFzeW5jIGltcG9ydChnbHRmOiBHTFRGLCBkZWJ1Z09wdGlvbnM6IFZSTURlYnVnT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxWUk1EZWJ1Zz4ge1xuICAgIGlmIChnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMgPT09IHVuZGVmaW5lZCB8fCBnbHRmLnBhcnNlci5qc29uLmV4dGVuc2lvbnMuVlJNID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgVlJNIGV4dGVuc2lvbiBvbiB0aGUgR0xURicpO1xuICAgIH1cbiAgICBjb25zdCBzY2VuZSA9IGdsdGYuc2NlbmU7XG5cbiAgICBzY2VuZS51cGRhdGVNYXRyaXhXb3JsZChmYWxzZSk7XG5cbiAgICAvLyBTa2lubmVkIG9iamVjdCBzaG91bGQgbm90IGJlIGZydXN0dW1DdWxsZWRcbiAgICAvLyBTaW5jZSBwcmUtc2tpbm5lZCBwb3NpdGlvbiBtaWdodCBiZSBvdXRzaWRlIG9mIHZpZXdcbiAgICBzY2VuZS50cmF2ZXJzZSgob2JqZWN0M2QpID0+IHtcbiAgICAgIGlmICgob2JqZWN0M2QgYXMgYW55KS5pc01lc2gpIHtcbiAgICAgICAgb2JqZWN0M2QuZnJ1c3R1bUN1bGxlZCA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgY29uc3QgbWV0YSA9IChhd2FpdCB0aGlzLl9tZXRhSW1wb3J0ZXIuaW1wb3J0KGdsdGYpKSB8fCB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBtYXRlcmlhbHMgPSAoYXdhaXQgdGhpcy5fbWF0ZXJpYWxJbXBvcnRlci5jb252ZXJ0R0xURk1hdGVyaWFscyhnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgaHVtYW5vaWQgPSAoYXdhaXQgdGhpcy5faHVtYW5vaWRJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IGZpcnN0UGVyc29uID0gaHVtYW5vaWQgPyAoYXdhaXQgdGhpcy5fZmlyc3RQZXJzb25JbXBvcnRlci5pbXBvcnQoZ2x0ZiwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cbiAgICBjb25zdCBibGVuZFNoYXBlUHJveHkgPSAoYXdhaXQgdGhpcy5fYmxlbmRTaGFwZUltcG9ydGVyLmltcG9ydChnbHRmKSkgfHwgdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgbG9va0F0ID1cbiAgICAgIGZpcnN0UGVyc29uICYmIGJsZW5kU2hhcGVQcm94eSAmJiBodW1hbm9pZFxuICAgICAgICA/IChhd2FpdCB0aGlzLl9sb29rQXRJbXBvcnRlci5pbXBvcnQoZ2x0ZiwgZmlyc3RQZXJzb24sIGJsZW5kU2hhcGVQcm94eSwgaHVtYW5vaWQpKSB8fCB1bmRlZmluZWRcbiAgICAgICAgOiB1bmRlZmluZWQ7XG4gICAgaWYgKChsb29rQXQgYXMgYW55KS5zZXR1cEhlbHBlcikge1xuICAgICAgKGxvb2tBdCBhcyBWUk1Mb29rQXRIZWFkRGVidWcpLnNldHVwSGVscGVyKHNjZW5lLCBkZWJ1Z09wdGlvbnMpO1xuICAgIH1cblxuICAgIGNvbnN0IHNwcmluZ0JvbmVNYW5hZ2VyID0gKGF3YWl0IHRoaXMuX3NwcmluZ0JvbmVJbXBvcnRlci5pbXBvcnQoZ2x0ZikpIHx8IHVuZGVmaW5lZDtcbiAgICBpZiAoKHNwcmluZ0JvbmVNYW5hZ2VyIGFzIGFueSkuc2V0dXBIZWxwZXIpIHtcbiAgICAgIChzcHJpbmdCb25lTWFuYWdlciBhcyBWUk1TcHJpbmdCb25lTWFuYWdlckRlYnVnKS5zZXR1cEhlbHBlcihzY2VuZSwgZGVidWdPcHRpb25zKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFZSTURlYnVnKFxuICAgICAge1xuICAgICAgICBzY2VuZTogZ2x0Zi5zY2VuZSxcbiAgICAgICAgbWV0YSxcbiAgICAgICAgbWF0ZXJpYWxzLFxuICAgICAgICBodW1hbm9pZCxcbiAgICAgICAgZmlyc3RQZXJzb24sXG4gICAgICAgIGJsZW5kU2hhcGVQcm94eSxcbiAgICAgICAgbG9va0F0LFxuICAgICAgICBzcHJpbmdCb25lTWFuYWdlcixcbiAgICAgIH0sXG4gICAgICBkZWJ1Z09wdGlvbnMsXG4gICAgKTtcbiAgfVxufVxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xuaW1wb3J0IHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xuaW1wb3J0IHsgVlJNLCBWUk1QYXJhbWV0ZXJzIH0gZnJvbSAnLi4vVlJNJztcbmltcG9ydCB7IFZSTUltcG9ydGVyT3B0aW9ucyB9IGZyb20gJy4uL1ZSTUltcG9ydGVyJztcbmltcG9ydCB7IFZSTURlYnVnT3B0aW9ucyB9IGZyb20gJy4vVlJNRGVidWdPcHRpb25zJztcbmltcG9ydCB7IFZSTUltcG9ydGVyRGVidWcgfSBmcm9tICcuL1ZSTUltcG9ydGVyRGVidWcnO1xuXG5leHBvcnQgY29uc3QgVlJNX0dJWk1PX1JFTkRFUl9PUkRFUiA9IDEwMDAwO1xuXG4vKipcbiAqIFtbVlJNXV0gYnV0IGl0IGhhcyBzb21lIHVzZWZ1bCBnaXptb3MuXG4gKi9cbmV4cG9ydCBjbGFzcyBWUk1EZWJ1ZyBleHRlbmRzIFZSTSB7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNRGVidWcgZnJvbSBhIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXIuXG4gICAqXG4gICAqIFNlZSBbW1ZSTS5mcm9tXV0gZm9yIGEgZGV0YWlsZWQgZXhhbXBsZS5cbiAgICpcbiAgICogQHBhcmFtIGdsdGYgQSBwYXJzZWQgR0xURiBvYmplY3QgdGFrZW4gZnJvbSBHTFRGTG9hZGVyXG4gICAqIEBwYXJhbSBvcHRpb25zIE9wdGlvbnMgdGhhdCB3aWxsIGJlIHVzZWQgaW4gaW1wb3J0ZXJcbiAgICogQHBhcmFtIGRlYnVnT3B0aW9uIE9wdGlvbnMgZm9yIFZSTURlYnVnIGZlYXR1cmVzXG4gICAqL1xuICBwdWJsaWMgc3RhdGljIGFzeW5jIGZyb20oXG4gICAgZ2x0ZjogR0xURixcbiAgICBvcHRpb25zOiBWUk1JbXBvcnRlck9wdGlvbnMgPSB7fSxcbiAgICBkZWJ1Z09wdGlvbjogVlJNRGVidWdPcHRpb25zID0ge30sXG4gICk6IFByb21pc2U8VlJNPiB7XG4gICAgY29uc3QgaW1wb3J0ZXIgPSBuZXcgVlJNSW1wb3J0ZXJEZWJ1ZyhvcHRpb25zKTtcbiAgICByZXR1cm4gYXdhaXQgaW1wb3J0ZXIuaW1wb3J0KGdsdGYsIGRlYnVnT3B0aW9uKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgVlJNRGVidWcgaW5zdGFuY2UuXG4gICAqXG4gICAqIEBwYXJhbSBwYXJhbXMgW1tWUk1QYXJhbWV0ZXJzXV0gdGhhdCByZXByZXNlbnRzIGNvbXBvbmVudHMgb2YgdGhlIFZSTVxuICAgKiBAcGFyYW0gZGVidWdPcHRpb24gT3B0aW9ucyBmb3IgVlJNRGVidWcgZmVhdHVyZXNcbiAgICovXG4gIGNvbnN0cnVjdG9yKHBhcmFtczogVlJNUGFyYW1ldGVycywgZGVidWdPcHRpb246IFZSTURlYnVnT3B0aW9ucyA9IHt9KSB7XG4gICAgc3VwZXIocGFyYW1zKTtcblxuICAgIC8vIEdpem1v44KS5bGV6ZaLXG4gICAgaWYgKCFkZWJ1Z09wdGlvbi5kaXNhYmxlQm94SGVscGVyKSB7XG4gICAgICB0aGlzLnNjZW5lLmFkZChuZXcgVEhSRUUuQm94SGVscGVyKHRoaXMuc2NlbmUpKTtcbiAgICB9XG5cbiAgICBpZiAoIWRlYnVnT3B0aW9uLmRpc2FibGVTa2VsZXRvbkhlbHBlcikge1xuICAgICAgdGhpcy5zY2VuZS5hZGQobmV3IFRIUkVFLlNrZWxldG9uSGVscGVyKHRoaXMuc2NlbmUpKTtcbiAgICB9XG4gIH1cblxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcbiAgICBzdXBlci51cGRhdGUoZGVsdGEpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiVEhSRUUiLCJfdjMiLCJWUk1TY2hlbWEiLCJWRUNUT1IzX0ZST05UIiwiX3F1YXQiLCJfdjNBIiwiX3F1YXRBIiwiX3YzQiIsIl92M0MiLCJNVG9vbk1hdGVyaWFsQ3VsbE1vZGUiLCJNVG9vbk1hdGVyaWFsRGVidWdNb2RlIiwiTVRvb25NYXRlcmlhbE91dGxpbmVDb2xvck1vZGUiLCJNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSIsIk1Ub29uTWF0ZXJpYWxSZW5kZXJNb2RlIiwidmVydGV4U2hhZGVyIiwiZnJhZ21lbnRTaGFkZXIiLCJWUk1VbmxpdE1hdGVyaWFsUmVuZGVyVHlwZSIsIl9tYXRBIiwiQnVmZmVyQXR0cmlidXRlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUE7SUFDQTtBQUNBO0lBQ0E7SUFDQTtBQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtBQXVEQTtJQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtJQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtJQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtJQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFF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
