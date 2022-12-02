/*!
 * @pixiv/three-vrm-core v1.0.0-beta.19
 * The implementation of core features of VRM, for @pixiv/three-vrm
 *
 * Copyright (c) 2020-2021 pixiv Inc.
 * @pixiv/three-vrm-core is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
import * as THREE from 'three';

// animationMixer の監視対象は、Scene の中に入っている必要がある。
// そのため、表示オブジェクトではないけれど、Object3D を継承して Scene に投入できるようにする。
class VRMExpression extends THREE.Object3D {
    constructor(expressionName) {
        super();
        /**
         * The current weight of the expression.
         */
        this.weight = 0.0;
        /**
         * Interpret non-zero values as 1.
         */
        this.isBinary = false;
        /**
         * Specify how the expression overrides blink expressions.
         */
        this.overrideBlink = 'none';
        /**
         * Specify how the expression overrides lookAt expressions.
         */
        this.overrideLookAt = 'none';
        /**
         * Specify how the expression overrides mouth expressions.
         */
        this.overrideMouth = 'none';
        this._binds = [];
        this.name = `VRMExpression_${expressionName}`;
        this.expressionName = expressionName;
        // traverse 時の救済手段として Object3D ではないことを明示しておく
        this.type = 'VRMExpression';
        // 表示目的のオブジェクトではないので、負荷軽減のために visible を false にしておく。
        // これにより、このインスタンスに対する毎フレームの matrix 自動計算を省略できる。
        this.visible = false;
    }
    /**
     * A value represents how much it should override blink expressions.
     * `0.0` == no override at all, `1.0` == completely block the expressions.
     */
    get overrideBlinkAmount() {
        if (this.overrideBlink === 'block') {
            return 0.0 < this.weight ? 1.0 : 0.0;
        }
        else if (this.overrideBlink === 'blend') {
            return this.weight;
        }
        else {
            return 0.0;
        }
    }
    /**
     * A value represents how much it should override lookAt expressions.
     * `0.0` == no override at all, `1.0` == completely block the expressions.
     */
    get overrideLookAtAmount() {
        if (this.overrideLookAt === 'block') {
            return 0.0 < this.weight ? 1.0 : 0.0;
        }
        else if (this.overrideLookAt === 'blend') {
            return this.weight;
        }
        else {
            return 0.0;
        }
    }
    /**
     * A value represents how much it should override mouth expressions.
     * `0.0` == no override at all, `1.0` == completely block the expressions.
     */
    get overrideMouthAmount() {
        if (this.overrideMouth === 'block') {
            return 0.0 < this.weight ? 1.0 : 0.0;
        }
        else if (this.overrideMouth === 'blend') {
            return this.weight;
        }
        else {
            return 0.0;
        }
    }
    addBind(bind) {
        this._binds.push(bind);
    }
    /**
     * Apply weight to every assigned blend shapes.
     * Should be called every frame.
     */
    applyWeight(options) {
        var _a;
        let actualWeight = this.isBinary ? (this.weight === 0.0 ? 0.0 : 1.0) : this.weight;
        actualWeight *= (_a = options === null || options === void 0 ? void 0 : options.multiplier) !== null && _a !== void 0 ? _a : 1.0;
        this._binds.forEach((bind) => bind.applyWeight(actualWeight));
    }
    /**
     * Clear previously assigned blend shapes.
     */
    clearAppliedWeight() {
        this._binds.forEach((bind) => bind.clearAppliedWeight());
    }
}

/*! *****************************************************************************
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

function extractPrimitivesInternal(gltf, nodeIndex, node) {
    var _a, _b;
    const json = gltf.parser.json;
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
    const schemaNode = (_a = json.nodes) === null || _a === void 0 ? void 0 : _a[nodeIndex];
    if (schemaNode == null) {
        console.warn(`extractPrimitivesInternal: Attempt to use nodes[${nodeIndex}] of glTF but the node doesn't exist`);
        return null;
    }
    const meshIndex = schemaNode.mesh;
    if (meshIndex == null) {
        return null;
    }
    // How many primitives the mesh has?
    const schemaMesh = (_b = json.meshes) === null || _b === void 0 ? void 0 : _b[meshIndex];
    if (schemaMesh == null) {
        console.warn(`extractPrimitivesInternal: Attempt to use meshes[${meshIndex}] of glTF but the mesh doesn't exist`);
        return null;
    }
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

/**
 * Get a material definition index of glTF from associated material.
 * It's basically a comat code between Three.js r133 or above and previous versions.
 * @param parser GLTFParser
 * @param material A material of gltf
 * @returns Material definition index of glTF
 */
function gltfGetAssociatedMaterialIndex(parser, material) {
    var _a, _b;
    const threeRevision = parseInt(THREE.REVISION, 10);
    let index = null;
    if (threeRevision >= 133) {
        index = (_b = (_a = parser.associations.get(material)) === null || _a === void 0 ? void 0 : _a.materials) !== null && _b !== void 0 ? _b : null;
    }
    else {
        const associations = parser.associations;
        const reference = associations.get(material);
        if ((reference === null || reference === void 0 ? void 0 : reference.type) === 'materials') {
            index = reference.index;
        }
    }
    return index;
}

/* eslint-disable @typescript-eslint/naming-convention */
const VRMExpressionPresetName = {
    Aa: 'aa',
    Ih: 'ih',
    Ou: 'ou',
    Ee: 'ee',
    Oh: 'oh',
    Blink: 'blink',
    Happy: 'happy',
    Angry: 'angry',
    Sad: 'sad',
    Relaxed: 'relaxed',
    LookUp: 'lookUp',
    Surprised: 'surprised',
    LookDown: 'lookDown',
    LookLeft: 'lookLeft',
    LookRight: 'lookRight',
    BlinkLeft: 'blinkLeft',
    BlinkRight: 'blinkRight',
    Neutral: 'neutral',
};

/**
 * Clamp the input value within [0.0 - 1.0].
 *
 * @param value The input value
 */
function saturate(value) {
    return Math.max(Math.min(value, 1.0), 0.0);
}

class VRMExpressionManager {
    /**
     * Create a new {@link VRMExpressionManager}.
     */
    constructor() {
        /**
         * A set of name or preset name of expressions that will be overridden by {@link VRMExpression.overrideBlink}.
         */
        this.blinkExpressionNames = ['blink', 'blinkLeft', 'blinkRight'];
        /**
         * A set of name or preset name of expressions that will be overridden by {@link VRMExpression.overrideLookAt}.
         */
        this.lookAtExpressionNames = ['lookLeft', 'lookRight', 'lookUp', 'lookDown'];
        /**
         * A set of name or preset name of expressions that will be overridden by {@link VRMExpression.overrideMouth}.
         */
        this.mouthExpressionNames = ['aa', 'ee', 'ih', 'oh', 'ou'];
        /**
         * A set of {@link VRMExpression}.
         * When you want to register expressions, use {@link registerExpression}
         */
        this._expressions = [];
        /**
         * A map from name to expression.
         */
        this._expressionMap = {};
        // do nothing
    }
    get expressions() {
        return this._expressions.concat();
    }
    get expressionMap() {
        return Object.assign({}, this._expressionMap);
    }
    /**
     * A map from name to expression, but excluding custom expressions.
     */
    get presetExpressionMap() {
        const result = {};
        const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
        Object.entries(this._expressionMap).forEach(([name, expression]) => {
            if (presetNameSet.has(name)) {
                result[name] = expression;
            }
        });
        return result;
    }
    /**
     * A map from name to expression, but excluding preset expressions.
     */
    get customExpressionMap() {
        const result = {};
        const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
        Object.entries(this._expressionMap).forEach(([name, expression]) => {
            if (!presetNameSet.has(name)) {
                result[name] = expression;
            }
        });
        return result;
    }
    /**
     * Copy the given {@link VRMExpressionManager} into this one.
     * @param source The {@link VRMExpressionManager} you want to copy
     * @returns this
     */
    copy(source) {
        // first unregister all the expression it has
        const expressions = this._expressions.concat();
        expressions.forEach((expression) => {
            this.unregisterExpression(expression);
        });
        // then register all the expression of the source
        source._expressions.forEach((expression) => {
            this.registerExpression(expression);
        });
        // copy remaining members
        this.blinkExpressionNames = source.blinkExpressionNames.concat();
        this.lookAtExpressionNames = source.lookAtExpressionNames.concat();
        this.mouthExpressionNames = source.mouthExpressionNames.concat();
        return this;
    }
    /**
     * Returns a clone of this {@link VRMExpressionManager}.
     * @returns Copied {@link VRMExpressionManager}
     */
    clone() {
        return new VRMExpressionManager().copy(this);
    }
    /**
     * Return a registered expression.
     * If it cannot find an expression, it will return `null` instead.
     *
     * @param name Name or preset name of the expression
     */
    getExpression(name) {
        var _a;
        return (_a = this._expressionMap[name]) !== null && _a !== void 0 ? _a : null;
    }
    /**
     * Register an expression.
     *
     * @param expression {@link VRMExpression} that describes the expression
     */
    registerExpression(expression) {
        this._expressions.push(expression);
        this._expressionMap[expression.expressionName] = expression;
    }
    /**
     * Unregister an expression.
     *
     * @param expression The expression you want to unregister
     */
    unregisterExpression(expression) {
        const index = this._expressions.indexOf(expression);
        if (index === -1) {
            console.warn('VRMExpressionManager: The specified expressions is not registered');
        }
        this._expressions.splice(index, 1);
        delete this._expressionMap[expression.expressionName];
    }
    /**
     * Get the current weight of the specified expression.
     * If it doesn't have an expression of given name, it will return `null` instead.
     *
     * @param name Name of the expression
     */
    getValue(name) {
        var _a;
        const expression = this.getExpression(name);
        return (_a = expression === null || expression === void 0 ? void 0 : expression.weight) !== null && _a !== void 0 ? _a : null;
    }
    /**
     * Set a weight to the specified expression.
     *
     * @param name Name of the expression
     * @param weight Weight
     */
    setValue(name, weight) {
        const expression = this.getExpression(name);
        if (expression) {
            expression.weight = saturate(weight);
        }
    }
    /**
     * Get a track name of specified expression.
     * This track name is needed to manipulate its expression via keyframe animations.
     *
     * @example Manipulate an expression using keyframe animation
     * ```js
     * const trackName = vrm.expressionManager.getExpressionTrackName( 'blink' );
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
     * @param name Name of the expression
     */
    getExpressionTrackName(name) {
        const expression = this.getExpression(name);
        return expression ? `${expression.name}.weight` : null;
    }
    /**
     * Update every expressions.
     */
    update() {
        // see how much we should override certain expressions
        const weightMultipliers = this._calculateWeightMultipliers();
        // reset expression binds first
        this._expressions.forEach((expression) => {
            expression.clearAppliedWeight();
        });
        // then apply binds
        this._expressions.forEach((expression) => {
            let multiplier = 1.0;
            const name = expression.expressionName;
            if (this.blinkExpressionNames.indexOf(name) !== -1) {
                multiplier *= weightMultipliers.blink;
            }
            if (this.lookAtExpressionNames.indexOf(name) !== -1) {
                multiplier *= weightMultipliers.lookAt;
            }
            if (this.mouthExpressionNames.indexOf(name) !== -1) {
                multiplier *= weightMultipliers.mouth;
            }
            expression.applyWeight({ multiplier });
        });
    }
    /**
     * Calculate sum of override amounts to see how much we should multiply weights of certain expressions.
     */
    _calculateWeightMultipliers() {
        let blink = 1.0;
        let lookAt = 1.0;
        let mouth = 1.0;
        this._expressions.forEach((expression) => {
            blink -= expression.overrideBlinkAmount;
            lookAt -= expression.overrideLookAtAmount;
            mouth -= expression.overrideMouthAmount;
        });
        blink = Math.max(0.0, blink);
        lookAt = Math.max(0.0, lookAt);
        mouth = Math.max(0.0, mouth);
        return { blink, lookAt, mouth };
    }
}

/* eslint-disable @typescript-eslint/naming-convention */
const VRMExpressionMaterialColorType = {
    Color: 'color',
    EmissionColor: 'emissionColor',
    ShadeColor: 'shadeColor',
    MatcapColor: 'matcapColor',
    RimColor: 'rimColor',
    OutlineColor: 'outlineColor',
};
const v0ExpressionMaterialColorMap = {
    _Color: VRMExpressionMaterialColorType.Color,
    _EmissionColor: VRMExpressionMaterialColorType.EmissionColor,
    _ShadeColor: VRMExpressionMaterialColorType.ShadeColor,
    _RimColor: VRMExpressionMaterialColorType.RimColor,
    _OutlineColor: VRMExpressionMaterialColorType.OutlineColor,
};

const _color = new THREE.Color();
/**
 * A bind of expression influences to a material color.
 */
class VRMExpressionMaterialColorBind {
    constructor({ material, type, targetValue, }) {
        var _a, _b, _c;
        this.material = material;
        this.type = type;
        this.targetValue = targetValue;
        // init property name
        const propertyNameMap = (_a = Object.entries(VRMExpressionMaterialColorBind._propertyNameMapMap).find(([distinguisher]) => {
            return material[distinguisher] === true;
        })) === null || _a === void 0 ? void 0 : _a[1];
        const propertyName = (_b = propertyNameMap === null || propertyNameMap === void 0 ? void 0 : propertyNameMap[type]) !== null && _b !== void 0 ? _b : null;
        if (propertyName == null) {
            console.warn(`Tried to add a material color bind to the material ${(_c = material.name) !== null && _c !== void 0 ? _c : '(no name)'}, the type ${type} but the material or the type is not supported.`);
            this._state = null;
        }
        else {
            const target = material[propertyName];
            const initialValue = target.clone();
            // 負の値を保持するためにColor.subを使わずに差分を計算する
            const deltaValue = new THREE.Color(targetValue.r - initialValue.r, targetValue.g - initialValue.g, targetValue.b - initialValue.b);
            this._state = {
                propertyName,
                initialValue,
                deltaValue,
            };
        }
    }
    applyWeight(weight) {
        if (this._state == null) {
            // warning is already emitted in constructor
            return;
        }
        const { propertyName, deltaValue } = this._state;
        const target = this.material[propertyName];
        if (target === undefined) {
            return;
        } // TODO: we should kick this at `addMaterialValue`
        target.add(_color.copy(deltaValue).multiplyScalar(weight));
        if (typeof this.material.shouldApplyUniforms === 'boolean') {
            this.material.shouldApplyUniforms = true;
        }
    }
    clearAppliedWeight() {
        if (this._state == null) {
            // warning is already emitted in constructor
            return;
        }
        const { propertyName, initialValue } = this._state;
        const target = this.material[propertyName];
        if (target === undefined) {
            return;
        } // TODO: we should kick this at `addMaterialValue`
        target.copy(initialValue);
        if (typeof this.material.shouldApplyUniforms === 'boolean') {
            this.material.shouldApplyUniforms = true;
        }
    }
}
/**
 * Mapping of property names from VRMC/materialColorBinds.type to three.js/Material.
 */
VRMExpressionMaterialColorBind._propertyNameMapMap = {
    isMeshStandardMaterial: {
        color: 'color',
        emissionColor: 'emissive',
    },
    isMeshBasicMaterial: {
        color: 'color',
    },
    isMToonMaterial: {
        color: 'color',
        emissionColor: 'emissive',
        outlineColor: 'outlineColorFactor',
        matcapColor: 'matcapFactor',
        rimColor: 'parametricRimColorFactor',
        shadeColor: 'shadeColorFactor',
    },
};

/**
 * A bind of {@link VRMExpression} influences to morph targets.
 */
class VRMExpressionMorphTargetBind {
    constructor({ primitives, index, weight, }) {
        this.primitives = primitives;
        this.index = index;
        this.weight = weight;
    }
    applyWeight(weight) {
        this.primitives.forEach((mesh) => {
            var _a;
            if (((_a = mesh.morphTargetInfluences) === null || _a === void 0 ? void 0 : _a[this.index]) != null) {
                mesh.morphTargetInfluences[this.index] += this.weight * weight;
            }
        });
    }
    clearAppliedWeight() {
        this.primitives.forEach((mesh) => {
            var _a;
            if (((_a = mesh.morphTargetInfluences) === null || _a === void 0 ? void 0 : _a[this.index]) != null) {
                mesh.morphTargetInfluences[this.index] = 0.0;
            }
        });
    }
}

const _v2 = new THREE.Vector2();
/**
 * A bind of expression influences to texture transforms.
 */
class VRMExpressionTextureTransformBind {
    constructor({ material, scale, offset, }) {
        var _a, _b;
        this.material = material;
        this.scale = scale;
        this.offset = offset;
        const propertyNames = (_a = Object.entries(VRMExpressionTextureTransformBind._propertyNamesMap).find(([distinguisher]) => {
            return material[distinguisher] === true;
        })) === null || _a === void 0 ? void 0 : _a[1];
        if (propertyNames == null) {
            console.warn(`Tried to add a texture transform bind to the material ${(_b = material.name) !== null && _b !== void 0 ? _b : '(no name)'} but the material is not supported.`);
            this._properties = [];
        }
        else {
            this._properties = [];
            propertyNames.forEach((propertyName) => {
                var _a;
                const texture = (_a = material[propertyName]) === null || _a === void 0 ? void 0 : _a.clone();
                if (!texture) {
                    return null;
                }
                material[propertyName] = texture; // because the texture is cloned
                const initialOffset = texture.offset.clone();
                const initialScale = texture.repeat.clone();
                const deltaOffset = offset.clone().sub(initialOffset);
                const deltaScale = scale.clone().sub(initialScale);
                this._properties.push({
                    name: propertyName,
                    initialOffset,
                    deltaOffset,
                    initialScale,
                    deltaScale,
                });
            });
        }
    }
    applyWeight(weight) {
        this._properties.forEach((property) => {
            const target = this.material[property.name];
            if (target === undefined) {
                return;
            } // TODO: we should kick this at `addMaterialValue`
            target.offset.add(_v2.copy(property.deltaOffset).multiplyScalar(weight));
            target.repeat.add(_v2.copy(property.deltaScale).multiplyScalar(weight));
            target.needsUpdate = true;
        });
    }
    clearAppliedWeight() {
        this._properties.forEach((property) => {
            const target = this.material[property.name];
            if (target === undefined) {
                return;
            } // TODO: we should kick this at `addMaterialValue`
            target.offset.copy(property.initialOffset);
            target.repeat.copy(property.initialScale);
            target.needsUpdate = true;
        });
    }
}
VRMExpressionTextureTransformBind._propertyNamesMap = {
    isMeshStandardMaterial: [
        'map',
        'emissiveMap',
        'bumpMap',
        'normalMap',
        'displacementMap',
        'roughnessMap',
        'metalnessMap',
        'alphaMap',
    ],
    isMeshBasicMaterial: ['map', 'specularMap', 'alphaMap'],
    isMToonMaterial: [
        'map',
        'normalMap',
        'emissiveMap',
        'shadeMultiplyTexture',
        'rimMultiplyTexture',
        'outlineWidthMultiplyTexture',
        'uvAnimationMaskTexture',
    ],
};

/**
 * A plugin of GLTFLoader that imports a {@link VRMExpressionManager} from a VRM extension of a GLTF.
 */
class VRMExpressionLoaderPlugin {
    constructor(parser) {
        this.parser = parser;
    }
    get name() {
        // We should use the extension name instead but we have multiple plugins for an extension...
        return 'VRMExpressionLoaderPlugin';
    }
    afterRoot(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            gltf.userData.vrmExpressionManager = yield this._import(gltf);
        });
    }
    /**
     * Import a {@link VRMExpressionManager} from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    _import(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            const v1Result = yield this._v1Import(gltf);
            if (v1Result) {
                return v1Result;
            }
            const v0Result = yield this._v0Import(gltf);
            if (v0Result) {
                return v0Result;
            }
            return null;
        });
    }
    _v1Import(gltf) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const isVRMUsed = ((_a = json.extensionsUsed) === null || _a === void 0 ? void 0 : _a.indexOf('VRMC_vrm')) !== -1;
            if (!isVRMUsed) {
                return null;
            }
            const extension = (_b = json.extensions) === null || _b === void 0 ? void 0 : _b['VRMC_vrm'];
            if (!extension) {
                return null;
            }
            const specVersion = extension.specVersion;
            if (specVersion !== '1.0-beta') {
                return null;
            }
            const schemaExpressions = extension.expressions;
            if (!schemaExpressions) {
                return null;
            }
            // list expressions
            const presetNameSet = new Set(Object.values(VRMExpressionPresetName));
            const nameSchemaExpressionMap = new Map();
            if (schemaExpressions.preset != null) {
                Object.entries(schemaExpressions.preset).forEach(([name, schemaExpression]) => {
                    if (schemaExpression == null) {
                        return;
                    } // typescript
                    if (!presetNameSet.has(name)) {
                        console.warn(`VRMExpressionLoaderPlugin: Unknown preset name "${name}" detected. Ignoring the expression`);
                        return;
                    }
                    nameSchemaExpressionMap.set(name, schemaExpression);
                });
            }
            if (schemaExpressions.custom != null) {
                Object.entries(schemaExpressions.custom).forEach(([name, schemaExpression]) => {
                    if (presetNameSet.has(name)) {
                        console.warn(`VRMExpressionLoaderPlugin: Custom expression cannot have preset name "${name}". Ignoring the expression`);
                        return;
                    }
                    nameSchemaExpressionMap.set(name, schemaExpression);
                });
            }
            // prepare manager
            const manager = new VRMExpressionManager();
            // load expressions
            yield Promise.all(Array.from(nameSchemaExpressionMap.entries()).map(([name, schemaExpression]) => __awaiter(this, void 0, void 0, function* () {
                var _c, _d, _e, _f, _g, _h, _j;
                const expression = new VRMExpression(name);
                gltf.scene.add(expression);
                expression.isBinary = (_c = schemaExpression.isBinary) !== null && _c !== void 0 ? _c : false;
                expression.overrideBlink = (_d = schemaExpression.overrideBlink) !== null && _d !== void 0 ? _d : 'none';
                expression.overrideLookAt = (_e = schemaExpression.overrideLookAt) !== null && _e !== void 0 ? _e : 'none';
                expression.overrideMouth = (_f = schemaExpression.overrideMouth) !== null && _f !== void 0 ? _f : 'none';
                (_g = schemaExpression.morphTargetBinds) === null || _g === void 0 ? void 0 : _g.forEach((bind) => __awaiter(this, void 0, void 0, function* () {
                    var _k;
                    if (bind.node === undefined || bind.index === undefined) {
                        return;
                    }
                    const primitives = (yield gltfExtractPrimitivesFromNode(gltf, bind.node));
                    const morphTargetIndex = bind.index;
                    // check if the mesh has the target morph target
                    if (!primitives.every((primitive) => Array.isArray(primitive.morphTargetInfluences) &&
                        morphTargetIndex < primitive.morphTargetInfluences.length)) {
                        console.warn(`VRMExpressionLoaderPlugin: ${schemaExpression.name} attempts to index morph #${morphTargetIndex} but not found.`);
                        return;
                    }
                    expression.addBind(new VRMExpressionMorphTargetBind({
                        primitives,
                        index: morphTargetIndex,
                        weight: (_k = bind.weight) !== null && _k !== void 0 ? _k : 1.0,
                    }));
                }));
                if (schemaExpression.materialColorBinds || schemaExpression.textureTransformBinds) {
                    // list up every material in `gltf.scene`
                    const gltfMaterials = [];
                    gltf.scene.traverse((object) => {
                        const material = object.material;
                        if (material) {
                            gltfMaterials.push(material);
                        }
                    });
                    (_h = schemaExpression.materialColorBinds) === null || _h === void 0 ? void 0 : _h.forEach((bind) => __awaiter(this, void 0, void 0, function* () {
                        const materials = gltfMaterials.filter((material) => {
                            const materialIndex = gltfGetAssociatedMaterialIndex(this.parser, material);
                            return bind.material === materialIndex;
                        });
                        materials.forEach((material) => {
                            expression.addBind(new VRMExpressionMaterialColorBind({
                                material,
                                type: bind.type,
                                targetValue: new THREE.Color().fromArray(bind.targetValue),
                            }));
                        });
                    }));
                    (_j = schemaExpression.textureTransformBinds) === null || _j === void 0 ? void 0 : _j.forEach((bind) => __awaiter(this, void 0, void 0, function* () {
                        const materials = gltfMaterials.filter((material) => {
                            const materialIndex = gltfGetAssociatedMaterialIndex(this.parser, material);
                            return bind.material === materialIndex;
                        });
                        materials.forEach((material) => {
                            var _a, _b;
                            expression.addBind(new VRMExpressionTextureTransformBind({
                                material,
                                offset: new THREE.Vector2().fromArray((_a = bind.offset) !== null && _a !== void 0 ? _a : [0.0, 0.0]),
                                scale: new THREE.Vector2().fromArray((_b = bind.scale) !== null && _b !== void 0 ? _b : [1.0, 1.0]),
                            }));
                        });
                    }));
                }
                manager.registerExpression(expression);
            })));
            return manager;
        });
    }
    _v0Import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const vrmExt = (_a = json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaBlendShape = vrmExt.blendShapeMaster;
            if (!schemaBlendShape) {
                return null;
            }
            const manager = new VRMExpressionManager();
            const schemaBlendShapeGroups = schemaBlendShape.blendShapeGroups;
            if (!schemaBlendShapeGroups) {
                return manager;
            }
            const blendShapeNameSet = new Set();
            yield Promise.all(schemaBlendShapeGroups.map((schemaGroup) => __awaiter(this, void 0, void 0, function* () {
                var _b;
                const v0PresetName = schemaGroup.presetName;
                const v1PresetName = (v0PresetName != null && VRMExpressionLoaderPlugin.v0v1PresetNameMap[v0PresetName]) || null;
                const name = v1PresetName !== null && v1PresetName !== void 0 ? v1PresetName : schemaGroup.name;
                if (name == null) {
                    console.warn('VRMExpressionLoaderPlugin: One of custom expressions has no name. Ignoring the expression');
                    return;
                }
                // duplication check
                if (blendShapeNameSet.has(name)) {
                    console.warn(`VRMExpressionLoaderPlugin: An expression preset ${v0PresetName} has duplicated entries. Ignoring the expression`);
                    return;
                }
                blendShapeNameSet.add(name);
                const expression = new VRMExpression(name);
                gltf.scene.add(expression);
                expression.isBinary = (_b = schemaGroup.isBinary) !== null && _b !== void 0 ? _b : false;
                // v0 doesn't have ignore properties
                // Bind morphTarget
                if (schemaGroup.binds) {
                    schemaGroup.binds.forEach((bind) => __awaiter(this, void 0, void 0, function* () {
                        var _c;
                        if (bind.mesh === undefined || bind.index === undefined) {
                            return;
                        }
                        const nodesUsingMesh = [];
                        (_c = json.nodes) === null || _c === void 0 ? void 0 : _c.forEach((node, i) => {
                            if (node.mesh === bind.mesh) {
                                nodesUsingMesh.push(i);
                            }
                        });
                        const morphTargetIndex = bind.index;
                        yield Promise.all(nodesUsingMesh.map((nodeIndex) => __awaiter(this, void 0, void 0, function* () {
                            var _d;
                            const primitives = (yield gltfExtractPrimitivesFromNode(gltf, nodeIndex));
                            // check if the mesh has the target morph target
                            if (!primitives.every((primitive) => Array.isArray(primitive.morphTargetInfluences) &&
                                morphTargetIndex < primitive.morphTargetInfluences.length)) {
                                console.warn(`VRMExpressionLoaderPlugin: ${schemaGroup.name} attempts to index ${morphTargetIndex}th morph but not found.`);
                                return;
                            }
                            expression.addBind(new VRMExpressionMorphTargetBind({
                                primitives,
                                index: morphTargetIndex,
                                weight: 0.01 * ((_d = bind.weight) !== null && _d !== void 0 ? _d : 100),
                            }));
                        })));
                    }));
                }
                // Bind MaterialColor and TextureTransform
                const materialValues = schemaGroup.materialValues;
                if (materialValues && materialValues.length !== 0) {
                    materialValues.forEach((materialValue) => {
                        if (materialValue.materialName === undefined ||
                            materialValue.propertyName === undefined ||
                            materialValue.targetValue === undefined) {
                            return;
                        }
                        /**
                         * アバターのオブジェクトに設定されているマテリアルの内から
                         * materialValueで指定されているマテリアルを集める。
                         *
                         * 特定には名前を使用する。
                         * アウトライン描画用のマテリアルも同時に集める。
                         */
                        const materials = [];
                        gltf.scene.traverse((object) => {
                            if (object.material) {
                                const material = object.material;
                                if (Array.isArray(material)) {
                                    materials.push(...material.filter((mtl) => (mtl.name === materialValue.materialName ||
                                        mtl.name === materialValue.materialName + ' (Outline)') &&
                                        materials.indexOf(mtl) === -1));
                                }
                                else if (material.name === materialValue.materialName && materials.indexOf(material) === -1) {
                                    materials.push(material);
                                }
                            }
                        });
                        const materialPropertyName = materialValue.propertyName;
                        materials.forEach((material) => {
                            // TextureTransformBind
                            if (materialPropertyName === '_MainTex_ST') {
                                const scale = new THREE.Vector2(materialValue.targetValue[0], materialValue.targetValue[1]);
                                const offset = new THREE.Vector2(materialValue.targetValue[2], materialValue.targetValue[3]);
                                expression.addBind(new VRMExpressionTextureTransformBind({
                                    material,
                                    scale,
                                    offset,
                                }));
                                return;
                            }
                            // MaterialColorBind
                            const materialColorType = v0ExpressionMaterialColorMap[materialPropertyName];
                            if (materialColorType) {
                                expression.addBind(new VRMExpressionMaterialColorBind({
                                    material,
                                    type: materialColorType,
                                    targetValue: new THREE.Color(...materialValue.targetValue.slice(0, 3)),
                                }));
                                return;
                            }
                            console.warn(materialPropertyName + ' is not supported');
                        });
                    });
                }
                manager.registerExpression(expression);
            })));
            return manager;
        });
    }
}
VRMExpressionLoaderPlugin.v0v1PresetNameMap = {
    a: 'aa',
    e: 'ee',
    i: 'ih',
    o: 'oh',
    u: 'ou',
    blink: 'blink',
    joy: 'happy',
    angry: 'angry',
    sorrow: 'sad',
    fun: 'relaxed',
    lookup: 'lookUp',
    lookdown: 'lookDown',
    lookleft: 'lookLeft',
    lookright: 'lookRight',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    blink_l: 'blinkLeft',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    blink_r: 'blinkRight',
    neutral: 'neutral',
};

/* eslint-disable @typescript-eslint/naming-convention */
const VRMExpressionOverrideType = {
    None: 'none',
    Block: 'block',
    Blend: 'blend',
};

class VRMFirstPerson {
    /**
     * Create a new VRMFirstPerson object.
     *
     * @param humanoid A {@link VRMHumanoid}
     * @param meshAnnotations A renderer settings. See the description of [[RendererFirstPersonFlags]] for more info
     */
    constructor(humanoid, meshAnnotations) {
        this._firstPersonOnlyLayer = VRMFirstPerson.DEFAULT_FIRSTPERSON_ONLY_LAYER;
        this._thirdPersonOnlyLayer = VRMFirstPerson.DEFAULT_THIRDPERSON_ONLY_LAYER;
        this._initializedLayers = false;
        this.humanoid = humanoid;
        this.meshAnnotations = meshAnnotations;
    }
    /**
     * Copy the given {@link VRMFirstPerson} into this one.
     * {@link humanoid} must be same as the source one.
     * @param source The {@link VRMFirstPerson} you want to copy
     * @returns this
     */
    copy(source) {
        if (this.humanoid !== source.humanoid) {
            throw new Error('VRMFirstPerson: humanoid must be same in order to copy');
        }
        this.meshAnnotations = source.meshAnnotations.map((annotation) => ({
            meshes: annotation.meshes.concat(),
            type: annotation.type,
        }));
        return this;
    }
    /**
     * Returns a clone of this {@link VRMFirstPerson}.
     * @returns Copied {@link VRMFirstPerson}
     */
    clone() {
        return new VRMFirstPerson(this.humanoid, this.meshAnnotations).copy(this);
    }
    /**
     * A camera layer represents `FirstPersonOnly` layer.
     * Note that **you must call {@link setup} first before you use the layer feature** or it does not work properly.
     *
     * The value is {@link DEFAULT_FIRSTPERSON_ONLY_LAYER} by default but you can change the layer by specifying via {@link setup} if you prefer.
     *
     * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
     * @see https://threejs.org/docs/#api/en/core/Layers
     */
    get firstPersonOnlyLayer() {
        return this._firstPersonOnlyLayer;
    }
    /**
     * A camera layer represents `ThirdPersonOnly` layer.
     * Note that **you must call {@link setup} first before you use the layer feature** or it does not work properly.
     *
     * The value is {@link DEFAULT_THIRDPERSON_ONLY_LAYER} by default but you can change the layer by specifying via {@link setup} if you prefer.
     *
     * @see https://vrm.dev/en/univrm/api/univrm_use_firstperson/
     * @see https://threejs.org/docs/#api/en/core/Layers
     */
    get thirdPersonOnlyLayer() {
        return this._thirdPersonOnlyLayer;
    }
    /**
     * In this method, it assigns layers for every meshes based on mesh annotations.
     * You must call this method first before you use the layer feature.
     *
     * This is an equivalent of [VRMFirstPerson.Setup](https://github.com/vrm-c/UniVRM/blob/73a5bd8fcddaa2a7a8735099a97e63c9db3e5ea0/Assets/VRM/Runtime/FirstPerson/VRMFirstPerson.cs#L295-L299) of the UniVRM.
     *
     * The `cameraLayer` parameter specifies which layer will be assigned for `FirstPersonOnly` / `ThirdPersonOnly`.
     * In UniVRM, we specified those by naming each desired layer as `FIRSTPERSON_ONLY_LAYER` / `THIRDPERSON_ONLY_LAYER`
     * but we are going to specify these layers at here since we are unable to name layers in Three.js.
     *
     * @param cameraLayer Specify which layer will be for `FirstPersonOnly` / `ThirdPersonOnly`.
     */
    setup({ firstPersonOnlyLayer = VRMFirstPerson.DEFAULT_FIRSTPERSON_ONLY_LAYER, thirdPersonOnlyLayer = VRMFirstPerson.DEFAULT_THIRDPERSON_ONLY_LAYER, } = {}) {
        if (this._initializedLayers) {
            return;
        }
        this._firstPersonOnlyLayer = firstPersonOnlyLayer;
        this._thirdPersonOnlyLayer = thirdPersonOnlyLayer;
        this.meshAnnotations.forEach((item) => {
            item.meshes.forEach((mesh) => {
                if (item.type === 'firstPersonOnly') {
                    mesh.layers.set(this._firstPersonOnlyLayer);
                    mesh.traverse((child) => child.layers.set(this._firstPersonOnlyLayer));
                }
                else if (item.type === 'thirdPersonOnly') {
                    mesh.layers.set(this._thirdPersonOnlyLayer);
                    mesh.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
                }
                else if (item.type === 'auto') {
                    this._createHeadlessModel(mesh);
                }
            });
        });
        this._initializedLayers = true;
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
    _createHeadlessModel(node) {
        if (node.type === 'Group') {
            node.layers.set(this._thirdPersonOnlyLayer);
            if (this._isEraseTarget(node)) {
                node.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
            }
            else {
                const parent = new THREE.Group();
                parent.name = `_headless_${node.name}`;
                parent.layers.set(this._firstPersonOnlyLayer);
                node.parent.add(parent);
                node.children
                    .filter((child) => child.type === 'SkinnedMesh')
                    .forEach((child) => {
                    const skinnedMesh = child;
                    this._createHeadlessModelForSkinnedMesh(parent, skinnedMesh);
                });
            }
        }
        else if (node.type === 'SkinnedMesh') {
            const skinnedMesh = node;
            this._createHeadlessModelForSkinnedMesh(node.parent, skinnedMesh);
        }
        else {
            if (this._isEraseTarget(node)) {
                node.layers.set(this._thirdPersonOnlyLayer);
                node.traverse((child) => child.layers.set(this._thirdPersonOnlyLayer));
            }
        }
    }
    _isEraseTarget(bone) {
        if (bone === this.humanoid.getRawBoneNode('head')) {
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
VRMFirstPerson.DEFAULT_FIRSTPERSON_ONLY_LAYER = 9;
/**
 * A default camera layer for `ThirdPersonOnly` layer.
 *
 * @see [[getThirdPersonOnlyLayer]]
 */
VRMFirstPerson.DEFAULT_THIRDPERSON_ONLY_LAYER = 10;

/**
 * A plugin of GLTFLoader that imports a {@link VRMFirstPerson} from a VRM extension of a GLTF.
 */
class VRMFirstPersonLoaderPlugin {
    constructor(parser) {
        this.parser = parser;
    }
    get name() {
        // We should use the extension name instead but we have multiple plugins for an extension...
        return 'VRMFirstPersonLoaderPlugin';
    }
    afterRoot(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            const vrmHumanoid = gltf.userData.vrmHumanoid;
            // explicitly distinguish null and undefined
            // since vrmHumanoid might be null as a result
            if (vrmHumanoid === null) {
                return;
            }
            else if (vrmHumanoid === undefined) {
                throw new Error('VRMFirstPersonLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first');
            }
            gltf.userData.vrmFirstPerson = yield this._import(gltf, vrmHumanoid);
        });
    }
    /**
     * Import a {@link VRMFirstPerson} from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param humanoid A {@link VRMHumanoid} instance that represents the VRM
     */
    _import(gltf, humanoid) {
        return __awaiter(this, void 0, void 0, function* () {
            if (humanoid == null) {
                return null;
            }
            const v1Result = yield this._v1Import(gltf, humanoid);
            if (v1Result) {
                return v1Result;
            }
            const v0Result = yield this._v0Import(gltf, humanoid);
            if (v0Result) {
                return v0Result;
            }
            return null;
        });
    }
    _v1Import(gltf, humanoid) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const isVRMUsed = ((_a = json.extensionsUsed) === null || _a === void 0 ? void 0 : _a.indexOf('VRMC_vrm')) !== -1;
            if (!isVRMUsed) {
                return null;
            }
            const extension = (_b = json.extensions) === null || _b === void 0 ? void 0 : _b['VRMC_vrm'];
            if (!extension) {
                return null;
            }
            const specVersion = extension.specVersion;
            if (specVersion !== '1.0-beta') {
                return null;
            }
            const schemaFirstPerson = extension.firstPerson;
            if (!schemaFirstPerson) {
                return null;
            }
            const meshAnnotations = [];
            const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
            Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
                var _a;
                const annotation = schemaFirstPerson.meshAnnotations
                    ? schemaFirstPerson.meshAnnotations.find((a) => a.node === nodeIndex)
                    : undefined;
                meshAnnotations.push({
                    meshes: primitives,
                    type: (_a = annotation === null || annotation === void 0 ? void 0 : annotation.type) !== null && _a !== void 0 ? _a : 'both',
                });
            });
            return new VRMFirstPerson(humanoid, meshAnnotations);
        });
    }
    _v0Import(gltf, humanoid) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            const vrmExt = (_a = json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaFirstPerson = vrmExt.firstPerson;
            if (!schemaFirstPerson) {
                return null;
            }
            const meshAnnotations = [];
            const nodePrimitivesMap = yield gltfExtractPrimitivesFromNodes(gltf);
            Array.from(nodePrimitivesMap.entries()).forEach(([nodeIndex, primitives]) => {
                const schemaNode = json.nodes[nodeIndex];
                const flag = schemaFirstPerson.meshAnnotations
                    ? schemaFirstPerson.meshAnnotations.find((a) => a.mesh === schemaNode.mesh)
                    : undefined;
                meshAnnotations.push({
                    meshes: primitives,
                    type: this._convertV0FlagToV1Type(flag === null || flag === void 0 ? void 0 : flag.firstPersonFlag),
                });
            });
            return new VRMFirstPerson(humanoid, meshAnnotations);
        });
    }
    _convertV0FlagToV1Type(flag) {
        if (flag === 'FirstPersonOnly') {
            return 'firstPersonOnly';
        }
        else if (flag === 'ThirdPersonOnly') {
            return 'thirdPersonOnly';
        }
        else if (flag === 'Auto') {
            return 'auto';
        }
        else {
            return 'both';
        }
    }
}

/* eslint-disable @typescript-eslint/naming-convention */
const VRMFirstPersonMeshAnnotationType = {
    Auto: 'auto',
    Both: 'both',
    ThirdPersonOnly: 'thirdPersonOnly',
    FirstPersonOnly: 'firstPersonOnly',
};

const _v3A$4 = new THREE.Vector3();
const _v3B$2 = new THREE.Vector3();
const _quatA$5 = new THREE.Quaternion();
class VRMHumanoidHelper extends THREE.Group {
    constructor(humanoid) {
        super();
        this.vrmHumanoid = humanoid;
        this._boneAxesMap = new Map();
        Object.values(humanoid.humanBones).forEach((bone) => {
            const helper = new THREE.AxesHelper(1.0);
            helper.matrixAutoUpdate = false;
            helper.material.depthTest = false;
            helper.material.depthWrite = false;
            this.add(helper);
            // TODO: type assertion is not needed in later versions of TypeScript
            this._boneAxesMap.set(bone, helper);
        });
    }
    dispose() {
        Array.from(this._boneAxesMap.values()).forEach((axes) => {
            axes.geometry.dispose();
            axes.material.dispose();
        });
    }
    updateMatrixWorld(force) {
        Array.from(this._boneAxesMap.entries()).forEach(([bone, axes]) => {
            bone.node.updateWorldMatrix(true, false);
            bone.node.matrixWorld.decompose(_v3A$4, _quatA$5, _v3B$2);
            const scale = _v3A$4.set(0.1, 0.1, 0.1).divide(_v3B$2);
            axes.matrix.copy(bone.node.matrixWorld).scale(scale);
        });
        super.updateMatrixWorld(force);
    }
}

/* eslint-disable @typescript-eslint/naming-convention */
/**
 * The list of {@link VRMHumanBoneName}. Dependency aware.
 */
const VRMHumanBoneList = [
    'hips',
    'spine',
    'chest',
    'upperChest',
    'neck',
    'head',
    'leftEye',
    'rightEye',
    'jaw',
    'leftUpperLeg',
    'leftLowerLeg',
    'leftFoot',
    'leftToes',
    'rightUpperLeg',
    'rightLowerLeg',
    'rightFoot',
    'rightToes',
    'leftShoulder',
    'leftUpperArm',
    'leftLowerArm',
    'leftHand',
    'rightShoulder',
    'rightUpperArm',
    'rightLowerArm',
    'rightHand',
    'leftThumbMetacarpal',
    'leftThumbProximal',
    'leftThumbDistal',
    'leftIndexProximal',
    'leftIndexIntermediate',
    'leftIndexDistal',
    'leftMiddleProximal',
    'leftMiddleIntermediate',
    'leftMiddleDistal',
    'leftRingProximal',
    'leftRingIntermediate',
    'leftRingDistal',
    'leftLittleProximal',
    'leftLittleIntermediate',
    'leftLittleDistal',
    'rightThumbMetacarpal',
    'rightThumbProximal',
    'rightThumbDistal',
    'rightIndexProximal',
    'rightIndexIntermediate',
    'rightIndexDistal',
    'rightMiddleProximal',
    'rightMiddleIntermediate',
    'rightMiddleDistal',
    'rightRingProximal',
    'rightRingIntermediate',
    'rightRingDistal',
    'rightLittleProximal',
    'rightLittleIntermediate',
    'rightLittleDistal',
];

/* eslint-disable @typescript-eslint/naming-convention */
/**
 * The names of {@link VRMHumanoid} bone names.
 *
 * Ref: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0-beta/humanoid.md
 */
const VRMHumanBoneName = {
    Hips: 'hips',
    Spine: 'spine',
    Chest: 'chest',
    UpperChest: 'upperChest',
    Neck: 'neck',
    Head: 'head',
    LeftEye: 'leftEye',
    RightEye: 'rightEye',
    Jaw: 'jaw',
    LeftUpperLeg: 'leftUpperLeg',
    LeftLowerLeg: 'leftLowerLeg',
    LeftFoot: 'leftFoot',
    LeftToes: 'leftToes',
    RightUpperLeg: 'rightUpperLeg',
    RightLowerLeg: 'rightLowerLeg',
    RightFoot: 'rightFoot',
    RightToes: 'rightToes',
    LeftShoulder: 'leftShoulder',
    LeftUpperArm: 'leftUpperArm',
    LeftLowerArm: 'leftLowerArm',
    LeftHand: 'leftHand',
    RightShoulder: 'rightShoulder',
    RightUpperArm: 'rightUpperArm',
    RightLowerArm: 'rightLowerArm',
    RightHand: 'rightHand',
    LeftThumbMetacarpal: 'leftThumbMetacarpal',
    LeftThumbProximal: 'leftThumbProximal',
    LeftThumbDistal: 'leftThumbDistal',
    LeftIndexProximal: 'leftIndexProximal',
    LeftIndexIntermediate: 'leftIndexIntermediate',
    LeftIndexDistal: 'leftIndexDistal',
    LeftMiddleProximal: 'leftMiddleProximal',
    LeftMiddleIntermediate: 'leftMiddleIntermediate',
    LeftMiddleDistal: 'leftMiddleDistal',
    LeftRingProximal: 'leftRingProximal',
    LeftRingIntermediate: 'leftRingIntermediate',
    LeftRingDistal: 'leftRingDistal',
    LeftLittleProximal: 'leftLittleProximal',
    LeftLittleIntermediate: 'leftLittleIntermediate',
    LeftLittleDistal: 'leftLittleDistal',
    RightThumbMetacarpal: 'rightThumbMetacarpal',
    RightThumbProximal: 'rightThumbProximal',
    RightThumbDistal: 'rightThumbDistal',
    RightIndexProximal: 'rightIndexProximal',
    RightIndexIntermediate: 'rightIndexIntermediate',
    RightIndexDistal: 'rightIndexDistal',
    RightMiddleProximal: 'rightMiddleProximal',
    RightMiddleIntermediate: 'rightMiddleIntermediate',
    RightMiddleDistal: 'rightMiddleDistal',
    RightRingProximal: 'rightRingProximal',
    RightRingIntermediate: 'rightRingIntermediate',
    RightRingDistal: 'rightRingDistal',
    RightLittleProximal: 'rightLittleProximal',
    RightLittleIntermediate: 'rightLittleIntermediate',
    RightLittleDistal: 'rightLittleDistal',
};

/* eslint-disable @typescript-eslint/naming-convention */
/**
 * An object that maps from {@link VRMHumanBoneName} to its parent {@link VRMHumanBoneName}.
 *
 * Ref: https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0-beta/humanoid.md
 */
const VRMHumanBoneParentMap = {
    hips: null,
    spine: 'hips',
    chest: 'spine',
    upperChest: 'chest',
    neck: 'upperChest',
    head: 'neck',
    leftEye: 'head',
    rightEye: 'head',
    jaw: 'head',
    leftUpperLeg: 'hips',
    leftLowerLeg: 'leftUpperLeg',
    leftFoot: 'leftLowerLeg',
    leftToes: 'leftFoot',
    rightUpperLeg: 'hips',
    rightLowerLeg: 'rightUpperLeg',
    rightFoot: 'rightLowerLeg',
    rightToes: 'rightFoot',
    leftShoulder: 'chest',
    leftUpperArm: 'leftShoulder',
    leftLowerArm: 'leftUpperArm',
    leftHand: 'leftLowerArm',
    rightShoulder: 'chest',
    rightUpperArm: 'rightShoulder',
    rightLowerArm: 'rightUpperArm',
    rightHand: 'rightLowerArm',
    leftThumbMetacarpal: 'leftHand',
    leftThumbProximal: 'leftThumbMetacarpal',
    leftThumbDistal: 'leftThumbProximal',
    leftIndexProximal: 'leftHand',
    leftIndexIntermediate: 'leftIndexProximal',
    leftIndexDistal: 'leftIndexIntermediate',
    leftMiddleProximal: 'leftHand',
    leftMiddleIntermediate: 'leftMiddleProximal',
    leftMiddleDistal: 'leftMiddleIntermediate',
    leftRingProximal: 'leftHand',
    leftRingIntermediate: 'leftRingProximal',
    leftRingDistal: 'leftRingIntermediate',
    leftLittleProximal: 'leftHand',
    leftLittleIntermediate: 'leftLittleProximal',
    leftLittleDistal: 'leftLittleIntermediate',
    rightThumbMetacarpal: 'rightHand',
    rightThumbProximal: 'rightThumbMetacarpal',
    rightThumbDistal: 'rightThumbProximal',
    rightIndexProximal: 'rightHand',
    rightIndexIntermediate: 'rightIndexProximal',
    rightIndexDistal: 'rightIndexIntermediate',
    rightMiddleProximal: 'rightHand',
    rightMiddleIntermediate: 'rightMiddleProximal',
    rightMiddleDistal: 'rightMiddleIntermediate',
    rightRingProximal: 'rightHand',
    rightRingIntermediate: 'rightRingProximal',
    rightRingDistal: 'rightRingIntermediate',
    rightLittleProximal: 'rightHand',
    rightLittleIntermediate: 'rightLittleProximal',
    rightLittleDistal: 'rightLittleIntermediate',
};

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

const _v3A$3 = new THREE.Vector3();
const _quatA$4 = new THREE.Quaternion();
/**
 * A class represents the Rig of a VRM.
 */
class VRMRig {
    /**
     * Create a new {@link VRMHumanoid}.
     * @param humanBones A {@link VRMHumanBones} contains all the bones of the new humanoid
     */
    constructor(humanBones) {
        this.humanBones = humanBones;
        this.restPose = this.getAbsolutePose();
    }
    /**
     * Return the current absolute pose of this humanoid as a {@link VRMPose}.
     * Note that the output result will contain initial state of the VRM and not compatible between different models.
     * You might want to use {@link getPose} instead.
     */
    getAbsolutePose() {
        const pose = {};
        Object.keys(this.humanBones).forEach((vrmBoneNameString) => {
            const vrmBoneName = vrmBoneNameString;
            const node = this.getBoneNode(vrmBoneName);
            // Ignore when there are no bone on the VRMHumanoid
            if (!node) {
                return;
            }
            // Get the position / rotation from the node
            _v3A$3.copy(node.position);
            _quatA$4.copy(node.quaternion);
            // Convert to raw arrays
            pose[vrmBoneName] = {
                position: _v3A$3.toArray(),
                rotation: _quatA$4.toArray(),
            };
        });
        return pose;
    }
    /**
     * Return the current pose of this humanoid as a {@link VRMPose}.
     *
     * Each transform is a local transform relative from rest pose (T-pose).
     */
    getPose() {
        const pose = {};
        Object.keys(this.humanBones).forEach((boneNameString) => {
            const boneName = boneNameString;
            const node = this.getBoneNode(boneName);
            // Ignore when there are no bone on the VRMHumanoid
            if (!node) {
                return;
            }
            // Take a diff from restPose
            _v3A$3.set(0, 0, 0);
            _quatA$4.identity();
            const restState = this.restPose[boneName];
            if (restState === null || restState === void 0 ? void 0 : restState.position) {
                _v3A$3.fromArray(restState.position).negate();
            }
            if (restState === null || restState === void 0 ? void 0 : restState.rotation) {
                quatInvertCompat(_quatA$4.fromArray(restState.rotation));
            }
            // Get the position / rotation from the node
            _v3A$3.add(node.position);
            _quatA$4.premultiply(node.quaternion);
            // Convert to raw arrays
            pose[boneName] = {
                position: _v3A$3.toArray(),
                rotation: _quatA$4.toArray(),
            };
        });
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
        Object.entries(poseObject).forEach(([boneNameString, state]) => {
            const boneName = boneNameString;
            const node = this.getBoneNode(boneName);
            // Ignore when there are no bone that is defined in the pose on the VRMHumanoid
            if (!node) {
                return;
            }
            const restState = this.restPose[boneName];
            if (!restState) {
                // It's very unlikely. Possibly a bug
                return;
            }
            // Apply the state to the actual bone
            if (state === null || state === void 0 ? void 0 : state.position) {
                node.position.fromArray(state.position);
                if (restState.position) {
                    node.position.add(_v3A$3.fromArray(restState.position));
                }
            }
            if (state === null || state === void 0 ? void 0 : state.rotation) {
                node.quaternion.fromArray(state.rotation);
                if (restState.rotation) {
                    node.quaternion.multiply(_quatA$4.fromArray(restState.rotation));
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
     * Return a bone bound to a specified {@link VRMHumanBoneName}, as a {@link VRMHumanBone}.
     *
     * @param name Name of the bone you want
     */
    getBone(name) {
        var _a;
        return (_a = this.humanBones[name]) !== null && _a !== void 0 ? _a : undefined;
    }
    /**
     * Return a bone bound to a specified {@link VRMHumanBoneName}, as a `THREE.Object3D`.
     *
     * @param name Name of the bone you want
     */
    getBoneNode(name) {
        var _a, _b;
        return (_b = (_a = this.humanBones[name]) === null || _a === void 0 ? void 0 : _a.node) !== null && _b !== void 0 ? _b : null;
    }
}

const _v3A$2 = new THREE.Vector3();
const _quatA$3 = new THREE.Quaternion();
/**
 * A class represents the normalized Rig of a VRM.
 */
class VRMHumanoidRig extends VRMRig {
    constructor(humanoid) {
        const { rigBones, root, parentWorldRotations, boneRotations } = VRMHumanoidRig._setupTransforms(humanoid);
        super(rigBones);
        this.original = humanoid;
        this.root = root;
        this._parentWorldRotations = parentWorldRotations;
        this._boneRotations = boneRotations;
    }
    static _setupTransforms(modelRig) {
        const root = new THREE.Object3D();
        root.name = 'VRMHumanoidRig';
        // store boneWorldPositions and boneWorldRotations
        const boneWorldPositions = {};
        const boneWorldRotations = {};
        const boneRotations = {};
        VRMHumanBoneList.forEach((boneName) => {
            const boneNode = modelRig.getBoneNode(boneName);
            if (boneNode) {
                const boneWorldPosition = new THREE.Vector3();
                const boneWorldRotation = new THREE.Quaternion();
                boneNode.updateWorldMatrix(true, false);
                boneNode.matrixWorld.decompose(boneWorldPosition, boneWorldRotation, _v3A$2);
                boneWorldPositions[boneName] = boneWorldPosition;
                boneWorldRotations[boneName] = boneWorldRotation;
                boneRotations[boneName] = boneNode.quaternion.clone();
            }
        });
        // build rig hierarchy + store parentWorldRotations
        const parentWorldRotations = {};
        const rigBones = {};
        VRMHumanBoneList.forEach((boneName) => {
            var _a;
            const boneNode = modelRig.getBoneNode(boneName);
            if (boneNode) {
                const boneWorldPosition = boneWorldPositions[boneName];
                // see the nearest parent position
                let currentBoneName = boneName;
                let parentWorldPosition;
                let parentWorldRotation;
                while (parentWorldPosition == null) {
                    currentBoneName = VRMHumanBoneParentMap[currentBoneName];
                    if (currentBoneName == null) {
                        break;
                    }
                    parentWorldPosition = boneWorldPositions[currentBoneName];
                    parentWorldRotation = boneWorldRotations[currentBoneName];
                }
                // add to hierarchy
                const rigBoneNode = new THREE.Object3D();
                rigBoneNode.name = 'Normalized_' + boneNode.name;
                const parentRigBoneNode = (currentBoneName ? (_a = rigBones[currentBoneName]) === null || _a === void 0 ? void 0 : _a.node : root);
                parentRigBoneNode.add(rigBoneNode);
                rigBoneNode.position.copy(boneWorldPosition);
                if (parentWorldPosition) {
                    rigBoneNode.position.sub(parentWorldPosition);
                }
                rigBones[boneName] = { node: rigBoneNode };
                // store parentWorldRotation
                parentWorldRotations[boneName] = parentWorldRotation !== null && parentWorldRotation !== void 0 ? parentWorldRotation : new THREE.Quaternion();
            }
        });
        return {
            rigBones: rigBones,
            root,
            parentWorldRotations,
            boneRotations,
        };
    }
    /**
     * Update this humanoid rig.
     */
    update() {
        VRMHumanBoneList.forEach((boneName) => {
            const boneNode = this.original.getBoneNode(boneName);
            if (boneNode != null) {
                const rigBoneNode = this.getBoneNode(boneName);
                const parentWorldRotation = this._parentWorldRotations[boneName];
                const invParentWorldRotation = _quatA$3.copy(parentWorldRotation).invert();
                const boneRotation = this._boneRotations[boneName];
                boneNode.quaternion
                    .copy(rigBoneNode.quaternion)
                    .multiply(parentWorldRotation)
                    .premultiply(invParentWorldRotation)
                    .multiply(boneRotation);
                // Move the mass center of the VRM
                if (boneName === 'hips') {
                    const boneWorldPosition = rigBoneNode.getWorldPosition(new THREE.Vector3());
                    const parentWorldMatrix = boneNode.parent.matrixWorld;
                    const localPosition = boneWorldPosition.applyMatrix4(parentWorldMatrix.invert());
                    boneNode.position.copy(localPosition);
                }
            }
        });
    }
}

/**
 * A class represents a humanoid of a VRM.
 */
class VRMHumanoid {
    /**
     * Create a new {@link VRMHumanoid}.
     * @param humanBones A {@link VRMHumanBones} contains all the bones of the new humanoid
     * @param autoUpdateHumanBones Whether it copies pose from normalizedHumanBones to rawHumanBones on {@link update}. `true` by default.
     */
    constructor(humanBones, options) {
        var _a;
        this.autoUpdateHumanBones = (_a = options === null || options === void 0 ? void 0 : options.autoUpdateHumanBones) !== null && _a !== void 0 ? _a : true;
        this._rawHumanBones = new VRMRig(humanBones);
        this._normalizedHumanBones = new VRMHumanoidRig(this._rawHumanBones);
    }
    /**
     * @deprecated Deprecated. Use either {@link rawRestPose} or {@link normalizedRestPose} instead.
     */
    get restPose() {
        console.warn('VRMHumanoid: restPose is deprecated. Use either rawRestPose or normalizedRestPose instead.');
        return this.rawRestPose;
    }
    /**
     * A {@link VRMPose} of its raw human bones that is its default state.
     * Note that it's not compatible with {@link setRawPose} and {@link getRawPose}, since it contains non-relative values of each local transforms.
     */
    get rawRestPose() {
        return this._rawHumanBones.restPose;
    }
    /**
     * A {@link VRMPose} of its normalized human bones that is its default state.
     * Note that it's not compatible with {@link setNormalizedPose} and {@link getNormalizedPose}, since it contains non-relative values of each local transforms.
     */
    get normalizedRestPose() {
        return this._normalizedHumanBones.restPose;
    }
    /**
     * A map from {@link VRMHumanBoneName} to raw {@link VRMHumanBone}s.
     */
    get humanBones() {
        // an alias of `rawHumanBones`
        return this._rawHumanBones.humanBones;
    }
    /**
     * A map from {@link VRMHumanBoneName} to raw {@link VRMHumanBone}s.
     */
    get rawHumanBones() {
        return this._rawHumanBones.humanBones;
    }
    /**
     * A map from {@link VRMHumanBoneName} to normalized {@link VRMHumanBone}s.
     */
    get normalizedHumanBones() {
        return this._normalizedHumanBones.humanBones;
    }
    /**
     * The root of normalized {@link VRMHumanBone}s.
     */
    get normalizedHumanBonesRoot() {
        return this._normalizedHumanBones.root;
    }
    /**
     * Copy the given {@link VRMHumanoid} into this one.
     * @param source The {@link VRMHumanoid} you want to copy
     * @returns this
     */
    copy(source) {
        this.autoUpdateHumanBones = source.autoUpdateHumanBones;
        this._rawHumanBones = new VRMRig(source.humanBones);
        this._normalizedHumanBones = new VRMHumanoidRig(this._rawHumanBones);
        return this;
    }
    /**
     * Returns a clone of this {@link VRMHumanoid}.
     * @returns Copied {@link VRMHumanoid}
     */
    clone() {
        return new VRMHumanoid(this.humanBones, { autoUpdateHumanBones: this.autoUpdateHumanBones }).copy(this);
    }
    /**
     * @deprecated Deprecated. Use either {@link getRawAbsolutePose} or {@link getNormalizedAbsolutePose} instead.
     */
    getAbsolutePose() {
        console.warn('VRMHumanoid: getAbsolutePose() is deprecated. Use either getRawAbsolutePose() or getNormalizedAbsolutePose() instead.');
        return this.getRawAbsolutePose();
    }
    /**
     * Return the current absolute pose of this raw human bones as a {@link VRMPose}.
     * Note that the output result will contain initial state of the VRM and not compatible between different models.
     * You might want to use {@link getRawPose} instead.
     */
    getRawAbsolutePose() {
        return this._rawHumanBones.getAbsolutePose();
    }
    /**
     * Return the current absolute pose of this normalized human bones as a {@link VRMPose}.
     * Note that the output result will contain initial state of the VRM and not compatible between different models.
     * You might want to use {@link getNormalizedPose} instead.
     */
    getNormalizedAbsolutePose() {
        return this._normalizedHumanBones.getAbsolutePose();
    }
    /**
     * @deprecated Deprecated. Use either {@link getRawPose} or {@link getNormalizedPose} instead.
     */
    getPose() {
        console.warn('VRMHumanoid: getPose() is deprecated. Use either getRawPose() or getNormalizedPose() instead.');
        return this.getRawPose();
    }
    /**
     * Return the current pose of raw human bones as a {@link VRMPose}.
     *
     * Each transform is a local transform relative from rest pose (T-pose).
     */
    getRawPose() {
        return this._rawHumanBones.getPose();
    }
    /**
     * Return the current pose of normalized human bones as a {@link VRMPose}.
     *
     * Each transform is a local transform relative from rest pose (T-pose).
     */
    getNormalizedPose() {
        return this._normalizedHumanBones.getPose();
    }
    /**
     * @deprecated Deprecated. Use either {@link setRawPose} or {@link setNormalizedPose} instead.
     */
    setPose(poseObject) {
        console.warn('VRMHumanoid: setPose() is deprecated. Use either setRawPose() or setNormalizedPose() instead.');
        return this.setRawPose(poseObject);
    }
    /**
     * Let the raw human bones do a specified pose.
     *
     * Each transform have to be a local transform relative from rest pose (T-pose).
     * You can pass what you got from {@link getRawPose}.
     *
     * If you are using {@link autoUpdateHumanBones}, you might want to use {@link setNormalizedPose} instead.
     *
     * @param poseObject A {@link VRMPose} that represents a single pose
     */
    setRawPose(poseObject) {
        return this._rawHumanBones.setPose(poseObject);
    }
    /**
     * Let the normalized human bones do a specified pose.
     *
     * Each transform have to be a local transform relative from rest pose (T-pose).
     * You can pass what you got from {@link getNormalizedPose}.
     *
     * @param poseObject A {@link VRMPose} that represents a single pose
     */
    setNormalizedPose(poseObject) {
        return this._normalizedHumanBones.setPose(poseObject);
    }
    /**
     * @deprecated Deprecated. Use either {@link resetRawPose} or {@link resetNormalizedPose} instead.
     */
    resetPose() {
        console.warn('VRMHumanoid: resetPose() is deprecated. Use either resetRawPose() or resetNormalizedPose() instead.');
        return this.resetRawPose();
    }
    /**
     * Reset the raw humanoid to its rest pose.
     *
     * If you are using {@link autoUpdateHumanBones}, you might want to use {@link resetNormalizedPose} instead.
     */
    resetRawPose() {
        return this._rawHumanBones.resetPose();
    }
    /**
     * Reset the normalized humanoid to its rest pose.
     */
    resetNormalizedPose() {
        return this._rawHumanBones.resetPose();
    }
    /**
     * @deprecated Deprecated. Use either {@link getRawBone} or {@link getNormalizedBone} instead.
     */
    getBone(name) {
        console.warn('VRMHumanoid: getBone() is deprecated. Use either getRawBone() or getNormalizedBone() instead.');
        return this.getRawBone(name);
    }
    /**
     * Return a raw {@link VRMHumanBone} bound to a specified {@link VRMHumanBoneName}.
     *
     * @param name Name of the bone you want
     */
    getRawBone(name) {
        return this._rawHumanBones.getBone(name);
    }
    /**
     * Return a normalized {@link VRMHumanBone} bound to a specified {@link VRMHumanBoneName}.
     *
     * @param name Name of the bone you want
     */
    getNormalizedBone(name) {
        return this._normalizedHumanBones.getBone(name);
    }
    /**
     * @deprecated Deprecated. Use either {@link getRawBoneNode} or {@link getNormalizedBoneNode} instead.
     */
    getBoneNode(name) {
        console.warn('VRMHumanoid: getBoneNode() is deprecated. Use either getRawBoneNode() or getNormalizedBoneNode() instead.');
        return this.getRawBoneNode(name);
    }
    /**
     * Return a raw bone as a `THREE.Object3D` bound to a specified {@link VRMHumanBoneName}.
     *
     * @param name Name of the bone you want
     */
    getRawBoneNode(name) {
        return this._rawHumanBones.getBoneNode(name);
    }
    /**
     * Return a normalized bone as a `THREE.Object3D` bound to a specified {@link VRMHumanBoneName}.
     *
     * @param name Name of the bone you want
     */
    getNormalizedBoneNode(name) {
        return this._normalizedHumanBones.getBoneNode(name);
    }
    /**
     * Update the humanoid component.
     *
     * If {@link autoUpdateHumanBones} is `true`, it transfers the pose of normalized human bones to raw human bones.
     */
    update() {
        if (this.autoUpdateHumanBones) {
            this._normalizedHumanBones.update();
        }
    }
}

/* eslint-disable @typescript-eslint/naming-convention */
const VRMRequiredHumanBoneName = {
    Hips: 'hips',
    Spine: 'spine',
    Head: 'head',
    LeftUpperLeg: 'leftUpperLeg',
    LeftLowerLeg: 'leftLowerLeg',
    LeftFoot: 'leftFoot',
    RightUpperLeg: 'rightUpperLeg',
    RightLowerLeg: 'rightLowerLeg',
    RightFoot: 'rightFoot',
    LeftUpperArm: 'leftUpperArm',
    LeftLowerArm: 'leftLowerArm',
    LeftHand: 'leftHand',
    RightUpperArm: 'rightUpperArm',
    RightLowerArm: 'rightLowerArm',
    RightHand: 'rightHand',
};

/**
 * A map from old thumb bone names to new thumb bone names
 */
const thumbBoneNameMap = {
    leftThumbProximal: 'leftThumbMetacarpal',
    leftThumbIntermediate: 'leftThumbProximal',
    rightThumbProximal: 'rightThumbMetacarpal',
    rightThumbIntermediate: 'rightThumbProximal',
};
/**
 * A plugin of GLTFLoader that imports a {@link VRMHumanoid} from a VRM extension of a GLTF.
 */
class VRMHumanoidLoaderPlugin {
    constructor(parser, options) {
        this.parser = parser;
        this.helperRoot = options === null || options === void 0 ? void 0 : options.helperRoot;
        this.autoUpdateHumanBones = options === null || options === void 0 ? void 0 : options.autoUpdateHumanBones;
    }
    get name() {
        // We should use the extension name instead but we have multiple plugins for an extension...
        return 'VRMHumanoidLoaderPlugin';
    }
    afterRoot(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            gltf.userData.vrmHumanoid = yield this._import(gltf);
        });
    }
    /**
     * Import a {@link VRMHumanoid} from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     */
    _import(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            const v1Result = yield this._v1Import(gltf);
            if (v1Result) {
                return v1Result;
            }
            const v0Result = yield this._v0Import(gltf);
            if (v0Result) {
                return v0Result;
            }
            return null;
        });
    }
    _v1Import(gltf) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const isVRMUsed = ((_a = json.extensionsUsed) === null || _a === void 0 ? void 0 : _a.indexOf('VRMC_vrm')) !== -1;
            if (!isVRMUsed) {
                return null;
            }
            const extension = (_b = json.extensions) === null || _b === void 0 ? void 0 : _b['VRMC_vrm'];
            if (!extension) {
                return null;
            }
            const specVersion = extension.specVersion;
            if (specVersion !== '1.0-beta') {
                return null;
            }
            const schemaHumanoid = extension.humanoid;
            if (!schemaHumanoid) {
                return null;
            }
            /**
             * compat: 1.0-beta thumb bone names
             *
             * `true` if `leftThumbIntermediate` or `rightThumbIntermediate` exists
             */
            const existsPreviousThumbName = schemaHumanoid.humanBones.leftThumbIntermediate != null ||
                schemaHumanoid.humanBones.rightThumbIntermediate != null;
            const humanBones = {};
            if (schemaHumanoid.humanBones != null) {
                yield Promise.all(Object.entries(schemaHumanoid.humanBones).map(([boneNameString, schemaHumanBone]) => __awaiter(this, void 0, void 0, function* () {
                    let boneName = boneNameString;
                    const index = schemaHumanBone.node;
                    // compat: 1.0-beta previous thumb bone names
                    if (existsPreviousThumbName) {
                        const thumbBoneName = thumbBoneNameMap[boneName];
                        if (thumbBoneName != null) {
                            boneName = thumbBoneName;
                        }
                    }
                    const node = yield this.parser.getDependency('node', index);
                    // if the specified node does not exist, emit a warning
                    if (node == null) {
                        console.warn(`A glTF node bound to the humanoid bone ${boneName} (index = ${index}) does not exist`);
                        return;
                    }
                    // set to the `humanBones`
                    humanBones[boneName] = { node };
                })));
            }
            const humanoid = new VRMHumanoid(this._ensureRequiredBonesExist(humanBones), {
                autoUpdateHumanBones: this.autoUpdateHumanBones,
            });
            gltf.scene.add(humanoid.normalizedHumanBonesRoot);
            if (this.helperRoot) {
                const helper = new VRMHumanoidHelper(humanoid);
                this.helperRoot.add(helper);
                helper.renderOrder = this.helperRoot.renderOrder;
            }
            return humanoid;
        });
    }
    _v0Import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            const vrmExt = (_a = json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaHumanoid = vrmExt.humanoid;
            if (!schemaHumanoid) {
                return null;
            }
            const humanBones = {};
            if (schemaHumanoid.humanBones != null) {
                yield Promise.all(schemaHumanoid.humanBones.map((bone) => __awaiter(this, void 0, void 0, function* () {
                    const boneName = bone.bone;
                    const index = bone.node;
                    if (boneName == null || index == null) {
                        return;
                    }
                    const node = yield this.parser.getDependency('node', index);
                    // if the specified node does not exist, emit a warning
                    if (node == null) {
                        console.warn(`A glTF node bound to the humanoid bone ${boneName} (index = ${index}) does not exist`);
                        return;
                    }
                    // map to new bone name
                    const thumbBoneName = thumbBoneNameMap[boneName];
                    const newBoneName = (thumbBoneName !== null && thumbBoneName !== void 0 ? thumbBoneName : boneName);
                    // v0 VRMs might have a multiple nodes attached to a single bone...
                    // so if there already is an entry in the `humanBones`, show a warning and ignore it
                    if (humanBones[newBoneName] != null) {
                        console.warn(`Multiple bone entries for ${newBoneName} detected (index = ${index}), ignoring duplicated entries.`);
                        return;
                    }
                    // set to the `humanBones`
                    humanBones[newBoneName] = { node };
                })));
            }
            const humanoid = new VRMHumanoid(this._ensureRequiredBonesExist(humanBones), {
                autoUpdateHumanBones: this.autoUpdateHumanBones,
            });
            gltf.scene.add(humanoid.normalizedHumanBonesRoot);
            if (this.helperRoot) {
                const helper = new VRMHumanoidHelper(humanoid);
                this.helperRoot.add(helper);
                helper.renderOrder = this.helperRoot.renderOrder;
            }
            return humanoid;
        });
    }
    /**
     * Ensure required bones exist in given human bones.
     * @param humanBones Human bones
     * @returns Human bones, no longer partial!
     */
    _ensureRequiredBonesExist(humanBones) {
        // ensure required bones exist
        const missingRequiredBones = Object.values(VRMRequiredHumanBoneName).filter((requiredBoneName) => humanBones[requiredBoneName] == null);
        // throw an error if there are missing bones
        if (missingRequiredBones.length > 0) {
            throw new Error(`VRMHumanoidLoaderPlugin: These humanoid bones are required but not exist: ${missingRequiredBones.join(', ')}`);
        }
        return humanBones;
    }
}

class FanBufferGeometry extends THREE.BufferGeometry {
    constructor() {
        super();
        this._currentTheta = 0;
        this._currentRadius = 0;
        this.theta = 0.0;
        this.radius = 0.0;
        this._currentTheta = 0.0;
        this._currentRadius = 0.0;
        this._attrPos = new THREE.BufferAttribute(new Float32Array(65 * 3), 3);
        this.setAttribute('position', this._attrPos);
        this._attrIndex = new THREE.BufferAttribute(new Uint16Array(3 * 63), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
    }
    update() {
        let shouldUpdateGeometry = false;
        if (this._currentTheta !== this.theta) {
            this._currentTheta = this.theta;
            shouldUpdateGeometry = true;
        }
        if (this._currentRadius !== this.radius) {
            this._currentRadius = this.radius;
            shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
            this._buildPosition();
        }
    }
    _buildPosition() {
        this._attrPos.setXYZ(0, 0.0, 0.0, 0.0);
        for (let i = 0; i < 64; i++) {
            const t = (i / 63.0) * this._currentTheta;
            this._attrPos.setXYZ(i + 1, this._currentRadius * Math.sin(t), 0.0, this._currentRadius * Math.cos(t));
        }
        this._attrPos.needsUpdate = true;
    }
    _buildIndex() {
        for (let i = 0; i < 63; i++) {
            this._attrIndex.setXYZ(i * 3, 0, i + 1, i + 2);
        }
        this._attrIndex.needsUpdate = true;
    }
}

class LineAndSphereBufferGeometry extends THREE.BufferGeometry {
    constructor() {
        super();
        this.radius = 0.0;
        this._currentRadius = 0.0;
        this.tail = new THREE.Vector3();
        this._currentTail = new THREE.Vector3();
        this._attrPos = new THREE.BufferAttribute(new Float32Array(294), 3);
        this.setAttribute('position', this._attrPos);
        this._attrIndex = new THREE.BufferAttribute(new Uint16Array(194), 1);
        this.setIndex(this._attrIndex);
        this._buildIndex();
        this.update();
    }
    update() {
        let shouldUpdateGeometry = false;
        if (this._currentRadius !== this.radius) {
            this._currentRadius = this.radius;
            shouldUpdateGeometry = true;
        }
        if (!this._currentTail.equals(this.tail)) {
            this._currentTail.copy(this.tail);
            shouldUpdateGeometry = true;
        }
        if (shouldUpdateGeometry) {
            this._buildPosition();
        }
    }
    _buildPosition() {
        for (let i = 0; i < 32; i++) {
            const t = (i / 16.0) * Math.PI;
            this._attrPos.setXYZ(i, Math.cos(t), Math.sin(t), 0.0);
            this._attrPos.setXYZ(32 + i, 0.0, Math.cos(t), Math.sin(t));
            this._attrPos.setXYZ(64 + i, Math.sin(t), 0.0, Math.cos(t));
        }
        this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
        this.translate(this._currentTail.x, this._currentTail.y, this._currentTail.z);
        this._attrPos.setXYZ(96, 0, 0, 0);
        this._attrPos.setXYZ(97, this._currentTail.x, this._currentTail.y, this._currentTail.z);
        this._attrPos.needsUpdate = true;
    }
    _buildIndex() {
        for (let i = 0; i < 32; i++) {
            const i1 = (i + 1) % 32;
            this._attrIndex.setXY(i * 2, i, i1);
            this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
            this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
        }
        this._attrIndex.setXY(192, 96, 97);
        this._attrIndex.needsUpdate = true;
    }
}

const _quatA$2 = new THREE.Quaternion();
const _quatB$2 = new THREE.Quaternion();
const _v3A$1 = new THREE.Vector3();
const _v3B$1 = new THREE.Vector3();
const SQRT_2_OVER_2 = Math.sqrt(2.0) / 2.0;
const QUAT_XY_CW90 = new THREE.Quaternion(0, 0, -SQRT_2_OVER_2, SQRT_2_OVER_2);
const VEC3_POSITIVE_Y = new THREE.Vector3(0.0, 1.0, 0.0);
class VRMLookAtHelper extends THREE.Group {
    constructor(lookAt) {
        super();
        this.matrixAutoUpdate = false;
        this.vrmLookAt = lookAt;
        {
            const geometry = new FanBufferGeometry();
            geometry.radius = 0.5;
            const material = new THREE.MeshBasicMaterial({
                color: 0x00ff00,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false,
            });
            this._meshPitch = new THREE.Mesh(geometry, material);
            this.add(this._meshPitch);
        }
        {
            const geometry = new FanBufferGeometry();
            geometry.radius = 0.5;
            const material = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide,
                depthTest: false,
                depthWrite: false,
            });
            this._meshYaw = new THREE.Mesh(geometry, material);
            this.add(this._meshYaw);
        }
        {
            const geometry = new LineAndSphereBufferGeometry();
            geometry.radius = 0.1;
            const material = new THREE.LineBasicMaterial({
                color: 0xffffff,
                depthTest: false,
                depthWrite: false,
            });
            this._lineTarget = new THREE.LineSegments(geometry, material);
            this._lineTarget.frustumCulled = false;
            this.add(this._lineTarget);
        }
    }
    dispose() {
        this._meshYaw.geometry.dispose();
        this._meshYaw.material.dispose();
        this._meshPitch.geometry.dispose();
        this._meshPitch.material.dispose();
        this._lineTarget.geometry.dispose();
        this._lineTarget.material.dispose();
    }
    updateMatrixWorld(force) {
        // update geometries
        const yaw = THREE.MathUtils.DEG2RAD * this.vrmLookAt.yaw;
        this._meshYaw.geometry.theta = yaw;
        this._meshYaw.geometry.update();
        const pitch = THREE.MathUtils.DEG2RAD * this.vrmLookAt.pitch;
        this._meshPitch.geometry.theta = pitch;
        this._meshPitch.geometry.update();
        // get world position and quaternion
        this.vrmLookAt.getLookAtWorldPosition(_v3A$1);
        this.vrmLookAt.getLookAtWorldQuaternion(_quatA$2);
        // calculate rotation using faceFront
        _quatA$2.multiply(this.vrmLookAt.getFaceFrontQuaternion(_quatB$2));
        // set transform to meshes
        this._meshYaw.position.copy(_v3A$1);
        this._meshYaw.quaternion.copy(_quatA$2);
        this._meshPitch.position.copy(_v3A$1);
        this._meshPitch.quaternion.copy(_quatA$2);
        this._meshPitch.quaternion.multiply(_quatB$2.setFromAxisAngle(VEC3_POSITIVE_Y, yaw));
        this._meshPitch.quaternion.multiply(QUAT_XY_CW90);
        // update target line and sphere
        const { target, autoUpdate } = this.vrmLookAt;
        if (target != null && autoUpdate) {
            target.getWorldPosition(_v3B$1).sub(_v3A$1);
            this._lineTarget.geometry.tail.copy(_v3B$1);
            this._lineTarget.geometry.update();
            this._lineTarget.position.copy(_v3A$1);
        }
        // apply transform to meshes
        super.updateMatrixWorld(force);
    }
}

const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
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

/**
 * Calculate azimuth / altitude angles from a vector.
 *
 * This returns a difference of angles from (1, 0, 0).
 * Azimuth represents an angle around Y axis.
 * Altitude represents an angle around Z axis.
 * It is rotated in intrinsic Y-Z order.
 *
 * @param vector The vector
 * @returns A tuple contains two angles, `[ azimuth, altitude ]`
 */
function calcAzimuthAltitude(vector) {
    return [Math.atan2(-vector.z, vector.x), Math.atan2(vector.y, Math.sqrt(vector.x * vector.x + vector.z * vector.z))];
}

/**
 * Make sure the angle is within -PI to PI.
 *
 * @example
 * ```js
 * sanitizeAngle(1.5 * Math.PI) // -0.5 * PI
 * ```
 *
 * @param angle An input angle
 */
function sanitizeAngle(angle) {
    const roundTurn = Math.round(angle / 2.0 / Math.PI);
    return angle - 2.0 * Math.PI * roundTurn;
}

const VEC3_POSITIVE_Z$1 = new THREE.Vector3(0.0, 0.0, 1.0);
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const _v3C = new THREE.Vector3();
const _quatA$1 = new THREE.Quaternion();
const _quatB$1 = new THREE.Quaternion();
const _quatC = new THREE.Quaternion();
const _eulerA$1 = new THREE.Euler();
/**
 * A class controls eye gaze movements of a VRM.
 */
class VRMLookAt {
    /**
     * Create a new {@link VRMLookAt}.
     *
     * @param humanoid A {@link VRMHumanoid}
     * @param applier A {@link VRMLookAtApplier}
     */
    constructor(humanoid, applier) {
        /**
         * The origin of LookAt. Position offset from the head bone.
         */
        this.offsetFromHeadBone = new THREE.Vector3();
        /**
         * If this is true, the LookAt will be updated automatically by calling {@link update}, towarding the direction to the {@link target}.
         * `true` by default.
         *
         * See also: {@link target}
         */
        this.autoUpdate = true;
        /**
         * The front direction of the face.
         * Intended to be used for VRM 0.0 compat (VRM 0.0 models are facing Z- instead of Z+).
         * You usually don't want to touch this.
         */
        this.faceFront = new THREE.Vector3(0.0, 0.0, 1.0);
        this.humanoid = humanoid;
        this.applier = applier;
        this._yaw = 0.0;
        this._pitch = 0.0;
        this._needsUpdate = true;
    }
    /**
     * Its current angle around Y axis, in degree.
     */
    get yaw() {
        return this._yaw;
    }
    /**
     * Its current angle around Y axis, in degree.
     */
    set yaw(value) {
        this._yaw = value;
        this._needsUpdate = true;
    }
    /**
     * Its current angle around X axis, in degree.
     */
    get pitch() {
        return this._pitch;
    }
    /**
     * Its current angle around X axis, in degree.
     */
    set pitch(value) {
        this._pitch = value;
        this._needsUpdate = true;
    }
    /**
     * @deprecated Use {@link getEuler} instead.
     */
    get euler() {
        console.warn('VRMLookAt: euler is deprecated. use getEuler() instead.');
        return this.getEuler(new THREE.Euler());
    }
    /**
     * Get its yaw-pitch angles as an `Euler`.
     * Does NOT consider {@link faceFront}.
     *
     * @param target The target euler
     */
    getEuler(target) {
        return target.set(THREE.MathUtils.DEG2RAD * this._pitch, THREE.MathUtils.DEG2RAD * this._yaw, 0.0, 'YXZ');
    }
    /**
     * Copy the given {@link VRMLookAt} into this one.
     * {@link humanoid} must be same as the source one.
     * {@link applier} will reference the same instance as the source one.
     * @param source The {@link VRMLookAt} you want to copy
     * @returns this
     */
    copy(source) {
        if (this.humanoid !== source.humanoid) {
            throw new Error('VRMLookAt: humanoid must be same in order to copy');
        }
        this.offsetFromHeadBone.copy(source.offsetFromHeadBone);
        this.applier = source.applier;
        this.autoUpdate = source.autoUpdate;
        this.target = source.target;
        this.faceFront.copy(source.faceFront);
        return this;
    }
    /**
     * Returns a clone of this {@link VRMLookAt}.
     * Note that {@link humanoid} and {@link applier} will reference the same instance as this one.
     * @returns Copied {@link VRMLookAt}
     */
    clone() {
        return new VRMLookAt(this.humanoid, this.applier).copy(this);
    }
    /**
     * Reset the lookAt direction to initial direction.
     */
    reset() {
        this._yaw = 0.0;
        this._pitch = 0.0;
        this._needsUpdate = true;
    }
    /**
     * Get its head position in world coordinate.
     *
     * @param target A target `THREE.Vector3`
     */
    getLookAtWorldPosition(target) {
        const head = this.humanoid.getRawBoneNode('head');
        return target.copy(this.offsetFromHeadBone).applyMatrix4(head.matrixWorld);
    }
    /**
     * Get its LookAt orientation in world coordinate.
     *
     * @param target A target `THREE.Vector3`
     */
    getLookAtWorldQuaternion(target) {
        const head = this.humanoid.getRawBoneNode('head');
        return getWorldQuaternionLite(head, target);
    }
    /**
     * Get a quaternion that rotates the +Z unit vector of the humanoid Head to the {@link faceFront} direction.
     *
     * @param target A target `THREE.Vector3`
     */
    getFaceFrontQuaternion(target) {
        if (this.faceFront.distanceToSquared(VEC3_POSITIVE_Z$1) < 0.01) {
            return target.identity();
        }
        const [faceFrontAzimuth, faceFrontAltitude] = calcAzimuthAltitude(this.faceFront);
        _eulerA$1.set(0.0, 0.5 * Math.PI + faceFrontAzimuth, faceFrontAltitude, 'YZX');
        return target.setFromEuler(_eulerA$1);
    }
    /**
     * Get its LookAt direction in world coordinate.
     *
     * @param target A target `THREE.Vector3`
     */
    getLookAtWorldDirection(target) {
        this.getLookAtWorldQuaternion(_quatB$1);
        this.getFaceFrontQuaternion(_quatC);
        return target
            .copy(VEC3_POSITIVE_Z$1)
            .applyQuaternion(_quatB$1)
            .applyQuaternion(_quatC)
            .applyEuler(this.getEuler(_eulerA$1));
    }
    /**
     * Set its LookAt position.
     * Note that its result will be instantly overwritten if {@link VRMLookAtHead.autoUpdate} is enabled.
     *
     * @param position A target position, in world space
     */
    lookAt(position) {
        // Look at direction in local coordinate
        const headRotInv = quatInvertCompat(this.getLookAtWorldQuaternion(_quatA$1));
        const headPos = this.getLookAtWorldPosition(_v3B);
        const lookAtDir = _v3C.copy(position).sub(headPos).applyQuaternion(headRotInv).normalize();
        // calculate angles
        const [azimuthFrom, altitudeFrom] = calcAzimuthAltitude(this.faceFront);
        const [azimuthTo, altitudeTo] = calcAzimuthAltitude(lookAtDir);
        const yaw = sanitizeAngle(azimuthTo - azimuthFrom);
        const pitch = sanitizeAngle(altitudeFrom - altitudeTo); // spinning (1, 0, 0) CCW around Z axis makes the vector look up, while spinning (0, 0, 1) CCW around X axis makes the vector look down
        // apply angles
        this._yaw = THREE.MathUtils.RAD2DEG * yaw;
        this._pitch = THREE.MathUtils.RAD2DEG * pitch;
        this._needsUpdate = true;
    }
    /**
     * Update the VRMLookAtHead.
     * If {@link VRMLookAtHead.autoUpdate} is disabled, it will do nothing.
     *
     * @param delta deltaTime, it isn't used though. You can use the parameter if you want to use this in your own extended {@link VRMLookAt}.
     */
    update(delta) {
        if (this.target != null && this.autoUpdate) {
            this.lookAt(this.target.getWorldPosition(_v3A));
        }
        if (this._needsUpdate) {
            this._needsUpdate = false;
            this.applier.applyYawPitch(this._yaw, this._pitch);
        }
    }
}
VRMLookAt.EULER_ORDER = 'YXZ'; // yaw-pitch-roll

const VEC3_POSITIVE_Z = new THREE.Vector3(0.0, 0.0, 1.0);
const _quatA = new THREE.Quaternion();
const _quatB = new THREE.Quaternion();
const _eulerA = new THREE.Euler(0.0, 0.0, 0.0, 'YXZ');
/**
 * A class that applies eye gaze directions to a VRM.
 * It will be used by {@link VRMLookAt}.
 */
class VRMLookAtBoneApplier {
    /**
     * Create a new {@link VRMLookAtBoneApplier}.
     *
     * @param humanoid A {@link VRMHumanoid}
     * @param rangeMapHorizontalInner A {@link VRMLookAtRangeMap} used for inner transverse direction
     * @param rangeMapHorizontalOuter A {@link VRMLookAtRangeMap} used for outer transverse direction
     * @param rangeMapVerticalDown A {@link VRMLookAtRangeMap} used for down direction
     * @param rangeMapVerticalUp A {@link VRMLookAtRangeMap} used for up direction
     */
    constructor(humanoid, rangeMapHorizontalInner, rangeMapHorizontalOuter, rangeMapVerticalDown, rangeMapVerticalUp) {
        this.humanoid = humanoid;
        this.rangeMapHorizontalInner = rangeMapHorizontalInner;
        this.rangeMapHorizontalOuter = rangeMapHorizontalOuter;
        this.rangeMapVerticalDown = rangeMapVerticalDown;
        this.rangeMapVerticalUp = rangeMapVerticalUp;
        this.faceFront = new THREE.Vector3(0.0, 0.0, 1.0);
        // set rest quaternions
        this._restQuatLeftEye = new THREE.Quaternion();
        this._restQuatRightEye = new THREE.Quaternion();
        const leftEye = this.humanoid.getRawBoneNode('leftEye');
        const rightEye = this.humanoid.getRawBoneNode('leftEye');
        if (leftEye) {
            this._restQuatLeftEye.copy(leftEye.quaternion);
        }
        if (rightEye) {
            this._restQuatRightEye.copy(rightEye.quaternion);
        }
    }
    /**
     * Apply the input angle to its associated VRM model.
     *
     * @param yaw Rotation around Y axis, in degree
     * @param pitch Rotation around X axis, in degree
     */
    applyYawPitch(yaw, pitch) {
        const leftEye = this.humanoid.getRawBoneNode('leftEye');
        const rightEye = this.humanoid.getRawBoneNode('rightEye');
        const leftEyeNormalized = this.humanoid.getNormalizedBoneNode('leftEye');
        const rightEyeNormalized = this.humanoid.getNormalizedBoneNode('rightEye');
        // left
        if (leftEye) {
            if (pitch < 0.0) {
                _eulerA.x = -THREE.MathUtils.DEG2RAD * this.rangeMapVerticalDown.map(-pitch);
            }
            else {
                _eulerA.x = THREE.MathUtils.DEG2RAD * this.rangeMapVerticalUp.map(pitch);
            }
            if (yaw < 0.0) {
                _eulerA.y = -THREE.MathUtils.DEG2RAD * this.rangeMapHorizontalInner.map(-yaw);
            }
            else {
                _eulerA.y = THREE.MathUtils.DEG2RAD * this.rangeMapHorizontalOuter.map(yaw);
            }
            _quatA.setFromEuler(_eulerA);
            this._getFaceFrontQuaternion(_quatB);
            // quatB^-1 * quatA * quatB * restQuatLeftEye
            leftEye.quaternion.copy(_quatB).premultiply(_quatA).premultiply(_quatB.invert()).multiply(this._restQuatLeftEye);
            leftEyeNormalized.quaternion.copy(_quatB).premultiply(_quatA).premultiply(_quatB.invert());
        }
        // right
        if (rightEye) {
            if (pitch < 0.0) {
                _eulerA.x = -THREE.MathUtils.DEG2RAD * this.rangeMapVerticalDown.map(-pitch);
            }
            else {
                _eulerA.x = THREE.MathUtils.DEG2RAD * this.rangeMapVerticalUp.map(pitch);
            }
            if (yaw < 0.0) {
                _eulerA.y = -THREE.MathUtils.DEG2RAD * this.rangeMapHorizontalOuter.map(-yaw);
            }
            else {
                _eulerA.y = THREE.MathUtils.DEG2RAD * this.rangeMapHorizontalInner.map(yaw);
            }
            _quatA.setFromEuler(_eulerA);
            this._getFaceFrontQuaternion(_quatB);
            // quatB^-1 * quatA * quatB * restQuatRightEye
            rightEye.quaternion
                .copy(_quatB)
                .premultiply(_quatA)
                .premultiply(_quatB.invert())
                .multiply(this._restQuatRightEye);
            rightEyeNormalized.quaternion.copy(_quatB).premultiply(_quatA).premultiply(_quatB.invert());
        }
    }
    /**
     * @deprecated Use {@link applyYawPitch} instead.
     */
    lookAt(euler) {
        console.warn('VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.');
        const yaw = THREE.MathUtils.RAD2DEG * euler.y;
        const pitch = THREE.MathUtils.RAD2DEG * euler.x;
        this.applyYawPitch(yaw, pitch);
    }
    /**
     * Get a quaternion that rotates the +Z unit vector of the humanoid Head to the {@link faceFront} direction.
     *
     * @param target A target `THREE.Vector3`
     */
    _getFaceFrontQuaternion(target) {
        if (this.faceFront.distanceToSquared(VEC3_POSITIVE_Z) < 0.01) {
            return target.identity();
        }
        const [faceFrontAzimuth, faceFrontAltitude] = calcAzimuthAltitude(this.faceFront);
        _eulerA.set(0.0, 0.5 * Math.PI + faceFrontAzimuth, faceFrontAltitude, 'YZX');
        return target.setFromEuler(_eulerA);
    }
}
/**
 * Represent its type of applier.
 */
VRMLookAtBoneApplier.type = 'bone';

/**
 * A class that applies eye gaze directions to a VRM.
 * It will be used by {@link VRMLookAt}.
 */
class VRMLookAtExpressionApplier {
    /**
     * Create a new {@link VRMLookAtExpressionApplier}.
     *
     * @param expressions A {@link VRMExpressionManager}
     * @param rangeMapHorizontalInner A {@link VRMLookAtRangeMap} used for inner transverse direction
     * @param rangeMapHorizontalOuter A {@link VRMLookAtRangeMap} used for outer transverse direction
     * @param rangeMapVerticalDown A {@link VRMLookAtRangeMap} used for down direction
     * @param rangeMapVerticalUp A {@link VRMLookAtRangeMap} used for up direction
     */
    constructor(expressions, rangeMapHorizontalInner, rangeMapHorizontalOuter, rangeMapVerticalDown, rangeMapVerticalUp) {
        this.expressions = expressions;
        this.rangeMapHorizontalInner = rangeMapHorizontalInner;
        this.rangeMapHorizontalOuter = rangeMapHorizontalOuter;
        this.rangeMapVerticalDown = rangeMapVerticalDown;
        this.rangeMapVerticalUp = rangeMapVerticalUp;
    }
    /**
     * Apply the input angle to its associated VRM model.
     *
     * @param yaw Rotation around Y axis, in degree
     * @param pitch Rotation around X axis, in degree
     */
    applyYawPitch(yaw, pitch) {
        if (pitch < 0.0) {
            this.expressions.setValue('lookDown', 0.0);
            this.expressions.setValue('lookUp', this.rangeMapVerticalUp.map(-pitch));
        }
        else {
            this.expressions.setValue('lookUp', 0.0);
            this.expressions.setValue('lookDown', this.rangeMapVerticalDown.map(pitch));
        }
        if (yaw < 0.0) {
            this.expressions.setValue('lookLeft', 0.0);
            this.expressions.setValue('lookRight', this.rangeMapHorizontalOuter.map(-yaw));
        }
        else {
            this.expressions.setValue('lookRight', 0.0);
            this.expressions.setValue('lookLeft', this.rangeMapHorizontalOuter.map(yaw));
        }
    }
    /**
     * @deprecated Use {@link applyYawPitch} instead.
     */
    lookAt(euler) {
        console.warn('VRMLookAtBoneApplier: lookAt() is deprecated. use apply() instead.');
        const yaw = THREE.MathUtils.RAD2DEG * euler.y;
        const pitch = THREE.MathUtils.RAD2DEG * euler.x;
        this.applyYawPitch(yaw, pitch);
    }
}
/**
 * Represent its type of applier.
 */
VRMLookAtExpressionApplier.type = 'expression';

class VRMLookAtRangeMap {
    /**
     * Create a new {@link VRMLookAtRangeMap}.
     *
     * @param inputMaxValue The {@link inputMaxValue} of the map
     * @param outputScale The {@link outputScale} of the map
     */
    constructor(inputMaxValue, outputScale) {
        this.inputMaxValue = inputMaxValue;
        this.outputScale = outputScale;
    }
    /**
     * Evaluate an input value and output a mapped value.
     * @param src The input value
     */
    map(src) {
        return this.outputScale * saturate(src / this.inputMaxValue);
    }
}

/**
 * A plugin of GLTFLoader that imports a {@link VRMLookAt} from a VRM extension of a GLTF.
 */
class VRMLookAtLoaderPlugin {
    constructor(parser, options) {
        this.parser = parser;
        this.helperRoot = options === null || options === void 0 ? void 0 : options.helperRoot;
    }
    get name() {
        // We should use the extension name instead but we have multiple plugins for an extension...
        return 'VRMLookAtLoaderPlugin';
    }
    afterRoot(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            const vrmHumanoid = gltf.userData.vrmHumanoid;
            // explicitly distinguish null and undefined
            // since vrmHumanoid might be null as a result
            if (vrmHumanoid === null) {
                return;
            }
            else if (vrmHumanoid === undefined) {
                throw new Error('VRMFirstPersonLoaderPlugin: vrmHumanoid is undefined. VRMHumanoidLoaderPlugin have to be used first');
            }
            const vrmExpressionManager = gltf.userData.vrmExpressionManager;
            if (vrmExpressionManager === null) {
                return;
            }
            else if (vrmExpressionManager === undefined) {
                throw new Error('VRMFirstPersonLoaderPlugin: vrmExpressionManager is undefined. VRMExpressionLoaderPlugin have to be used first');
            }
            gltf.userData.vrmLookAt = yield this._import(gltf, vrmHumanoid, vrmExpressionManager);
        });
    }
    /**
     * Import a {@link VRMLookAt} from a VRM.
     *
     * @param gltf A parsed result of GLTF taken from GLTFLoader
     * @param humanoid A {@link VRMHumanoid} instance that represents the VRM
     * @param expressions A {@link VRMExpressionManager} instance that represents the VRM
     */
    _import(gltf, humanoid, expressions) {
        return __awaiter(this, void 0, void 0, function* () {
            if (humanoid == null || expressions == null) {
                return null;
            }
            const v1Result = yield this._v1Import(gltf, humanoid, expressions);
            if (v1Result) {
                return v1Result;
            }
            const v0Result = yield this._v0Import(gltf, humanoid, expressions);
            if (v0Result) {
                return v0Result;
            }
            return null;
        });
    }
    _v1Import(gltf, humanoid, expressions) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const isVRMUsed = ((_a = json.extensionsUsed) === null || _a === void 0 ? void 0 : _a.indexOf('VRMC_vrm')) !== -1;
            if (!isVRMUsed) {
                return null;
            }
            const extension = (_b = json.extensions) === null || _b === void 0 ? void 0 : _b['VRMC_vrm'];
            if (!extension) {
                return null;
            }
            const specVersion = extension.specVersion;
            if (specVersion !== '1.0-beta') {
                return null;
            }
            const schemaLookAt = extension.lookAt;
            if (!schemaLookAt) {
                return null;
            }
            const defaultOutputScale = schemaLookAt.type === 'expression' ? 1.0 : 10.0;
            const mapHI = this._v1ImportRangeMap(schemaLookAt.rangeMapHorizontalInner, defaultOutputScale);
            const mapHO = this._v1ImportRangeMap(schemaLookAt.rangeMapHorizontalOuter, defaultOutputScale);
            const mapVD = this._v1ImportRangeMap(schemaLookAt.rangeMapVerticalDown, defaultOutputScale);
            const mapVU = this._v1ImportRangeMap(schemaLookAt.rangeMapVerticalUp, defaultOutputScale);
            let applier;
            if (schemaLookAt.type === 'expression') {
                applier = new VRMLookAtExpressionApplier(expressions, mapHI, mapHO, mapVD, mapVU);
            }
            else {
                applier = new VRMLookAtBoneApplier(humanoid, mapHI, mapHO, mapVD, mapVU);
            }
            const lookAt = this._importLookAt(humanoid, applier);
            lookAt.offsetFromHeadBone.fromArray((_c = schemaLookAt.offsetFromHeadBone) !== null && _c !== void 0 ? _c : [0.0, 0.06, 0.0]);
            return lookAt;
        });
    }
    _v1ImportRangeMap(schemaRangeMap, defaultOutputScale) {
        var _a, _b;
        return new VRMLookAtRangeMap((_a = schemaRangeMap === null || schemaRangeMap === void 0 ? void 0 : schemaRangeMap.inputMaxValue) !== null && _a !== void 0 ? _a : 90.0, (_b = schemaRangeMap === null || schemaRangeMap === void 0 ? void 0 : schemaRangeMap.outputScale) !== null && _b !== void 0 ? _b : defaultOutputScale);
    }
    _v0Import(gltf, humanoid, expressions) {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const vrmExt = (_a = json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaFirstPerson = vrmExt.firstPerson;
            if (!schemaFirstPerson) {
                return null;
            }
            const defaultOutputScale = schemaFirstPerson.lookAtTypeName === 'BlendShape' ? 1.0 : 10.0;
            const mapHI = this._v0ImportDegreeMap(schemaFirstPerson.lookAtHorizontalInner, defaultOutputScale);
            const mapHO = this._v0ImportDegreeMap(schemaFirstPerson.lookAtHorizontalOuter, defaultOutputScale);
            const mapVD = this._v0ImportDegreeMap(schemaFirstPerson.lookAtVerticalDown, defaultOutputScale);
            const mapVU = this._v0ImportDegreeMap(schemaFirstPerson.lookAtVerticalUp, defaultOutputScale);
            let applier;
            if (schemaFirstPerson.lookAtTypeName === 'BlendShape') {
                applier = new VRMLookAtExpressionApplier(expressions, mapHI, mapHO, mapVD, mapVU);
            }
            else {
                applier = new VRMLookAtBoneApplier(humanoid, mapHI, mapHO, mapVD, mapVU);
            }
            const lookAt = this._importLookAt(humanoid, applier);
            if (schemaFirstPerson.firstPersonBoneOffset) {
                lookAt.offsetFromHeadBone.set((_b = schemaFirstPerson.firstPersonBoneOffset.x) !== null && _b !== void 0 ? _b : 0.0, (_c = schemaFirstPerson.firstPersonBoneOffset.y) !== null && _c !== void 0 ? _c : 0.06, -((_d = schemaFirstPerson.firstPersonBoneOffset.z) !== null && _d !== void 0 ? _d : 0.0));
            }
            else {
                lookAt.offsetFromHeadBone.set(0.0, 0.06, 0.0);
            }
            // VRM 0.0 are facing Z- instead of Z+
            lookAt.faceFront.set(0.0, 0.0, -1.0);
            if (applier instanceof VRMLookAtBoneApplier) {
                applier.faceFront.set(0.0, 0.0, -1.0);
            }
            return lookAt;
        });
    }
    _v0ImportDegreeMap(schemaDegreeMap, defaultOutputScale) {
        var _a, _b;
        const curve = schemaDegreeMap === null || schemaDegreeMap === void 0 ? void 0 : schemaDegreeMap.curve;
        if (JSON.stringify(curve) !== '[0,0,0,1,1,1,1,0]') {
            console.warn('Curves of LookAtDegreeMap defined in VRM 0.0 are not supported');
        }
        return new VRMLookAtRangeMap((_a = schemaDegreeMap === null || schemaDegreeMap === void 0 ? void 0 : schemaDegreeMap.xRange) !== null && _a !== void 0 ? _a : 90.0, (_b = schemaDegreeMap === null || schemaDegreeMap === void 0 ? void 0 : schemaDegreeMap.yRange) !== null && _b !== void 0 ? _b : defaultOutputScale);
    }
    _importLookAt(humanoid, applier) {
        const lookAt = new VRMLookAt(humanoid, applier);
        if (this.helperRoot) {
            const helper = new VRMLookAtHelper(lookAt);
            this.helperRoot.add(helper);
            helper.renderOrder = this.helperRoot.renderOrder;
        }
        return lookAt;
    }
}

/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Represents a type of applier.
 */
const VRMLookAtTypeName = {
    Bone: 'bone',
    Expression: 'expression',
};

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
 * Yoinked from https://github.com/mrdoob/three.js/blob/master/examples/jsm/loaders/GLTFLoader.js
 */
function resolveURL(url, path) {
    // Invalid URL
    if (typeof url !== 'string' || url === '')
        return '';
    // Host Relative URL
    if (/^https?:\/\//i.test(path) && /^\//.test(url)) {
        path = path.replace(/(^https?:\/\/[^/]+).*/i, '$1');
    }
    // Absolute URL http://,https://,//
    if (/^(https?:)?\/\//i.test(url))
        return url;
    // Data URI
    if (/^data:.*,.*$/i.test(url))
        return url;
    // Blob URL
    if (/^blob:.*$/i.test(url))
        return url;
    // Relative URL
    return path + url;
}

/**
 * A plugin of GLTFLoader that imports a {@link VRM1Meta} from a VRM extension of a GLTF.
 */
class VRMMetaLoaderPlugin {
    constructor(parser, options) {
        var _a, _b, _c;
        this.parser = parser;
        this.needThumbnailImage = (_a = options === null || options === void 0 ? void 0 : options.needThumbnailImage) !== null && _a !== void 0 ? _a : true;
        this.acceptLicenseUrls = (_b = options === null || options === void 0 ? void 0 : options.acceptLicenseUrls) !== null && _b !== void 0 ? _b : ['https://vrm.dev/licenses/1.0/'];
        this.acceptV0Meta = (_c = options === null || options === void 0 ? void 0 : options.acceptV0Meta) !== null && _c !== void 0 ? _c : true;
    }
    get name() {
        // We should use the extension name instead but we have multiple plugins for an extension...
        return 'VRMMetaLoaderPlugin';
    }
    afterRoot(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            gltf.userData.vrmMeta = yield this._import(gltf);
        });
    }
    _import(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            const v1Result = yield this._v1Import(gltf);
            if (v1Result != null) {
                return v1Result;
            }
            const v0Result = yield this._v0Import(gltf);
            if (v0Result != null) {
                return v0Result;
            }
            return null;
        });
    }
    _v1Import(gltf) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const isVRMUsed = ((_a = json.extensionsUsed) === null || _a === void 0 ? void 0 : _a.indexOf('VRMC_vrm')) !== -1;
            if (!isVRMUsed) {
                return null;
            }
            const extension = (_b = json.extensions) === null || _b === void 0 ? void 0 : _b['VRMC_vrm'];
            if (extension == null) {
                return null;
            }
            const specVersion = extension.specVersion;
            if (specVersion !== '1.0-beta') {
                return null;
            }
            const schemaMeta = extension.meta;
            if (!schemaMeta) {
                return null;
            }
            // throw an error if acceptV0Meta is false
            const licenseUrl = schemaMeta.licenseUrl;
            const acceptLicenseUrlsSet = new Set(this.acceptLicenseUrls);
            if (!acceptLicenseUrlsSet.has(licenseUrl)) {
                throw new Error(`VRMMetaLoaderPlugin: The license url "${licenseUrl}" is not accepted`);
            }
            let thumbnailImage = undefined;
            if (this.needThumbnailImage && schemaMeta.thumbnailImage != null) {
                thumbnailImage = (_c = (yield this._extractGLTFImage(schemaMeta.thumbnailImage))) !== null && _c !== void 0 ? _c : undefined;
            }
            return {
                metaVersion: '1',
                name: schemaMeta.name,
                version: schemaMeta.version,
                authors: schemaMeta.authors,
                copyrightInformation: schemaMeta.copyrightInformation,
                contactInformation: schemaMeta.contactInformation,
                references: schemaMeta.references,
                thirdPartyLicenses: schemaMeta.thirdPartyLicenses,
                thumbnailImage,
                licenseUrl: schemaMeta.licenseUrl,
                avatarPermission: schemaMeta.avatarPermission,
                allowExcessivelyViolentUsage: schemaMeta.allowExcessivelyViolentUsage,
                allowExcessivelySexualUsage: schemaMeta.allowExcessivelySexualUsage,
                commercialUsage: schemaMeta.commercialUsage,
                allowPoliticalOrReligiousUsage: schemaMeta.allowPoliticalOrReligiousUsage,
                allowAntisocialOrHateUsage: schemaMeta.allowAntisocialOrHateUsage,
                creditNotation: schemaMeta.creditNotation,
                allowRedistribution: schemaMeta.allowRedistribution,
                modification: schemaMeta.modification,
                otherLicenseUrl: schemaMeta.otherLicenseUrl,
            };
        });
    }
    _v0Import(gltf) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            // early abort if it doesn't use vrm
            const vrmExt = (_a = json.extensions) === null || _a === void 0 ? void 0 : _a.VRM;
            if (!vrmExt) {
                return null;
            }
            const schemaMeta = vrmExt.meta;
            if (!schemaMeta) {
                return null;
            }
            // throw an error if acceptV0Meta is false
            if (!this.acceptV0Meta) {
                throw new Error('VRMMetaLoaderPlugin: Attempted to load VRM0.0 meta but acceptV0Meta is false');
            }
            // load thumbnail texture
            let texture;
            if (this.needThumbnailImage && schemaMeta.texture != null && schemaMeta.texture !== -1) {
                texture = yield this.parser.getDependency('texture', schemaMeta.texture);
            }
            return {
                metaVersion: '0',
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
    _extractGLTFImage(index) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const json = this.parser.json;
            const source = (_a = json.images) === null || _a === void 0 ? void 0 : _a[index];
            if (source == null) {
                console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${index}] of glTF as a thumbnail but the image doesn't exist`);
                return null;
            }
            // Ref: https://github.com/mrdoob/three.js/blob/r124/examples/jsm/loaders/GLTFLoader.js#L2467
            // `source.uri` might be a reference to a file
            let sourceURI = source.uri;
            // Load the binary as a blob
            if (source.bufferView != null) {
                const bufferView = yield this.parser.getDependency('bufferView', source.bufferView);
                const blob = new Blob([bufferView], { type: source.mimeType });
                sourceURI = URL.createObjectURL(blob);
            }
            if (sourceURI == null) {
                console.warn(`VRMMetaLoaderPlugin: Attempt to use images[${index}] of glTF as a thumbnail but the image couldn't load properly`);
                return null;
            }
            const loader = new THREE.ImageLoader();
            return yield loader.loadAsync(resolveURL(sourceURI, this.parser.options.path)).catch((error) => {
                console.error(error);
                console.warn('VRMMetaLoaderPlugin: Failed to load a thumbnail image');
                return null;
            });
        });
    }
}

/**
 * A class that represents a single VRM model.
 * This class only includes core spec of the VRM (`VRMC_vrm`).
 */
class VRMCore {
    /**
     * Create a new VRM instance.
     *
     * @param params [[VRMParameters]] that represents components of the VRM
     */
    constructor(params) {
        this.scene = params.scene;
        this.meta = params.meta;
        this.humanoid = params.humanoid;
        this.expressionManager = params.expressionManager;
        this.firstPerson = params.firstPerson;
        this.lookAt = params.lookAt;
    }
    /**
     * **You need to call this on your update loop.**
     *
     * This function updates every VRM components.
     *
     * @param delta deltaTime
     */
    update(delta) {
        this.humanoid.update();
        if (this.lookAt) {
            this.lookAt.update(delta);
        }
        if (this.expressionManager) {
            this.expressionManager.update();
        }
    }
}

class VRMCoreLoaderPlugin {
    constructor(parser, options) {
        var _a, _b, _c, _d, _e;
        this.parser = parser;
        const helperRoot = options === null || options === void 0 ? void 0 : options.helperRoot;
        const autoUpdateHumanBones = options === null || options === void 0 ? void 0 : options.autoUpdateHumanBones;
        this.expressionPlugin = (_a = options === null || options === void 0 ? void 0 : options.expressionPlugin) !== null && _a !== void 0 ? _a : new VRMExpressionLoaderPlugin(parser);
        this.firstPersonPlugin = (_b = options === null || options === void 0 ? void 0 : options.firstPersonPlugin) !== null && _b !== void 0 ? _b : new VRMFirstPersonLoaderPlugin(parser);
        this.humanoidPlugin = (_c = options === null || options === void 0 ? void 0 : options.humanoidPlugin) !== null && _c !== void 0 ? _c : new VRMHumanoidLoaderPlugin(parser, { helperRoot, autoUpdateHumanBones });
        this.lookAtPlugin = (_d = options === null || options === void 0 ? void 0 : options.lookAtPlugin) !== null && _d !== void 0 ? _d : new VRMLookAtLoaderPlugin(parser, { helperRoot });
        this.metaPlugin = (_e = options === null || options === void 0 ? void 0 : options.metaPlugin) !== null && _e !== void 0 ? _e : new VRMMetaLoaderPlugin(parser);
    }
    get name() {
        // We should use the extension name instead but we have multiple plugins for an extension...
        return 'VRMC_vrm';
    }
    afterRoot(gltf) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.metaPlugin.afterRoot(gltf);
            yield this.humanoidPlugin.afterRoot(gltf);
            yield this.expressionPlugin.afterRoot(gltf);
            yield this.lookAtPlugin.afterRoot(gltf);
            yield this.firstPersonPlugin.afterRoot(gltf);
            const meta = gltf.userData.vrmMeta;
            const humanoid = gltf.userData.vrmHumanoid;
            // meta and humanoid are required to be a VRM.
            // Don't create VRM if they are null
            if (meta && humanoid) {
                const vrmCore = new VRMCore({
                    scene: gltf.scene,
                    expressionManager: gltf.userData.vrmExpressionManager,
                    firstPerson: gltf.userData.vrmFirstPerson,
                    humanoid,
                    lookAt: gltf.userData.vrmLookAt,
                    meta,
                });
                gltf.userData.vrmCore = vrmCore;
            }
        });
    }
}

export { VRMCore, VRMCoreLoaderPlugin, VRMCurveMapper, VRMExpression, VRMExpressionLoaderPlugin, VRMExpressionManager, VRMExpressionMaterialColorType, VRMExpressionOverrideType, VRMExpressionPresetName, VRMFirstPerson, VRMFirstPersonLoaderPlugin, VRMFirstPersonMeshAnnotationType, VRMHumanBoneList, VRMHumanBoneName, VRMHumanBoneParentMap, VRMHumanoid, VRMHumanoidHelper, VRMHumanoidLoaderPlugin, VRMLookAt, VRMLookAtBoneApplier, VRMLookAtExpressionApplier, VRMLookAtHelper, VRMLookAtLoaderPlugin, VRMLookAtRangeMap, VRMLookAtTypeName, VRMMetaLoaderPlugin, VRMRequiredHumanBoneName };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLWNvcmUubW9kdWxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvZXhwcmVzc2lvbnMvVlJNRXhwcmVzc2lvbi50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy90c2xpYi90c2xpYi5lczYuanMiLCIuLi9zcmMvdXRpbHMvZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUudHMiLCIuLi9zcmMvdXRpbHMvZ2x0ZkdldEFzc29jaWF0ZWRNYXRlcmlhbEluZGV4LnRzIiwiLi4vc3JjL2V4cHJlc3Npb25zL1ZSTUV4cHJlc3Npb25QcmVzZXROYW1lLnRzIiwiLi4vc3JjL3V0aWxzL3NhdHVyYXRlLnRzIiwiLi4vc3JjL2V4cHJlc3Npb25zL1ZSTUV4cHJlc3Npb25NYW5hZ2VyLnRzIiwiLi4vc3JjL2V4cHJlc3Npb25zL1ZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZS50cyIsIi4uL3NyYy9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQudHMiLCIuLi9zcmMvZXhwcmVzc2lvbnMvVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZC50cyIsIi4uL3NyYy9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uVGV4dHVyZVRyYW5zZm9ybUJpbmQudHMiLCIuLi9zcmMvZXhwcmVzc2lvbnMvVlJNRXhwcmVzc2lvbkxvYWRlclBsdWdpbi50cyIsIi4uL3NyYy9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlLnRzIiwiLi4vc3JjL2ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uLnRzIiwiLi4vc3JjL2ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uTG9hZGVyUGx1Z2luLnRzIiwiLi4vc3JjL2ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlLnRzIiwiLi4vc3JjL2h1bWFub2lkL2hlbHBlcnMvVlJNSHVtYW5vaWRIZWxwZXIudHMiLCIuLi9zcmMvaHVtYW5vaWQvVlJNSHVtYW5Cb25lTGlzdC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbkJvbmVOYW1lLnRzIiwiLi4vc3JjL2h1bWFub2lkL1ZSTUh1bWFuQm9uZVBhcmVudE1hcC50cyIsIi4uL3NyYy91dGlscy9xdWF0SW52ZXJ0Q29tcGF0LnRzIiwiLi4vc3JjL2h1bWFub2lkL1ZSTVJpZy50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZFJpZy50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1IdW1hbm9pZC50cyIsIi4uL3NyYy9odW1hbm9pZC9WUk1SZXF1aXJlZEh1bWFuQm9uZU5hbWUudHMiLCIuLi9zcmMvaHVtYW5vaWQvVlJNSHVtYW5vaWRMb2FkZXJQbHVnaW4udHMiLCIuLi9zcmMvbG9va0F0L2hlbHBlcnMvdXRpbHMvRmFuQnVmZmVyR2VvbWV0cnkudHMiLCIuLi9zcmMvbG9va0F0L2hlbHBlcnMvdXRpbHMvTGluZUFuZFNwaGVyZUJ1ZmZlckdlb21ldHJ5LnRzIiwiLi4vc3JjL2xvb2tBdC9oZWxwZXJzL1ZSTUxvb2tBdEhlbHBlci50cyIsIi4uL3NyYy91dGlscy9nZXRXb3JsZFF1YXRlcm5pb25MaXRlLnRzIiwiLi4vc3JjL2xvb2tBdC91dGlscy9jYWxjQXppbXV0aEFsdGl0dWRlLnRzIiwiLi4vc3JjL2xvb2tBdC91dGlscy9zYW5pdGl6ZUFuZ2xlLnRzIiwiLi4vc3JjL2xvb2tBdC9WUk1Mb29rQXQudHMiLCIuLi9zcmMvbG9va0F0L1ZSTUxvb2tBdEJvbmVBcHBsaWVyLnRzIiwiLi4vc3JjL2xvb2tBdC9WUk1Mb29rQXRFeHByZXNzaW9uQXBwbGllci50cyIsIi4uL3NyYy9sb29rQXQvVlJNTG9va0F0UmFuZ2VNYXAudHMiLCIuLi9zcmMvbG9va0F0L1ZSTUxvb2tBdExvYWRlclBsdWdpbi50cyIsIi4uL3NyYy9sb29rQXQvVlJNTG9va0F0VHlwZU5hbWUudHMiLCIuLi9zcmMvbG9va0F0L1ZSTUN1cnZlTWFwcGVyLnRzIiwiLi4vc3JjL3V0aWxzL3Jlc29sdmVVUkwudHMiLCIuLi9zcmMvbWV0YS9WUk1NZXRhTG9hZGVyUGx1Z2luLnRzIiwiLi4vc3JjL1ZSTUNvcmUudHMiLCIuLi9zcmMvVlJNQ29yZUxvYWRlclBsdWdpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTUV4cHJlc3Npb25CaW5kIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uQmluZCc7XHJcbmltcG9ydCB0eXBlIHsgVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZSB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZSc7XHJcblxyXG4vLyBhbmltYXRpb25NaXhlciDjga7nm6Poppblr77osaHjga/jgIFTY2VuZSDjga7kuK3jgavlhaXjgaPjgabjgYTjgovlv4XopoHjgYzjgYLjgovjgIJcclxuLy8g44Gd44Gu44Gf44KB44CB6KGo56S644Kq44OW44K444Kn44Kv44OI44Gn44Gv44Gq44GE44GR44KM44Gp44CBT2JqZWN0M0Qg44KS57aZ5om/44GX44GmIFNjZW5lIOOBq+aKleWFpeOBp+OBjeOCi+OCiOOBhuOBq+OBmeOCi+OAglxyXG5leHBvcnQgY2xhc3MgVlJNRXhwcmVzc2lvbiBleHRlbmRzIFRIUkVFLk9iamVjdDNEIHtcclxuICAvKipcclxuICAgKiBOYW1lIG9mIHRoaXMgZXhwcmVzc2lvbi5cclxuICAgKiBEaXN0aW5ndWlzaGVkIHdpdGggYG5hbWVgIHNpbmNlIGBuYW1lYCB3aWxsIGJlIGNvbmZsaWN0ZWQgd2l0aCBPYmplY3QzRC5cclxuICAgKi9cclxuICBwdWJsaWMgZXhwcmVzc2lvbk5hbWU6IHN0cmluZztcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIGN1cnJlbnQgd2VpZ2h0IG9mIHRoZSBleHByZXNzaW9uLlxyXG4gICAqL1xyXG4gIHB1YmxpYyB3ZWlnaHQgPSAwLjA7XHJcblxyXG4gIC8qKlxyXG4gICAqIEludGVycHJldCBub24temVybyB2YWx1ZXMgYXMgMS5cclxuICAgKi9cclxuICBwdWJsaWMgaXNCaW5hcnkgPSBmYWxzZTtcclxuXHJcbiAgLyoqXHJcbiAgICogU3BlY2lmeSBob3cgdGhlIGV4cHJlc3Npb24gb3ZlcnJpZGVzIGJsaW5rIGV4cHJlc3Npb25zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBvdmVycmlkZUJsaW5rOiBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlID0gJ25vbmUnO1xyXG5cclxuICAvKipcclxuICAgKiBTcGVjaWZ5IGhvdyB0aGUgZXhwcmVzc2lvbiBvdmVycmlkZXMgbG9va0F0IGV4cHJlc3Npb25zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBvdmVycmlkZUxvb2tBdDogVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZSA9ICdub25lJztcclxuXHJcbiAgLyoqXHJcbiAgICogU3BlY2lmeSBob3cgdGhlIGV4cHJlc3Npb24gb3ZlcnJpZGVzIG1vdXRoIGV4cHJlc3Npb25zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBvdmVycmlkZU1vdXRoOiBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlID0gJ25vbmUnO1xyXG5cclxuICBwcml2YXRlIF9iaW5kczogVlJNRXhwcmVzc2lvbkJpbmRbXSA9IFtdO1xyXG5cclxuICAvKipcclxuICAgKiBBIHZhbHVlIHJlcHJlc2VudHMgaG93IG11Y2ggaXQgc2hvdWxkIG92ZXJyaWRlIGJsaW5rIGV4cHJlc3Npb25zLlxyXG4gICAqIGAwLjBgID09IG5vIG92ZXJyaWRlIGF0IGFsbCwgYDEuMGAgPT0gY29tcGxldGVseSBibG9jayB0aGUgZXhwcmVzc2lvbnMuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBvdmVycmlkZUJsaW5rQW1vdW50KCk6IG51bWJlciB7XHJcbiAgICBpZiAodGhpcy5vdmVycmlkZUJsaW5rID09PSAnYmxvY2snKSB7XHJcbiAgICAgIHJldHVybiAwLjAgPCB0aGlzLndlaWdodCA/IDEuMCA6IDAuMDtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5vdmVycmlkZUJsaW5rID09PSAnYmxlbmQnKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLndlaWdodDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiAwLjA7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBIHZhbHVlIHJlcHJlc2VudHMgaG93IG11Y2ggaXQgc2hvdWxkIG92ZXJyaWRlIGxvb2tBdCBleHByZXNzaW9ucy5cclxuICAgKiBgMC4wYCA9PSBubyBvdmVycmlkZSBhdCBhbGwsIGAxLjBgID09IGNvbXBsZXRlbHkgYmxvY2sgdGhlIGV4cHJlc3Npb25zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgb3ZlcnJpZGVMb29rQXRBbW91bnQoKTogbnVtYmVyIHtcclxuICAgIGlmICh0aGlzLm92ZXJyaWRlTG9va0F0ID09PSAnYmxvY2snKSB7XHJcbiAgICAgIHJldHVybiAwLjAgPCB0aGlzLndlaWdodCA/IDEuMCA6IDAuMDtcclxuICAgIH0gZWxzZSBpZiAodGhpcy5vdmVycmlkZUxvb2tBdCA9PT0gJ2JsZW5kJykge1xyXG4gICAgICByZXR1cm4gdGhpcy53ZWlnaHQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gMC4wO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSB2YWx1ZSByZXByZXNlbnRzIGhvdyBtdWNoIGl0IHNob3VsZCBvdmVycmlkZSBtb3V0aCBleHByZXNzaW9ucy5cclxuICAgKiBgMC4wYCA9PSBubyBvdmVycmlkZSBhdCBhbGwsIGAxLjBgID09IGNvbXBsZXRlbHkgYmxvY2sgdGhlIGV4cHJlc3Npb25zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgb3ZlcnJpZGVNb3V0aEFtb3VudCgpOiBudW1iZXIge1xyXG4gICAgaWYgKHRoaXMub3ZlcnJpZGVNb3V0aCA9PT0gJ2Jsb2NrJykge1xyXG4gICAgICByZXR1cm4gMC4wIDwgdGhpcy53ZWlnaHQgPyAxLjAgOiAwLjA7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMub3ZlcnJpZGVNb3V0aCA9PT0gJ2JsZW5kJykge1xyXG4gICAgICByZXR1cm4gdGhpcy53ZWlnaHQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gMC4wO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgY29uc3RydWN0b3IoZXhwcmVzc2lvbk5hbWU6IHN0cmluZykge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLm5hbWUgPSBgVlJNRXhwcmVzc2lvbl8ke2V4cHJlc3Npb25OYW1lfWA7XHJcbiAgICB0aGlzLmV4cHJlc3Npb25OYW1lID0gZXhwcmVzc2lvbk5hbWU7XHJcblxyXG4gICAgLy8gdHJhdmVyc2Ug5pmC44Gu5pWR5riI5omL5q6144Go44GX44GmIE9iamVjdDNEIOOBp+OBr+OBquOBhOOBk+OBqOOCkuaYjuekuuOBl+OBpuOBiuOBj1xyXG4gICAgdGhpcy50eXBlID0gJ1ZSTUV4cHJlc3Npb24nO1xyXG4gICAgLy8g6KGo56S655uu55qE44Gu44Kq44OW44K444Kn44Kv44OI44Gn44Gv44Gq44GE44Gu44Gn44CB6LKg6I236Lu95rib44Gu44Gf44KB44GrIHZpc2libGUg44KSIGZhbHNlIOOBq+OBl+OBpuOBiuOBj+OAglxyXG4gICAgLy8g44GT44KM44Gr44KI44KK44CB44GT44Gu44Kk44Oz44K544K/44Oz44K544Gr5a++44GZ44KL5q+O44OV44Os44O844Og44GuIG1hdHJpeCDoh6rli5XoqIjnrpfjgpLnnIHnlaXjgafjgY3jgovjgIJcclxuICAgIHRoaXMudmlzaWJsZSA9IGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFkZEJpbmQoYmluZDogVlJNRXhwcmVzc2lvbkJpbmQpOiB2b2lkIHtcclxuICAgIHRoaXMuX2JpbmRzLnB1c2goYmluZCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBcHBseSB3ZWlnaHQgdG8gZXZlcnkgYXNzaWduZWQgYmxlbmQgc2hhcGVzLlxyXG4gICAqIFNob3VsZCBiZSBjYWxsZWQgZXZlcnkgZnJhbWUuXHJcbiAgICovXHJcbiAgcHVibGljIGFwcGx5V2VpZ2h0KG9wdGlvbnM/OiB7XHJcbiAgICAvKipcclxuICAgICAqIE11bHRpcGxpZXMgYSB2YWx1ZSB0byBpdHMgd2VpZ2h0IHRvIGFwcGx5LlxyXG4gICAgICogSW50ZW5kZWQgdG8gYmUgdXNlZCBmb3Igb3ZlcnJpZGluZyBhbiBleHByZXNzaW9uIHdlaWdodCBieSBhbm90aGVyIGV4cHJlc3Npb24uXHJcbiAgICAgKiBTZWUgYWxzbzoge0BsaW5rIG92ZXJyaWRlQmxpbmt9LCB7QGxpbmsgb3ZlcnJpZGVMb29rQXR9LCB7QGxpbmsgb3ZlcnJpZGVNb3V0aH1cclxuICAgICAqL1xyXG4gICAgbXVsdGlwbGllcj86IG51bWJlcjtcclxuICB9KTogdm9pZCB7XHJcbiAgICBsZXQgYWN0dWFsV2VpZ2h0ID0gdGhpcy5pc0JpbmFyeSA/ICh0aGlzLndlaWdodCA9PT0gMC4wID8gMC4wIDogMS4wKSA6IHRoaXMud2VpZ2h0O1xyXG4gICAgYWN0dWFsV2VpZ2h0ICo9IG9wdGlvbnM/Lm11bHRpcGxpZXIgPz8gMS4wO1xyXG5cclxuICAgIHRoaXMuX2JpbmRzLmZvckVhY2goKGJpbmQpID0+IGJpbmQuYXBwbHlXZWlnaHQoYWN0dWFsV2VpZ2h0KSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDbGVhciBwcmV2aW91c2x5IGFzc2lnbmVkIGJsZW5kIHNoYXBlcy5cclxuICAgKi9cclxuICBwdWJsaWMgY2xlYXJBcHBsaWVkV2VpZ2h0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5fYmluZHMuZm9yRWFjaCgoYmluZCkgPT4gYmluZC5jbGVhckFwcGxpZWRXZWlnaHQoKSk7XHJcbiAgfVxyXG59XHJcbiIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBmcm9tLmxlbmd0aCwgaiA9IHRvLmxlbmd0aDsgaSA8IGlsOyBpKyssIGorKylcclxuICAgICAgICB0b1tqXSA9IGZyb21baV07XHJcbiAgICByZXR1cm4gdG87XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHByaXZhdGVNYXApIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBnZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcHJpdmF0ZU1hcC5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgcHJpdmF0ZU1hcCwgdmFsdWUpIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBzZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICBwcml2YXRlTWFwLnNldChyZWNlaXZlciwgdmFsdWUpO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59XHJcbiIsImltcG9ydCB0eXBlIHsgR0xURiB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xyXG5pbXBvcnQgeyBHTFRGIGFzIEdMVEZTY2hlbWEgfSBmcm9tICdAZ2x0Zi10cmFuc2Zvcm0vY29yZSc7XHJcblxyXG5mdW5jdGlvbiBleHRyYWN0UHJpbWl0aXZlc0ludGVybmFsKGdsdGY6IEdMVEYsIG5vZGVJbmRleDogbnVtYmVyLCBub2RlOiBUSFJFRS5PYmplY3QzRCk6IFRIUkVFLk1lc2hbXSB8IG51bGwge1xyXG4gIGNvbnN0IGpzb24gPSBnbHRmLnBhcnNlci5qc29uIGFzIEdMVEZTY2hlbWEuSUdMVEY7XHJcblxyXG4gIC8qKlxyXG4gICAqIExldCdzIGxpc3QgdXAgZXZlcnkgcG9zc2libGUgcGF0dGVybnMgdGhhdCBwYXJzZWQgZ2x0ZiBub2RlcyB3aXRoIGEgbWVzaCBjYW4gaGF2ZSwsLFxyXG4gICAqXHJcbiAgICogXCIqXCIgaW5kaWNhdGVzIHRoYXQgdGhvc2UgbWVzaGVzIHNob3VsZCBiZSBsaXN0ZWQgdXAgdXNpbmcgdGhpcyBmdW5jdGlvblxyXG4gICAqXHJcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIGEgc2lnbmxlIHByaW1pdGl2ZSlcclxuICAgKlxyXG4gICAqIC0gYFRIUkVFLk1lc2hgOiBUaGUgb25seSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKlxyXG4gICAqXHJcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpXHJcbiAgICpcclxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXHJcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKlxyXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXHJcbiAgICpcclxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBhIHNpbmdsZSBwcmltaXRpdmUpXHJcbiAgICpcclxuICAgKiAtIGBUSFJFRS5Hcm91cGA6IFRoZSByb290IG9mIHRoZSBtZXNoXHJcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKlxyXG4gICAqICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXHJcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxyXG4gICAqXHJcbiAgICogIyMjIEEgbm9kZSB3aXRoIGEgKG1lc2gsIG11bHRpcGxlIHByaW1pdGl2ZXMpIEFORCAoYSBjaGlsZCB3aXRoIGEgbWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcylcclxuICAgKlxyXG4gICAqIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcclxuICAgKiAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCAqXHJcbiAgICogICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcclxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxyXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggb2YgdGhlIGNoaWxkXHJcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGQgKDIpXHJcbiAgICpcclxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQlVUIHRoZSBub2RlIGlzIGEgYm9uZVxyXG4gICAqXHJcbiAgICogLSBgVEhSRUUuQm9uZWA6IFRoZSByb290IG9mIHRoZSBub2RlLCBhcyBhIGJvbmVcclxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgdGhlIG1lc2hcclxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICpcclxuICAgKiAgICAgLSBgVEhSRUUuTWVzaGA6IEEgcHJpbWl0aXZlIG9mIHRoZSBtZXNoICgyKSAqXHJcbiAgICpcclxuICAgKiAjIyMgQSBub2RlIHdpdGggYSAobWVzaCwgbXVsdGlwbGUgcHJpbWl0aXZlcykgQU5EIChhIGNoaWxkIHdpdGggYSBtZXNoLCBtdWx0aXBsZSBwcmltaXRpdmVzKSBCVVQgdGhlIG5vZGUgaXMgYSBib25lXHJcbiAgICpcclxuICAgKiAtIGBUSFJFRS5Cb25lYDogVGhlIHJvb3Qgb2YgdGhlIG5vZGUsIGFzIGEgYm9uZVxyXG4gICAqICAgLSBgVEhSRUUuR3JvdXBgOiBUaGUgcm9vdCBvZiB0aGUgbWVzaFxyXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKlxyXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggKDIpICpcclxuICAgKiAgIC0gYFRIUkVFLkdyb3VwYDogVGhlIHJvb3Qgb2YgYSBNRVNIIE9GIFRIRSBDSElMRFxyXG4gICAqICAgICAtIGBUSFJFRS5NZXNoYDogQSBwcmltaXRpdmUgb2YgdGhlIG1lc2ggb2YgdGhlIGNoaWxkXHJcbiAgICogICAgIC0gYFRIUkVFLk1lc2hgOiBBIHByaW1pdGl2ZSBvZiB0aGUgbWVzaCBvZiB0aGUgY2hpbGQgKDIpXHJcbiAgICpcclxuICAgKiAuLi5JIHdpbGwgdGFrZSBhIHN0cmF0ZWd5IHRoYXQgdHJhdmVyc2VzIHRoZSByb290IG9mIHRoZSBub2RlIGFuZCB0YWtlIGZpcnN0IChwcmltaXRpdmVDb3VudCkgbWVzaGVzLlxyXG4gICAqL1xyXG5cclxuICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgbm9kZSBoYXMgYSBtZXNoXHJcbiAgY29uc3Qgc2NoZW1hTm9kZSA9IGpzb24ubm9kZXM/Lltub2RlSW5kZXhdO1xyXG4gIGlmIChzY2hlbWFOb2RlID09IG51bGwpIHtcclxuICAgIGNvbnNvbGUud2FybihgZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbDogQXR0ZW1wdCB0byB1c2Ugbm9kZXNbJHtub2RlSW5kZXh9XSBvZiBnbFRGIGJ1dCB0aGUgbm9kZSBkb2Vzbid0IGV4aXN0YCk7XHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIGNvbnN0IG1lc2hJbmRleCA9IHNjaGVtYU5vZGUubWVzaDtcclxuICBpZiAobWVzaEluZGV4ID09IG51bGwpIHtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgLy8gSG93IG1hbnkgcHJpbWl0aXZlcyB0aGUgbWVzaCBoYXM/XHJcbiAgY29uc3Qgc2NoZW1hTWVzaCA9IGpzb24ubWVzaGVzPy5bbWVzaEluZGV4XTtcclxuICBpZiAoc2NoZW1hTWVzaCA9PSBudWxsKSB7XHJcbiAgICBjb25zb2xlLndhcm4oYGV4dHJhY3RQcmltaXRpdmVzSW50ZXJuYWw6IEF0dGVtcHQgdG8gdXNlIG1lc2hlc1ske21lc2hJbmRleH1dIG9mIGdsVEYgYnV0IHRoZSBtZXNoIGRvZXNuJ3QgZXhpc3RgKTtcclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgcHJpbWl0aXZlQ291bnQgPSBzY2hlbWFNZXNoLnByaW1pdGl2ZXMubGVuZ3RoO1xyXG5cclxuICAvLyBUcmF2ZXJzZSB0aGUgbm9kZSBhbmQgdGFrZSBmaXJzdCAocHJpbWl0aXZlQ291bnQpIG1lc2hlc1xyXG4gIGNvbnN0IHByaW1pdGl2ZXM6IFRIUkVFLk1lc2hbXSA9IFtdO1xyXG4gIG5vZGUudHJhdmVyc2UoKG9iamVjdCkgPT4ge1xyXG4gICAgaWYgKHByaW1pdGl2ZXMubGVuZ3RoIDwgcHJpbWl0aXZlQ291bnQpIHtcclxuICAgICAgaWYgKChvYmplY3QgYXMgYW55KS5pc01lc2gpIHtcclxuICAgICAgICBwcmltaXRpdmVzLnB1c2gob2JqZWN0IGFzIFRIUkVFLk1lc2gpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiBwcmltaXRpdmVzO1xyXG59XHJcblxyXG4vKipcclxuICogRXh0cmFjdCBwcmltaXRpdmVzICggYFRIUkVFLk1lc2hbXWAgKSBvZiBhIG5vZGUgZnJvbSBhIGxvYWRlZCBHTFRGLlxyXG4gKiBUaGUgbWFpbiBwdXJwb3NlIG9mIHRoaXMgZnVuY3Rpb24gaXMgdG8gZGlzdGluZ3Vpc2ggcHJpbWl0aXZlcyBhbmQgY2hpbGRyZW4gZnJvbSBhIG5vZGUgdGhhdCBoYXMgYm90aCBtZXNoZXMgYW5kIGNoaWxkcmVuLlxyXG4gKlxyXG4gKiBJdCB1dGlsaXplcyB0aGUgYmVoYXZpb3IgdGhhdCBHTFRGTG9hZGVyIGFkZHMgbWVzaCBwcmltaXRpdmVzIHRvIHRoZSBub2RlIG9iamVjdCAoIGBUSFJFRS5Hcm91cGAgKSBmaXJzdCB0aGVuIGFkZHMgaXRzIGNoaWxkcmVuLlxyXG4gKlxyXG4gKiBAcGFyYW0gZ2x0ZiBBIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gKiBAcGFyYW0gbm9kZUluZGV4IFRoZSBpbmRleCBvZiB0aGUgbm9kZVxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlKGdsdGY6IEdMVEYsIG5vZGVJbmRleDogbnVtYmVyKTogUHJvbWlzZTxUSFJFRS5NZXNoW10gfCBudWxsPiB7XHJcbiAgY29uc3Qgbm9kZTogVEhSRUUuT2JqZWN0M0QgPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmN5KCdub2RlJywgbm9kZUluZGV4KTtcclxuICByZXR1cm4gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmLCBub2RlSW5kZXgsIG5vZGUpO1xyXG59XHJcblxyXG4vKipcclxuICogRXh0cmFjdCBwcmltaXRpdmVzICggYFRIUkVFLk1lc2hbXWAgKSBvZiBub2RlcyBmcm9tIGEgbG9hZGVkIEdMVEYuXHJcbiAqIFNlZSB7QGxpbmsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGV9IGZvciBtb3JlIGRldGFpbHMuXHJcbiAqXHJcbiAqIEl0IHJldHVybnMgYSBtYXAgZnJvbSBub2RlIGluZGV4IHRvIGV4dHJhY3Rpb24gcmVzdWx0LlxyXG4gKiBJZiBhIG5vZGUgZG9lcyBub3QgaGF2ZSBhIG1lc2gsIHRoZSBlbnRyeSBmb3IgdGhlIG5vZGUgd2lsbCBub3QgYmUgcHV0IGluIHRoZSByZXR1cm5pbmcgbWFwLlxyXG4gKlxyXG4gKiBAcGFyYW0gZ2x0ZiBBIEdMVEYgb2JqZWN0IHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gKi9cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyhnbHRmOiBHTFRGKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBUSFJFRS5NZXNoW10+PiB7XHJcbiAgY29uc3Qgbm9kZXM6IFRIUkVFLk9iamVjdDNEW10gPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmNpZXMoJ25vZGUnKTtcclxuICBjb25zdCBtYXAgPSBuZXcgTWFwPG51bWJlciwgVEhSRUUuTWVzaFtdPigpO1xyXG5cclxuICBub2Rlcy5mb3JFYWNoKChub2RlLCBpbmRleCkgPT4ge1xyXG4gICAgY29uc3QgcmVzdWx0ID0gZXh0cmFjdFByaW1pdGl2ZXNJbnRlcm5hbChnbHRmLCBpbmRleCwgbm9kZSk7XHJcbiAgICBpZiAocmVzdWx0ICE9IG51bGwpIHtcclxuICAgICAgbWFwLnNldChpbmRleCwgcmVzdWx0KTtcclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIG1hcDtcclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEZQYXJzZXIgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcclxuXHJcbi8qKlxyXG4gKiBHZXQgYSBtYXRlcmlhbCBkZWZpbml0aW9uIGluZGV4IG9mIGdsVEYgZnJvbSBhc3NvY2lhdGVkIG1hdGVyaWFsLlxyXG4gKiBJdCdzIGJhc2ljYWxseSBhIGNvbWF0IGNvZGUgYmV0d2VlbiBUaHJlZS5qcyByMTMzIG9yIGFib3ZlIGFuZCBwcmV2aW91cyB2ZXJzaW9ucy5cclxuICogQHBhcmFtIHBhcnNlciBHTFRGUGFyc2VyXHJcbiAqIEBwYXJhbSBtYXRlcmlhbCBBIG1hdGVyaWFsIG9mIGdsdGZcclxuICogQHJldHVybnMgTWF0ZXJpYWwgZGVmaW5pdGlvbiBpbmRleCBvZiBnbFRGXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2x0ZkdldEFzc29jaWF0ZWRNYXRlcmlhbEluZGV4KHBhcnNlcjogR0xURlBhcnNlciwgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsKTogbnVtYmVyIHwgbnVsbCB7XHJcbiAgY29uc3QgdGhyZWVSZXZpc2lvbiA9IHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCk7XHJcblxyXG4gIGxldCBpbmRleDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gIGlmICh0aHJlZVJldmlzaW9uID49IDEzMykge1xyXG4gICAgaW5kZXggPSBwYXJzZXIuYXNzb2NpYXRpb25zLmdldChtYXRlcmlhbCk/Lm1hdGVyaWFscyA/PyBudWxsO1xyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBDT01QQVQ6IHN0cnVjdHVyZSBvZiBgcGFyc2VyLmFzc29jaWF0aW9uc2AgaGFzIGJlZW4gY2hhbmdlZCBAIHIxMzNcclxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIxNzM3XHJcbiAgICAvLyBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS90aHJlZS10eXBlcy90aHJlZS10cy10eXBlcy9jb21taXQvNTI0NjY3NmU0NzliNjFhOWZmMmRiNzFkZjQxMTlmNmYxNDYyNTgwZFxyXG4gICAgdHlwZSBHTFRGUmVmZXJlbmNlUHJlMTMzID0ge1xyXG4gICAgICB0eXBlOiAnbWF0ZXJpYWxzJyB8ICdub2RlcycgfCAndGV4dHVyZXMnIHwgJ21lc2hlcyc7XHJcbiAgICAgIGluZGV4OiBudW1iZXI7XHJcbiAgICB9O1xyXG5cclxuICAgIHR5cGUgR0xURkFzc29jaWF0aW9uc1ByZTEzMyA9IE1hcDxUSFJFRS5PYmplY3QzRCB8IFRIUkVFLk1hdGVyaWFsIHwgVEhSRUUuVGV4dHVyZSwgR0xURlJlZmVyZW5jZVByZTEzMz47XHJcblxyXG4gICAgY29uc3QgYXNzb2NpYXRpb25zID0gcGFyc2VyLmFzc29jaWF0aW9ucyBhcyBHTFRGQXNzb2NpYXRpb25zUHJlMTMzO1xyXG5cclxuICAgIGNvbnN0IHJlZmVyZW5jZSA9IGFzc29jaWF0aW9ucy5nZXQobWF0ZXJpYWwpO1xyXG5cclxuICAgIGlmIChyZWZlcmVuY2U/LnR5cGUgPT09ICdtYXRlcmlhbHMnKSB7XHJcbiAgICAgIGluZGV4ID0gcmVmZXJlbmNlLmluZGV4O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGluZGV4O1xyXG59XHJcbiIsIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xyXG5cclxuZXhwb3J0IGNvbnN0IFZSTUV4cHJlc3Npb25QcmVzZXROYW1lID0ge1xyXG4gIEFhOiAnYWEnLFxyXG4gIEloOiAnaWgnLFxyXG4gIE91OiAnb3UnLFxyXG4gIEVlOiAnZWUnLFxyXG4gIE9oOiAnb2gnLFxyXG4gIEJsaW5rOiAnYmxpbmsnLFxyXG4gIEhhcHB5OiAnaGFwcHknLFxyXG4gIEFuZ3J5OiAnYW5ncnknLFxyXG4gIFNhZDogJ3NhZCcsXHJcbiAgUmVsYXhlZDogJ3JlbGF4ZWQnLFxyXG4gIExvb2tVcDogJ2xvb2tVcCcsXHJcbiAgU3VycHJpc2VkOiAnc3VycHJpc2VkJyxcclxuICBMb29rRG93bjogJ2xvb2tEb3duJyxcclxuICBMb29rTGVmdDogJ2xvb2tMZWZ0JyxcclxuICBMb29rUmlnaHQ6ICdsb29rUmlnaHQnLFxyXG4gIEJsaW5rTGVmdDogJ2JsaW5rTGVmdCcsXHJcbiAgQmxpbmtSaWdodDogJ2JsaW5rUmlnaHQnLFxyXG4gIE5ldXRyYWw6ICduZXV0cmFsJyxcclxufSBhcyBjb25zdDtcclxuXHJcbmV4cG9ydCB0eXBlIFZSTUV4cHJlc3Npb25QcmVzZXROYW1lID0gdHlwZW9mIFZSTUV4cHJlc3Npb25QcmVzZXROYW1lW2tleW9mIHR5cGVvZiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZV07XHJcbiIsIi8qKlxyXG4gKiBDbGFtcCB0aGUgaW5wdXQgdmFsdWUgd2l0aGluIFswLjAgLSAxLjBdLlxyXG4gKlxyXG4gKiBAcGFyYW0gdmFsdWUgVGhlIGlucHV0IHZhbHVlXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc2F0dXJhdGUodmFsdWU6IG51bWJlcik6IG51bWJlciB7XHJcbiAgcmV0dXJuIE1hdGgubWF4KE1hdGgubWluKHZhbHVlLCAxLjApLCAwLjApO1xyXG59XHJcbiIsImltcG9ydCB7IFZSTUV4cHJlc3Npb25QcmVzZXROYW1lIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uUHJlc2V0TmFtZSc7XHJcbmltcG9ydCB7IHNhdHVyYXRlIH0gZnJvbSAnLi4vdXRpbHMvc2F0dXJhdGUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUV4cHJlc3Npb24gfSBmcm9tICcuL1ZSTUV4cHJlc3Npb24nO1xyXG5cclxuZXhwb3J0IGNsYXNzIFZSTUV4cHJlc3Npb25NYW5hZ2VyIHtcclxuICAvKipcclxuICAgKiBBIHNldCBvZiBuYW1lIG9yIHByZXNldCBuYW1lIG9mIGV4cHJlc3Npb25zIHRoYXQgd2lsbCBiZSBvdmVycmlkZGVuIGJ5IHtAbGluayBWUk1FeHByZXNzaW9uLm92ZXJyaWRlQmxpbmt9LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBibGlua0V4cHJlc3Npb25OYW1lcyA9IFsnYmxpbmsnLCAnYmxpbmtMZWZ0JywgJ2JsaW5rUmlnaHQnXTtcclxuXHJcbiAgLyoqXHJcbiAgICogQSBzZXQgb2YgbmFtZSBvciBwcmVzZXQgbmFtZSBvZiBleHByZXNzaW9ucyB0aGF0IHdpbGwgYmUgb3ZlcnJpZGRlbiBieSB7QGxpbmsgVlJNRXhwcmVzc2lvbi5vdmVycmlkZUxvb2tBdH0uXHJcbiAgICovXHJcbiAgcHVibGljIGxvb2tBdEV4cHJlc3Npb25OYW1lcyA9IFsnbG9va0xlZnQnLCAnbG9va1JpZ2h0JywgJ2xvb2tVcCcsICdsb29rRG93biddO1xyXG5cclxuICAvKipcclxuICAgKiBBIHNldCBvZiBuYW1lIG9yIHByZXNldCBuYW1lIG9mIGV4cHJlc3Npb25zIHRoYXQgd2lsbCBiZSBvdmVycmlkZGVuIGJ5IHtAbGluayBWUk1FeHByZXNzaW9uLm92ZXJyaWRlTW91dGh9LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBtb3V0aEV4cHJlc3Npb25OYW1lcyA9IFsnYWEnLCAnZWUnLCAnaWgnLCAnb2gnLCAnb3UnXTtcclxuXHJcbiAgLyoqXHJcbiAgICogQSBzZXQgb2Yge0BsaW5rIFZSTUV4cHJlc3Npb259LlxyXG4gICAqIFdoZW4geW91IHdhbnQgdG8gcmVnaXN0ZXIgZXhwcmVzc2lvbnMsIHVzZSB7QGxpbmsgcmVnaXN0ZXJFeHByZXNzaW9ufVxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2V4cHJlc3Npb25zOiBWUk1FeHByZXNzaW9uW10gPSBbXTtcclxuICBwdWJsaWMgZ2V0IGV4cHJlc3Npb25zKCk6IFZSTUV4cHJlc3Npb25bXSB7XHJcbiAgICByZXR1cm4gdGhpcy5fZXhwcmVzc2lvbnMuY29uY2F0KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBIG1hcCBmcm9tIG5hbWUgdG8gZXhwcmVzc2lvbi5cclxuICAgKi9cclxuICBwcml2YXRlIF9leHByZXNzaW9uTWFwOiB7IFtuYW1lOiBzdHJpbmddOiBWUk1FeHByZXNzaW9uIH0gPSB7fTtcclxuICBwdWJsaWMgZ2V0IGV4cHJlc3Npb25NYXAoKTogeyBbbmFtZTogc3RyaW5nXTogVlJNRXhwcmVzc2lvbiB9IHtcclxuICAgIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLl9leHByZXNzaW9uTWFwKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgbWFwIGZyb20gbmFtZSB0byBleHByZXNzaW9uLCBidXQgZXhjbHVkaW5nIGN1c3RvbSBleHByZXNzaW9ucy5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0IHByZXNldEV4cHJlc3Npb25NYXAoKTogeyBbbmFtZSBpbiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZV0/OiBWUk1FeHByZXNzaW9uIH0ge1xyXG4gICAgY29uc3QgcmVzdWx0OiB7IFtuYW1lIGluIFZSTUV4cHJlc3Npb25QcmVzZXROYW1lXT86IFZSTUV4cHJlc3Npb24gfSA9IHt9O1xyXG5cclxuICAgIGNvbnN0IHByZXNldE5hbWVTZXQgPSBuZXcgU2V0PHN0cmluZz4oT2JqZWN0LnZhbHVlcyhWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSkpO1xyXG5cclxuICAgIE9iamVjdC5lbnRyaWVzKHRoaXMuX2V4cHJlc3Npb25NYXApLmZvckVhY2goKFtuYW1lLCBleHByZXNzaW9uXSkgPT4ge1xyXG4gICAgICBpZiAocHJlc2V0TmFtZVNldC5oYXMobmFtZSkpIHtcclxuICAgICAgICByZXN1bHRbbmFtZSBhcyBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZV0gPSBleHByZXNzaW9uO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBtYXAgZnJvbSBuYW1lIHRvIGV4cHJlc3Npb24sIGJ1dCBleGNsdWRpbmcgcHJlc2V0IGV4cHJlc3Npb25zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgY3VzdG9tRXhwcmVzc2lvbk1hcCgpOiB7IFtuYW1lOiBzdHJpbmddOiBWUk1FeHByZXNzaW9uIH0ge1xyXG4gICAgY29uc3QgcmVzdWx0OiB7IFtuYW1lOiBzdHJpbmddOiBWUk1FeHByZXNzaW9uIH0gPSB7fTtcclxuXHJcbiAgICBjb25zdCBwcmVzZXROYW1lU2V0ID0gbmV3IFNldDxzdHJpbmc+KE9iamVjdC52YWx1ZXMoVlJNRXhwcmVzc2lvblByZXNldE5hbWUpKTtcclxuXHJcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLl9leHByZXNzaW9uTWFwKS5mb3JFYWNoKChbbmFtZSwgZXhwcmVzc2lvbl0pID0+IHtcclxuICAgICAgaWYgKCFwcmVzZXROYW1lU2V0LmhhcyhuYW1lKSkge1xyXG4gICAgICAgIHJlc3VsdFtuYW1lXSA9IGV4cHJlc3Npb247XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiByZXN1bHQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcge0BsaW5rIFZSTUV4cHJlc3Npb25NYW5hZ2VyfS5cclxuICAgKi9cclxuICBwdWJsaWMgY29uc3RydWN0b3IoKSB7XHJcbiAgICAvLyBkbyBub3RoaW5nXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb3B5IHRoZSBnaXZlbiB7QGxpbmsgVlJNRXhwcmVzc2lvbk1hbmFnZXJ9IGludG8gdGhpcyBvbmUuXHJcbiAgICogQHBhcmFtIHNvdXJjZSBUaGUge0BsaW5rIFZSTUV4cHJlc3Npb25NYW5hZ2VyfSB5b3Ugd2FudCB0byBjb3B5XHJcbiAgICogQHJldHVybnMgdGhpc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogVlJNRXhwcmVzc2lvbk1hbmFnZXIpOiB0aGlzIHtcclxuICAgIC8vIGZpcnN0IHVucmVnaXN0ZXIgYWxsIHRoZSBleHByZXNzaW9uIGl0IGhhc1xyXG4gICAgY29uc3QgZXhwcmVzc2lvbnMgPSB0aGlzLl9leHByZXNzaW9ucy5jb25jYXQoKTtcclxuICAgIGV4cHJlc3Npb25zLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcclxuICAgICAgdGhpcy51bnJlZ2lzdGVyRXhwcmVzc2lvbihleHByZXNzaW9uKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIHRoZW4gcmVnaXN0ZXIgYWxsIHRoZSBleHByZXNzaW9uIG9mIHRoZSBzb3VyY2VcclxuICAgIHNvdXJjZS5fZXhwcmVzc2lvbnMuZm9yRWFjaCgoZXhwcmVzc2lvbikgPT4ge1xyXG4gICAgICB0aGlzLnJlZ2lzdGVyRXhwcmVzc2lvbihleHByZXNzaW9uKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGNvcHkgcmVtYWluaW5nIG1lbWJlcnNcclxuICAgIHRoaXMuYmxpbmtFeHByZXNzaW9uTmFtZXMgPSBzb3VyY2UuYmxpbmtFeHByZXNzaW9uTmFtZXMuY29uY2F0KCk7XHJcbiAgICB0aGlzLmxvb2tBdEV4cHJlc3Npb25OYW1lcyA9IHNvdXJjZS5sb29rQXRFeHByZXNzaW9uTmFtZXMuY29uY2F0KCk7XHJcbiAgICB0aGlzLm1vdXRoRXhwcmVzc2lvbk5hbWVzID0gc291cmNlLm1vdXRoRXhwcmVzc2lvbk5hbWVzLmNvbmNhdCgpO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyBhIGNsb25lIG9mIHRoaXMge0BsaW5rIFZSTUV4cHJlc3Npb25NYW5hZ2VyfS5cclxuICAgKiBAcmV0dXJucyBDb3BpZWQge0BsaW5rIFZSTUV4cHJlc3Npb25NYW5hZ2VyfVxyXG4gICAqL1xyXG4gIHB1YmxpYyBjbG9uZSgpOiBWUk1FeHByZXNzaW9uTWFuYWdlciB7XHJcbiAgICByZXR1cm4gbmV3IFZSTUV4cHJlc3Npb25NYW5hZ2VyKCkuY29weSh0aGlzKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiBhIHJlZ2lzdGVyZWQgZXhwcmVzc2lvbi5cclxuICAgKiBJZiBpdCBjYW5ub3QgZmluZCBhbiBleHByZXNzaW9uLCBpdCB3aWxsIHJldHVybiBgbnVsbGAgaW5zdGVhZC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb3IgcHJlc2V0IG5hbWUgb2YgdGhlIGV4cHJlc3Npb25cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0RXhwcmVzc2lvbihuYW1lOiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB8IHN0cmluZyk6IFZSTUV4cHJlc3Npb24gfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLl9leHByZXNzaW9uTWFwW25hbWVdID8/IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZWdpc3RlciBhbiBleHByZXNzaW9uLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGV4cHJlc3Npb24ge0BsaW5rIFZSTUV4cHJlc3Npb259IHRoYXQgZGVzY3JpYmVzIHRoZSBleHByZXNzaW9uXHJcbiAgICovXHJcbiAgcHVibGljIHJlZ2lzdGVyRXhwcmVzc2lvbihleHByZXNzaW9uOiBWUk1FeHByZXNzaW9uKTogdm9pZCB7XHJcbiAgICB0aGlzLl9leHByZXNzaW9ucy5wdXNoKGV4cHJlc3Npb24pO1xyXG4gICAgdGhpcy5fZXhwcmVzc2lvbk1hcFtleHByZXNzaW9uLmV4cHJlc3Npb25OYW1lXSA9IGV4cHJlc3Npb247XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVbnJlZ2lzdGVyIGFuIGV4cHJlc3Npb24uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZXhwcmVzc2lvbiBUaGUgZXhwcmVzc2lvbiB5b3Ugd2FudCB0byB1bnJlZ2lzdGVyXHJcbiAgICovXHJcbiAgcHVibGljIHVucmVnaXN0ZXJFeHByZXNzaW9uKGV4cHJlc3Npb246IFZSTUV4cHJlc3Npb24pOiB2b2lkIHtcclxuICAgIGNvbnN0IGluZGV4ID0gdGhpcy5fZXhwcmVzc2lvbnMuaW5kZXhPZihleHByZXNzaW9uKTtcclxuICAgIGlmIChpbmRleCA9PT0gLTEpIHtcclxuICAgICAgY29uc29sZS53YXJuKCdWUk1FeHByZXNzaW9uTWFuYWdlcjogVGhlIHNwZWNpZmllZCBleHByZXNzaW9ucyBpcyBub3QgcmVnaXN0ZXJlZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2V4cHJlc3Npb25zLnNwbGljZShpbmRleCwgMSk7XHJcbiAgICBkZWxldGUgdGhpcy5fZXhwcmVzc2lvbk1hcFtleHByZXNzaW9uLmV4cHJlc3Npb25OYW1lXTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCB0aGUgY3VycmVudCB3ZWlnaHQgb2YgdGhlIHNwZWNpZmllZCBleHByZXNzaW9uLlxyXG4gICAqIElmIGl0IGRvZXNuJ3QgaGF2ZSBhbiBleHByZXNzaW9uIG9mIGdpdmVuIG5hbWUsIGl0IHdpbGwgcmV0dXJuIGBudWxsYCBpbnN0ZWFkLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIG5hbWUgTmFtZSBvZiB0aGUgZXhwcmVzc2lvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRWYWx1ZShuYW1lOiBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB8IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xyXG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IHRoaXMuZ2V0RXhwcmVzc2lvbihuYW1lKTtcclxuICAgIHJldHVybiBleHByZXNzaW9uPy53ZWlnaHQgPz8gbnVsbDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCBhIHdlaWdodCB0byB0aGUgc3BlY2lmaWVkIGV4cHJlc3Npb24uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBleHByZXNzaW9uXHJcbiAgICogQHBhcmFtIHdlaWdodCBXZWlnaHRcclxuICAgKi9cclxuICBwdWJsaWMgc2V0VmFsdWUobmFtZTogVlJNRXhwcmVzc2lvblByZXNldE5hbWUgfCBzdHJpbmcsIHdlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBleHByZXNzaW9uID0gdGhpcy5nZXRFeHByZXNzaW9uKG5hbWUpO1xyXG4gICAgaWYgKGV4cHJlc3Npb24pIHtcclxuICAgICAgZXhwcmVzc2lvbi53ZWlnaHQgPSBzYXR1cmF0ZSh3ZWlnaHQpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgdHJhY2sgbmFtZSBvZiBzcGVjaWZpZWQgZXhwcmVzc2lvbi5cclxuICAgKiBUaGlzIHRyYWNrIG5hbWUgaXMgbmVlZGVkIHRvIG1hbmlwdWxhdGUgaXRzIGV4cHJlc3Npb24gdmlhIGtleWZyYW1lIGFuaW1hdGlvbnMuXHJcbiAgICpcclxuICAgKiBAZXhhbXBsZSBNYW5pcHVsYXRlIGFuIGV4cHJlc3Npb24gdXNpbmcga2V5ZnJhbWUgYW5pbWF0aW9uXHJcbiAgICogYGBganNcclxuICAgKiBjb25zdCB0cmFja05hbWUgPSB2cm0uZXhwcmVzc2lvbk1hbmFnZXIuZ2V0RXhwcmVzc2lvblRyYWNrTmFtZSggJ2JsaW5rJyApO1xyXG4gICAqIGNvbnN0IHRyYWNrID0gbmV3IFRIUkVFLk51bWJlcktleWZyYW1lVHJhY2soXHJcbiAgICogICBuYW1lLFxyXG4gICAqICAgWyAwLjAsIDAuNSwgMS4wIF0sIC8vIHRpbWVzXHJcbiAgICogICBbIDAuMCwgMS4wLCAwLjAgXSAvLyB2YWx1ZXNcclxuICAgKiApO1xyXG4gICAqXHJcbiAgICogY29uc3QgY2xpcCA9IG5ldyBUSFJFRS5BbmltYXRpb25DbGlwKFxyXG4gICAqICAgJ2JsaW5rJywgLy8gbmFtZVxyXG4gICAqICAgMS4wLCAvLyBkdXJhdGlvblxyXG4gICAqICAgWyB0cmFjayBdIC8vIHRyYWNrc1xyXG4gICAqICk7XHJcbiAgICpcclxuICAgKiBjb25zdCBtaXhlciA9IG5ldyBUSFJFRS5BbmltYXRpb25NaXhlciggdnJtLnNjZW5lICk7XHJcbiAgICogY29uc3QgYWN0aW9uID0gbWl4ZXIuY2xpcEFjdGlvbiggY2xpcCApO1xyXG4gICAqIGFjdGlvbi5wbGF5KCk7XHJcbiAgICogYGBgXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBleHByZXNzaW9uXHJcbiAgICovXHJcbiAgcHVibGljIGdldEV4cHJlc3Npb25UcmFja05hbWUobmFtZTogVlJNRXhwcmVzc2lvblByZXNldE5hbWUgfCBzdHJpbmcpOiBzdHJpbmcgfCBudWxsIHtcclxuICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0aGlzLmdldEV4cHJlc3Npb24obmFtZSk7XHJcbiAgICByZXR1cm4gZXhwcmVzc2lvbiA/IGAke2V4cHJlc3Npb24ubmFtZX0ud2VpZ2h0YCA6IG51bGw7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgZXZlcnkgZXhwcmVzc2lvbnMuXHJcbiAgICovXHJcbiAgcHVibGljIHVwZGF0ZSgpOiB2b2lkIHtcclxuICAgIC8vIHNlZSBob3cgbXVjaCB3ZSBzaG91bGQgb3ZlcnJpZGUgY2VydGFpbiBleHByZXNzaW9uc1xyXG4gICAgY29uc3Qgd2VpZ2h0TXVsdGlwbGllcnMgPSB0aGlzLl9jYWxjdWxhdGVXZWlnaHRNdWx0aXBsaWVycygpO1xyXG5cclxuICAgIC8vIHJlc2V0IGV4cHJlc3Npb24gYmluZHMgZmlyc3RcclxuICAgIHRoaXMuX2V4cHJlc3Npb25zLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcclxuICAgICAgZXhwcmVzc2lvbi5jbGVhckFwcGxpZWRXZWlnaHQoKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIHRoZW4gYXBwbHkgYmluZHNcclxuICAgIHRoaXMuX2V4cHJlc3Npb25zLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcclxuICAgICAgbGV0IG11bHRpcGxpZXIgPSAxLjA7XHJcbiAgICAgIGNvbnN0IG5hbWUgPSBleHByZXNzaW9uLmV4cHJlc3Npb25OYW1lO1xyXG5cclxuICAgICAgaWYgKHRoaXMuYmxpbmtFeHByZXNzaW9uTmFtZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcclxuICAgICAgICBtdWx0aXBsaWVyICo9IHdlaWdodE11bHRpcGxpZXJzLmJsaW5rO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAodGhpcy5sb29rQXRFeHByZXNzaW9uTmFtZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcclxuICAgICAgICBtdWx0aXBsaWVyICo9IHdlaWdodE11bHRpcGxpZXJzLmxvb2tBdDtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHRoaXMubW91dGhFeHByZXNzaW9uTmFtZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcclxuICAgICAgICBtdWx0aXBsaWVyICo9IHdlaWdodE11bHRpcGxpZXJzLm1vdXRoO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBleHByZXNzaW9uLmFwcGx5V2VpZ2h0KHsgbXVsdGlwbGllciB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ2FsY3VsYXRlIHN1bSBvZiBvdmVycmlkZSBhbW91bnRzIHRvIHNlZSBob3cgbXVjaCB3ZSBzaG91bGQgbXVsdGlwbHkgd2VpZ2h0cyBvZiBjZXJ0YWluIGV4cHJlc3Npb25zLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2NhbGN1bGF0ZVdlaWdodE11bHRpcGxpZXJzKCk6IHtcclxuICAgIGJsaW5rOiBudW1iZXI7XHJcbiAgICBsb29rQXQ6IG51bWJlcjtcclxuICAgIG1vdXRoOiBudW1iZXI7XHJcbiAgfSB7XHJcbiAgICBsZXQgYmxpbmsgPSAxLjA7XHJcbiAgICBsZXQgbG9va0F0ID0gMS4wO1xyXG4gICAgbGV0IG1vdXRoID0gMS4wO1xyXG5cclxuICAgIHRoaXMuX2V4cHJlc3Npb25zLmZvckVhY2goKGV4cHJlc3Npb24pID0+IHtcclxuICAgICAgYmxpbmsgLT0gZXhwcmVzc2lvbi5vdmVycmlkZUJsaW5rQW1vdW50O1xyXG4gICAgICBsb29rQXQgLT0gZXhwcmVzc2lvbi5vdmVycmlkZUxvb2tBdEFtb3VudDtcclxuICAgICAgbW91dGggLT0gZXhwcmVzc2lvbi5vdmVycmlkZU1vdXRoQW1vdW50O1xyXG4gICAgfSk7XHJcblxyXG4gICAgYmxpbmsgPSBNYXRoLm1heCgwLjAsIGJsaW5rKTtcclxuICAgIGxvb2tBdCA9IE1hdGgubWF4KDAuMCwgbG9va0F0KTtcclxuICAgIG1vdXRoID0gTWF0aC5tYXgoMC4wLCBtb3V0aCk7XHJcblxyXG4gICAgcmV0dXJuIHsgYmxpbmssIGxvb2tBdCwgbW91dGggfTtcclxuICB9XHJcbn1cclxuIiwiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcblxyXG5leHBvcnQgY29uc3QgVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlID0ge1xyXG4gIENvbG9yOiAnY29sb3InLFxyXG4gIEVtaXNzaW9uQ29sb3I6ICdlbWlzc2lvbkNvbG9yJyxcclxuICBTaGFkZUNvbG9yOiAnc2hhZGVDb2xvcicsXHJcbiAgTWF0Y2FwQ29sb3I6ICdtYXRjYXBDb2xvcicsXHJcbiAgUmltQ29sb3I6ICdyaW1Db2xvcicsXHJcbiAgT3V0bGluZUNvbG9yOiAnb3V0bGluZUNvbG9yJyxcclxufSBhcyBjb25zdDtcclxuXHJcbmV4cG9ydCB0eXBlIFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZSA9IHR5cGVvZiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGVba2V5b2YgdHlwZW9mIFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZV07XHJcblxyXG5leHBvcnQgY29uc3QgdjBFeHByZXNzaW9uTWF0ZXJpYWxDb2xvck1hcDogeyBba2V5OiBzdHJpbmddOiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUgfCB1bmRlZmluZWQgfSA9IHtcclxuICBfQ29sb3I6IFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZS5Db2xvcixcclxuICBfRW1pc3Npb25Db2xvcjogVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlLkVtaXNzaW9uQ29sb3IsXHJcbiAgX1NoYWRlQ29sb3I6IFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZS5TaGFkZUNvbG9yLFxyXG4gIF9SaW1Db2xvcjogVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlLlJpbUNvbG9yLFxyXG4gIF9PdXRsaW5lQ29sb3I6IFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZS5PdXRsaW5lQ29sb3IsXHJcbn07XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHR5cGUgeyBWUk1FeHByZXNzaW9uQmluZCB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbkJpbmQnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZSB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlJztcclxuXHJcbmNvbnN0IF9jb2xvciA9IG5ldyBUSFJFRS5Db2xvcigpO1xyXG5cclxuLyoqXHJcbiAqIEEgYmluZCBvZiBleHByZXNzaW9uIGluZmx1ZW5jZXMgdG8gYSBtYXRlcmlhbCBjb2xvci5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQgaW1wbGVtZW50cyBWUk1FeHByZXNzaW9uQmluZCB7XHJcbiAgLyoqXHJcbiAgICogTWFwcGluZyBvZiBwcm9wZXJ0eSBuYW1lcyBmcm9tIFZSTUMvbWF0ZXJpYWxDb2xvckJpbmRzLnR5cGUgdG8gdGhyZWUuanMvTWF0ZXJpYWwuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBzdGF0aWMgX3Byb3BlcnR5TmFtZU1hcE1hcDoge1xyXG4gICAgW2Rpc3Rpbmd1aXNoZXI6IHN0cmluZ106IHsgW3R5cGUgaW4gVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JUeXBlXT86IHN0cmluZyB9O1xyXG4gIH0gPSB7XHJcbiAgICBpc01lc2hTdGFuZGFyZE1hdGVyaWFsOiB7XHJcbiAgICAgIGNvbG9yOiAnY29sb3InLFxyXG4gICAgICBlbWlzc2lvbkNvbG9yOiAnZW1pc3NpdmUnLFxyXG4gICAgfSxcclxuICAgIGlzTWVzaEJhc2ljTWF0ZXJpYWw6IHtcclxuICAgICAgY29sb3I6ICdjb2xvcicsXHJcbiAgICB9LFxyXG4gICAgaXNNVG9vbk1hdGVyaWFsOiB7XHJcbiAgICAgIGNvbG9yOiAnY29sb3InLFxyXG4gICAgICBlbWlzc2lvbkNvbG9yOiAnZW1pc3NpdmUnLFxyXG4gICAgICBvdXRsaW5lQ29sb3I6ICdvdXRsaW5lQ29sb3JGYWN0b3InLFxyXG4gICAgICBtYXRjYXBDb2xvcjogJ21hdGNhcEZhY3RvcicsXHJcbiAgICAgIHJpbUNvbG9yOiAncGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yJyxcclxuICAgICAgc2hhZGVDb2xvcjogJ3NoYWRlQ29sb3JGYWN0b3InLFxyXG4gICAgfSxcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBUaGUgdGFyZ2V0IG1hdGVyaWFsLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSB0eXBlIG9mIHRoZSB0YXJnZXQgcHJvcGVydHkgb2YgdGhlIG1hdGVyaWFsLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSB0eXBlOiBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGU7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSB0YXJnZXQgY29sb3IuXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHRhcmdldFZhbHVlOiBUSFJFRS5Db2xvcjtcclxuXHJcbiAgLyoqXHJcbiAgICogSXRzIHN0YXRlLlxyXG4gICAqIElmIGl0IGNhbm5vdCBmaW5kIHRoZSB0YXJnZXQgcHJvcGVydHkgaW4gY29uc3RydWN0b3IsIGl0IHdpbGwgYmUgbnVsbCBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3N0YXRlOiB7XHJcbiAgICBwcm9wZXJ0eU5hbWU6IHN0cmluZztcclxuICAgIGluaXRpYWxWYWx1ZTogVEhSRUUuQ29sb3I7XHJcbiAgICBkZWx0YVZhbHVlOiBUSFJFRS5Db2xvcjtcclxuICB9IHwgbnVsbDtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHtcclxuICAgIG1hdGVyaWFsLFxyXG4gICAgdHlwZSxcclxuICAgIHRhcmdldFZhbHVlLFxyXG4gIH06IHtcclxuICAgIC8qKlxyXG4gICAgICogVGhlIHRhcmdldCBtYXRlcmlhbC5cclxuICAgICAqL1xyXG4gICAgbWF0ZXJpYWw6IFRIUkVFLk1hdGVyaWFsO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIHR5cGUgb2YgdGhlIHRhcmdldCBwcm9wZXJ0eSBvZiB0aGUgbWF0ZXJpYWwuXHJcbiAgICAgKi9cclxuICAgIHR5cGU6IFZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yVHlwZTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSB0YXJnZXQgY29sb3IuXHJcbiAgICAgKi9cclxuICAgIHRhcmdldFZhbHVlOiBUSFJFRS5Db2xvcjtcclxuICB9KSB7XHJcbiAgICB0aGlzLm1hdGVyaWFsID0gbWF0ZXJpYWw7XHJcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xyXG4gICAgdGhpcy50YXJnZXRWYWx1ZSA9IHRhcmdldFZhbHVlO1xyXG5cclxuICAgIC8vIGluaXQgcHJvcGVydHkgbmFtZVxyXG4gICAgY29uc3QgcHJvcGVydHlOYW1lTWFwID0gT2JqZWN0LmVudHJpZXMoVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JCaW5kLl9wcm9wZXJ0eU5hbWVNYXBNYXApLmZpbmQoXHJcbiAgICAgIChbZGlzdGluZ3Vpc2hlcl0pID0+IHtcclxuICAgICAgICByZXR1cm4gKG1hdGVyaWFsIGFzIGFueSlbZGlzdGluZ3Vpc2hlcl0gPT09IHRydWU7XHJcbiAgICAgIH0sXHJcbiAgICApPy5bMV07XHJcbiAgICBjb25zdCBwcm9wZXJ0eU5hbWUgPSBwcm9wZXJ0eU5hbWVNYXA/Llt0eXBlXSA/PyBudWxsO1xyXG5cclxuICAgIGlmIChwcm9wZXJ0eU5hbWUgPT0gbnVsbCkge1xyXG4gICAgICBjb25zb2xlLndhcm4oXHJcbiAgICAgICAgYFRyaWVkIHRvIGFkZCBhIG1hdGVyaWFsIGNvbG9yIGJpbmQgdG8gdGhlIG1hdGVyaWFsICR7XHJcbiAgICAgICAgICBtYXRlcmlhbC5uYW1lID8/ICcobm8gbmFtZSknXHJcbiAgICAgICAgfSwgdGhlIHR5cGUgJHt0eXBlfSBidXQgdGhlIG1hdGVyaWFsIG9yIHRoZSB0eXBlIGlzIG5vdCBzdXBwb3J0ZWQuYCxcclxuICAgICAgKTtcclxuXHJcbiAgICAgIHRoaXMuX3N0YXRlID0gbnVsbDtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGNvbnN0IHRhcmdldCA9IChtYXRlcmlhbCBhcyBhbnkpW3Byb3BlcnR5TmFtZV0gYXMgVEhSRUUuQ29sb3I7XHJcblxyXG4gICAgICBjb25zdCBpbml0aWFsVmFsdWUgPSB0YXJnZXQuY2xvbmUoKTtcclxuXHJcbiAgICAgIC8vIOiyoOOBruWApOOCkuS/neaMgeOBmeOCi+OBn+OCgeOBq0NvbG9yLnN1YuOCkuS9v+OCj+OBmuOBq+W3ruWIhuOCkuioiOeul+OBmeOCi1xyXG4gICAgICBjb25zdCBkZWx0YVZhbHVlID0gbmV3IFRIUkVFLkNvbG9yKFxyXG4gICAgICAgIHRhcmdldFZhbHVlLnIgLSBpbml0aWFsVmFsdWUucixcclxuICAgICAgICB0YXJnZXRWYWx1ZS5nIC0gaW5pdGlhbFZhbHVlLmcsXHJcbiAgICAgICAgdGFyZ2V0VmFsdWUuYiAtIGluaXRpYWxWYWx1ZS5iLFxyXG4gICAgICApO1xyXG5cclxuICAgICAgdGhpcy5fc3RhdGUgPSB7XHJcbiAgICAgICAgcHJvcGVydHlOYW1lLFxyXG4gICAgICAgIGluaXRpYWxWYWx1ZSxcclxuICAgICAgICBkZWx0YVZhbHVlLFxyXG4gICAgICB9O1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGFwcGx5V2VpZ2h0KHdlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5fc3RhdGUgPT0gbnVsbCkge1xyXG4gICAgICAvLyB3YXJuaW5nIGlzIGFscmVhZHkgZW1pdHRlZCBpbiBjb25zdHJ1Y3RvclxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgeyBwcm9wZXJ0eU5hbWUsIGRlbHRhVmFsdWUgfSA9IHRoaXMuX3N0YXRlO1xyXG5cclxuICAgIGNvbnN0IHRhcmdldCA9ICh0aGlzLm1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXSBhcyBUSFJFRS5Db2xvcjtcclxuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXHJcblxyXG4gICAgdGFyZ2V0LmFkZChfY29sb3IuY29weShkZWx0YVZhbHVlKS5tdWx0aXBseVNjYWxhcih3ZWlnaHQpKTtcclxuXHJcbiAgICBpZiAodHlwZW9mICh0aGlzLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICh0aGlzLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY2xlYXJBcHBsaWVkV2VpZ2h0KCk6IHZvaWQge1xyXG4gICAgaWYgKHRoaXMuX3N0YXRlID09IG51bGwpIHtcclxuICAgICAgLy8gd2FybmluZyBpcyBhbHJlYWR5IGVtaXR0ZWQgaW4gY29uc3RydWN0b3JcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHsgcHJvcGVydHlOYW1lLCBpbml0aWFsVmFsdWUgfSA9IHRoaXMuX3N0YXRlO1xyXG5cclxuICAgIGNvbnN0IHRhcmdldCA9ICh0aGlzLm1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHlOYW1lXSBhcyBUSFJFRS5Db2xvcjtcclxuICAgIGlmICh0YXJnZXQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXHJcblxyXG4gICAgdGFyZ2V0LmNvcHkoaW5pdGlhbFZhbHVlKTtcclxuXHJcbiAgICBpZiAodHlwZW9mICh0aGlzLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICh0aGlzLm1hdGVyaWFsIGFzIGFueSkuc2hvdWxkQXBwbHlVbmlmb3JtcyA9IHRydWU7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCB0eXBlICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUV4cHJlc3Npb25CaW5kIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uQmluZCc7XHJcblxyXG4vKipcclxuICogQSBiaW5kIG9mIHtAbGluayBWUk1FeHByZXNzaW9ufSBpbmZsdWVuY2VzIHRvIG1vcnBoIHRhcmdldHMuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZCBpbXBsZW1lbnRzIFZSTUV4cHJlc3Npb25CaW5kIHtcclxuICAvKipcclxuICAgKiBUaGUgbWVzaCBwcmltaXRpdmVzIHRoYXQgYXR0YWNoZWQgdG8gdGFyZ2V0IG1lc2guXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHByaW1pdGl2ZXM6IFRIUkVFLk1lc2hbXTtcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIGluZGV4IG9mIHRoZSBtb3JwaCB0YXJnZXQgaW4gdGhlIG1lc2guXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGluZGV4OiBudW1iZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSB3ZWlnaHQgdmFsdWUgb2YgdGFyZ2V0IG1vcnBoIHRhcmdldC4gUmFuZ2luZyBpbiBbMC4wIC0gMS4wXS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgd2VpZ2h0OiBudW1iZXI7XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcih7XHJcbiAgICBwcmltaXRpdmVzLFxyXG4gICAgaW5kZXgsXHJcbiAgICB3ZWlnaHQsXHJcbiAgfToge1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgbWVzaCBwcmltaXRpdmVzIHRoYXQgYXR0YWNoZWQgdG8gdGFyZ2V0IG1lc2guXHJcbiAgICAgKi9cclxuICAgIHByaW1pdGl2ZXM6IFRIUkVFLk1lc2hbXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFRoZSBpbmRleCBvZiB0aGUgbW9ycGggdGFyZ2V0IGluIHRoZSBtZXNoLlxyXG4gICAgICovXHJcbiAgICBpbmRleDogbnVtYmVyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIHdlaWdodCB2YWx1ZSBvZiB0YXJnZXQgbW9ycGggdGFyZ2V0LiBSYW5naW5nIGluIFswLjAgLSAxLjBdLlxyXG4gICAgICovXHJcbiAgICB3ZWlnaHQ6IG51bWJlcjtcclxuICB9KSB7XHJcbiAgICB0aGlzLnByaW1pdGl2ZXMgPSBwcmltaXRpdmVzO1xyXG4gICAgdGhpcy5pbmRleCA9IGluZGV4O1xyXG4gICAgdGhpcy53ZWlnaHQgPSB3ZWlnaHQ7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXBwbHlXZWlnaHQod2VpZ2h0OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMucHJpbWl0aXZlcy5mb3JFYWNoKChtZXNoKSA9PiB7XHJcbiAgICAgIGlmIChtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlcz8uW3RoaXMuaW5kZXhdICE9IG51bGwpIHtcclxuICAgICAgICBtZXNoLm1vcnBoVGFyZ2V0SW5mbHVlbmNlc1t0aGlzLmluZGV4XSArPSB0aGlzLndlaWdodCAqIHdlaWdodDtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY2xlYXJBcHBsaWVkV2VpZ2h0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5wcmltaXRpdmVzLmZvckVhY2goKG1lc2gpID0+IHtcclxuICAgICAgaWYgKG1lc2gubW9ycGhUYXJnZXRJbmZsdWVuY2VzPy5bdGhpcy5pbmRleF0gIT0gbnVsbCkge1xyXG4gICAgICAgIG1lc2gubW9ycGhUYXJnZXRJbmZsdWVuY2VzW3RoaXMuaW5kZXhdID0gMC4wO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUV4cHJlc3Npb25CaW5kIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uQmluZCc7XHJcblxyXG5jb25zdCBfdjIgPSBuZXcgVEhSRUUuVmVjdG9yMigpO1xyXG5cclxuLyoqXHJcbiAqIEEgYmluZCBvZiBleHByZXNzaW9uIGluZmx1ZW5jZXMgdG8gdGV4dHVyZSB0cmFuc2Zvcm1zLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUV4cHJlc3Npb25UZXh0dXJlVHJhbnNmb3JtQmluZCBpbXBsZW1lbnRzIFZSTUV4cHJlc3Npb25CaW5kIHtcclxuICBwcml2YXRlIHN0YXRpYyBfcHJvcGVydHlOYW1lc01hcDogeyBbZGlzdGluZ3Vpc2hlcjogc3RyaW5nXTogc3RyaW5nW10gfSA9IHtcclxuICAgIGlzTWVzaFN0YW5kYXJkTWF0ZXJpYWw6IFtcclxuICAgICAgJ21hcCcsXHJcbiAgICAgICdlbWlzc2l2ZU1hcCcsXHJcbiAgICAgICdidW1wTWFwJyxcclxuICAgICAgJ25vcm1hbE1hcCcsXHJcbiAgICAgICdkaXNwbGFjZW1lbnRNYXAnLFxyXG4gICAgICAncm91Z2huZXNzTWFwJyxcclxuICAgICAgJ21ldGFsbmVzc01hcCcsXHJcbiAgICAgICdhbHBoYU1hcCcsXHJcbiAgICBdLFxyXG4gICAgaXNNZXNoQmFzaWNNYXRlcmlhbDogWydtYXAnLCAnc3BlY3VsYXJNYXAnLCAnYWxwaGFNYXAnXSxcclxuICAgIGlzTVRvb25NYXRlcmlhbDogW1xyXG4gICAgICAnbWFwJyxcclxuICAgICAgJ25vcm1hbE1hcCcsXHJcbiAgICAgICdlbWlzc2l2ZU1hcCcsXHJcbiAgICAgICdzaGFkZU11bHRpcGx5VGV4dHVyZScsXHJcbiAgICAgICdyaW1NdWx0aXBseVRleHR1cmUnLFxyXG4gICAgICAnb3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlJyxcclxuICAgICAgJ3V2QW5pbWF0aW9uTWFza1RleHR1cmUnLFxyXG4gICAgXSxcclxuICB9O1xyXG5cclxuICAvKipcclxuICAgKiBUaGUgdGFyZ2V0IG1hdGVyaWFsLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSB1diBzY2FsZSBvZiB0aGUgdGV4dHVyZS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgc2NhbGU6IFRIUkVFLlZlY3RvcjI7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSB1diBvZmZzZXQgb2YgdGhlIHRleHR1cmUuXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IG9mZnNldDogVEhSRUUuVmVjdG9yMjtcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIGxpc3Qgb2YgdGV4dHVyZSBuYW1lcyBhbmQgaXRzIHN0YXRlIHRoYXQgc2hvdWxkIGJlIHRyYW5zZm9ybWVkIGJ5IHRoaXMgYmluZC5cclxuICAgKi9cclxuICBwcml2YXRlIF9wcm9wZXJ0aWVzOiB7XHJcbiAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICBpbml0aWFsT2Zmc2V0OiBUSFJFRS5WZWN0b3IyO1xyXG4gICAgaW5pdGlhbFNjYWxlOiBUSFJFRS5WZWN0b3IyO1xyXG4gICAgZGVsdGFPZmZzZXQ6IFRIUkVFLlZlY3RvcjI7XHJcbiAgICBkZWx0YVNjYWxlOiBUSFJFRS5WZWN0b3IyO1xyXG4gIH1bXTtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHtcclxuICAgIG1hdGVyaWFsLFxyXG4gICAgc2NhbGUsXHJcbiAgICBvZmZzZXQsXHJcbiAgfToge1xyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgdGFyZ2V0IG1hdGVyaWFsLlxyXG4gICAgICovXHJcbiAgICBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWw7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgdXYgc2NhbGUgb2YgdGhlIHRleHR1cmUuXHJcbiAgICAgKi9cclxuICAgIHNjYWxlOiBUSFJFRS5WZWN0b3IyO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogVGhlIHV2IG9mZnNldCBvZiB0aGUgdGV4dHVyZS5cclxuICAgICAqL1xyXG4gICAgb2Zmc2V0OiBUSFJFRS5WZWN0b3IyO1xyXG4gIH0pIHtcclxuICAgIHRoaXMubWF0ZXJpYWwgPSBtYXRlcmlhbDtcclxuICAgIHRoaXMuc2NhbGUgPSBzY2FsZTtcclxuICAgIHRoaXMub2Zmc2V0ID0gb2Zmc2V0O1xyXG5cclxuICAgIGNvbnN0IHByb3BlcnR5TmFtZXMgPSBPYmplY3QuZW50cmllcyhWUk1FeHByZXNzaW9uVGV4dHVyZVRyYW5zZm9ybUJpbmQuX3Byb3BlcnR5TmFtZXNNYXApLmZpbmQoXHJcbiAgICAgIChbZGlzdGluZ3Vpc2hlcl0pID0+IHtcclxuICAgICAgICByZXR1cm4gKG1hdGVyaWFsIGFzIGFueSlbZGlzdGluZ3Vpc2hlcl0gPT09IHRydWU7XHJcbiAgICAgIH0sXHJcbiAgICApPy5bMV07XHJcblxyXG4gICAgaWYgKHByb3BlcnR5TmFtZXMgPT0gbnVsbCkge1xyXG4gICAgICBjb25zb2xlLndhcm4oXHJcbiAgICAgICAgYFRyaWVkIHRvIGFkZCBhIHRleHR1cmUgdHJhbnNmb3JtIGJpbmQgdG8gdGhlIG1hdGVyaWFsICR7XHJcbiAgICAgICAgICBtYXRlcmlhbC5uYW1lID8/ICcobm8gbmFtZSknXHJcbiAgICAgICAgfSBidXQgdGhlIG1hdGVyaWFsIGlzIG5vdCBzdXBwb3J0ZWQuYCxcclxuICAgICAgKTtcclxuXHJcbiAgICAgIHRoaXMuX3Byb3BlcnRpZXMgPSBbXTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuX3Byb3BlcnRpZXMgPSBbXTtcclxuXHJcbiAgICAgIHByb3BlcnR5TmFtZXMuZm9yRWFjaCgocHJvcGVydHlOYW1lKSA9PiB7XHJcbiAgICAgICAgY29uc3QgdGV4dHVyZSA9ICgobWF0ZXJpYWwgYXMgYW55KVtwcm9wZXJ0eU5hbWVdIGFzIFRIUkVFLlRleHR1cmUgfCB1bmRlZmluZWQpPy5jbG9uZSgpO1xyXG4gICAgICAgIGlmICghdGV4dHVyZSkge1xyXG4gICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAobWF0ZXJpYWwgYXMgYW55KVtwcm9wZXJ0eU5hbWVdID0gdGV4dHVyZTsgLy8gYmVjYXVzZSB0aGUgdGV4dHVyZSBpcyBjbG9uZWRcclxuXHJcbiAgICAgICAgY29uc3QgaW5pdGlhbE9mZnNldCA9IHRleHR1cmUub2Zmc2V0LmNsb25lKCk7XHJcbiAgICAgICAgY29uc3QgaW5pdGlhbFNjYWxlID0gdGV4dHVyZS5yZXBlYXQuY2xvbmUoKTtcclxuICAgICAgICBjb25zdCBkZWx0YU9mZnNldCA9IG9mZnNldC5jbG9uZSgpLnN1Yihpbml0aWFsT2Zmc2V0KTtcclxuICAgICAgICBjb25zdCBkZWx0YVNjYWxlID0gc2NhbGUuY2xvbmUoKS5zdWIoaW5pdGlhbFNjYWxlKTtcclxuXHJcbiAgICAgICAgdGhpcy5fcHJvcGVydGllcy5wdXNoKHtcclxuICAgICAgICAgIG5hbWU6IHByb3BlcnR5TmFtZSxcclxuICAgICAgICAgIGluaXRpYWxPZmZzZXQsXHJcbiAgICAgICAgICBkZWx0YU9mZnNldCxcclxuICAgICAgICAgIGluaXRpYWxTY2FsZSxcclxuICAgICAgICAgIGRlbHRhU2NhbGUsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGFwcGx5V2VpZ2h0KHdlaWdodDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLl9wcm9wZXJ0aWVzLmZvckVhY2goKHByb3BlcnR5KSA9PiB7XHJcbiAgICAgIGNvbnN0IHRhcmdldCA9ICh0aGlzLm1hdGVyaWFsIGFzIGFueSlbcHJvcGVydHkubmFtZV0gYXMgVEhSRUUuVGV4dHVyZTtcclxuICAgICAgaWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9IC8vIFRPRE86IHdlIHNob3VsZCBraWNrIHRoaXMgYXQgYGFkZE1hdGVyaWFsVmFsdWVgXHJcblxyXG4gICAgICB0YXJnZXQub2Zmc2V0LmFkZChfdjIuY29weShwcm9wZXJ0eS5kZWx0YU9mZnNldCkubXVsdGlwbHlTY2FsYXIod2VpZ2h0KSk7XHJcbiAgICAgIHRhcmdldC5yZXBlYXQuYWRkKF92Mi5jb3B5KHByb3BlcnR5LmRlbHRhU2NhbGUpLm11bHRpcGx5U2NhbGFyKHdlaWdodCkpO1xyXG5cclxuICAgICAgdGFyZ2V0Lm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNsZWFyQXBwbGllZFdlaWdodCgpOiB2b2lkIHtcclxuICAgIHRoaXMuX3Byb3BlcnRpZXMuZm9yRWFjaCgocHJvcGVydHkpID0+IHtcclxuICAgICAgY29uc3QgdGFyZ2V0ID0gKHRoaXMubWF0ZXJpYWwgYXMgYW55KVtwcm9wZXJ0eS5uYW1lXSBhcyBUSFJFRS5UZXh0dXJlO1xyXG4gICAgICBpZiAodGFyZ2V0ID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH0gLy8gVE9ETzogd2Ugc2hvdWxkIGtpY2sgdGhpcyBhdCBgYWRkTWF0ZXJpYWxWYWx1ZWBcclxuXHJcbiAgICAgIHRhcmdldC5vZmZzZXQuY29weShwcm9wZXJ0eS5pbml0aWFsT2Zmc2V0KTtcclxuICAgICAgdGFyZ2V0LnJlcGVhdC5jb3B5KHByb3BlcnR5LmluaXRpYWxTY2FsZSk7XHJcblxyXG4gICAgICB0YXJnZXQubmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCB0eXBlICogYXMgVjBWUk0gZnJvbSAnQHBpeGl2L3R5cGVzLXZybS0wLjAnO1xyXG5pbXBvcnQgdHlwZSAqIGFzIFYxVlJNU2NoZW1hIGZyb20gJ0BwaXhpdi90eXBlcy12cm1jLXZybS0xLjAnO1xyXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEYsIEdMVEZMb2FkZXJQbHVnaW4sIEdMVEZQYXJzZXIgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcclxuaW1wb3J0IHsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUgfSBmcm9tICcuLi91dGlscy9nbHRmRXh0cmFjdFByaW1pdGl2ZXNGcm9tTm9kZSc7XHJcbmltcG9ydCB7IGdsdGZHZXRBc3NvY2lhdGVkTWF0ZXJpYWxJbmRleCB9IGZyb20gJy4uL3V0aWxzL2dsdGZHZXRBc3NvY2lhdGVkTWF0ZXJpYWxJbmRleCc7XHJcbmltcG9ydCB7IFZSTUV4cHJlc3Npb24gfSBmcm9tICcuL1ZSTUV4cHJlc3Npb24nO1xyXG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uTWFuYWdlciB9IGZyb20gJy4vVlJNRXhwcmVzc2lvbk1hbmFnZXInO1xyXG5pbXBvcnQgeyB2MEV4cHJlc3Npb25NYXRlcmlhbENvbG9yTWFwIH0gZnJvbSAnLi9WUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvclR5cGUnO1xyXG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQgfSBmcm9tICcuL1ZSTUV4cHJlc3Npb25NYXRlcmlhbENvbG9yQmluZCc7XHJcbmltcG9ydCB7IFZSTUV4cHJlc3Npb25Nb3JwaFRhcmdldEJpbmQgfSBmcm9tICcuL1ZSTUV4cHJlc3Npb25Nb3JwaFRhcmdldEJpbmQnO1xyXG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSB9IGZyb20gJy4vVlJNRXhwcmVzc2lvblByZXNldE5hbWUnO1xyXG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uVGV4dHVyZVRyYW5zZm9ybUJpbmQgfSBmcm9tICcuL1ZSTUV4cHJlc3Npb25UZXh0dXJlVHJhbnNmb3JtQmluZCc7XHJcbmltcG9ydCB7IEdMVEYgYXMgR0xURlNjaGVtYSB9IGZyb20gJ0BnbHRmLXRyYW5zZm9ybS9jb3JlJztcclxuXHJcbi8qKlxyXG4gKiBBIHBsdWdpbiBvZiBHTFRGTG9hZGVyIHRoYXQgaW1wb3J0cyBhIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW4gaW1wbGVtZW50cyBHTFRGTG9hZGVyUGx1Z2luIHtcclxuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHYwdjFQcmVzZXROYW1lTWFwOiB7IFt2ME5hbWUgaW4gVjBWUk0uQmxlbmRTaGFwZVByZXNldE5hbWVdPzogVlJNRXhwcmVzc2lvblByZXNldE5hbWUgfSA9IHtcclxuICAgIGE6ICdhYScsXHJcbiAgICBlOiAnZWUnLFxyXG4gICAgaTogJ2loJyxcclxuICAgIG86ICdvaCcsXHJcbiAgICB1OiAnb3UnLFxyXG4gICAgYmxpbms6ICdibGluaycsXHJcbiAgICBqb3k6ICdoYXBweScsXHJcbiAgICBhbmdyeTogJ2FuZ3J5JyxcclxuICAgIHNvcnJvdzogJ3NhZCcsXHJcbiAgICBmdW46ICdyZWxheGVkJyxcclxuICAgIGxvb2t1cDogJ2xvb2tVcCcsXHJcbiAgICBsb29rZG93bjogJ2xvb2tEb3duJyxcclxuICAgIGxvb2tsZWZ0OiAnbG9va0xlZnQnLFxyXG4gICAgbG9va3JpZ2h0OiAnbG9va1JpZ2h0JyxcclxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb25cclxuICAgIGJsaW5rX2w6ICdibGlua0xlZnQnLFxyXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxyXG4gICAgYmxpbmtfcjogJ2JsaW5rUmlnaHQnLFxyXG4gICAgbmV1dHJhbDogJ25ldXRyYWwnLFxyXG4gIH07XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBwYXJzZXI6IEdMVEZQYXJzZXI7XHJcblxyXG4gIHB1YmxpYyBnZXQgbmFtZSgpOiBzdHJpbmcge1xyXG4gICAgLy8gV2Ugc2hvdWxkIHVzZSB0aGUgZXh0ZW5zaW9uIG5hbWUgaW5zdGVhZCBidXQgd2UgaGF2ZSBtdWx0aXBsZSBwbHVnaW5zIGZvciBhbiBleHRlbnNpb24uLi5cclxuICAgIHJldHVybiAnVlJNRXhwcmVzc2lvbkxvYWRlclBsdWdpbic7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyc2VyOiBHTFRGUGFyc2VyKSB7XHJcbiAgICB0aGlzLnBhcnNlciA9IHBhcnNlcjtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBhZnRlclJvb3QoZ2x0ZjogR0xURik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgZ2x0Zi51c2VyRGF0YS52cm1FeHByZXNzaW9uTWFuYWdlciA9IGF3YWl0IHRoaXMuX2ltcG9ydChnbHRmKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBhIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn0gZnJvbSBhIFZSTS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgX2ltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1FeHByZXNzaW9uTWFuYWdlciB8IG51bGw+IHtcclxuICAgIGNvbnN0IHYxUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjFJbXBvcnQoZ2x0Zik7XHJcbiAgICBpZiAodjFSZXN1bHQpIHtcclxuICAgICAgcmV0dXJuIHYxUmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHYwUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjBJbXBvcnQoZ2x0Zik7XHJcbiAgICBpZiAodjBSZXN1bHQpIHtcclxuICAgICAgcmV0dXJuIHYwUmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBfdjFJbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNRXhwcmVzc2lvbk1hbmFnZXIgfCBudWxsPiB7XHJcbiAgICBjb25zdCBqc29uID0gdGhpcy5wYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIC8vIGVhcmx5IGFib3J0IGlmIGl0IGRvZXNuJ3QgdXNlIHZybVxyXG4gICAgY29uc3QgaXNWUk1Vc2VkID0ganNvbi5leHRlbnNpb25zVXNlZD8uaW5kZXhPZignVlJNQ192cm0nKSAhPT0gLTE7XHJcbiAgICBpZiAoIWlzVlJNVXNlZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LlsnVlJNQ192cm0nXSBhcyBWMVZSTVNjaGVtYS5WUk1DVlJNIHwgdW5kZWZpbmVkO1xyXG4gICAgaWYgKCFleHRlbnNpb24pIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3BlY1ZlcnNpb24gPSBleHRlbnNpb24uc3BlY1ZlcnNpb247XHJcbiAgICBpZiAoc3BlY1ZlcnNpb24gIT09ICcxLjAtYmV0YScpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2NoZW1hRXhwcmVzc2lvbnMgPSBleHRlbnNpb24uZXhwcmVzc2lvbnM7XHJcbiAgICBpZiAoIXNjaGVtYUV4cHJlc3Npb25zKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGxpc3QgZXhwcmVzc2lvbnNcclxuICAgIGNvbnN0IHByZXNldE5hbWVTZXQgPSBuZXcgU2V0PHN0cmluZz4oT2JqZWN0LnZhbHVlcyhWUk1FeHByZXNzaW9uUHJlc2V0TmFtZSkpO1xyXG4gICAgY29uc3QgbmFtZVNjaGVtYUV4cHJlc3Npb25NYXAgPSBuZXcgTWFwPHN0cmluZywgVjFWUk1TY2hlbWEuRXhwcmVzc2lvbj4oKTtcclxuXHJcbiAgICBpZiAoc2NoZW1hRXhwcmVzc2lvbnMucHJlc2V0ICE9IG51bGwpIHtcclxuICAgICAgT2JqZWN0LmVudHJpZXMoc2NoZW1hRXhwcmVzc2lvbnMucHJlc2V0KS5mb3JFYWNoKChbbmFtZSwgc2NoZW1hRXhwcmVzc2lvbl0pID0+IHtcclxuICAgICAgICBpZiAoc2NoZW1hRXhwcmVzc2lvbiA9PSBudWxsKSB7XHJcbiAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfSAvLyB0eXBlc2NyaXB0XHJcblxyXG4gICAgICAgIGlmICghcHJlc2V0TmFtZVNldC5oYXMobmFtZSkpIHtcclxuICAgICAgICAgIGNvbnNvbGUud2FybihgVlJNRXhwcmVzc2lvbkxvYWRlclBsdWdpbjogVW5rbm93biBwcmVzZXQgbmFtZSBcIiR7bmFtZX1cIiBkZXRlY3RlZC4gSWdub3JpbmcgdGhlIGV4cHJlc3Npb25gKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5hbWVTY2hlbWFFeHByZXNzaW9uTWFwLnNldChuYW1lLCBzY2hlbWFFeHByZXNzaW9uKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNjaGVtYUV4cHJlc3Npb25zLmN1c3RvbSAhPSBudWxsKSB7XHJcbiAgICAgIE9iamVjdC5lbnRyaWVzKHNjaGVtYUV4cHJlc3Npb25zLmN1c3RvbSkuZm9yRWFjaCgoW25hbWUsIHNjaGVtYUV4cHJlc3Npb25dKSA9PiB7XHJcbiAgICAgICAgaWYgKHByZXNldE5hbWVTZXQuaGFzKG5hbWUpKSB7XHJcbiAgICAgICAgICBjb25zb2xlLndhcm4oXHJcbiAgICAgICAgICAgIGBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiBDdXN0b20gZXhwcmVzc2lvbiBjYW5ub3QgaGF2ZSBwcmVzZXQgbmFtZSBcIiR7bmFtZX1cIi4gSWdub3JpbmcgdGhlIGV4cHJlc3Npb25gLFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIG5hbWVTY2hlbWFFeHByZXNzaW9uTWFwLnNldChuYW1lLCBzY2hlbWFFeHByZXNzaW9uKTtcclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gcHJlcGFyZSBtYW5hZ2VyXHJcbiAgICBjb25zdCBtYW5hZ2VyID0gbmV3IFZSTUV4cHJlc3Npb25NYW5hZ2VyKCk7XHJcblxyXG4gICAgLy8gbG9hZCBleHByZXNzaW9uc1xyXG4gICAgYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgIEFycmF5LmZyb20obmFtZVNjaGVtYUV4cHJlc3Npb25NYXAuZW50cmllcygpKS5tYXAoYXN5bmMgKFtuYW1lLCBzY2hlbWFFeHByZXNzaW9uXSkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBuZXcgVlJNRXhwcmVzc2lvbihuYW1lKTtcclxuICAgICAgICBnbHRmLnNjZW5lLmFkZChleHByZXNzaW9uKTtcclxuXHJcbiAgICAgICAgZXhwcmVzc2lvbi5pc0JpbmFyeSA9IHNjaGVtYUV4cHJlc3Npb24uaXNCaW5hcnkgPz8gZmFsc2U7XHJcbiAgICAgICAgZXhwcmVzc2lvbi5vdmVycmlkZUJsaW5rID0gc2NoZW1hRXhwcmVzc2lvbi5vdmVycmlkZUJsaW5rID8/ICdub25lJztcclxuICAgICAgICBleHByZXNzaW9uLm92ZXJyaWRlTG9va0F0ID0gc2NoZW1hRXhwcmVzc2lvbi5vdmVycmlkZUxvb2tBdCA/PyAnbm9uZSc7XHJcbiAgICAgICAgZXhwcmVzc2lvbi5vdmVycmlkZU1vdXRoID0gc2NoZW1hRXhwcmVzc2lvbi5vdmVycmlkZU1vdXRoID8/ICdub25lJztcclxuXHJcbiAgICAgICAgc2NoZW1hRXhwcmVzc2lvbi5tb3JwaFRhcmdldEJpbmRzPy5mb3JFYWNoKGFzeW5jIChiaW5kKSA9PiB7XHJcbiAgICAgICAgICBpZiAoYmluZC5ub2RlID09PSB1bmRlZmluZWQgfHwgYmluZC5pbmRleCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjb25zdCBwcmltaXRpdmVzID0gKGF3YWl0IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlKGdsdGYsIGJpbmQubm9kZSkpITtcclxuICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0SW5kZXggPSBiaW5kLmluZGV4O1xyXG5cclxuICAgICAgICAgIC8vIGNoZWNrIGlmIHRoZSBtZXNoIGhhcyB0aGUgdGFyZ2V0IG1vcnBoIHRhcmdldFxyXG4gICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAhcHJpbWl0aXZlcy5ldmVyeShcclxuICAgICAgICAgICAgICAocHJpbWl0aXZlKSA9PlxyXG4gICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheShwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzKSAmJlxyXG4gICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCA8IHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMubGVuZ3RoLFxyXG4gICAgICAgICAgICApXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICAgICAgIGBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiAke3NjaGVtYUV4cHJlc3Npb24ubmFtZX0gYXR0ZW1wdHMgdG8gaW5kZXggbW9ycGggIyR7bW9ycGhUYXJnZXRJbmRleH0gYnV0IG5vdCBmb3VuZC5gLFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgZXhwcmVzc2lvbi5hZGRCaW5kKFxyXG4gICAgICAgICAgICBuZXcgVlJNRXhwcmVzc2lvbk1vcnBoVGFyZ2V0QmluZCh7XHJcbiAgICAgICAgICAgICAgcHJpbWl0aXZlcyxcclxuICAgICAgICAgICAgICBpbmRleDogbW9ycGhUYXJnZXRJbmRleCxcclxuICAgICAgICAgICAgICB3ZWlnaHQ6IGJpbmQud2VpZ2h0ID8/IDEuMCxcclxuICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZiAoc2NoZW1hRXhwcmVzc2lvbi5tYXRlcmlhbENvbG9yQmluZHMgfHwgc2NoZW1hRXhwcmVzc2lvbi50ZXh0dXJlVHJhbnNmb3JtQmluZHMpIHtcclxuICAgICAgICAgIC8vIGxpc3QgdXAgZXZlcnkgbWF0ZXJpYWwgaW4gYGdsdGYuc2NlbmVgXHJcbiAgICAgICAgICBjb25zdCBnbHRmTWF0ZXJpYWxzOiBUSFJFRS5NYXRlcmlhbFtdID0gW107XHJcbiAgICAgICAgICBnbHRmLnNjZW5lLnRyYXZlcnNlKChvYmplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWwgPSAob2JqZWN0IGFzIGFueSkubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwgfCB1bmRlZmluZWQ7XHJcbiAgICAgICAgICAgIGlmIChtYXRlcmlhbCkge1xyXG4gICAgICAgICAgICAgIGdsdGZNYXRlcmlhbHMucHVzaChtYXRlcmlhbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIHNjaGVtYUV4cHJlc3Npb24ubWF0ZXJpYWxDb2xvckJpbmRzPy5mb3JFYWNoKGFzeW5jIChiaW5kKSA9PiB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFscyA9IGdsdGZNYXRlcmlhbHMuZmlsdGVyKChtYXRlcmlhbCkgPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsSW5kZXggPSBnbHRmR2V0QXNzb2NpYXRlZE1hdGVyaWFsSW5kZXgodGhpcy5wYXJzZXIsIG1hdGVyaWFsKTtcclxuICAgICAgICAgICAgICByZXR1cm4gYmluZC5tYXRlcmlhbCA9PT0gbWF0ZXJpYWxJbmRleDtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBtYXRlcmlhbHMuZm9yRWFjaCgobWF0ZXJpYWwpID0+IHtcclxuICAgICAgICAgICAgICBleHByZXNzaW9uLmFkZEJpbmQoXHJcbiAgICAgICAgICAgICAgICBuZXcgVlJNRXhwcmVzc2lvbk1hdGVyaWFsQ29sb3JCaW5kKHtcclxuICAgICAgICAgICAgICAgICAgbWF0ZXJpYWwsXHJcbiAgICAgICAgICAgICAgICAgIHR5cGU6IGJpbmQudHlwZSxcclxuICAgICAgICAgICAgICAgICAgdGFyZ2V0VmFsdWU6IG5ldyBUSFJFRS5Db2xvcigpLmZyb21BcnJheShiaW5kLnRhcmdldFZhbHVlKSxcclxuICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgc2NoZW1hRXhwcmVzc2lvbi50ZXh0dXJlVHJhbnNmb3JtQmluZHM/LmZvckVhY2goYXN5bmMgKGJpbmQpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxzID0gZ2x0Zk1hdGVyaWFscy5maWx0ZXIoKG1hdGVyaWFsKSA9PiB7XHJcbiAgICAgICAgICAgICAgY29uc3QgbWF0ZXJpYWxJbmRleCA9IGdsdGZHZXRBc3NvY2lhdGVkTWF0ZXJpYWxJbmRleCh0aGlzLnBhcnNlciwgbWF0ZXJpYWwpO1xyXG4gICAgICAgICAgICAgIHJldHVybiBiaW5kLm1hdGVyaWFsID09PSBtYXRlcmlhbEluZGV4O1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIG1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbCkgPT4ge1xyXG4gICAgICAgICAgICAgIGV4cHJlc3Npb24uYWRkQmluZChcclxuICAgICAgICAgICAgICAgIG5ldyBWUk1FeHByZXNzaW9uVGV4dHVyZVRyYW5zZm9ybUJpbmQoe1xyXG4gICAgICAgICAgICAgICAgICBtYXRlcmlhbCxcclxuICAgICAgICAgICAgICAgICAgb2Zmc2V0OiBuZXcgVEhSRUUuVmVjdG9yMigpLmZyb21BcnJheShiaW5kLm9mZnNldCA/PyBbMC4wLCAwLjBdKSxcclxuICAgICAgICAgICAgICAgICAgc2NhbGU6IG5ldyBUSFJFRS5WZWN0b3IyKCkuZnJvbUFycmF5KGJpbmQuc2NhbGUgPz8gWzEuMCwgMS4wXSksXHJcbiAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbWFuYWdlci5yZWdpc3RlckV4cHJlc3Npb24oZXhwcmVzc2lvbik7XHJcbiAgICAgIH0pLFxyXG4gICAgKTtcclxuXHJcbiAgICByZXR1cm4gbWFuYWdlcjtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgX3YwSW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTUV4cHJlc3Npb25NYW5hZ2VyIHwgbnVsbD4ge1xyXG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcclxuXHJcbiAgICAvLyBlYXJseSBhYm9ydCBpZiBpdCBkb2Vzbid0IHVzZSB2cm1cclxuICAgIGNvbnN0IHZybUV4dCA9IGpzb24uZXh0ZW5zaW9ucz8uVlJNIGFzIFYwVlJNLlZSTSB8IHVuZGVmaW5lZDtcclxuICAgIGlmICghdnJtRXh0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNjaGVtYUJsZW5kU2hhcGUgPSB2cm1FeHQuYmxlbmRTaGFwZU1hc3RlcjtcclxuICAgIGlmICghc2NoZW1hQmxlbmRTaGFwZSkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtYW5hZ2VyID0gbmV3IFZSTUV4cHJlc3Npb25NYW5hZ2VyKCk7XHJcblxyXG4gICAgY29uc3Qgc2NoZW1hQmxlbmRTaGFwZUdyb3VwcyA9IHNjaGVtYUJsZW5kU2hhcGUuYmxlbmRTaGFwZUdyb3VwcztcclxuICAgIGlmICghc2NoZW1hQmxlbmRTaGFwZUdyb3Vwcykge1xyXG4gICAgICByZXR1cm4gbWFuYWdlcjtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBibGVuZFNoYXBlTmFtZVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xyXG5cclxuICAgIGF3YWl0IFByb21pc2UuYWxsKFxyXG4gICAgICBzY2hlbWFCbGVuZFNoYXBlR3JvdXBzLm1hcChhc3luYyAoc2NoZW1hR3JvdXApID0+IHtcclxuICAgICAgICBjb25zdCB2MFByZXNldE5hbWUgPSBzY2hlbWFHcm91cC5wcmVzZXROYW1lO1xyXG4gICAgICAgIGNvbnN0IHYxUHJlc2V0TmFtZSA9XHJcbiAgICAgICAgICAodjBQcmVzZXROYW1lICE9IG51bGwgJiYgVlJNRXhwcmVzc2lvbkxvYWRlclBsdWdpbi52MHYxUHJlc2V0TmFtZU1hcFt2MFByZXNldE5hbWVdKSB8fCBudWxsO1xyXG4gICAgICAgIGNvbnN0IG5hbWUgPSB2MVByZXNldE5hbWUgPz8gc2NoZW1hR3JvdXAubmFtZTtcclxuXHJcbiAgICAgICAgaWYgKG5hbWUgPT0gbnVsbCkge1xyXG4gICAgICAgICAgY29uc29sZS53YXJuKCdWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiBPbmUgb2YgY3VzdG9tIGV4cHJlc3Npb25zIGhhcyBubyBuYW1lLiBJZ25vcmluZyB0aGUgZXhwcmVzc2lvbicpO1xyXG4gICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gZHVwbGljYXRpb24gY2hlY2tcclxuICAgICAgICBpZiAoYmxlbmRTaGFwZU5hbWVTZXQuaGFzKG5hbWUpKSB7XHJcbiAgICAgICAgICBjb25zb2xlLndhcm4oXHJcbiAgICAgICAgICAgIGBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiBBbiBleHByZXNzaW9uIHByZXNldCAke3YwUHJlc2V0TmFtZX0gaGFzIGR1cGxpY2F0ZWQgZW50cmllcy4gSWdub3JpbmcgdGhlIGV4cHJlc3Npb25gLFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGJsZW5kU2hhcGVOYW1lU2V0LmFkZChuYW1lKTtcclxuXHJcbiAgICAgICAgY29uc3QgZXhwcmVzc2lvbiA9IG5ldyBWUk1FeHByZXNzaW9uKG5hbWUpO1xyXG4gICAgICAgIGdsdGYuc2NlbmUuYWRkKGV4cHJlc3Npb24pO1xyXG5cclxuICAgICAgICBleHByZXNzaW9uLmlzQmluYXJ5ID0gc2NoZW1hR3JvdXAuaXNCaW5hcnkgPz8gZmFsc2U7XHJcbiAgICAgICAgLy8gdjAgZG9lc24ndCBoYXZlIGlnbm9yZSBwcm9wZXJ0aWVzXHJcblxyXG4gICAgICAgIC8vIEJpbmQgbW9ycGhUYXJnZXRcclxuICAgICAgICBpZiAoc2NoZW1hR3JvdXAuYmluZHMpIHtcclxuICAgICAgICAgIHNjaGVtYUdyb3VwLmJpbmRzLmZvckVhY2goYXN5bmMgKGJpbmQpID0+IHtcclxuICAgICAgICAgICAgaWYgKGJpbmQubWVzaCA9PT0gdW5kZWZpbmVkIHx8IGJpbmQuaW5kZXggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3Qgbm9kZXNVc2luZ01lc2g6IG51bWJlcltdID0gW107XHJcbiAgICAgICAgICAgIGpzb24ubm9kZXM/LmZvckVhY2goKG5vZGUsIGkpID0+IHtcclxuICAgICAgICAgICAgICBpZiAobm9kZS5tZXNoID09PSBiaW5kLm1lc2gpIHtcclxuICAgICAgICAgICAgICAgIG5vZGVzVXNpbmdNZXNoLnB1c2goaSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG1vcnBoVGFyZ2V0SW5kZXggPSBiaW5kLmluZGV4O1xyXG5cclxuICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgICAgICAgbm9kZXNVc2luZ01lc2gubWFwKGFzeW5jIChub2RlSW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHByaW1pdGl2ZXMgPSAoYXdhaXQgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUoZ2x0Ziwgbm9kZUluZGV4KSkhO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIGNoZWNrIGlmIHRoZSBtZXNoIGhhcyB0aGUgdGFyZ2V0IG1vcnBoIHRhcmdldFxyXG4gICAgICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgICAhcHJpbWl0aXZlcy5ldmVyeShcclxuICAgICAgICAgICAgICAgICAgICAocHJpbWl0aXZlKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgQXJyYXkuaXNBcnJheShwcmltaXRpdmUubW9ycGhUYXJnZXRJbmZsdWVuY2VzKSAmJlxyXG4gICAgICAgICAgICAgICAgICAgICAgbW9ycGhUYXJnZXRJbmRleCA8IHByaW1pdGl2ZS5tb3JwaFRhcmdldEluZmx1ZW5jZXMubGVuZ3RoLFxyXG4gICAgICAgICAgICAgICAgICApXHJcbiAgICAgICAgICAgICAgICApIHtcclxuICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICAgICAgICAgICAgIGBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luOiAke3NjaGVtYUdyb3VwLm5hbWV9IGF0dGVtcHRzIHRvIGluZGV4ICR7bW9ycGhUYXJnZXRJbmRleH10aCBtb3JwaCBidXQgbm90IGZvdW5kLmAsXHJcbiAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uLmFkZEJpbmQoXHJcbiAgICAgICAgICAgICAgICAgIG5ldyBWUk1FeHByZXNzaW9uTW9ycGhUYXJnZXRCaW5kKHtcclxuICAgICAgICAgICAgICAgICAgICBwcmltaXRpdmVzLFxyXG4gICAgICAgICAgICAgICAgICAgIGluZGV4OiBtb3JwaFRhcmdldEluZGV4LFxyXG4gICAgICAgICAgICAgICAgICAgIHdlaWdodDogMC4wMSAqIChiaW5kLndlaWdodCA/PyAxMDApLCAvLyBuYXJyb3dpbmcgdGhlIHJhbmdlIGZyb20gWyAwLjAgLSAxMDAuMCBdIHRvIFsgMC4wIC0gMS4wIF1cclxuICAgICAgICAgICAgICAgICAgfSksXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBCaW5kIE1hdGVyaWFsQ29sb3IgYW5kIFRleHR1cmVUcmFuc2Zvcm1cclxuICAgICAgICBjb25zdCBtYXRlcmlhbFZhbHVlcyA9IHNjaGVtYUdyb3VwLm1hdGVyaWFsVmFsdWVzO1xyXG4gICAgICAgIGlmIChtYXRlcmlhbFZhbHVlcyAmJiBtYXRlcmlhbFZhbHVlcy5sZW5ndGggIT09IDApIHtcclxuICAgICAgICAgIG1hdGVyaWFsVmFsdWVzLmZvckVhY2goKG1hdGVyaWFsVmFsdWUpID0+IHtcclxuICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgIG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lID09PSB1bmRlZmluZWQgfHxcclxuICAgICAgICAgICAgICBtYXRlcmlhbFZhbHVlLnByb3BlcnR5TmFtZSA9PT0gdW5kZWZpbmVkIHx8XHJcbiAgICAgICAgICAgICAgbWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSA9PT0gdW5kZWZpbmVkXHJcbiAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAqIOOCouODkOOCv+ODvOOBruOCquODluOCuOOCp+OCr+ODiOOBq+ioreWumuOBleOCjOOBpuOBhOOCi+ODnuODhuODquOCouODq+OBruWGheOBi+OCiVxyXG4gICAgICAgICAgICAgKiBtYXRlcmlhbFZhbHVl44Gn5oyH5a6a44GV44KM44Gm44GE44KL44Oe44OG44Oq44Ki44Or44KS6ZuG44KB44KL44CCXHJcbiAgICAgICAgICAgICAqXHJcbiAgICAgICAgICAgICAqIOeJueWumuOBq+OBr+WQjeWJjeOCkuS9v+eUqOOBmeOCi+OAglxyXG4gICAgICAgICAgICAgKiDjgqLjgqbjg4jjg6njgqTjg7Pmj4/nlLvnlKjjga7jg57jg4bjg6rjgqLjg6vjgoLlkIzmmYLjgavpm4bjgoHjgovjgIJcclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsczogVEhSRUUuTWF0ZXJpYWxbXSA9IFtdO1xyXG4gICAgICAgICAgICBnbHRmLnNjZW5lLnRyYXZlcnNlKChvYmplY3QpID0+IHtcclxuICAgICAgICAgICAgICBpZiAoKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRlcmlhbDogVEhSRUUuTWF0ZXJpYWxbXSB8IFRIUkVFLk1hdGVyaWFsID0gKG9iamVjdCBhcyBhbnkpLm1hdGVyaWFsO1xyXG4gICAgICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkobWF0ZXJpYWwpKSB7XHJcbiAgICAgICAgICAgICAgICAgIG1hdGVyaWFscy5wdXNoKFxyXG4gICAgICAgICAgICAgICAgICAgIC4uLm1hdGVyaWFsLmZpbHRlcihcclxuICAgICAgICAgICAgICAgICAgICAgIChtdGwpID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIChtdGwubmFtZSA9PT0gbWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbE5hbWUhIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbXRsLm5hbWUgPT09IG1hdGVyaWFsVmFsdWUubWF0ZXJpYWxOYW1lISArICcgKE91dGxpbmUpJykgJiZcclxuICAgICAgICAgICAgICAgICAgICAgICAgbWF0ZXJpYWxzLmluZGV4T2YobXRsKSA9PT0gLTEsXHJcbiAgICAgICAgICAgICAgICAgICAgKSxcclxuICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAobWF0ZXJpYWwubmFtZSA9PT0gbWF0ZXJpYWxWYWx1ZS5tYXRlcmlhbE5hbWUgJiYgbWF0ZXJpYWxzLmluZGV4T2YobWF0ZXJpYWwpID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICBtYXRlcmlhbHMucHVzaChtYXRlcmlhbCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsUHJvcGVydHlOYW1lID0gbWF0ZXJpYWxWYWx1ZS5wcm9wZXJ0eU5hbWU7XHJcbiAgICAgICAgICAgIG1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbCkgPT4ge1xyXG4gICAgICAgICAgICAgIC8vIFRleHR1cmVUcmFuc2Zvcm1CaW5kXHJcbiAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsUHJvcGVydHlOYW1lID09PSAnX01haW5UZXhfU1QnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzY2FsZSA9IG5ldyBUSFJFRS5WZWN0b3IyKG1hdGVyaWFsVmFsdWUudGFyZ2V0VmFsdWUhWzBdLCBtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlIVsxXSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBvZmZzZXQgPSBuZXcgVEhSRUUuVmVjdG9yMihtYXRlcmlhbFZhbHVlLnRhcmdldFZhbHVlIVsyXSwgbWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSFbM10pO1xyXG4gICAgICAgICAgICAgICAgZXhwcmVzc2lvbi5hZGRCaW5kKFxyXG4gICAgICAgICAgICAgICAgICBuZXcgVlJNRXhwcmVzc2lvblRleHR1cmVUcmFuc2Zvcm1CaW5kKHtcclxuICAgICAgICAgICAgICAgICAgICBtYXRlcmlhbCxcclxuICAgICAgICAgICAgICAgICAgICBzY2FsZSxcclxuICAgICAgICAgICAgICAgICAgICBvZmZzZXQsXHJcbiAgICAgICAgICAgICAgICAgIH0pLFxyXG4gICAgICAgICAgICAgICAgKTtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAvLyBNYXRlcmlhbENvbG9yQmluZFxyXG4gICAgICAgICAgICAgIGNvbnN0IG1hdGVyaWFsQ29sb3JUeXBlID0gdjBFeHByZXNzaW9uTWF0ZXJpYWxDb2xvck1hcFttYXRlcmlhbFByb3BlcnR5TmFtZV07XHJcbiAgICAgICAgICAgICAgaWYgKG1hdGVyaWFsQ29sb3JUeXBlKSB7XHJcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uLmFkZEJpbmQoXHJcbiAgICAgICAgICAgICAgICAgIG5ldyBWUk1FeHByZXNzaW9uTWF0ZXJpYWxDb2xvckJpbmQoe1xyXG4gICAgICAgICAgICAgICAgICAgIG1hdGVyaWFsLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IG1hdGVyaWFsQ29sb3JUeXBlLFxyXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoLi4ubWF0ZXJpYWxWYWx1ZS50YXJnZXRWYWx1ZSEuc2xpY2UoMCwgMykpLFxyXG4gICAgICAgICAgICAgICAgICB9KSxcclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKG1hdGVyaWFsUHJvcGVydHlOYW1lICsgJyBpcyBub3Qgc3VwcG9ydGVkJyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBtYW5hZ2VyLnJlZ2lzdGVyRXhwcmVzc2lvbihleHByZXNzaW9uKTtcclxuICAgICAgfSksXHJcbiAgICApO1xyXG5cclxuICAgIHJldHVybiBtYW5hZ2VyO1xyXG4gIH1cclxufVxyXG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cclxuXHJcbmV4cG9ydCBjb25zdCBWUk1FeHByZXNzaW9uT3ZlcnJpZGVUeXBlID0ge1xyXG4gIE5vbmU6ICdub25lJyxcclxuICBCbG9jazogJ2Jsb2NrJyxcclxuICBCbGVuZDogJ2JsZW5kJyxcclxufSBhcyBjb25zdDtcclxuXHJcbmV4cG9ydCB0eXBlIFZSTUV4cHJlc3Npb25PdmVycmlkZVR5cGUgPSB0eXBlb2YgVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZVtrZXlvZiB0eXBlb2YgVlJNRXhwcmVzc2lvbk92ZXJyaWRlVHlwZV07XHJcbiIsImltcG9ydCB0eXBlIHsgVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvbiB9IGZyb20gJy4vVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvbic7XHJcbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHR5cGUgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcclxuXHJcbmV4cG9ydCBjbGFzcyBWUk1GaXJzdFBlcnNvbiB7XHJcbiAgLyoqXHJcbiAgICogQSBkZWZhdWx0IGNhbWVyYSBsYXllciBmb3IgYEZpcnN0UGVyc29uT25seWAgbGF5ZXIuXHJcbiAgICpcclxuICAgKiBAc2VlIFtbZ2V0Rmlyc3RQZXJzb25Pbmx5TGF5ZXJdXVxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSID0gOTtcclxuXHJcbiAgLyoqXHJcbiAgICogQSBkZWZhdWx0IGNhbWVyYSBsYXllciBmb3IgYFRoaXJkUGVyc29uT25seWAgbGF5ZXIuXHJcbiAgICpcclxuICAgKiBAc2VlIFtbZ2V0VGhpcmRQZXJzb25Pbmx5TGF5ZXJdXVxyXG4gICAqL1xyXG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSID0gMTA7XHJcblxyXG4gIC8qKlxyXG4gICAqIEl0cyBhc3NvY2lhdGVkIHtAbGluayBWUk1IdW1hbm9pZH0uXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGh1bWFub2lkOiBWUk1IdW1hbm9pZDtcclxuICBwdWJsaWMgbWVzaEFubm90YXRpb25zOiBWUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uW107XHJcblxyXG4gIHByaXZhdGUgX2ZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSO1xyXG4gIHByaXZhdGUgX3RoaXJkUGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uREVGQVVMVF9USElSRFBFUlNPTl9PTkxZX0xBWUVSO1xyXG5cclxuICBwcml2YXRlIF9pbml0aWFsaXplZExheWVycyA9IGZhbHNlO1xyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgVlJNRmlyc3RQZXJzb24gb2JqZWN0LlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGh1bWFub2lkIEEge0BsaW5rIFZSTUh1bWFub2lkfVxyXG4gICAqIEBwYXJhbSBtZXNoQW5ub3RhdGlvbnMgQSByZW5kZXJlciBzZXR0aW5ncy4gU2VlIHRoZSBkZXNjcmlwdGlvbiBvZiBbW1JlbmRlcmVyRmlyc3RQZXJzb25GbGFnc11dIGZvciBtb3JlIGluZm9cclxuICAgKi9cclxuICBwdWJsaWMgY29uc3RydWN0b3IoaHVtYW5vaWQ6IFZSTUh1bWFub2lkLCBtZXNoQW5ub3RhdGlvbnM6IFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25bXSkge1xyXG4gICAgdGhpcy5odW1hbm9pZCA9IGh1bWFub2lkO1xyXG4gICAgdGhpcy5tZXNoQW5ub3RhdGlvbnMgPSBtZXNoQW5ub3RhdGlvbnM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb3B5IHRoZSBnaXZlbiB7QGxpbmsgVlJNRmlyc3RQZXJzb259IGludG8gdGhpcyBvbmUuXHJcbiAgICoge0BsaW5rIGh1bWFub2lkfSBtdXN0IGJlIHNhbWUgYXMgdGhlIHNvdXJjZSBvbmUuXHJcbiAgICogQHBhcmFtIHNvdXJjZSBUaGUge0BsaW5rIFZSTUZpcnN0UGVyc29ufSB5b3Ugd2FudCB0byBjb3B5XHJcbiAgICogQHJldHVybnMgdGhpc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogVlJNRmlyc3RQZXJzb24pOiB0aGlzIHtcclxuICAgIGlmICh0aGlzLmh1bWFub2lkICE9PSBzb3VyY2UuaHVtYW5vaWQpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdWUk1GaXJzdFBlcnNvbjogaHVtYW5vaWQgbXVzdCBiZSBzYW1lIGluIG9yZGVyIHRvIGNvcHknKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLm1lc2hBbm5vdGF0aW9ucyA9IHNvdXJjZS5tZXNoQW5ub3RhdGlvbnMubWFwKChhbm5vdGF0aW9uKSA9PiAoe1xyXG4gICAgICBtZXNoZXM6IGFubm90YXRpb24ubWVzaGVzLmNvbmNhdCgpLFxyXG4gICAgICB0eXBlOiBhbm5vdGF0aW9uLnR5cGUsXHJcbiAgICB9KSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm5zIGEgY2xvbmUgb2YgdGhpcyB7QGxpbmsgVlJNRmlyc3RQZXJzb259LlxyXG4gICAqIEByZXR1cm5zIENvcGllZCB7QGxpbmsgVlJNRmlyc3RQZXJzb259XHJcbiAgICovXHJcbiAgcHVibGljIGNsb25lKCk6IFZSTUZpcnN0UGVyc29uIHtcclxuICAgIHJldHVybiBuZXcgVlJNRmlyc3RQZXJzb24odGhpcy5odW1hbm9pZCwgdGhpcy5tZXNoQW5ub3RhdGlvbnMpLmNvcHkodGhpcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBIGNhbWVyYSBsYXllciByZXByZXNlbnRzIGBGaXJzdFBlcnNvbk9ubHlgIGxheWVyLlxyXG4gICAqIE5vdGUgdGhhdCAqKnlvdSBtdXN0IGNhbGwge0BsaW5rIHNldHVwfSBmaXJzdCBiZWZvcmUgeW91IHVzZSB0aGUgbGF5ZXIgZmVhdHVyZSoqIG9yIGl0IGRvZXMgbm90IHdvcmsgcHJvcGVybHkuXHJcbiAgICpcclxuICAgKiBUaGUgdmFsdWUgaXMge0BsaW5rIERFRkFVTFRfRklSU1RQRVJTT05fT05MWV9MQVlFUn0gYnkgZGVmYXVsdCBidXQgeW91IGNhbiBjaGFuZ2UgdGhlIGxheWVyIGJ5IHNwZWNpZnlpbmcgdmlhIHtAbGluayBzZXR1cH0gaWYgeW91IHByZWZlci5cclxuICAgKlxyXG4gICAqIEBzZWUgaHR0cHM6Ly92cm0uZGV2L2VuL3VuaXZybS9hcGkvdW5pdnJtX3VzZV9maXJzdHBlcnNvbi9cclxuICAgKiBAc2VlIGh0dHBzOi8vdGhyZWVqcy5vcmcvZG9jcy8jYXBpL2VuL2NvcmUvTGF5ZXJzXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBmaXJzdFBlcnNvbk9ubHlMYXllcigpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBjYW1lcmEgbGF5ZXIgcmVwcmVzZW50cyBgVGhpcmRQZXJzb25Pbmx5YCBsYXllci5cclxuICAgKiBOb3RlIHRoYXQgKip5b3UgbXVzdCBjYWxsIHtAbGluayBzZXR1cH0gZmlyc3QgYmVmb3JlIHlvdSB1c2UgdGhlIGxheWVyIGZlYXR1cmUqKiBvciBpdCBkb2VzIG5vdCB3b3JrIHByb3Blcmx5LlxyXG4gICAqXHJcbiAgICogVGhlIHZhbHVlIGlzIHtAbGluayBERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVJ9IGJ5IGRlZmF1bHQgYnV0IHlvdSBjYW4gY2hhbmdlIHRoZSBsYXllciBieSBzcGVjaWZ5aW5nIHZpYSB7QGxpbmsgc2V0dXB9IGlmIHlvdSBwcmVmZXIuXHJcbiAgICpcclxuICAgKiBAc2VlIGh0dHBzOi8vdnJtLmRldi9lbi91bml2cm0vYXBpL3VuaXZybV91c2VfZmlyc3RwZXJzb24vXHJcbiAgICogQHNlZSBodHRwczovL3RocmVlanMub3JnL2RvY3MvI2FwaS9lbi9jb3JlL0xheWVyc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgdGhpcmRQZXJzb25Pbmx5TGF5ZXIoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcjtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEluIHRoaXMgbWV0aG9kLCBpdCBhc3NpZ25zIGxheWVycyBmb3IgZXZlcnkgbWVzaGVzIGJhc2VkIG9uIG1lc2ggYW5ub3RhdGlvbnMuXHJcbiAgICogWW91IG11c3QgY2FsbCB0aGlzIG1ldGhvZCBmaXJzdCBiZWZvcmUgeW91IHVzZSB0aGUgbGF5ZXIgZmVhdHVyZS5cclxuICAgKlxyXG4gICAqIFRoaXMgaXMgYW4gZXF1aXZhbGVudCBvZiBbVlJNRmlyc3RQZXJzb24uU2V0dXBdKGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy9VbmlWUk0vYmxvYi83M2E1YmQ4ZmNkZGFhMmE3YTg3MzUwOTlhOTdlNjNjOWRiM2U1ZWEwL0Fzc2V0cy9WUk0vUnVudGltZS9GaXJzdFBlcnNvbi9WUk1GaXJzdFBlcnNvbi5jcyNMMjk1LUwyOTkpIG9mIHRoZSBVbmlWUk0uXHJcbiAgICpcclxuICAgKiBUaGUgYGNhbWVyYUxheWVyYCBwYXJhbWV0ZXIgc3BlY2lmaWVzIHdoaWNoIGxheWVyIHdpbGwgYmUgYXNzaWduZWQgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIC8gYFRoaXJkUGVyc29uT25seWAuXHJcbiAgICogSW4gVW5pVlJNLCB3ZSBzcGVjaWZpZWQgdGhvc2UgYnkgbmFtaW5nIGVhY2ggZGVzaXJlZCBsYXllciBhcyBgRklSU1RQRVJTT05fT05MWV9MQVlFUmAgLyBgVEhJUkRQRVJTT05fT05MWV9MQVlFUmBcclxuICAgKiBidXQgd2UgYXJlIGdvaW5nIHRvIHNwZWNpZnkgdGhlc2UgbGF5ZXJzIGF0IGhlcmUgc2luY2Ugd2UgYXJlIHVuYWJsZSB0byBuYW1lIGxheWVycyBpbiBUaHJlZS5qcy5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBjYW1lcmFMYXllciBTcGVjaWZ5IHdoaWNoIGxheWVyIHdpbGwgYmUgZm9yIGBGaXJzdFBlcnNvbk9ubHlgIC8gYFRoaXJkUGVyc29uT25seWAuXHJcbiAgICovXHJcbiAgcHVibGljIHNldHVwKHtcclxuICAgIGZpcnN0UGVyc29uT25seUxheWVyID0gVlJNRmlyc3RQZXJzb24uREVGQVVMVF9GSVJTVFBFUlNPTl9PTkxZX0xBWUVSLFxyXG4gICAgdGhpcmRQZXJzb25Pbmx5TGF5ZXIgPSBWUk1GaXJzdFBlcnNvbi5ERUZBVUxUX1RISVJEUEVSU09OX09OTFlfTEFZRVIsXHJcbiAgfSA9IHt9KTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5faW5pdGlhbGl6ZWRMYXllcnMpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIgPSBmaXJzdFBlcnNvbk9ubHlMYXllcjtcclxuICAgIHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyID0gdGhpcmRQZXJzb25Pbmx5TGF5ZXI7XHJcblxyXG4gICAgdGhpcy5tZXNoQW5ub3RhdGlvbnMuZm9yRWFjaCgoaXRlbSkgPT4ge1xyXG4gICAgICBpdGVtLm1lc2hlcy5mb3JFYWNoKChtZXNoKSA9PiB7XHJcbiAgICAgICAgaWYgKGl0ZW0udHlwZSA9PT0gJ2ZpcnN0UGVyc29uT25seScpIHtcclxuICAgICAgICAgIG1lc2gubGF5ZXJzLnNldCh0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcik7XHJcbiAgICAgICAgICBtZXNoLnRyYXZlcnNlKChjaGlsZCkgPT4gY2hpbGQubGF5ZXJzLnNldCh0aGlzLl9maXJzdFBlcnNvbk9ubHlMYXllcikpO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaXRlbS50eXBlID09PSAndGhpcmRQZXJzb25Pbmx5Jykge1xyXG4gICAgICAgICAgbWVzaC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcclxuICAgICAgICAgIG1lc2gudHJhdmVyc2UoKGNoaWxkKSA9PiBjaGlsZC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKSk7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtLnR5cGUgPT09ICdhdXRvJykge1xyXG4gICAgICAgICAgdGhpcy5fY3JlYXRlSGVhZGxlc3NNb2RlbChtZXNoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5faW5pdGlhbGl6ZWRMYXllcnMgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfZXhjbHVkZVRyaWFuZ2xlcyh0cmlhbmdsZXM6IG51bWJlcltdLCBid3M6IG51bWJlcltdW10sIHNraW5JbmRleDogbnVtYmVyW11bXSwgZXhjbHVkZTogbnVtYmVyW10pOiBudW1iZXIge1xyXG4gICAgbGV0IGNvdW50ID0gMDtcclxuICAgIGlmIChid3MgIT0gbnVsbCAmJiBid3MubGVuZ3RoID4gMCkge1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRyaWFuZ2xlcy5sZW5ndGg7IGkgKz0gMykge1xyXG4gICAgICAgIGNvbnN0IGEgPSB0cmlhbmdsZXNbaV07XHJcbiAgICAgICAgY29uc3QgYiA9IHRyaWFuZ2xlc1tpICsgMV07XHJcbiAgICAgICAgY29uc3QgYyA9IHRyaWFuZ2xlc1tpICsgMl07XHJcbiAgICAgICAgY29uc3QgYncwID0gYndzW2FdO1xyXG4gICAgICAgIGNvbnN0IHNraW4wID0gc2tpbkluZGV4W2FdO1xyXG5cclxuICAgICAgICBpZiAoYncwWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzBdKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKGJ3MFsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMFsxXSkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChidzBbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjBbMl0pKSBjb250aW51ZTtcclxuICAgICAgICBpZiAoYncwWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4wWzNdKSkgY29udGludWU7XHJcblxyXG4gICAgICAgIGNvbnN0IGJ3MSA9IGJ3c1tiXTtcclxuICAgICAgICBjb25zdCBza2luMSA9IHNraW5JbmRleFtiXTtcclxuICAgICAgICBpZiAoYncxWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzBdKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKGJ3MVsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMVsxXSkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChidzFbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjFbMl0pKSBjb250aW51ZTtcclxuICAgICAgICBpZiAoYncxWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4xWzNdKSkgY29udGludWU7XHJcblxyXG4gICAgICAgIGNvbnN0IGJ3MiA9IGJ3c1tjXTtcclxuICAgICAgICBjb25zdCBza2luMiA9IHNraW5JbmRleFtjXTtcclxuICAgICAgICBpZiAoYncyWzBdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzBdKSkgY29udGludWU7XHJcbiAgICAgICAgaWYgKGJ3MlsxXSA+IDAgJiYgZXhjbHVkZS5pbmNsdWRlcyhza2luMlsxXSkpIGNvbnRpbnVlO1xyXG4gICAgICAgIGlmIChidzJbMl0gPiAwICYmIGV4Y2x1ZGUuaW5jbHVkZXMoc2tpbjJbMl0pKSBjb250aW51ZTtcclxuICAgICAgICBpZiAoYncyWzNdID4gMCAmJiBleGNsdWRlLmluY2x1ZGVzKHNraW4yWzNdKSkgY29udGludWU7XHJcblxyXG4gICAgICAgIHRyaWFuZ2xlc1tjb3VudCsrXSA9IGE7XHJcbiAgICAgICAgdHJpYW5nbGVzW2NvdW50KytdID0gYjtcclxuICAgICAgICB0cmlhbmdsZXNbY291bnQrK10gPSBjO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gY291bnQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9jcmVhdGVFcmFzZWRNZXNoKHNyYzogVEhSRUUuU2tpbm5lZE1lc2gsIGVyYXNpbmdCb25lc0luZGV4OiBudW1iZXJbXSk6IFRIUkVFLlNraW5uZWRNZXNoIHtcclxuICAgIGNvbnN0IGRzdCA9IG5ldyBUSFJFRS5Ta2lubmVkTWVzaChzcmMuZ2VvbWV0cnkuY2xvbmUoKSwgc3JjLm1hdGVyaWFsKTtcclxuICAgIGRzdC5uYW1lID0gYCR7c3JjLm5hbWV9KGVyYXNlKWA7XHJcbiAgICBkc3QuZnJ1c3R1bUN1bGxlZCA9IHNyYy5mcnVzdHVtQ3VsbGVkO1xyXG4gICAgZHN0LmxheWVycy5zZXQodGhpcy5fZmlyc3RQZXJzb25Pbmx5TGF5ZXIpO1xyXG5cclxuICAgIGNvbnN0IGdlb21ldHJ5ID0gZHN0Lmdlb21ldHJ5O1xyXG5cclxuICAgIGNvbnN0IHNraW5JbmRleEF0dHIgPSBnZW9tZXRyeS5nZXRBdHRyaWJ1dGUoJ3NraW5JbmRleCcpLmFycmF5O1xyXG4gICAgY29uc3Qgc2tpbkluZGV4ID0gW107XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHNraW5JbmRleEF0dHIubGVuZ3RoOyBpICs9IDQpIHtcclxuICAgICAgc2tpbkluZGV4LnB1c2goW3NraW5JbmRleEF0dHJbaV0sIHNraW5JbmRleEF0dHJbaSArIDFdLCBza2luSW5kZXhBdHRyW2kgKyAyXSwgc2tpbkluZGV4QXR0cltpICsgM11dKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBza2luV2VpZ2h0QXR0ciA9IGdlb21ldHJ5LmdldEF0dHJpYnV0ZSgnc2tpbldlaWdodCcpLmFycmF5O1xyXG4gICAgY29uc3Qgc2tpbldlaWdodCA9IFtdO1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBza2luV2VpZ2h0QXR0ci5sZW5ndGg7IGkgKz0gNCkge1xyXG4gICAgICBza2luV2VpZ2h0LnB1c2goW3NraW5XZWlnaHRBdHRyW2ldLCBza2luV2VpZ2h0QXR0cltpICsgMV0sIHNraW5XZWlnaHRBdHRyW2kgKyAyXSwgc2tpbldlaWdodEF0dHJbaSArIDNdXSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaW5kZXggPSBnZW9tZXRyeS5nZXRJbmRleCgpO1xyXG4gICAgaWYgKCFpbmRleCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZ2VvbWV0cnkgZG9lc24ndCBoYXZlIGFuIGluZGV4IGJ1ZmZlclwiKTtcclxuICAgIH1cclxuICAgIGNvbnN0IG9sZFRyaWFuZ2xlcyA9IEFycmF5LmZyb20oaW5kZXguYXJyYXkpO1xyXG5cclxuICAgIGNvbnN0IGNvdW50ID0gdGhpcy5fZXhjbHVkZVRyaWFuZ2xlcyhvbGRUcmlhbmdsZXMsIHNraW5XZWlnaHQsIHNraW5JbmRleCwgZXJhc2luZ0JvbmVzSW5kZXgpO1xyXG4gICAgY29uc3QgbmV3VHJpYW5nbGU6IG51bWJlcltdID0gW107XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcclxuICAgICAgbmV3VHJpYW5nbGVbaV0gPSBvbGRUcmlhbmdsZXNbaV07XHJcbiAgICB9XHJcbiAgICBnZW9tZXRyeS5zZXRJbmRleChuZXdUcmlhbmdsZSk7XHJcblxyXG4gICAgLy8gbXRvb24gbWF0ZXJpYWwgaW5jbHVkZXMgb25CZWZvcmVSZW5kZXIuIHRoaXMgaXMgdW5zdXBwb3J0ZWQgYXQgU2tpbm5lZE1lc2gjY2xvbmVcclxuICAgIGlmIChzcmMub25CZWZvcmVSZW5kZXIpIHtcclxuICAgICAgZHN0Lm9uQmVmb3JlUmVuZGVyID0gc3JjLm9uQmVmb3JlUmVuZGVyO1xyXG4gICAgfVxyXG4gICAgZHN0LmJpbmQobmV3IFRIUkVFLlNrZWxldG9uKHNyYy5za2VsZXRvbi5ib25lcywgc3JjLnNrZWxldG9uLmJvbmVJbnZlcnNlcyksIG5ldyBUSFJFRS5NYXRyaXg0KCkpO1xyXG4gICAgcmV0dXJuIGRzdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2NyZWF0ZUhlYWRsZXNzTW9kZWxGb3JTa2lubmVkTWVzaChwYXJlbnQ6IFRIUkVFLk9iamVjdDNELCBtZXNoOiBUSFJFRS5Ta2lubmVkTWVzaCk6IHZvaWQge1xyXG4gICAgY29uc3QgZXJhc2VCb25lSW5kZXhlczogbnVtYmVyW10gPSBbXTtcclxuICAgIG1lc2guc2tlbGV0b24uYm9uZXMuZm9yRWFjaCgoYm9uZSwgaW5kZXgpID0+IHtcclxuICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQoYm9uZSkpIGVyYXNlQm9uZUluZGV4ZXMucHVzaChpbmRleCk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBVbmxpa2UgVW5pVlJNIHdlIGRvbid0IGNvcHkgbWVzaCBpZiBubyBpbnZpc2libGUgYm9uZSB3YXMgZm91bmRcclxuICAgIGlmICghZXJhc2VCb25lSW5kZXhlcy5sZW5ndGgpIHtcclxuICAgICAgbWVzaC5sYXllcnMuZW5hYmxlKHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcclxuICAgICAgbWVzaC5sYXllcnMuZW5hYmxlKHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgbWVzaC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcclxuICAgIGNvbnN0IG5ld01lc2ggPSB0aGlzLl9jcmVhdGVFcmFzZWRNZXNoKG1lc2gsIGVyYXNlQm9uZUluZGV4ZXMpO1xyXG4gICAgcGFyZW50LmFkZChuZXdNZXNoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2NyZWF0ZUhlYWRsZXNzTW9kZWwobm9kZTogVEhSRUUuT2JqZWN0M0QpOiB2b2lkIHtcclxuICAgIGlmIChub2RlLnR5cGUgPT09ICdHcm91cCcpIHtcclxuICAgICAgbm9kZS5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKTtcclxuICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQobm9kZSkpIHtcclxuICAgICAgICBub2RlLnRyYXZlcnNlKChjaGlsZCkgPT4gY2hpbGQubGF5ZXJzLnNldCh0aGlzLl90aGlyZFBlcnNvbk9ubHlMYXllcikpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGNvbnN0IHBhcmVudCA9IG5ldyBUSFJFRS5Hcm91cCgpO1xyXG4gICAgICAgIHBhcmVudC5uYW1lID0gYF9oZWFkbGVzc18ke25vZGUubmFtZX1gO1xyXG4gICAgICAgIHBhcmVudC5sYXllcnMuc2V0KHRoaXMuX2ZpcnN0UGVyc29uT25seUxheWVyKTtcclxuICAgICAgICBub2RlLnBhcmVudCEuYWRkKHBhcmVudCk7XHJcbiAgICAgICAgbm9kZS5jaGlsZHJlblxyXG4gICAgICAgICAgLmZpbHRlcigoY2hpbGQpID0+IGNoaWxkLnR5cGUgPT09ICdTa2lubmVkTWVzaCcpXHJcbiAgICAgICAgICAuZm9yRWFjaCgoY2hpbGQpID0+IHtcclxuICAgICAgICAgICAgY29uc3Qgc2tpbm5lZE1lc2ggPSBjaGlsZCBhcyBUSFJFRS5Ta2lubmVkTWVzaDtcclxuICAgICAgICAgICAgdGhpcy5fY3JlYXRlSGVhZGxlc3NNb2RlbEZvclNraW5uZWRNZXNoKHBhcmVudCwgc2tpbm5lZE1lc2gpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAobm9kZS50eXBlID09PSAnU2tpbm5lZE1lc2gnKSB7XHJcbiAgICAgIGNvbnN0IHNraW5uZWRNZXNoID0gbm9kZSBhcyBUSFJFRS5Ta2lubmVkTWVzaDtcclxuICAgICAgdGhpcy5fY3JlYXRlSGVhZGxlc3NNb2RlbEZvclNraW5uZWRNZXNoKG5vZGUucGFyZW50ISwgc2tpbm5lZE1lc2gpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgaWYgKHRoaXMuX2lzRXJhc2VUYXJnZXQobm9kZSkpIHtcclxuICAgICAgICBub2RlLmxheWVycy5zZXQodGhpcy5fdGhpcmRQZXJzb25Pbmx5TGF5ZXIpO1xyXG4gICAgICAgIG5vZGUudHJhdmVyc2UoKGNoaWxkKSA9PiBjaGlsZC5sYXllcnMuc2V0KHRoaXMuX3RoaXJkUGVyc29uT25seUxheWVyKSk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2lzRXJhc2VUYXJnZXQoYm9uZTogVEhSRUUuT2JqZWN0M0QpOiBib29sZWFuIHtcclxuICAgIGlmIChib25lID09PSB0aGlzLmh1bWFub2lkLmdldFJhd0JvbmVOb2RlKCdoZWFkJykpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9IGVsc2UgaWYgKCFib25lLnBhcmVudCkge1xyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gdGhpcy5faXNFcmFzZVRhcmdldChib25lLnBhcmVudCk7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCB0eXBlICogYXMgVjBWUk0gZnJvbSAnQHBpeGl2L3R5cGVzLXZybS0wLjAnO1xyXG5pbXBvcnQgdHlwZSAqIGFzIFYxVlJNU2NoZW1hIGZyb20gJ0BwaXhpdi90eXBlcy12cm1jLXZybS0xLjAnO1xyXG5pbXBvcnQgdHlwZSB7IEdMVEYsIEdMVEZMb2FkZXJQbHVnaW4sIEdMVEZQYXJzZXIgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcclxuaW1wb3J0IHR5cGUgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkL1ZSTUh1bWFub2lkJztcclxuaW1wb3J0IHsgZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGVzIH0gZnJvbSAnLi4vdXRpbHMvZ2x0ZkV4dHJhY3RQcmltaXRpdmVzRnJvbU5vZGUnO1xyXG5pbXBvcnQgeyBWUk1GaXJzdFBlcnNvbiB9IGZyb20gJy4vVlJNRmlyc3RQZXJzb24nO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb24gfSBmcm9tICcuL1ZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb24nO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlIH0gZnJvbSAnLi9WUk1GaXJzdFBlcnNvbk1lc2hBbm5vdGF0aW9uVHlwZSc7XHJcbmltcG9ydCB7IEdMVEYgYXMgR0xURlNjaGVtYSB9IGZyb20gJ0BnbHRmLXRyYW5zZm9ybS9jb3JlJztcclxuXHJcbi8qKlxyXG4gKiBBIHBsdWdpbiBvZiBHTFRGTG9hZGVyIHRoYXQgaW1wb3J0cyBhIHtAbGluayBWUk1GaXJzdFBlcnNvbn0gZnJvbSBhIFZSTSBleHRlbnNpb24gb2YgYSBHTFRGLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUZpcnN0UGVyc29uTG9hZGVyUGx1Z2luIGltcGxlbWVudHMgR0xURkxvYWRlclBsdWdpbiB7XHJcbiAgcHVibGljIHJlYWRvbmx5IHBhcnNlcjogR0xURlBhcnNlcjtcclxuXHJcbiAgcHVibGljIGdldCBuYW1lKCk6IHN0cmluZyB7XHJcbiAgICAvLyBXZSBzaG91bGQgdXNlIHRoZSBleHRlbnNpb24gbmFtZSBpbnN0ZWFkIGJ1dCB3ZSBoYXZlIG11bHRpcGxlIHBsdWdpbnMgZm9yIGFuIGV4dGVuc2lvbi4uLlxyXG4gICAgcmV0dXJuICdWUk1GaXJzdFBlcnNvbkxvYWRlclBsdWdpbic7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyc2VyOiBHTFRGUGFyc2VyKSB7XHJcbiAgICB0aGlzLnBhcnNlciA9IHBhcnNlcjtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBhZnRlclJvb3QoZ2x0ZjogR0xURik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdnJtSHVtYW5vaWQgPSBnbHRmLnVzZXJEYXRhLnZybUh1bWFub2lkIGFzIFZSTUh1bWFub2lkIHwgdW5kZWZpbmVkO1xyXG5cclxuICAgIC8vIGV4cGxpY2l0bHkgZGlzdGluZ3Vpc2ggbnVsbCBhbmQgdW5kZWZpbmVkXHJcbiAgICAvLyBzaW5jZSB2cm1IdW1hbm9pZCBtaWdodCBiZSBudWxsIGFzIGEgcmVzdWx0XHJcbiAgICBpZiAodnJtSHVtYW5vaWQgPT09IG51bGwpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfSBlbHNlIGlmICh2cm1IdW1hbm9pZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAnVlJNRmlyc3RQZXJzb25Mb2FkZXJQbHVnaW46IHZybUh1bWFub2lkIGlzIHVuZGVmaW5lZC4gVlJNSHVtYW5vaWRMb2FkZXJQbHVnaW4gaGF2ZSB0byBiZSB1c2VkIGZpcnN0JyxcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBnbHRmLnVzZXJEYXRhLnZybUZpcnN0UGVyc29uID0gYXdhaXQgdGhpcy5faW1wb3J0KGdsdGYsIHZybUh1bWFub2lkKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBhIHtAbGluayBWUk1GaXJzdFBlcnNvbn0gZnJvbSBhIFZSTS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIHtAbGluayBWUk1IdW1hbm9pZH0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cclxuICAgKi9cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBfaW1wb3J0KGdsdGY6IEdMVEYsIGh1bWFub2lkOiBWUk1IdW1hbm9pZCB8IG51bGwpOiBQcm9taXNlPFZSTUZpcnN0UGVyc29uIHwgbnVsbD4ge1xyXG4gICAgaWYgKGh1bWFub2lkID09IG51bGwpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdjFSZXN1bHQgPSBhd2FpdCB0aGlzLl92MUltcG9ydChnbHRmLCBodW1hbm9pZCk7XHJcbiAgICBpZiAodjFSZXN1bHQpIHtcclxuICAgICAgcmV0dXJuIHYxUmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHYwUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjBJbXBvcnQoZ2x0ZiwgaHVtYW5vaWQpO1xyXG4gICAgaWYgKHYwUmVzdWx0KSB7XHJcbiAgICAgIHJldHVybiB2MFJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgX3YxSW1wb3J0KGdsdGY6IEdMVEYsIGh1bWFub2lkOiBWUk1IdW1hbm9pZCk6IFByb21pc2U8VlJNRmlyc3RQZXJzb24gfCBudWxsPiB7XHJcbiAgICBjb25zdCBqc29uID0gdGhpcy5wYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIC8vIGVhcmx5IGFib3J0IGlmIGl0IGRvZXNuJ3QgdXNlIHZybVxyXG4gICAgY29uc3QgaXNWUk1Vc2VkID0ganNvbi5leHRlbnNpb25zVXNlZD8uaW5kZXhPZignVlJNQ192cm0nKSAhPT0gLTE7XHJcbiAgICBpZiAoIWlzVlJNVXNlZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LlsnVlJNQ192cm0nXSBhcyBWMVZSTVNjaGVtYS5WUk1DVlJNIHwgdW5kZWZpbmVkO1xyXG4gICAgaWYgKCFleHRlbnNpb24pIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3BlY1ZlcnNpb24gPSBleHRlbnNpb24uc3BlY1ZlcnNpb247XHJcbiAgICBpZiAoc3BlY1ZlcnNpb24gIT09ICcxLjAtYmV0YScpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2NoZW1hRmlyc3RQZXJzb24gPSBleHRlbnNpb24uZmlyc3RQZXJzb247XHJcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lc2hBbm5vdGF0aW9uczogVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvbltdID0gW107XHJcbiAgICBjb25zdCBub2RlUHJpbWl0aXZlc01hcCA9IGF3YWl0IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyhnbHRmKTtcclxuICAgIEFycmF5LmZyb20obm9kZVByaW1pdGl2ZXNNYXAuZW50cmllcygpKS5mb3JFYWNoKChbbm9kZUluZGV4LCBwcmltaXRpdmVzXSkgPT4ge1xyXG4gICAgICBjb25zdCBhbm5vdGF0aW9uID0gc2NoZW1hRmlyc3RQZXJzb24ubWVzaEFubm90YXRpb25zXHJcbiAgICAgICAgPyBzY2hlbWFGaXJzdFBlcnNvbi5tZXNoQW5ub3RhdGlvbnMuZmluZCgoYSkgPT4gYS5ub2RlID09PSBub2RlSW5kZXgpXHJcbiAgICAgICAgOiB1bmRlZmluZWQ7XHJcblxyXG4gICAgICBtZXNoQW5ub3RhdGlvbnMucHVzaCh7XHJcbiAgICAgICAgbWVzaGVzOiBwcmltaXRpdmVzLFxyXG4gICAgICAgIHR5cGU6IGFubm90YXRpb24/LnR5cGUgPz8gJ2JvdGgnLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBuZXcgVlJNRmlyc3RQZXJzb24oaHVtYW5vaWQsIG1lc2hBbm5vdGF0aW9ucyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIF92MEltcG9ydChnbHRmOiBHTFRGLCBodW1hbm9pZDogVlJNSHVtYW5vaWQpOiBQcm9taXNlPFZSTUZpcnN0UGVyc29uIHwgbnVsbD4ge1xyXG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcclxuXHJcbiAgICBjb25zdCB2cm1FeHQgPSBqc29uLmV4dGVuc2lvbnM/LlZSTSBhcyBWMFZSTS5WUk0gfCB1bmRlZmluZWQ7XHJcbiAgICBpZiAoIXZybUV4dCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbjogVjBWUk0uRmlyc3RQZXJzb24gfCB1bmRlZmluZWQgPSB2cm1FeHQuZmlyc3RQZXJzb247XHJcbiAgICBpZiAoIXNjaGVtYUZpcnN0UGVyc29uKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1lc2hBbm5vdGF0aW9uczogVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvbltdID0gW107XHJcbiAgICBjb25zdCBub2RlUHJpbWl0aXZlc01hcCA9IGF3YWl0IGdsdGZFeHRyYWN0UHJpbWl0aXZlc0Zyb21Ob2RlcyhnbHRmKTtcclxuXHJcbiAgICBBcnJheS5mcm9tKG5vZGVQcmltaXRpdmVzTWFwLmVudHJpZXMoKSkuZm9yRWFjaCgoW25vZGVJbmRleCwgcHJpbWl0aXZlc10pID0+IHtcclxuICAgICAgY29uc3Qgc2NoZW1hTm9kZSA9IGpzb24ubm9kZXMhW25vZGVJbmRleF07XHJcblxyXG4gICAgICBjb25zdCBmbGFnID0gc2NoZW1hRmlyc3RQZXJzb24ubWVzaEFubm90YXRpb25zXHJcbiAgICAgICAgPyBzY2hlbWFGaXJzdFBlcnNvbi5tZXNoQW5ub3RhdGlvbnMuZmluZCgoYSkgPT4gYS5tZXNoID09PSBzY2hlbWFOb2RlLm1lc2gpXHJcbiAgICAgICAgOiB1bmRlZmluZWQ7XHJcblxyXG4gICAgICBtZXNoQW5ub3RhdGlvbnMucHVzaCh7XHJcbiAgICAgICAgbWVzaGVzOiBwcmltaXRpdmVzLFxyXG4gICAgICAgIHR5cGU6IHRoaXMuX2NvbnZlcnRWMEZsYWdUb1YxVHlwZShmbGFnPy5maXJzdFBlcnNvbkZsYWcpLFxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBuZXcgVlJNRmlyc3RQZXJzb24oaHVtYW5vaWQsIG1lc2hBbm5vdGF0aW9ucyk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9jb252ZXJ0VjBGbGFnVG9WMVR5cGUoZmxhZzogc3RyaW5nIHwgdW5kZWZpbmVkKTogVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvblR5cGUge1xyXG4gICAgaWYgKGZsYWcgPT09ICdGaXJzdFBlcnNvbk9ubHknKSB7XHJcbiAgICAgIHJldHVybiAnZmlyc3RQZXJzb25Pbmx5JztcclxuICAgIH0gZWxzZSBpZiAoZmxhZyA9PT0gJ1RoaXJkUGVyc29uT25seScpIHtcclxuICAgICAgcmV0dXJuICd0aGlyZFBlcnNvbk9ubHknO1xyXG4gICAgfSBlbHNlIGlmIChmbGFnID09PSAnQXV0bycpIHtcclxuICAgICAgcmV0dXJuICdhdXRvJztcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHJldHVybiAnYm90aCc7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiIsIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xyXG5cclxuZXhwb3J0IGNvbnN0IFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlID0ge1xyXG4gIEF1dG86ICdhdXRvJyxcclxuICBCb3RoOiAnYm90aCcsXHJcbiAgVGhpcmRQZXJzb25Pbmx5OiAndGhpcmRQZXJzb25Pbmx5JyxcclxuICBGaXJzdFBlcnNvbk9ubHk6ICdmaXJzdFBlcnNvbk9ubHknLFxyXG59IGFzIGNvbnN0O1xyXG5cclxuZXhwb3J0IHR5cGUgVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvblR5cGUgPSB0eXBlb2YgVlJNRmlyc3RQZXJzb25NZXNoQW5ub3RhdGlvblR5cGVba2V5b2YgdHlwZW9mIFZSTUZpcnN0UGVyc29uTWVzaEFubm90YXRpb25UeXBlXTtcclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBWUk1IdW1hbkJvbmUgfSBmcm9tICcuLi9WUk1IdW1hbkJvbmUnO1xyXG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL1ZSTUh1bWFub2lkJztcclxuXHJcbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBWUk1IdW1hbm9pZEhlbHBlciBleHRlbmRzIFRIUkVFLkdyb3VwIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgdnJtSHVtYW5vaWQ6IFZSTUh1bWFub2lkO1xyXG4gIHByaXZhdGUgX2JvbmVBeGVzTWFwOiBNYXA8VlJNSHVtYW5Cb25lLCBUSFJFRS5BeGVzSGVscGVyPjtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKGh1bWFub2lkOiBWUk1IdW1hbm9pZCkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLnZybUh1bWFub2lkID0gaHVtYW5vaWQ7XHJcblxyXG4gICAgdGhpcy5fYm9uZUF4ZXNNYXAgPSBuZXcgTWFwKCk7XHJcblxyXG4gICAgT2JqZWN0LnZhbHVlcyhodW1hbm9pZC5odW1hbkJvbmVzKS5mb3JFYWNoKChib25lKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhlbHBlciA9IG5ldyBUSFJFRS5BeGVzSGVscGVyKDEuMCk7XHJcblxyXG4gICAgICBoZWxwZXIubWF0cml4QXV0b1VwZGF0ZSA9IGZhbHNlO1xyXG5cclxuICAgICAgKGhlbHBlci5tYXRlcmlhbCBhcyBUSFJFRS5NYXRlcmlhbCkuZGVwdGhUZXN0ID0gZmFsc2U7XHJcbiAgICAgIChoZWxwZXIubWF0ZXJpYWwgYXMgVEhSRUUuTWF0ZXJpYWwpLmRlcHRoV3JpdGUgPSBmYWxzZTtcclxuXHJcbiAgICAgIHRoaXMuYWRkKGhlbHBlcik7XHJcblxyXG4gICAgICAvLyBUT0RPOiB0eXBlIGFzc2VydGlvbiBpcyBub3QgbmVlZGVkIGluIGxhdGVyIHZlcnNpb25zIG9mIFR5cGVTY3JpcHRcclxuICAgICAgdGhpcy5fYm9uZUF4ZXNNYXAuc2V0KGJvbmUhLCBoZWxwZXIpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcclxuICAgIEFycmF5LmZyb20odGhpcy5fYm9uZUF4ZXNNYXAudmFsdWVzKCkpLmZvckVhY2goKGF4ZXMpID0+IHtcclxuICAgICAgYXhlcy5nZW9tZXRyeS5kaXNwb3NlKCk7XHJcbiAgICAgIChheGVzLm1hdGVyaWFsIGFzIFRIUkVFLk1hdGVyaWFsKS5kaXNwb3NlKCk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGVNYXRyaXhXb3JsZChmb3JjZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgQXJyYXkuZnJvbSh0aGlzLl9ib25lQXhlc01hcC5lbnRyaWVzKCkpLmZvckVhY2goKFtib25lLCBheGVzXSkgPT4ge1xyXG4gICAgICBib25lLm5vZGUudXBkYXRlV29ybGRNYXRyaXgodHJ1ZSwgZmFsc2UpO1xyXG5cclxuICAgICAgYm9uZS5ub2RlLm1hdHJpeFdvcmxkLmRlY29tcG9zZShfdjNBLCBfcXVhdEEsIF92M0IpO1xyXG5cclxuICAgICAgY29uc3Qgc2NhbGUgPSBfdjNBLnNldCgwLjEsIDAuMSwgMC4xKS5kaXZpZGUoX3YzQik7XHJcbiAgICAgIGF4ZXMubWF0cml4LmNvcHkoYm9uZS5ub2RlLm1hdHJpeFdvcmxkKS5zY2FsZShzY2FsZSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzdXBlci51cGRhdGVNYXRyaXhXb3JsZChmb3JjZSk7XHJcbiAgfVxyXG59XHJcbiIsIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xyXG5cclxuaW1wb3J0IHsgVlJNSHVtYW5Cb25lTmFtZSB9IGZyb20gJy4vVlJNSHVtYW5Cb25lTmFtZSc7XHJcblxyXG4vKipcclxuICogVGhlIGxpc3Qgb2Yge0BsaW5rIFZSTUh1bWFuQm9uZU5hbWV9LiBEZXBlbmRlbmN5IGF3YXJlLlxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IFZSTUh1bWFuQm9uZUxpc3Q6IFZSTUh1bWFuQm9uZU5hbWVbXSA9IFtcclxuICAnaGlwcycsXHJcbiAgJ3NwaW5lJyxcclxuICAnY2hlc3QnLFxyXG4gICd1cHBlckNoZXN0JyxcclxuICAnbmVjaycsXHJcblxyXG4gICdoZWFkJyxcclxuICAnbGVmdEV5ZScsXHJcbiAgJ3JpZ2h0RXllJyxcclxuICAnamF3JyxcclxuXHJcbiAgJ2xlZnRVcHBlckxlZycsXHJcbiAgJ2xlZnRMb3dlckxlZycsXHJcbiAgJ2xlZnRGb290JyxcclxuICAnbGVmdFRvZXMnLFxyXG5cclxuICAncmlnaHRVcHBlckxlZycsXHJcbiAgJ3JpZ2h0TG93ZXJMZWcnLFxyXG4gICdyaWdodEZvb3QnLFxyXG4gICdyaWdodFRvZXMnLFxyXG5cclxuICAnbGVmdFNob3VsZGVyJyxcclxuICAnbGVmdFVwcGVyQXJtJyxcclxuICAnbGVmdExvd2VyQXJtJyxcclxuICAnbGVmdEhhbmQnLFxyXG5cclxuICAncmlnaHRTaG91bGRlcicsXHJcbiAgJ3JpZ2h0VXBwZXJBcm0nLFxyXG4gICdyaWdodExvd2VyQXJtJyxcclxuICAncmlnaHRIYW5kJyxcclxuXHJcbiAgJ2xlZnRUaHVtYk1ldGFjYXJwYWwnLFxyXG4gICdsZWZ0VGh1bWJQcm94aW1hbCcsXHJcbiAgJ2xlZnRUaHVtYkRpc3RhbCcsXHJcbiAgJ2xlZnRJbmRleFByb3hpbWFsJyxcclxuICAnbGVmdEluZGV4SW50ZXJtZWRpYXRlJyxcclxuICAnbGVmdEluZGV4RGlzdGFsJyxcclxuICAnbGVmdE1pZGRsZVByb3hpbWFsJyxcclxuICAnbGVmdE1pZGRsZUludGVybWVkaWF0ZScsXHJcbiAgJ2xlZnRNaWRkbGVEaXN0YWwnLFxyXG4gICdsZWZ0UmluZ1Byb3hpbWFsJyxcclxuICAnbGVmdFJpbmdJbnRlcm1lZGlhdGUnLFxyXG4gICdsZWZ0UmluZ0Rpc3RhbCcsXHJcbiAgJ2xlZnRMaXR0bGVQcm94aW1hbCcsXHJcbiAgJ2xlZnRMaXR0bGVJbnRlcm1lZGlhdGUnLFxyXG4gICdsZWZ0TGl0dGxlRGlzdGFsJyxcclxuXHJcbiAgJ3JpZ2h0VGh1bWJNZXRhY2FycGFsJyxcclxuICAncmlnaHRUaHVtYlByb3hpbWFsJyxcclxuICAncmlnaHRUaHVtYkRpc3RhbCcsXHJcbiAgJ3JpZ2h0SW5kZXhQcm94aW1hbCcsXHJcbiAgJ3JpZ2h0SW5kZXhJbnRlcm1lZGlhdGUnLFxyXG4gICdyaWdodEluZGV4RGlzdGFsJyxcclxuICAncmlnaHRNaWRkbGVQcm94aW1hbCcsXHJcbiAgJ3JpZ2h0TWlkZGxlSW50ZXJtZWRpYXRlJyxcclxuICAncmlnaHRNaWRkbGVEaXN0YWwnLFxyXG4gICdyaWdodFJpbmdQcm94aW1hbCcsXHJcbiAgJ3JpZ2h0UmluZ0ludGVybWVkaWF0ZScsXHJcbiAgJ3JpZ2h0UmluZ0Rpc3RhbCcsXHJcbiAgJ3JpZ2h0TGl0dGxlUHJveGltYWwnLFxyXG4gICdyaWdodExpdHRsZUludGVybWVkaWF0ZScsXHJcbiAgJ3JpZ2h0TGl0dGxlRGlzdGFsJyxcclxuXTtcclxuIiwiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcblxyXG4vKipcclxuICogVGhlIG5hbWVzIG9mIHtAbGluayBWUk1IdW1hbm9pZH0gYm9uZSBuYW1lcy5cclxuICpcclxuICogUmVmOiBodHRwczovL2dpdGh1Yi5jb20vdnJtLWMvdnJtLXNwZWNpZmljYXRpb24vYmxvYi9tYXN0ZXIvc3BlY2lmaWNhdGlvbi9WUk1DX3ZybS0xLjAtYmV0YS9odW1hbm9pZC5tZFxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IFZSTUh1bWFuQm9uZU5hbWUgPSB7XHJcbiAgSGlwczogJ2hpcHMnLFxyXG4gIFNwaW5lOiAnc3BpbmUnLFxyXG4gIENoZXN0OiAnY2hlc3QnLFxyXG4gIFVwcGVyQ2hlc3Q6ICd1cHBlckNoZXN0JyxcclxuICBOZWNrOiAnbmVjaycsXHJcblxyXG4gIEhlYWQ6ICdoZWFkJyxcclxuICBMZWZ0RXllOiAnbGVmdEV5ZScsXHJcbiAgUmlnaHRFeWU6ICdyaWdodEV5ZScsXHJcbiAgSmF3OiAnamF3JyxcclxuXHJcbiAgTGVmdFVwcGVyTGVnOiAnbGVmdFVwcGVyTGVnJyxcclxuICBMZWZ0TG93ZXJMZWc6ICdsZWZ0TG93ZXJMZWcnLFxyXG4gIExlZnRGb290OiAnbGVmdEZvb3QnLFxyXG4gIExlZnRUb2VzOiAnbGVmdFRvZXMnLFxyXG5cclxuICBSaWdodFVwcGVyTGVnOiAncmlnaHRVcHBlckxlZycsXHJcbiAgUmlnaHRMb3dlckxlZzogJ3JpZ2h0TG93ZXJMZWcnLFxyXG4gIFJpZ2h0Rm9vdDogJ3JpZ2h0Rm9vdCcsXHJcbiAgUmlnaHRUb2VzOiAncmlnaHRUb2VzJyxcclxuXHJcbiAgTGVmdFNob3VsZGVyOiAnbGVmdFNob3VsZGVyJyxcclxuICBMZWZ0VXBwZXJBcm06ICdsZWZ0VXBwZXJBcm0nLFxyXG4gIExlZnRMb3dlckFybTogJ2xlZnRMb3dlckFybScsXHJcbiAgTGVmdEhhbmQ6ICdsZWZ0SGFuZCcsXHJcblxyXG4gIFJpZ2h0U2hvdWxkZXI6ICdyaWdodFNob3VsZGVyJyxcclxuICBSaWdodFVwcGVyQXJtOiAncmlnaHRVcHBlckFybScsXHJcbiAgUmlnaHRMb3dlckFybTogJ3JpZ2h0TG93ZXJBcm0nLFxyXG4gIFJpZ2h0SGFuZDogJ3JpZ2h0SGFuZCcsXHJcblxyXG4gIExlZnRUaHVtYk1ldGFjYXJwYWw6ICdsZWZ0VGh1bWJNZXRhY2FycGFsJyxcclxuICBMZWZ0VGh1bWJQcm94aW1hbDogJ2xlZnRUaHVtYlByb3hpbWFsJyxcclxuICBMZWZ0VGh1bWJEaXN0YWw6ICdsZWZ0VGh1bWJEaXN0YWwnLFxyXG4gIExlZnRJbmRleFByb3hpbWFsOiAnbGVmdEluZGV4UHJveGltYWwnLFxyXG4gIExlZnRJbmRleEludGVybWVkaWF0ZTogJ2xlZnRJbmRleEludGVybWVkaWF0ZScsXHJcbiAgTGVmdEluZGV4RGlzdGFsOiAnbGVmdEluZGV4RGlzdGFsJyxcclxuICBMZWZ0TWlkZGxlUHJveGltYWw6ICdsZWZ0TWlkZGxlUHJveGltYWwnLFxyXG4gIExlZnRNaWRkbGVJbnRlcm1lZGlhdGU6ICdsZWZ0TWlkZGxlSW50ZXJtZWRpYXRlJyxcclxuICBMZWZ0TWlkZGxlRGlzdGFsOiAnbGVmdE1pZGRsZURpc3RhbCcsXHJcbiAgTGVmdFJpbmdQcm94aW1hbDogJ2xlZnRSaW5nUHJveGltYWwnLFxyXG4gIExlZnRSaW5nSW50ZXJtZWRpYXRlOiAnbGVmdFJpbmdJbnRlcm1lZGlhdGUnLFxyXG4gIExlZnRSaW5nRGlzdGFsOiAnbGVmdFJpbmdEaXN0YWwnLFxyXG4gIExlZnRMaXR0bGVQcm94aW1hbDogJ2xlZnRMaXR0bGVQcm94aW1hbCcsXHJcbiAgTGVmdExpdHRsZUludGVybWVkaWF0ZTogJ2xlZnRMaXR0bGVJbnRlcm1lZGlhdGUnLFxyXG4gIExlZnRMaXR0bGVEaXN0YWw6ICdsZWZ0TGl0dGxlRGlzdGFsJyxcclxuXHJcbiAgUmlnaHRUaHVtYk1ldGFjYXJwYWw6ICdyaWdodFRodW1iTWV0YWNhcnBhbCcsXHJcbiAgUmlnaHRUaHVtYlByb3hpbWFsOiAncmlnaHRUaHVtYlByb3hpbWFsJyxcclxuICBSaWdodFRodW1iRGlzdGFsOiAncmlnaHRUaHVtYkRpc3RhbCcsXHJcbiAgUmlnaHRJbmRleFByb3hpbWFsOiAncmlnaHRJbmRleFByb3hpbWFsJyxcclxuICBSaWdodEluZGV4SW50ZXJtZWRpYXRlOiAncmlnaHRJbmRleEludGVybWVkaWF0ZScsXHJcbiAgUmlnaHRJbmRleERpc3RhbDogJ3JpZ2h0SW5kZXhEaXN0YWwnLFxyXG4gIFJpZ2h0TWlkZGxlUHJveGltYWw6ICdyaWdodE1pZGRsZVByb3hpbWFsJyxcclxuICBSaWdodE1pZGRsZUludGVybWVkaWF0ZTogJ3JpZ2h0TWlkZGxlSW50ZXJtZWRpYXRlJyxcclxuICBSaWdodE1pZGRsZURpc3RhbDogJ3JpZ2h0TWlkZGxlRGlzdGFsJyxcclxuICBSaWdodFJpbmdQcm94aW1hbDogJ3JpZ2h0UmluZ1Byb3hpbWFsJyxcclxuICBSaWdodFJpbmdJbnRlcm1lZGlhdGU6ICdyaWdodFJpbmdJbnRlcm1lZGlhdGUnLFxyXG4gIFJpZ2h0UmluZ0Rpc3RhbDogJ3JpZ2h0UmluZ0Rpc3RhbCcsXHJcbiAgUmlnaHRMaXR0bGVQcm94aW1hbDogJ3JpZ2h0TGl0dGxlUHJveGltYWwnLFxyXG4gIFJpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlOiAncmlnaHRMaXR0bGVJbnRlcm1lZGlhdGUnLFxyXG4gIFJpZ2h0TGl0dGxlRGlzdGFsOiAncmlnaHRMaXR0bGVEaXN0YWwnLFxyXG59IGFzIGNvbnN0O1xyXG5cclxuZXhwb3J0IHR5cGUgVlJNSHVtYW5Cb25lTmFtZSA9IHR5cGVvZiBWUk1IdW1hbkJvbmVOYW1lW2tleW9mIHR5cGVvZiBWUk1IdW1hbkJvbmVOYW1lXTtcclxuIiwiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcblxyXG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVOYW1lIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVOYW1lJztcclxuXHJcbi8qKlxyXG4gKiBBbiBvYmplY3QgdGhhdCBtYXBzIGZyb20ge0BsaW5rIFZSTUh1bWFuQm9uZU5hbWV9IHRvIGl0cyBwYXJlbnQge0BsaW5rIFZSTUh1bWFuQm9uZU5hbWV9LlxyXG4gKlxyXG4gKiBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy92cm0tc3BlY2lmaWNhdGlvbi9ibG9iL21hc3Rlci9zcGVjaWZpY2F0aW9uL1ZSTUNfdnJtLTEuMC1iZXRhL2h1bWFub2lkLm1kXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgVlJNSHVtYW5Cb25lUGFyZW50TWFwOiB7IFtib25lIGluIFZSTUh1bWFuQm9uZU5hbWVdOiBWUk1IdW1hbkJvbmVOYW1lIHwgbnVsbCB9ID0ge1xyXG4gIGhpcHM6IG51bGwsXHJcbiAgc3BpbmU6ICdoaXBzJyxcclxuICBjaGVzdDogJ3NwaW5lJyxcclxuICB1cHBlckNoZXN0OiAnY2hlc3QnLFxyXG4gIG5lY2s6ICd1cHBlckNoZXN0JyxcclxuXHJcbiAgaGVhZDogJ25lY2snLFxyXG4gIGxlZnRFeWU6ICdoZWFkJyxcclxuICByaWdodEV5ZTogJ2hlYWQnLFxyXG4gIGphdzogJ2hlYWQnLFxyXG5cclxuICBsZWZ0VXBwZXJMZWc6ICdoaXBzJyxcclxuICBsZWZ0TG93ZXJMZWc6ICdsZWZ0VXBwZXJMZWcnLFxyXG4gIGxlZnRGb290OiAnbGVmdExvd2VyTGVnJyxcclxuICBsZWZ0VG9lczogJ2xlZnRGb290JyxcclxuXHJcbiAgcmlnaHRVcHBlckxlZzogJ2hpcHMnLFxyXG4gIHJpZ2h0TG93ZXJMZWc6ICdyaWdodFVwcGVyTGVnJyxcclxuICByaWdodEZvb3Q6ICdyaWdodExvd2VyTGVnJyxcclxuICByaWdodFRvZXM6ICdyaWdodEZvb3QnLFxyXG5cclxuICBsZWZ0U2hvdWxkZXI6ICdjaGVzdCcsXHJcbiAgbGVmdFVwcGVyQXJtOiAnbGVmdFNob3VsZGVyJyxcclxuICBsZWZ0TG93ZXJBcm06ICdsZWZ0VXBwZXJBcm0nLFxyXG4gIGxlZnRIYW5kOiAnbGVmdExvd2VyQXJtJyxcclxuXHJcbiAgcmlnaHRTaG91bGRlcjogJ2NoZXN0JyxcclxuICByaWdodFVwcGVyQXJtOiAncmlnaHRTaG91bGRlcicsXHJcbiAgcmlnaHRMb3dlckFybTogJ3JpZ2h0VXBwZXJBcm0nLFxyXG4gIHJpZ2h0SGFuZDogJ3JpZ2h0TG93ZXJBcm0nLFxyXG5cclxuICBsZWZ0VGh1bWJNZXRhY2FycGFsOiAnbGVmdEhhbmQnLFxyXG4gIGxlZnRUaHVtYlByb3hpbWFsOiAnbGVmdFRodW1iTWV0YWNhcnBhbCcsXHJcbiAgbGVmdFRodW1iRGlzdGFsOiAnbGVmdFRodW1iUHJveGltYWwnLFxyXG4gIGxlZnRJbmRleFByb3hpbWFsOiAnbGVmdEhhbmQnLFxyXG4gIGxlZnRJbmRleEludGVybWVkaWF0ZTogJ2xlZnRJbmRleFByb3hpbWFsJyxcclxuICBsZWZ0SW5kZXhEaXN0YWw6ICdsZWZ0SW5kZXhJbnRlcm1lZGlhdGUnLFxyXG4gIGxlZnRNaWRkbGVQcm94aW1hbDogJ2xlZnRIYW5kJyxcclxuICBsZWZ0TWlkZGxlSW50ZXJtZWRpYXRlOiAnbGVmdE1pZGRsZVByb3hpbWFsJyxcclxuICBsZWZ0TWlkZGxlRGlzdGFsOiAnbGVmdE1pZGRsZUludGVybWVkaWF0ZScsXHJcbiAgbGVmdFJpbmdQcm94aW1hbDogJ2xlZnRIYW5kJyxcclxuICBsZWZ0UmluZ0ludGVybWVkaWF0ZTogJ2xlZnRSaW5nUHJveGltYWwnLFxyXG4gIGxlZnRSaW5nRGlzdGFsOiAnbGVmdFJpbmdJbnRlcm1lZGlhdGUnLFxyXG4gIGxlZnRMaXR0bGVQcm94aW1hbDogJ2xlZnRIYW5kJyxcclxuICBsZWZ0TGl0dGxlSW50ZXJtZWRpYXRlOiAnbGVmdExpdHRsZVByb3hpbWFsJyxcclxuICBsZWZ0TGl0dGxlRGlzdGFsOiAnbGVmdExpdHRsZUludGVybWVkaWF0ZScsXHJcblxyXG4gIHJpZ2h0VGh1bWJNZXRhY2FycGFsOiAncmlnaHRIYW5kJyxcclxuICByaWdodFRodW1iUHJveGltYWw6ICdyaWdodFRodW1iTWV0YWNhcnBhbCcsXHJcbiAgcmlnaHRUaHVtYkRpc3RhbDogJ3JpZ2h0VGh1bWJQcm94aW1hbCcsXHJcbiAgcmlnaHRJbmRleFByb3hpbWFsOiAncmlnaHRIYW5kJyxcclxuICByaWdodEluZGV4SW50ZXJtZWRpYXRlOiAncmlnaHRJbmRleFByb3hpbWFsJyxcclxuICByaWdodEluZGV4RGlzdGFsOiAncmlnaHRJbmRleEludGVybWVkaWF0ZScsXHJcbiAgcmlnaHRNaWRkbGVQcm94aW1hbDogJ3JpZ2h0SGFuZCcsXHJcbiAgcmlnaHRNaWRkbGVJbnRlcm1lZGlhdGU6ICdyaWdodE1pZGRsZVByb3hpbWFsJyxcclxuICByaWdodE1pZGRsZURpc3RhbDogJ3JpZ2h0TWlkZGxlSW50ZXJtZWRpYXRlJyxcclxuICByaWdodFJpbmdQcm94aW1hbDogJ3JpZ2h0SGFuZCcsXHJcbiAgcmlnaHRSaW5nSW50ZXJtZWRpYXRlOiAncmlnaHRSaW5nUHJveGltYWwnLFxyXG4gIHJpZ2h0UmluZ0Rpc3RhbDogJ3JpZ2h0UmluZ0ludGVybWVkaWF0ZScsXHJcbiAgcmlnaHRMaXR0bGVQcm94aW1hbDogJ3JpZ2h0SGFuZCcsXHJcbiAgcmlnaHRMaXR0bGVJbnRlcm1lZGlhdGU6ICdyaWdodExpdHRsZVByb3hpbWFsJyxcclxuICByaWdodExpdHRsZURpc3RhbDogJ3JpZ2h0TGl0dGxlSW50ZXJtZWRpYXRlJyxcclxufTtcclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5cclxuLyoqXHJcbiAqIEEgY29tcGF0IGZ1bmN0aW9uIGZvciBgUXVhdGVybmlvbi5pbnZlcnQoKWAgLyBgUXVhdGVybmlvbi5pbnZlcnNlKClgLlxyXG4gKiBgUXVhdGVybmlvbi5pbnZlcnQoKWAgaXMgaW50cm9kdWNlZCBpbiByMTIzIGFuZCBgUXVhdGVybmlvbi5pbnZlcnNlKClgIGVtaXRzIGEgd2FybmluZy5cclxuICogV2UgYXJlIGdvaW5nIHRvIHVzZSB0aGlzIGNvbXBhdCBmb3IgYSB3aGlsZS5cclxuICogQHBhcmFtIHRhcmdldCBBIHRhcmdldCBxdWF0ZXJuaW9uXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gcXVhdEludmVydENvbXBhdDxUIGV4dGVuZHMgVEhSRUUuUXVhdGVybmlvbj4odGFyZ2V0OiBUKTogVCB7XHJcbiAgaWYgKCh0YXJnZXQgYXMgYW55KS5pbnZlcnQpIHtcclxuICAgIHRhcmdldC5pbnZlcnQoKTtcclxuICB9IGVsc2Uge1xyXG4gICAgKHRhcmdldCBhcyBhbnkpLmludmVyc2UoKTtcclxuICB9XHJcblxyXG4gIHJldHVybiB0YXJnZXQ7XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBxdWF0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvcXVhdEludmVydENvbXBhdCc7XHJcbmltcG9ydCB0eXBlIHsgVlJNSHVtYW5Cb25lIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUh1bWFuQm9uZXMgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZXMnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUh1bWFuQm9uZU5hbWUgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZU5hbWUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTVBvc2UgfSBmcm9tICcuL1ZSTVBvc2UnO1xyXG5cclxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbmNvbnN0IF9xdWF0QSA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcblxyXG4vKipcclxuICogQSBjbGFzcyByZXByZXNlbnRzIHRoZSBSaWcgb2YgYSBWUk0uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNUmlnIHtcclxuICAvKipcclxuICAgKiBBIHtAbGluayBWUk1IdW1hbkJvbmVzfSB0aGF0IGNvbnRhaW5zIGFsbCB0aGUgaHVtYW4gYm9uZXMgb2YgdGhlIFZSTS5cclxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBnZXQgdGhlc2UgYm9uZXMgdXNpbmcge0BsaW5rIFZSTUh1bWFub2lkLmdldEJvbmV9LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBodW1hbkJvbmVzOiBWUk1IdW1hbkJvbmVzO1xyXG5cclxuICAvKipcclxuICAgKiBBIHtAbGluayBWUk1Qb3NlfSB0aGF0IGlzIGl0cyBkZWZhdWx0IHN0YXRlLlxyXG4gICAqIE5vdGUgdGhhdCBpdCdzIG5vdCBjb21wYXRpYmxlIHdpdGgge0BsaW5rIHNldFBvc2V9IGFuZCB7QGxpbmsgZ2V0UG9zZX0sIHNpbmNlIGl0IGNvbnRhaW5zIG5vbi1yZWxhdGl2ZSB2YWx1ZXMgb2YgZWFjaCBsb2NhbCB0cmFuc2Zvcm1zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZXN0UG9zZTogVlJNUG9zZTtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IHtAbGluayBWUk1IdW1hbm9pZH0uXHJcbiAgICogQHBhcmFtIGh1bWFuQm9uZXMgQSB7QGxpbmsgVlJNSHVtYW5Cb25lc30gY29udGFpbnMgYWxsIHRoZSBib25lcyBvZiB0aGUgbmV3IGh1bWFub2lkXHJcbiAgICovXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKGh1bWFuQm9uZXM6IFZSTUh1bWFuQm9uZXMpIHtcclxuICAgIHRoaXMuaHVtYW5Cb25lcyA9IGh1bWFuQm9uZXM7XHJcblxyXG4gICAgdGhpcy5yZXN0UG9zZSA9IHRoaXMuZ2V0QWJzb2x1dGVQb3NlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm4gdGhlIGN1cnJlbnQgYWJzb2x1dGUgcG9zZSBvZiB0aGlzIGh1bWFub2lkIGFzIGEge0BsaW5rIFZSTVBvc2V9LlxyXG4gICAqIE5vdGUgdGhhdCB0aGUgb3V0cHV0IHJlc3VsdCB3aWxsIGNvbnRhaW4gaW5pdGlhbCBzdGF0ZSBvZiB0aGUgVlJNIGFuZCBub3QgY29tcGF0aWJsZSBiZXR3ZWVuIGRpZmZlcmVudCBtb2RlbHMuXHJcbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gdXNlIHtAbGluayBnZXRQb3NlfSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRBYnNvbHV0ZVBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICBjb25zdCBwb3NlID0ge30gYXMgVlJNUG9zZTtcclxuXHJcbiAgICBPYmplY3Qua2V5cyh0aGlzLmh1bWFuQm9uZXMpLmZvckVhY2goKHZybUJvbmVOYW1lU3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHZybUJvbmVOYW1lID0gdnJtQm9uZU5hbWVTdHJpbmcgYXMgVlJNSHVtYW5Cb25lTmFtZTtcclxuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Qm9uZU5vZGUodnJtQm9uZU5hbWUpO1xyXG5cclxuICAgICAgLy8gSWdub3JlIHdoZW4gdGhlcmUgYXJlIG5vIGJvbmUgb24gdGhlIFZSTUh1bWFub2lkXHJcbiAgICAgIGlmICghbm9kZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gR2V0IHRoZSBwb3NpdGlvbiAvIHJvdGF0aW9uIGZyb20gdGhlIG5vZGVcclxuICAgICAgX3YzQS5jb3B5KG5vZGUucG9zaXRpb24pO1xyXG4gICAgICBfcXVhdEEuY29weShub2RlLnF1YXRlcm5pb24pO1xyXG5cclxuICAgICAgLy8gQ29udmVydCB0byByYXcgYXJyYXlzXHJcbiAgICAgIHBvc2VbdnJtQm9uZU5hbWVdID0ge1xyXG4gICAgICAgIHBvc2l0aW9uOiBfdjNBLnRvQXJyYXkoKSBhcyBbbnVtYmVyLCBudW1iZXIsIG51bWJlcl0sXHJcbiAgICAgICAgcm90YXRpb246IF9xdWF0QS50b0FycmF5KCkgYXMgW251bWJlciwgbnVtYmVyLCBudW1iZXIsIG51bWJlcl0sXHJcbiAgICAgIH07XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gcG9zZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiB0aGUgY3VycmVudCBwb3NlIG9mIHRoaXMgaHVtYW5vaWQgYXMgYSB7QGxpbmsgVlJNUG9zZX0uXHJcbiAgICpcclxuICAgKiBFYWNoIHRyYW5zZm9ybSBpcyBhIGxvY2FsIHRyYW5zZm9ybSByZWxhdGl2ZSBmcm9tIHJlc3QgcG9zZSAoVC1wb3NlKS5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0UG9zZSgpOiBWUk1Qb3NlIHtcclxuICAgIGNvbnN0IHBvc2UgPSB7fSBhcyBWUk1Qb3NlO1xyXG5cclxuICAgIE9iamVjdC5rZXlzKHRoaXMuaHVtYW5Cb25lcykuZm9yRWFjaCgoYm9uZU5hbWVTdHJpbmcpID0+IHtcclxuICAgICAgY29uc3QgYm9uZU5hbWUgPSBib25lTmFtZVN0cmluZyBhcyBWUk1IdW1hbkJvbmVOYW1lO1xyXG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXRCb25lTm9kZShib25lTmFtZSk7XHJcblxyXG4gICAgICAvLyBJZ25vcmUgd2hlbiB0aGVyZSBhcmUgbm8gYm9uZSBvbiB0aGUgVlJNSHVtYW5vaWRcclxuICAgICAgaWYgKCFub2RlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICAvLyBUYWtlIGEgZGlmZiBmcm9tIHJlc3RQb3NlXHJcbiAgICAgIF92M0Euc2V0KDAsIDAsIDApO1xyXG4gICAgICBfcXVhdEEuaWRlbnRpdHkoKTtcclxuXHJcbiAgICAgIGNvbnN0IHJlc3RTdGF0ZSA9IHRoaXMucmVzdFBvc2VbYm9uZU5hbWVdO1xyXG4gICAgICBpZiAocmVzdFN0YXRlPy5wb3NpdGlvbikge1xyXG4gICAgICAgIF92M0EuZnJvbUFycmF5KHJlc3RTdGF0ZS5wb3NpdGlvbikubmVnYXRlKCk7XHJcbiAgICAgIH1cclxuICAgICAgaWYgKHJlc3RTdGF0ZT8ucm90YXRpb24pIHtcclxuICAgICAgICBxdWF0SW52ZXJ0Q29tcGF0KF9xdWF0QS5mcm9tQXJyYXkocmVzdFN0YXRlLnJvdGF0aW9uKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIEdldCB0aGUgcG9zaXRpb24gLyByb3RhdGlvbiBmcm9tIHRoZSBub2RlXHJcbiAgICAgIF92M0EuYWRkKG5vZGUucG9zaXRpb24pO1xyXG4gICAgICBfcXVhdEEucHJlbXVsdGlwbHkobm9kZS5xdWF0ZXJuaW9uKTtcclxuXHJcbiAgICAgIC8vIENvbnZlcnQgdG8gcmF3IGFycmF5c1xyXG4gICAgICBwb3NlW2JvbmVOYW1lXSA9IHtcclxuICAgICAgICBwb3NpdGlvbjogX3YzQS50b0FycmF5KCkgYXMgW251bWJlciwgbnVtYmVyLCBudW1iZXJdLFxyXG4gICAgICAgIHJvdGF0aW9uOiBfcXVhdEEudG9BcnJheSgpIGFzIFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdLFxyXG4gICAgICB9O1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHBvc2U7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBMZXQgdGhlIGh1bWFub2lkIGRvIGEgc3BlY2lmaWVkIHBvc2UuXHJcbiAgICpcclxuICAgKiBFYWNoIHRyYW5zZm9ybSBoYXZlIHRvIGJlIGEgbG9jYWwgdHJhbnNmb3JtIHJlbGF0aXZlIGZyb20gcmVzdCBwb3NlIChULXBvc2UpLlxyXG4gICAqIFlvdSBjYW4gcGFzcyB3aGF0IHlvdSBnb3QgZnJvbSB7QGxpbmsgZ2V0UG9zZX0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gcG9zZU9iamVjdCBBIFtbVlJNUG9zZV1dIHRoYXQgcmVwcmVzZW50cyBhIHNpbmdsZSBwb3NlXHJcbiAgICovXHJcbiAgcHVibGljIHNldFBvc2UocG9zZU9iamVjdDogVlJNUG9zZSk6IHZvaWQge1xyXG4gICAgT2JqZWN0LmVudHJpZXMocG9zZU9iamVjdCkuZm9yRWFjaCgoW2JvbmVOYW1lU3RyaW5nLCBzdGF0ZV0pID0+IHtcclxuICAgICAgY29uc3QgYm9uZU5hbWUgPSBib25lTmFtZVN0cmluZyBhcyBWUk1IdW1hbkJvbmVOYW1lO1xyXG4gICAgICBjb25zdCBub2RlID0gdGhpcy5nZXRCb25lTm9kZShib25lTmFtZSk7XHJcblxyXG4gICAgICAvLyBJZ25vcmUgd2hlbiB0aGVyZSBhcmUgbm8gYm9uZSB0aGF0IGlzIGRlZmluZWQgaW4gdGhlIHBvc2Ugb24gdGhlIFZSTUh1bWFub2lkXHJcbiAgICAgIGlmICghbm9kZSkge1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgY29uc3QgcmVzdFN0YXRlID0gdGhpcy5yZXN0UG9zZVtib25lTmFtZV07XHJcbiAgICAgIGlmICghcmVzdFN0YXRlKSB7XHJcbiAgICAgICAgLy8gSXQncyB2ZXJ5IHVubGlrZWx5LiBQb3NzaWJseSBhIGJ1Z1xyXG4gICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gQXBwbHkgdGhlIHN0YXRlIHRvIHRoZSBhY3R1YWwgYm9uZVxyXG4gICAgICBpZiAoc3RhdGU/LnBvc2l0aW9uKSB7XHJcbiAgICAgICAgbm9kZS5wb3NpdGlvbi5mcm9tQXJyYXkoc3RhdGUucG9zaXRpb24pO1xyXG5cclxuICAgICAgICBpZiAocmVzdFN0YXRlLnBvc2l0aW9uKSB7XHJcbiAgICAgICAgICBub2RlLnBvc2l0aW9uLmFkZChfdjNBLmZyb21BcnJheShyZXN0U3RhdGUucG9zaXRpb24pKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmIChzdGF0ZT8ucm90YXRpb24pIHtcclxuICAgICAgICBub2RlLnF1YXRlcm5pb24uZnJvbUFycmF5KHN0YXRlLnJvdGF0aW9uKTtcclxuXHJcbiAgICAgICAgaWYgKHJlc3RTdGF0ZS5yb3RhdGlvbikge1xyXG4gICAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLm11bHRpcGx5KF9xdWF0QS5mcm9tQXJyYXkocmVzdFN0YXRlLnJvdGF0aW9uKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc2V0IHRoZSBodW1hbm9pZCB0byBpdHMgcmVzdCBwb3NlLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZXNldFBvc2UoKTogdm9pZCB7XHJcbiAgICBPYmplY3QuZW50cmllcyh0aGlzLnJlc3RQb3NlKS5mb3JFYWNoKChbYm9uZU5hbWUsIHJlc3RdKSA9PiB7XHJcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldEJvbmVOb2RlKGJvbmVOYW1lIGFzIFZSTUh1bWFuQm9uZU5hbWUpO1xyXG5cclxuICAgICAgaWYgKCFub2RlKSB7XHJcbiAgICAgICAgcmV0dXJuO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAocmVzdD8ucG9zaXRpb24pIHtcclxuICAgICAgICBub2RlLnBvc2l0aW9uLmZyb21BcnJheShyZXN0LnBvc2l0aW9uKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYgKHJlc3Q/LnJvdGF0aW9uKSB7XHJcbiAgICAgICAgbm9kZS5xdWF0ZXJuaW9uLmZyb21BcnJheShyZXN0LnJvdGF0aW9uKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm4gYSBib25lIGJvdW5kIHRvIGEgc3BlY2lmaWVkIHtAbGluayBWUk1IdW1hbkJvbmVOYW1lfSwgYXMgYSB7QGxpbmsgVlJNSHVtYW5Cb25lfS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0Qm9uZShuYW1lOiBWUk1IdW1hbkJvbmVOYW1lKTogVlJNSHVtYW5Cb25lIHwgdW5kZWZpbmVkIHtcclxuICAgIHJldHVybiB0aGlzLmh1bWFuQm9uZXNbbmFtZV0gPz8gdW5kZWZpbmVkO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIGEgYm9uZSBib3VuZCB0byBhIHNwZWNpZmllZCB7QGxpbmsgVlJNSHVtYW5Cb25lTmFtZX0sIGFzIGEgYFRIUkVFLk9iamVjdDNEYC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0Qm9uZU5vZGUobmFtZTogVlJNSHVtYW5Cb25lTmFtZSk6IFRIUkVFLk9iamVjdDNEIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy5odW1hbkJvbmVzW25hbWVdPy5ub2RlID8/IG51bGw7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgVlJNSHVtYW5Cb25lTmFtZSwgVlJNSHVtYW5Cb25lcyB9IGZyb20gJy4nO1xyXG5pbXBvcnQgeyBWUk1IdW1hbkJvbmVMaXN0IH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVMaXN0JztcclxuaW1wb3J0IHsgVlJNSHVtYW5Cb25lUGFyZW50TWFwIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmVQYXJlbnRNYXAnO1xyXG5pbXBvcnQgeyBWUk1SaWcgfSBmcm9tICcuL1ZSTVJpZyc7XHJcblxyXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuXHJcbi8qKlxyXG4gKiBBIGNsYXNzIHJlcHJlc2VudHMgdGhlIG5vcm1hbGl6ZWQgUmlnIG9mIGEgVlJNLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUh1bWFub2lkUmlnIGV4dGVuZHMgVlJNUmlnIHtcclxuICBwcm90ZWN0ZWQgc3RhdGljIF9zZXR1cFRyYW5zZm9ybXMoXHJcbiAgICBtb2RlbFJpZzogVlJNUmlnLFxyXG4gICk6IHtcclxuICAgIHJpZ0JvbmVzOiBWUk1IdW1hbkJvbmVzO1xyXG4gICAgcm9vdDogVEhSRUUuT2JqZWN0M0Q7XHJcbiAgICBwYXJlbnRXb3JsZFJvdGF0aW9uczogeyBbYm9uZU5hbWUgaW4gVlJNSHVtYW5Cb25lTmFtZV0/OiBUSFJFRS5RdWF0ZXJuaW9uIH07XHJcbiAgICBib25lUm90YXRpb25zOiB7IFtib25lTmFtZSBpbiBWUk1IdW1hbkJvbmVOYW1lXT86IFRIUkVFLlF1YXRlcm5pb24gfTtcclxuICB9IHtcclxuICAgIGNvbnN0IHJvb3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcclxuICAgIHJvb3QubmFtZSA9ICdWUk1IdW1hbm9pZFJpZyc7XHJcblxyXG4gICAgLy8gc3RvcmUgYm9uZVdvcmxkUG9zaXRpb25zIGFuZCBib25lV29ybGRSb3RhdGlvbnNcclxuICAgIGNvbnN0IGJvbmVXb3JsZFBvc2l0aW9uczogeyBbYm9uZU5hbWUgaW4gVlJNSHVtYW5Cb25lTmFtZV0/OiBUSFJFRS5WZWN0b3IzIH0gPSB7fTtcclxuICAgIGNvbnN0IGJvbmVXb3JsZFJvdGF0aW9uczogeyBbYm9uZU5hbWUgaW4gVlJNSHVtYW5Cb25lTmFtZV0/OiBUSFJFRS5RdWF0ZXJuaW9uIH0gPSB7fTtcclxuICAgIGNvbnN0IGJvbmVSb3RhdGlvbnM6IHsgW2JvbmVOYW1lIGluIFZSTUh1bWFuQm9uZU5hbWVdPzogVEhSRUUuUXVhdGVybmlvbiB9ID0ge307XHJcblxyXG4gICAgVlJNSHVtYW5Cb25lTGlzdC5mb3JFYWNoKChib25lTmFtZSkgPT4ge1xyXG4gICAgICBjb25zdCBib25lTm9kZSA9IG1vZGVsUmlnLmdldEJvbmVOb2RlKGJvbmVOYW1lKTtcclxuXHJcbiAgICAgIGlmIChib25lTm9kZSkge1xyXG4gICAgICAgIGNvbnN0IGJvbmVXb3JsZFBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuICAgICAgICBjb25zdCBib25lV29ybGRSb3RhdGlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcblxyXG4gICAgICAgIGJvbmVOb2RlLnVwZGF0ZVdvcmxkTWF0cml4KHRydWUsIGZhbHNlKTtcclxuICAgICAgICBib25lTm9kZS5tYXRyaXhXb3JsZC5kZWNvbXBvc2UoYm9uZVdvcmxkUG9zaXRpb24sIGJvbmVXb3JsZFJvdGF0aW9uLCBfdjNBKTtcclxuXHJcbiAgICAgICAgYm9uZVdvcmxkUG9zaXRpb25zW2JvbmVOYW1lXSA9IGJvbmVXb3JsZFBvc2l0aW9uO1xyXG4gICAgICAgIGJvbmVXb3JsZFJvdGF0aW9uc1tib25lTmFtZV0gPSBib25lV29ybGRSb3RhdGlvbjtcclxuICAgICAgICBib25lUm90YXRpb25zW2JvbmVOYW1lXSA9IGJvbmVOb2RlLnF1YXRlcm5pb24uY2xvbmUoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gYnVpbGQgcmlnIGhpZXJhcmNoeSArIHN0b3JlIHBhcmVudFdvcmxkUm90YXRpb25zXHJcbiAgICBjb25zdCBwYXJlbnRXb3JsZFJvdGF0aW9uczogeyBbYm9uZU5hbWUgaW4gVlJNSHVtYW5Cb25lTmFtZV0/OiBUSFJFRS5RdWF0ZXJuaW9uIH0gPSB7fTtcclxuXHJcbiAgICBjb25zdCByaWdCb25lczogUGFydGlhbDxWUk1IdW1hbkJvbmVzPiA9IHt9O1xyXG4gICAgVlJNSHVtYW5Cb25lTGlzdC5mb3JFYWNoKChib25lTmFtZSkgPT4ge1xyXG4gICAgICBjb25zdCBib25lTm9kZSA9IG1vZGVsUmlnLmdldEJvbmVOb2RlKGJvbmVOYW1lKTtcclxuXHJcbiAgICAgIGlmIChib25lTm9kZSkge1xyXG4gICAgICAgIGNvbnN0IGJvbmVXb3JsZFBvc2l0aW9uID0gYm9uZVdvcmxkUG9zaXRpb25zW2JvbmVOYW1lXSBhcyBUSFJFRS5WZWN0b3IzO1xyXG5cclxuICAgICAgICAvLyBzZWUgdGhlIG5lYXJlc3QgcGFyZW50IHBvc2l0aW9uXHJcbiAgICAgICAgbGV0IGN1cnJlbnRCb25lTmFtZTogVlJNSHVtYW5Cb25lTmFtZSB8IG51bGwgPSBib25lTmFtZTtcclxuICAgICAgICBsZXQgcGFyZW50V29ybGRQb3NpdGlvbjogVEhSRUUuVmVjdG9yMyB8IHVuZGVmaW5lZDtcclxuICAgICAgICBsZXQgcGFyZW50V29ybGRSb3RhdGlvbjogVEhSRUUuUXVhdGVybmlvbiB8IHVuZGVmaW5lZDtcclxuICAgICAgICB3aGlsZSAocGFyZW50V29ybGRQb3NpdGlvbiA9PSBudWxsKSB7XHJcbiAgICAgICAgICBjdXJyZW50Qm9uZU5hbWUgPSBWUk1IdW1hbkJvbmVQYXJlbnRNYXBbY3VycmVudEJvbmVOYW1lXTtcclxuICAgICAgICAgIGlmIChjdXJyZW50Qm9uZU5hbWUgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHBhcmVudFdvcmxkUG9zaXRpb24gPSBib25lV29ybGRQb3NpdGlvbnNbY3VycmVudEJvbmVOYW1lXTtcclxuICAgICAgICAgIHBhcmVudFdvcmxkUm90YXRpb24gPSBib25lV29ybGRSb3RhdGlvbnNbY3VycmVudEJvbmVOYW1lXTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIGFkZCB0byBoaWVyYXJjaHlcclxuICAgICAgICBjb25zdCByaWdCb25lTm9kZSA9IG5ldyBUSFJFRS5PYmplY3QzRCgpO1xyXG4gICAgICAgIHJpZ0JvbmVOb2RlLm5hbWUgPSAnTm9ybWFsaXplZF8nICsgYm9uZU5vZGUubmFtZTtcclxuXHJcbiAgICAgICAgY29uc3QgcGFyZW50UmlnQm9uZU5vZGUgPSAoY3VycmVudEJvbmVOYW1lID8gcmlnQm9uZXNbY3VycmVudEJvbmVOYW1lXT8ubm9kZSA6IHJvb3QpIGFzIFRIUkVFLk9iamVjdDNEO1xyXG5cclxuICAgICAgICBwYXJlbnRSaWdCb25lTm9kZS5hZGQocmlnQm9uZU5vZGUpO1xyXG4gICAgICAgIHJpZ0JvbmVOb2RlLnBvc2l0aW9uLmNvcHkoYm9uZVdvcmxkUG9zaXRpb24pO1xyXG4gICAgICAgIGlmIChwYXJlbnRXb3JsZFBvc2l0aW9uKSB7XHJcbiAgICAgICAgICByaWdCb25lTm9kZS5wb3NpdGlvbi5zdWIocGFyZW50V29ybGRQb3NpdGlvbik7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByaWdCb25lc1tib25lTmFtZV0gPSB7IG5vZGU6IHJpZ0JvbmVOb2RlIH07XHJcblxyXG4gICAgICAgIC8vIHN0b3JlIHBhcmVudFdvcmxkUm90YXRpb25cclxuICAgICAgICBwYXJlbnRXb3JsZFJvdGF0aW9uc1tib25lTmFtZV0gPSBwYXJlbnRXb3JsZFJvdGF0aW9uID8/IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHJpZ0JvbmVzOiByaWdCb25lcyBhcyBWUk1IdW1hbkJvbmVzLFxyXG4gICAgICByb290LFxyXG4gICAgICBwYXJlbnRXb3JsZFJvdGF0aW9ucyxcclxuICAgICAgYm9uZVJvdGF0aW9ucyxcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgcmVhZG9ubHkgb3JpZ2luYWw6IFZSTVJpZztcclxuICBwdWJsaWMgcmVhZG9ubHkgcm9vdDogVEhSRUUuT2JqZWN0M0Q7XHJcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9wYXJlbnRXb3JsZFJvdGF0aW9uczogeyBbYm9uZU5hbWUgaW4gVlJNSHVtYW5Cb25lTmFtZV0/OiBUSFJFRS5RdWF0ZXJuaW9uIH07XHJcbiAgcHJvdGVjdGVkIHJlYWRvbmx5IF9ib25lUm90YXRpb25zOiB7IFtib25lTmFtZSBpbiBWUk1IdW1hbkJvbmVOYW1lXT86IFRIUkVFLlF1YXRlcm5pb24gfTtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKGh1bWFub2lkOiBWUk1SaWcpIHtcclxuICAgIGNvbnN0IHsgcmlnQm9uZXMsIHJvb3QsIHBhcmVudFdvcmxkUm90YXRpb25zLCBib25lUm90YXRpb25zIH0gPSBWUk1IdW1hbm9pZFJpZy5fc2V0dXBUcmFuc2Zvcm1zKGh1bWFub2lkKTtcclxuXHJcbiAgICBzdXBlcihyaWdCb25lcyk7XHJcblxyXG4gICAgdGhpcy5vcmlnaW5hbCA9IGh1bWFub2lkO1xyXG4gICAgdGhpcy5yb290ID0gcm9vdDtcclxuICAgIHRoaXMuX3BhcmVudFdvcmxkUm90YXRpb25zID0gcGFyZW50V29ybGRSb3RhdGlvbnM7XHJcbiAgICB0aGlzLl9ib25lUm90YXRpb25zID0gYm9uZVJvdGF0aW9ucztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSB0aGlzIGh1bWFub2lkIHJpZy5cclxuICAgKi9cclxuICBwdWJsaWMgdXBkYXRlKCk6IHZvaWQge1xyXG4gICAgVlJNSHVtYW5Cb25lTGlzdC5mb3JFYWNoKChib25lTmFtZSkgPT4ge1xyXG4gICAgICBjb25zdCBib25lTm9kZSA9IHRoaXMub3JpZ2luYWwuZ2V0Qm9uZU5vZGUoYm9uZU5hbWUpO1xyXG5cclxuICAgICAgaWYgKGJvbmVOb2RlICE9IG51bGwpIHtcclxuICAgICAgICBjb25zdCByaWdCb25lTm9kZSA9IHRoaXMuZ2V0Qm9uZU5vZGUoYm9uZU5hbWUpITtcclxuICAgICAgICBjb25zdCBwYXJlbnRXb3JsZFJvdGF0aW9uID0gdGhpcy5fcGFyZW50V29ybGRSb3RhdGlvbnNbYm9uZU5hbWVdITtcclxuICAgICAgICBjb25zdCBpbnZQYXJlbnRXb3JsZFJvdGF0aW9uID0gX3F1YXRBLmNvcHkocGFyZW50V29ybGRSb3RhdGlvbikuaW52ZXJ0KCk7XHJcbiAgICAgICAgY29uc3QgYm9uZVJvdGF0aW9uID0gdGhpcy5fYm9uZVJvdGF0aW9uc1tib25lTmFtZV0hO1xyXG5cclxuICAgICAgICBib25lTm9kZS5xdWF0ZXJuaW9uXHJcbiAgICAgICAgICAuY29weShyaWdCb25lTm9kZS5xdWF0ZXJuaW9uKVxyXG4gICAgICAgICAgLm11bHRpcGx5KHBhcmVudFdvcmxkUm90YXRpb24pXHJcbiAgICAgICAgICAucHJlbXVsdGlwbHkoaW52UGFyZW50V29ybGRSb3RhdGlvbilcclxuICAgICAgICAgIC5tdWx0aXBseShib25lUm90YXRpb24pO1xyXG5cclxuICAgICAgICAvLyBNb3ZlIHRoZSBtYXNzIGNlbnRlciBvZiB0aGUgVlJNXHJcbiAgICAgICAgaWYgKGJvbmVOYW1lID09PSAnaGlwcycpIHtcclxuICAgICAgICAgIGNvbnN0IGJvbmVXb3JsZFBvc2l0aW9uID0gcmlnQm9uZU5vZGUuZ2V0V29ybGRQb3NpdGlvbihuZXcgVEhSRUUuVmVjdG9yMygpKTtcclxuICAgICAgICAgIGNvbnN0IHBhcmVudFdvcmxkTWF0cml4ID0gYm9uZU5vZGUucGFyZW50IS5tYXRyaXhXb3JsZDtcclxuICAgICAgICAgIGNvbnN0IGxvY2FsUG9zaXRpb24gPSBib25lV29ybGRQb3NpdGlvbi5hcHBseU1hdHJpeDQocGFyZW50V29ybGRNYXRyaXguaW52ZXJ0KCkpO1xyXG4gICAgICAgICAgYm9uZU5vZGUucG9zaXRpb24uY29weShsb2NhbFBvc2l0aW9uKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB0eXBlIHsgVlJNSHVtYW5Cb25lIH0gZnJvbSAnLi9WUk1IdW1hbkJvbmUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUh1bWFuQm9uZXMgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZXMnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUh1bWFuQm9uZU5hbWUgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZU5hbWUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTVBvc2UgfSBmcm9tICcuL1ZSTVBvc2UnO1xyXG5pbXBvcnQgeyBWUk1SaWcgfSBmcm9tICcuL1ZSTVJpZyc7XHJcbmltcG9ydCB7IFZSTUh1bWFub2lkUmlnIH0gZnJvbSAnLi9WUk1IdW1hbm9pZFJpZyc7XHJcblxyXG4vKipcclxuICogQSBjbGFzcyByZXByZXNlbnRzIGEgaHVtYW5vaWQgb2YgYSBWUk0uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNSHVtYW5vaWQge1xyXG4gIC8qKlxyXG4gICAqIFdoZXRoZXIgaXQgY29waWVzIHBvc2UgZnJvbSBub3JtYWxpemVkSHVtYW5Cb25lcyB0byByYXdIdW1hbkJvbmVzIG9uIHtAbGluayB1cGRhdGV9LlxyXG4gICAqIGB0cnVlYCBieSBkZWZhdWx0LlxyXG4gICAqXHJcbiAgICogQGRlZmF1bHQgdHJ1ZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhdXRvVXBkYXRlSHVtYW5Cb25lczogYm9vbGVhbjtcclxuXHJcbiAgLyoqXHJcbiAgICogQSByYXcgcmlnIG9mIHRoZSBWUk0uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfcmF3SHVtYW5Cb25lczogVlJNUmlnOyAvLyBUT0RPOiBSZW5hbWVcclxuXHJcbiAgLyoqXHJcbiAgICogQSBub3JtYWxpemVkIHJpZyBvZiB0aGUgVlJNLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX25vcm1hbGl6ZWRIdW1hbkJvbmVzOiBWUk1IdW1hbm9pZFJpZzsgLy8gVE9ETzogUmVuYW1lXHJcblxyXG4gIC8qKlxyXG4gICAqIEBkZXByZWNhdGVkIERlcHJlY2F0ZWQuIFVzZSBlaXRoZXIge0BsaW5rIHJhd1Jlc3RQb3NlfSBvciB7QGxpbmsgbm9ybWFsaXplZFJlc3RQb3NlfSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgcmVzdFBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICBjb25zb2xlLndhcm4oJ1ZSTUh1bWFub2lkOiByZXN0UG9zZSBpcyBkZXByZWNhdGVkLiBVc2UgZWl0aGVyIHJhd1Jlc3RQb3NlIG9yIG5vcm1hbGl6ZWRSZXN0UG9zZSBpbnN0ZWFkLicpO1xyXG5cclxuICAgIHJldHVybiB0aGlzLnJhd1Jlc3RQb3NlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSB7QGxpbmsgVlJNUG9zZX0gb2YgaXRzIHJhdyBodW1hbiBib25lcyB0aGF0IGlzIGl0cyBkZWZhdWx0IHN0YXRlLlxyXG4gICAqIE5vdGUgdGhhdCBpdCdzIG5vdCBjb21wYXRpYmxlIHdpdGgge0BsaW5rIHNldFJhd1Bvc2V9IGFuZCB7QGxpbmsgZ2V0UmF3UG9zZX0sIHNpbmNlIGl0IGNvbnRhaW5zIG5vbi1yZWxhdGl2ZSB2YWx1ZXMgb2YgZWFjaCBsb2NhbCB0cmFuc2Zvcm1zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgcmF3UmVzdFBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICByZXR1cm4gdGhpcy5fcmF3SHVtYW5Cb25lcy5yZXN0UG9zZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEEge0BsaW5rIFZSTVBvc2V9IG9mIGl0cyBub3JtYWxpemVkIGh1bWFuIGJvbmVzIHRoYXQgaXMgaXRzIGRlZmF1bHQgc3RhdGUuXHJcbiAgICogTm90ZSB0aGF0IGl0J3Mgbm90IGNvbXBhdGlibGUgd2l0aCB7QGxpbmsgc2V0Tm9ybWFsaXplZFBvc2V9IGFuZCB7QGxpbmsgZ2V0Tm9ybWFsaXplZFBvc2V9LCBzaW5jZSBpdCBjb250YWlucyBub24tcmVsYXRpdmUgdmFsdWVzIG9mIGVhY2ggbG9jYWwgdHJhbnNmb3Jtcy5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0IG5vcm1hbGl6ZWRSZXN0UG9zZSgpOiBWUk1Qb3NlIHtcclxuICAgIHJldHVybiB0aGlzLl9ub3JtYWxpemVkSHVtYW5Cb25lcy5yZXN0UG9zZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEEgbWFwIGZyb20ge0BsaW5rIFZSTUh1bWFuQm9uZU5hbWV9IHRvIHJhdyB7QGxpbmsgVlJNSHVtYW5Cb25lfXMuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBodW1hbkJvbmVzKCk6IFZSTUh1bWFuQm9uZXMge1xyXG4gICAgLy8gYW4gYWxpYXMgb2YgYHJhd0h1bWFuQm9uZXNgXHJcbiAgICByZXR1cm4gdGhpcy5fcmF3SHVtYW5Cb25lcy5odW1hbkJvbmVzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBtYXAgZnJvbSB7QGxpbmsgVlJNSHVtYW5Cb25lTmFtZX0gdG8gcmF3IHtAbGluayBWUk1IdW1hbkJvbmV9cy5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0IHJhd0h1bWFuQm9uZXMoKTogVlJNSHVtYW5Cb25lcyB7XHJcbiAgICByZXR1cm4gdGhpcy5fcmF3SHVtYW5Cb25lcy5odW1hbkJvbmVzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQSBtYXAgZnJvbSB7QGxpbmsgVlJNSHVtYW5Cb25lTmFtZX0gdG8gbm9ybWFsaXplZCB7QGxpbmsgVlJNSHVtYW5Cb25lfXMuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBub3JtYWxpemVkSHVtYW5Cb25lcygpOiBWUk1IdW1hbkJvbmVzIHtcclxuICAgIHJldHVybiB0aGlzLl9ub3JtYWxpemVkSHVtYW5Cb25lcy5odW1hbkJvbmVzO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIHJvb3Qgb2Ygbm9ybWFsaXplZCB7QGxpbmsgVlJNSHVtYW5Cb25lfXMuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBub3JtYWxpemVkSHVtYW5Cb25lc1Jvb3QoKTogVEhSRUUuT2JqZWN0M0Qge1xyXG4gICAgcmV0dXJuIHRoaXMuX25vcm1hbGl6ZWRIdW1hbkJvbmVzLnJvb3Q7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcge0BsaW5rIFZSTUh1bWFub2lkfS5cclxuICAgKiBAcGFyYW0gaHVtYW5Cb25lcyBBIHtAbGluayBWUk1IdW1hbkJvbmVzfSBjb250YWlucyBhbGwgdGhlIGJvbmVzIG9mIHRoZSBuZXcgaHVtYW5vaWRcclxuICAgKiBAcGFyYW0gYXV0b1VwZGF0ZUh1bWFuQm9uZXMgV2hldGhlciBpdCBjb3BpZXMgcG9zZSBmcm9tIG5vcm1hbGl6ZWRIdW1hbkJvbmVzIHRvIHJhd0h1bWFuQm9uZXMgb24ge0BsaW5rIHVwZGF0ZX0uIGB0cnVlYCBieSBkZWZhdWx0LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihodW1hbkJvbmVzOiBWUk1IdW1hbkJvbmVzLCBvcHRpb25zPzogeyBhdXRvVXBkYXRlSHVtYW5Cb25lcz86IGJvb2xlYW4gfSkge1xyXG4gICAgdGhpcy5hdXRvVXBkYXRlSHVtYW5Cb25lcyA9IG9wdGlvbnM/LmF1dG9VcGRhdGVIdW1hbkJvbmVzID8/IHRydWU7XHJcbiAgICB0aGlzLl9yYXdIdW1hbkJvbmVzID0gbmV3IFZSTVJpZyhodW1hbkJvbmVzKTtcclxuICAgIHRoaXMuX25vcm1hbGl6ZWRIdW1hbkJvbmVzID0gbmV3IFZSTUh1bWFub2lkUmlnKHRoaXMuX3Jhd0h1bWFuQm9uZXMpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ29weSB0aGUgZ2l2ZW4ge0BsaW5rIFZSTUh1bWFub2lkfSBpbnRvIHRoaXMgb25lLlxyXG4gICAqIEBwYXJhbSBzb3VyY2UgVGhlIHtAbGluayBWUk1IdW1hbm9pZH0geW91IHdhbnQgdG8gY29weVxyXG4gICAqIEByZXR1cm5zIHRoaXNcclxuICAgKi9cclxuICBwdWJsaWMgY29weShzb3VyY2U6IFZSTUh1bWFub2lkKTogdGhpcyB7XHJcbiAgICB0aGlzLmF1dG9VcGRhdGVIdW1hbkJvbmVzID0gc291cmNlLmF1dG9VcGRhdGVIdW1hbkJvbmVzO1xyXG4gICAgdGhpcy5fcmF3SHVtYW5Cb25lcyA9IG5ldyBWUk1SaWcoc291cmNlLmh1bWFuQm9uZXMpO1xyXG4gICAgdGhpcy5fbm9ybWFsaXplZEh1bWFuQm9uZXMgPSBuZXcgVlJNSHVtYW5vaWRSaWcodGhpcy5fcmF3SHVtYW5Cb25lcyk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm5zIGEgY2xvbmUgb2YgdGhpcyB7QGxpbmsgVlJNSHVtYW5vaWR9LlxyXG4gICAqIEByZXR1cm5zIENvcGllZCB7QGxpbmsgVlJNSHVtYW5vaWR9XHJcbiAgICovXHJcbiAgcHVibGljIGNsb25lKCk6IFZSTUh1bWFub2lkIHtcclxuICAgIHJldHVybiBuZXcgVlJNSHVtYW5vaWQodGhpcy5odW1hbkJvbmVzLCB7IGF1dG9VcGRhdGVIdW1hbkJvbmVzOiB0aGlzLmF1dG9VcGRhdGVIdW1hbkJvbmVzIH0pLmNvcHkodGhpcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkLiBVc2UgZWl0aGVyIHtAbGluayBnZXRSYXdBYnNvbHV0ZVBvc2V9IG9yIHtAbGluayBnZXROb3JtYWxpemVkQWJzb2x1dGVQb3NlfSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRBYnNvbHV0ZVBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICBjb25zb2xlLndhcm4oXHJcbiAgICAgICdWUk1IdW1hbm9pZDogZ2V0QWJzb2x1dGVQb3NlKCkgaXMgZGVwcmVjYXRlZC4gVXNlIGVpdGhlciBnZXRSYXdBYnNvbHV0ZVBvc2UoKSBvciBnZXROb3JtYWxpemVkQWJzb2x1dGVQb3NlKCkgaW5zdGVhZC4nLFxyXG4gICAgKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5nZXRSYXdBYnNvbHV0ZVBvc2UoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiB0aGUgY3VycmVudCBhYnNvbHV0ZSBwb3NlIG9mIHRoaXMgcmF3IGh1bWFuIGJvbmVzIGFzIGEge0BsaW5rIFZSTVBvc2V9LlxyXG4gICAqIE5vdGUgdGhhdCB0aGUgb3V0cHV0IHJlc3VsdCB3aWxsIGNvbnRhaW4gaW5pdGlhbCBzdGF0ZSBvZiB0aGUgVlJNIGFuZCBub3QgY29tcGF0aWJsZSBiZXR3ZWVuIGRpZmZlcmVudCBtb2RlbHMuXHJcbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gdXNlIHtAbGluayBnZXRSYXdQb3NlfSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRSYXdBYnNvbHV0ZVBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICByZXR1cm4gdGhpcy5fcmF3SHVtYW5Cb25lcy5nZXRBYnNvbHV0ZVBvc2UoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiB0aGUgY3VycmVudCBhYnNvbHV0ZSBwb3NlIG9mIHRoaXMgbm9ybWFsaXplZCBodW1hbiBib25lcyBhcyBhIHtAbGluayBWUk1Qb3NlfS5cclxuICAgKiBOb3RlIHRoYXQgdGhlIG91dHB1dCByZXN1bHQgd2lsbCBjb250YWluIGluaXRpYWwgc3RhdGUgb2YgdGhlIFZSTSBhbmQgbm90IGNvbXBhdGlibGUgYmV0d2VlbiBkaWZmZXJlbnQgbW9kZWxzLlxyXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIHVzZSB7QGxpbmsgZ2V0Tm9ybWFsaXplZFBvc2V9IGluc3RlYWQuXHJcbiAgICovXHJcbiAgcHVibGljIGdldE5vcm1hbGl6ZWRBYnNvbHV0ZVBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICByZXR1cm4gdGhpcy5fbm9ybWFsaXplZEh1bWFuQm9uZXMuZ2V0QWJzb2x1dGVQb3NlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkLiBVc2UgZWl0aGVyIHtAbGluayBnZXRSYXdQb3NlfSBvciB7QGxpbmsgZ2V0Tm9ybWFsaXplZFBvc2V9IGluc3RlYWQuXHJcbiAgICovXHJcbiAgcHVibGljIGdldFBvc2UoKTogVlJNUG9zZSB7XHJcbiAgICBjb25zb2xlLndhcm4oJ1ZSTUh1bWFub2lkOiBnZXRQb3NlKCkgaXMgZGVwcmVjYXRlZC4gVXNlIGVpdGhlciBnZXRSYXdQb3NlKCkgb3IgZ2V0Tm9ybWFsaXplZFBvc2UoKSBpbnN0ZWFkLicpO1xyXG5cclxuICAgIHJldHVybiB0aGlzLmdldFJhd1Bvc2UoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiB0aGUgY3VycmVudCBwb3NlIG9mIHJhdyBodW1hbiBib25lcyBhcyBhIHtAbGluayBWUk1Qb3NlfS5cclxuICAgKlxyXG4gICAqIEVhY2ggdHJhbnNmb3JtIGlzIGEgbG9jYWwgdHJhbnNmb3JtIHJlbGF0aXZlIGZyb20gcmVzdCBwb3NlIChULXBvc2UpLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXRSYXdQb3NlKCk6IFZSTVBvc2Uge1xyXG4gICAgcmV0dXJuIHRoaXMuX3Jhd0h1bWFuQm9uZXMuZ2V0UG9zZSgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIHRoZSBjdXJyZW50IHBvc2Ugb2Ygbm9ybWFsaXplZCBodW1hbiBib25lcyBhcyBhIHtAbGluayBWUk1Qb3NlfS5cclxuICAgKlxyXG4gICAqIEVhY2ggdHJhbnNmb3JtIGlzIGEgbG9jYWwgdHJhbnNmb3JtIHJlbGF0aXZlIGZyb20gcmVzdCBwb3NlIChULXBvc2UpLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXROb3JtYWxpemVkUG9zZSgpOiBWUk1Qb3NlIHtcclxuICAgIHJldHVybiB0aGlzLl9ub3JtYWxpemVkSHVtYW5Cb25lcy5nZXRQb3NlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkLiBVc2UgZWl0aGVyIHtAbGluayBzZXRSYXdQb3NlfSBvciB7QGxpbmsgc2V0Tm9ybWFsaXplZFBvc2V9IGluc3RlYWQuXHJcbiAgICovXHJcbiAgcHVibGljIHNldFBvc2UocG9zZU9iamVjdDogVlJNUG9zZSk6IHZvaWQge1xyXG4gICAgY29uc29sZS53YXJuKCdWUk1IdW1hbm9pZDogc2V0UG9zZSgpIGlzIGRlcHJlY2F0ZWQuIFVzZSBlaXRoZXIgc2V0UmF3UG9zZSgpIG9yIHNldE5vcm1hbGl6ZWRQb3NlKCkgaW5zdGVhZC4nKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5zZXRSYXdQb3NlKHBvc2VPYmplY3QpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogTGV0IHRoZSByYXcgaHVtYW4gYm9uZXMgZG8gYSBzcGVjaWZpZWQgcG9zZS5cclxuICAgKlxyXG4gICAqIEVhY2ggdHJhbnNmb3JtIGhhdmUgdG8gYmUgYSBsb2NhbCB0cmFuc2Zvcm0gcmVsYXRpdmUgZnJvbSByZXN0IHBvc2UgKFQtcG9zZSkuXHJcbiAgICogWW91IGNhbiBwYXNzIHdoYXQgeW91IGdvdCBmcm9tIHtAbGluayBnZXRSYXdQb3NlfS5cclxuICAgKlxyXG4gICAqIElmIHlvdSBhcmUgdXNpbmcge0BsaW5rIGF1dG9VcGRhdGVIdW1hbkJvbmVzfSwgeW91IG1pZ2h0IHdhbnQgdG8gdXNlIHtAbGluayBzZXROb3JtYWxpemVkUG9zZX0gaW5zdGVhZC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBwb3NlT2JqZWN0IEEge0BsaW5rIFZSTVBvc2V9IHRoYXQgcmVwcmVzZW50cyBhIHNpbmdsZSBwb3NlXHJcbiAgICovXHJcbiAgcHVibGljIHNldFJhd1Bvc2UocG9zZU9iamVjdDogVlJNUG9zZSk6IHZvaWQge1xyXG4gICAgcmV0dXJuIHRoaXMuX3Jhd0h1bWFuQm9uZXMuc2V0UG9zZShwb3NlT2JqZWN0KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIExldCB0aGUgbm9ybWFsaXplZCBodW1hbiBib25lcyBkbyBhIHNwZWNpZmllZCBwb3NlLlxyXG4gICAqXHJcbiAgICogRWFjaCB0cmFuc2Zvcm0gaGF2ZSB0byBiZSBhIGxvY2FsIHRyYW5zZm9ybSByZWxhdGl2ZSBmcm9tIHJlc3QgcG9zZSAoVC1wb3NlKS5cclxuICAgKiBZb3UgY2FuIHBhc3Mgd2hhdCB5b3UgZ290IGZyb20ge0BsaW5rIGdldE5vcm1hbGl6ZWRQb3NlfS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBwb3NlT2JqZWN0IEEge0BsaW5rIFZSTVBvc2V9IHRoYXQgcmVwcmVzZW50cyBhIHNpbmdsZSBwb3NlXHJcbiAgICovXHJcbiAgcHVibGljIHNldE5vcm1hbGl6ZWRQb3NlKHBvc2VPYmplY3Q6IFZSTVBvc2UpOiB2b2lkIHtcclxuICAgIHJldHVybiB0aGlzLl9ub3JtYWxpemVkSHVtYW5Cb25lcy5zZXRQb3NlKHBvc2VPYmplY3QpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQGRlcHJlY2F0ZWQgRGVwcmVjYXRlZC4gVXNlIGVpdGhlciB7QGxpbmsgcmVzZXRSYXdQb3NlfSBvciB7QGxpbmsgcmVzZXROb3JtYWxpemVkUG9zZX0gaW5zdGVhZC5cclxuICAgKi9cclxuICBwdWJsaWMgcmVzZXRQb3NlKCk6IHZvaWQge1xyXG4gICAgY29uc29sZS53YXJuKCdWUk1IdW1hbm9pZDogcmVzZXRQb3NlKCkgaXMgZGVwcmVjYXRlZC4gVXNlIGVpdGhlciByZXNldFJhd1Bvc2UoKSBvciByZXNldE5vcm1hbGl6ZWRQb3NlKCkgaW5zdGVhZC4nKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXNldFJhd1Bvc2UoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc2V0IHRoZSByYXcgaHVtYW5vaWQgdG8gaXRzIHJlc3QgcG9zZS5cclxuICAgKlxyXG4gICAqIElmIHlvdSBhcmUgdXNpbmcge0BsaW5rIGF1dG9VcGRhdGVIdW1hbkJvbmVzfSwgeW91IG1pZ2h0IHdhbnQgdG8gdXNlIHtAbGluayByZXNldE5vcm1hbGl6ZWRQb3NlfSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZXNldFJhd1Bvc2UoKTogdm9pZCB7XHJcbiAgICByZXR1cm4gdGhpcy5fcmF3SHVtYW5Cb25lcy5yZXNldFBvc2UoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlc2V0IHRoZSBub3JtYWxpemVkIGh1bWFub2lkIHRvIGl0cyByZXN0IHBvc2UuXHJcbiAgICovXHJcbiAgcHVibGljIHJlc2V0Tm9ybWFsaXplZFBvc2UoKTogdm9pZCB7XHJcbiAgICByZXR1cm4gdGhpcy5fcmF3SHVtYW5Cb25lcy5yZXNldFBvc2UoKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBkZXByZWNhdGVkIERlcHJlY2F0ZWQuIFVzZSBlaXRoZXIge0BsaW5rIGdldFJhd0JvbmV9IG9yIHtAbGluayBnZXROb3JtYWxpemVkQm9uZX0gaW5zdGVhZC5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0Qm9uZShuYW1lOiBWUk1IdW1hbkJvbmVOYW1lKTogVlJNSHVtYW5Cb25lIHwgdW5kZWZpbmVkIHtcclxuICAgIGNvbnNvbGUud2FybignVlJNSHVtYW5vaWQ6IGdldEJvbmUoKSBpcyBkZXByZWNhdGVkLiBVc2UgZWl0aGVyIGdldFJhd0JvbmUoKSBvciBnZXROb3JtYWxpemVkQm9uZSgpIGluc3RlYWQuJyk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuZ2V0UmF3Qm9uZShuYW1lKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiBhIHJhdyB7QGxpbmsgVlJNSHVtYW5Cb25lfSBib3VuZCB0byBhIHNwZWNpZmllZCB7QGxpbmsgVlJNSHVtYW5Cb25lTmFtZX0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XHJcbiAgICovXHJcbiAgcHVibGljIGdldFJhd0JvbmUobmFtZTogVlJNSHVtYW5Cb25lTmFtZSk6IFZSTUh1bWFuQm9uZSB8IHVuZGVmaW5lZCB7XHJcbiAgICByZXR1cm4gdGhpcy5fcmF3SHVtYW5Cb25lcy5nZXRCb25lKG5hbWUpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIGEgbm9ybWFsaXplZCB7QGxpbmsgVlJNSHVtYW5Cb25lfSBib3VuZCB0byBhIHNwZWNpZmllZCB7QGxpbmsgVlJNSHVtYW5Cb25lTmFtZX0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XHJcbiAgICovXHJcbiAgcHVibGljIGdldE5vcm1hbGl6ZWRCb25lKG5hbWU6IFZSTUh1bWFuQm9uZU5hbWUpOiBWUk1IdW1hbkJvbmUgfCB1bmRlZmluZWQge1xyXG4gICAgcmV0dXJuIHRoaXMuX25vcm1hbGl6ZWRIdW1hbkJvbmVzLmdldEJvbmUobmFtZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBEZXByZWNhdGVkLiBVc2UgZWl0aGVyIHtAbGluayBnZXRSYXdCb25lTm9kZX0gb3Ige0BsaW5rIGdldE5vcm1hbGl6ZWRCb25lTm9kZX0gaW5zdGVhZC5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0Qm9uZU5vZGUobmFtZTogVlJNSHVtYW5Cb25lTmFtZSk6IFRIUkVFLk9iamVjdDNEIHwgbnVsbCB7XHJcbiAgICBjb25zb2xlLndhcm4oXHJcbiAgICAgICdWUk1IdW1hbm9pZDogZ2V0Qm9uZU5vZGUoKSBpcyBkZXByZWNhdGVkLiBVc2UgZWl0aGVyIGdldFJhd0JvbmVOb2RlKCkgb3IgZ2V0Tm9ybWFsaXplZEJvbmVOb2RlKCkgaW5zdGVhZC4nLFxyXG4gICAgKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5nZXRSYXdCb25lTm9kZShuYW1lKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybiBhIHJhdyBib25lIGFzIGEgYFRIUkVFLk9iamVjdDNEYCBib3VuZCB0byBhIHNwZWNpZmllZCB7QGxpbmsgVlJNSHVtYW5Cb25lTmFtZX0uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbmFtZSBOYW1lIG9mIHRoZSBib25lIHlvdSB3YW50XHJcbiAgICovXHJcbiAgcHVibGljIGdldFJhd0JvbmVOb2RlKG5hbWU6IFZSTUh1bWFuQm9uZU5hbWUpOiBUSFJFRS5PYmplY3QzRCB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuX3Jhd0h1bWFuQm9uZXMuZ2V0Qm9uZU5vZGUobmFtZSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXR1cm4gYSBub3JtYWxpemVkIGJvbmUgYXMgYSBgVEhSRUUuT2JqZWN0M0RgIGJvdW5kIHRvIGEgc3BlY2lmaWVkIHtAbGluayBWUk1IdW1hbkJvbmVOYW1lfS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBuYW1lIE5hbWUgb2YgdGhlIGJvbmUgeW91IHdhbnRcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0Tm9ybWFsaXplZEJvbmVOb2RlKG5hbWU6IFZSTUh1bWFuQm9uZU5hbWUpOiBUSFJFRS5PYmplY3QzRCB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuX25vcm1hbGl6ZWRIdW1hbkJvbmVzLmdldEJvbmVOb2RlKG5hbWUpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBodW1hbm9pZCBjb21wb25lbnQuXHJcbiAgICpcclxuICAgKiBJZiB7QGxpbmsgYXV0b1VwZGF0ZUh1bWFuQm9uZXN9IGlzIGB0cnVlYCwgaXQgdHJhbnNmZXJzIHRoZSBwb3NlIG9mIG5vcm1hbGl6ZWQgaHVtYW4gYm9uZXMgdG8gcmF3IGh1bWFuIGJvbmVzLlxyXG4gICAqL1xyXG4gIHB1YmxpYyB1cGRhdGUoKTogdm9pZCB7XHJcbiAgICBpZiAodGhpcy5hdXRvVXBkYXRlSHVtYW5Cb25lcykge1xyXG4gICAgICB0aGlzLl9ub3JtYWxpemVkSHVtYW5Cb25lcy51cGRhdGUoKTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIiwiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcblxyXG5leHBvcnQgY29uc3QgVlJNUmVxdWlyZWRIdW1hbkJvbmVOYW1lID0ge1xyXG4gIEhpcHM6ICdoaXBzJyxcclxuICBTcGluZTogJ3NwaW5lJyxcclxuICBIZWFkOiAnaGVhZCcsXHJcbiAgTGVmdFVwcGVyTGVnOiAnbGVmdFVwcGVyTGVnJyxcclxuICBMZWZ0TG93ZXJMZWc6ICdsZWZ0TG93ZXJMZWcnLFxyXG4gIExlZnRGb290OiAnbGVmdEZvb3QnLFxyXG4gIFJpZ2h0VXBwZXJMZWc6ICdyaWdodFVwcGVyTGVnJyxcclxuICBSaWdodExvd2VyTGVnOiAncmlnaHRMb3dlckxlZycsXHJcbiAgUmlnaHRGb290OiAncmlnaHRGb290JyxcclxuICBMZWZ0VXBwZXJBcm06ICdsZWZ0VXBwZXJBcm0nLFxyXG4gIExlZnRMb3dlckFybTogJ2xlZnRMb3dlckFybScsXHJcbiAgTGVmdEhhbmQ6ICdsZWZ0SGFuZCcsXHJcbiAgUmlnaHRVcHBlckFybTogJ3JpZ2h0VXBwZXJBcm0nLFxyXG4gIFJpZ2h0TG93ZXJBcm06ICdyaWdodExvd2VyQXJtJyxcclxuICBSaWdodEhhbmQ6ICdyaWdodEhhbmQnLFxyXG59IGFzIGNvbnN0O1xyXG5cclxuZXhwb3J0IHR5cGUgVlJNUmVxdWlyZWRIdW1hbkJvbmVOYW1lID0gdHlwZW9mIFZSTVJlcXVpcmVkSHVtYW5Cb25lTmFtZVtrZXlvZiB0eXBlb2YgVlJNUmVxdWlyZWRIdW1hbkJvbmVOYW1lXTtcclxuIiwiaW1wb3J0IHR5cGUgKiBhcyBWMFZSTSBmcm9tICdAcGl4aXYvdHlwZXMtdnJtLTAuMCc7XHJcbmltcG9ydCB0eXBlICogYXMgVjFWUk1TY2hlbWEgZnJvbSAnQHBpeGl2L3R5cGVzLXZybWMtdnJtLTEuMCc7XHJcbmltcG9ydCB0eXBlIHsgR0xURiwgR0xURkxvYWRlclBsdWdpbiwgR0xURlBhcnNlciB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xyXG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4vVlJNSHVtYW5vaWQnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUh1bWFuQm9uZXMgfSBmcm9tICcuL1ZSTUh1bWFuQm9uZXMnO1xyXG5pbXBvcnQgeyBWUk1SZXF1aXJlZEh1bWFuQm9uZU5hbWUgfSBmcm9tICcuL1ZSTVJlcXVpcmVkSHVtYW5Cb25lTmFtZSc7XHJcbmltcG9ydCB7IEdMVEYgYXMgR0xURlNjaGVtYSB9IGZyb20gJ0BnbHRmLXRyYW5zZm9ybS9jb3JlJztcclxuaW1wb3J0IHsgVlJNSHVtYW5vaWRIZWxwZXIgfSBmcm9tICcuL2hlbHBlcnMvVlJNSHVtYW5vaWRIZWxwZXInO1xyXG5pbXBvcnQgeyBWUk1IdW1hbm9pZExvYWRlclBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL1ZSTUh1bWFub2lkTG9hZGVyUGx1Z2luT3B0aW9ucyc7XHJcblxyXG4vKipcclxuICogQSBtYXAgZnJvbSBvbGQgdGh1bWIgYm9uZSBuYW1lcyB0byBuZXcgdGh1bWIgYm9uZSBuYW1lc1xyXG4gKi9cclxuY29uc3QgdGh1bWJCb25lTmFtZU1hcDogeyBba2V5OiBzdHJpbmddOiBWMVZSTVNjaGVtYS5IdW1hbm9pZEh1bWFuQm9uZU5hbWUgfCB1bmRlZmluZWQgfSA9IHtcclxuICBsZWZ0VGh1bWJQcm94aW1hbDogJ2xlZnRUaHVtYk1ldGFjYXJwYWwnLFxyXG4gIGxlZnRUaHVtYkludGVybWVkaWF0ZTogJ2xlZnRUaHVtYlByb3hpbWFsJyxcclxuICByaWdodFRodW1iUHJveGltYWw6ICdyaWdodFRodW1iTWV0YWNhcnBhbCcsXHJcbiAgcmlnaHRUaHVtYkludGVybWVkaWF0ZTogJ3JpZ2h0VGh1bWJQcm94aW1hbCcsXHJcbn07XHJcblxyXG4vKipcclxuICogQSBwbHVnaW4gb2YgR0xURkxvYWRlciB0aGF0IGltcG9ydHMgYSB7QGxpbmsgVlJNSHVtYW5vaWR9IGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1IdW1hbm9pZExvYWRlclBsdWdpbiBpbXBsZW1lbnRzIEdMVEZMb2FkZXJQbHVnaW4ge1xyXG4gIC8qKlxyXG4gICAqIFNwZWNpZnkgYW4gT2JqZWN0M0QgdG8gYWRkIHtAbGluayBWUk1IdW1hbm9pZEhlbHBlcn0uXHJcbiAgICogSWYgbm90IHNwZWNpZmllZCwgaGVscGVyIHdpbGwgbm90IGJlIGNyZWF0ZWQuXHJcbiAgICogSWYgYHJlbmRlck9yZGVyYCBpcyBzZXQgdG8gdGhlIHJvb3QsIHRoZSBoZWxwZXIgd2lsbCBjb3B5IHRoZSBzYW1lIGByZW5kZXJPcmRlcmAgLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBoZWxwZXJSb290PzogVEhSRUUuT2JqZWN0M0Q7XHJcblxyXG4gIHB1YmxpYyBhdXRvVXBkYXRlSHVtYW5Cb25lcz86IGJvb2xlYW47XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBwYXJzZXI6IEdMVEZQYXJzZXI7XHJcblxyXG4gIHB1YmxpYyBnZXQgbmFtZSgpOiBzdHJpbmcge1xyXG4gICAgLy8gV2Ugc2hvdWxkIHVzZSB0aGUgZXh0ZW5zaW9uIG5hbWUgaW5zdGVhZCBidXQgd2UgaGF2ZSBtdWx0aXBsZSBwbHVnaW5zIGZvciBhbiBleHRlbnNpb24uLi5cclxuICAgIHJldHVybiAnVlJNSHVtYW5vaWRMb2FkZXJQbHVnaW4nO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHBhcnNlcjogR0xURlBhcnNlciwgb3B0aW9ucz86IFZSTUh1bWFub2lkTG9hZGVyUGx1Z2luT3B0aW9ucykge1xyXG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XHJcblxyXG4gICAgdGhpcy5oZWxwZXJSb290ID0gb3B0aW9ucz8uaGVscGVyUm9vdDtcclxuICAgIHRoaXMuYXV0b1VwZGF0ZUh1bWFuQm9uZXMgPSBvcHRpb25zPy5hdXRvVXBkYXRlSHVtYW5Cb25lcztcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBhZnRlclJvb3QoZ2x0ZjogR0xURik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgZ2x0Zi51c2VyRGF0YS52cm1IdW1hbm9pZCA9IGF3YWl0IHRoaXMuX2ltcG9ydChnbHRmKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEltcG9ydCBhIHtAbGluayBWUk1IdW1hbm9pZH0gZnJvbSBhIFZSTS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gICAqL1xyXG4gIHByaXZhdGUgYXN5bmMgX2ltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1IdW1hbm9pZCB8IG51bGw+IHtcclxuICAgIGNvbnN0IHYxUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjFJbXBvcnQoZ2x0Zik7XHJcbiAgICBpZiAodjFSZXN1bHQpIHtcclxuICAgICAgcmV0dXJuIHYxUmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHYwUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjBJbXBvcnQoZ2x0Zik7XHJcbiAgICBpZiAodjBSZXN1bHQpIHtcclxuICAgICAgcmV0dXJuIHYwUmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBfdjFJbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNSHVtYW5vaWQgfCBudWxsPiB7XHJcbiAgICBjb25zdCBqc29uID0gdGhpcy5wYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIC8vIGVhcmx5IGFib3J0IGlmIGl0IGRvZXNuJ3QgdXNlIHZybVxyXG4gICAgY29uc3QgaXNWUk1Vc2VkID0ganNvbi5leHRlbnNpb25zVXNlZD8uaW5kZXhPZignVlJNQ192cm0nKSAhPT0gLTE7XHJcbiAgICBpZiAoIWlzVlJNVXNlZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LlsnVlJNQ192cm0nXSBhcyBWMVZSTVNjaGVtYS5WUk1DVlJNIHwgdW5kZWZpbmVkO1xyXG4gICAgaWYgKCFleHRlbnNpb24pIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3BlY1ZlcnNpb24gPSBleHRlbnNpb24uc3BlY1ZlcnNpb247XHJcbiAgICBpZiAoc3BlY1ZlcnNpb24gIT09ICcxLjAtYmV0YScpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2NoZW1hSHVtYW5vaWQgPSBleHRlbnNpb24uaHVtYW5vaWQ7XHJcbiAgICBpZiAoIXNjaGVtYUh1bWFub2lkKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogY29tcGF0OiAxLjAtYmV0YSB0aHVtYiBib25lIG5hbWVzXHJcbiAgICAgKlxyXG4gICAgICogYHRydWVgIGlmIGBsZWZ0VGh1bWJJbnRlcm1lZGlhdGVgIG9yIGByaWdodFRodW1iSW50ZXJtZWRpYXRlYCBleGlzdHNcclxuICAgICAqL1xyXG4gICAgY29uc3QgZXhpc3RzUHJldmlvdXNUaHVtYk5hbWUgPVxyXG4gICAgICAoc2NoZW1hSHVtYW5vaWQuaHVtYW5Cb25lcyBhcyBhbnkpLmxlZnRUaHVtYkludGVybWVkaWF0ZSAhPSBudWxsIHx8XHJcbiAgICAgIChzY2hlbWFIdW1hbm9pZC5odW1hbkJvbmVzIGFzIGFueSkucmlnaHRUaHVtYkludGVybWVkaWF0ZSAhPSBudWxsO1xyXG5cclxuICAgIGNvbnN0IGh1bWFuQm9uZXM6IFBhcnRpYWw8VlJNSHVtYW5Cb25lcz4gPSB7fTtcclxuICAgIGlmIChzY2hlbWFIdW1hbm9pZC5odW1hbkJvbmVzICE9IG51bGwpIHtcclxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXHJcbiAgICAgICAgT2JqZWN0LmVudHJpZXMoc2NoZW1hSHVtYW5vaWQuaHVtYW5Cb25lcykubWFwKGFzeW5jIChbYm9uZU5hbWVTdHJpbmcsIHNjaGVtYUh1bWFuQm9uZV0pID0+IHtcclxuICAgICAgICAgIGxldCBib25lTmFtZSA9IGJvbmVOYW1lU3RyaW5nIGFzIFYxVlJNU2NoZW1hLkh1bWFub2lkSHVtYW5Cb25lTmFtZTtcclxuICAgICAgICAgIGNvbnN0IGluZGV4ID0gc2NoZW1hSHVtYW5Cb25lLm5vZGU7XHJcblxyXG4gICAgICAgICAgLy8gY29tcGF0OiAxLjAtYmV0YSBwcmV2aW91cyB0aHVtYiBib25lIG5hbWVzXHJcbiAgICAgICAgICBpZiAoZXhpc3RzUHJldmlvdXNUaHVtYk5hbWUpIHtcclxuICAgICAgICAgICAgY29uc3QgdGh1bWJCb25lTmFtZSA9IHRodW1iQm9uZU5hbWVNYXBbYm9uZU5hbWVdO1xyXG4gICAgICAgICAgICBpZiAodGh1bWJCb25lTmFtZSAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgYm9uZU5hbWUgPSB0aHVtYkJvbmVOYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgY29uc3Qgbm9kZSA9IGF3YWl0IHRoaXMucGFyc2VyLmdldERlcGVuZGVuY3koJ25vZGUnLCBpbmRleCk7XHJcblxyXG4gICAgICAgICAgLy8gaWYgdGhlIHNwZWNpZmllZCBub2RlIGRvZXMgbm90IGV4aXN0LCBlbWl0IGEgd2FybmluZ1xyXG4gICAgICAgICAgaWYgKG5vZGUgPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEEgZ2xURiBub2RlIGJvdW5kIHRvIHRoZSBodW1hbm9pZCBib25lICR7Ym9uZU5hbWV9IChpbmRleCA9ICR7aW5kZXh9KSBkb2VzIG5vdCBleGlzdGApO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgLy8gc2V0IHRvIHRoZSBgaHVtYW5Cb25lc2BcclxuICAgICAgICAgIGh1bWFuQm9uZXNbYm9uZU5hbWVdID0geyBub2RlIH07XHJcbiAgICAgICAgfSksXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaHVtYW5vaWQgPSBuZXcgVlJNSHVtYW5vaWQodGhpcy5fZW5zdXJlUmVxdWlyZWRCb25lc0V4aXN0KGh1bWFuQm9uZXMpLCB7XHJcbiAgICAgIGF1dG9VcGRhdGVIdW1hbkJvbmVzOiB0aGlzLmF1dG9VcGRhdGVIdW1hbkJvbmVzLFxyXG4gICAgfSk7XHJcbiAgICBnbHRmLnNjZW5lLmFkZChodW1hbm9pZC5ub3JtYWxpemVkSHVtYW5Cb25lc1Jvb3QpO1xyXG5cclxuICAgIGlmICh0aGlzLmhlbHBlclJvb3QpIHtcclxuICAgICAgY29uc3QgaGVscGVyID0gbmV3IFZSTUh1bWFub2lkSGVscGVyKGh1bWFub2lkKTtcclxuICAgICAgdGhpcy5oZWxwZXJSb290LmFkZChoZWxwZXIpO1xyXG4gICAgICBoZWxwZXIucmVuZGVyT3JkZXIgPSB0aGlzLmhlbHBlclJvb3QucmVuZGVyT3JkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGh1bWFub2lkO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBfdjBJbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNSHVtYW5vaWQgfCBudWxsPiB7XHJcbiAgICBjb25zdCBqc29uID0gdGhpcy5wYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIGNvbnN0IHZybUV4dCA9IGpzb24uZXh0ZW5zaW9ucz8uVlJNIGFzIFYwVlJNLlZSTSB8IHVuZGVmaW5lZDtcclxuICAgIGlmICghdnJtRXh0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNjaGVtYUh1bWFub2lkOiBWMFZSTS5IdW1hbm9pZCB8IHVuZGVmaW5lZCA9IHZybUV4dC5odW1hbm9pZDtcclxuICAgIGlmICghc2NoZW1hSHVtYW5vaWQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgaHVtYW5Cb25lczogUGFydGlhbDxWUk1IdW1hbkJvbmVzPiA9IHt9O1xyXG4gICAgaWYgKHNjaGVtYUh1bWFub2lkLmh1bWFuQm9uZXMgIT0gbnVsbCkge1xyXG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChcclxuICAgICAgICBzY2hlbWFIdW1hbm9pZC5odW1hbkJvbmVzLm1hcChhc3luYyAoYm9uZSkgPT4ge1xyXG4gICAgICAgICAgY29uc3QgYm9uZU5hbWUgPSBib25lLmJvbmU7XHJcbiAgICAgICAgICBjb25zdCBpbmRleCA9IGJvbmUubm9kZTtcclxuXHJcbiAgICAgICAgICBpZiAoYm9uZU5hbWUgPT0gbnVsbCB8fCBpbmRleCA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBjb25zdCBub2RlID0gYXdhaXQgdGhpcy5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnbm9kZScsIGluZGV4KTtcclxuXHJcbiAgICAgICAgICAvLyBpZiB0aGUgc3BlY2lmaWVkIG5vZGUgZG9lcyBub3QgZXhpc3QsIGVtaXQgYSB3YXJuaW5nXHJcbiAgICAgICAgICBpZiAobm9kZSA9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgQSBnbFRGIG5vZGUgYm91bmQgdG8gdGhlIGh1bWFub2lkIGJvbmUgJHtib25lTmFtZX0gKGluZGV4ID0gJHtpbmRleH0pIGRvZXMgbm90IGV4aXN0YCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBtYXAgdG8gbmV3IGJvbmUgbmFtZVxyXG4gICAgICAgICAgY29uc3QgdGh1bWJCb25lTmFtZSA9IHRodW1iQm9uZU5hbWVNYXBbYm9uZU5hbWVdO1xyXG4gICAgICAgICAgY29uc3QgbmV3Qm9uZU5hbWUgPSAodGh1bWJCb25lTmFtZSA/PyBib25lTmFtZSkgYXMgVjFWUk1TY2hlbWEuSHVtYW5vaWRIdW1hbkJvbmVOYW1lO1xyXG5cclxuICAgICAgICAgIC8vIHYwIFZSTXMgbWlnaHQgaGF2ZSBhIG11bHRpcGxlIG5vZGVzIGF0dGFjaGVkIHRvIGEgc2luZ2xlIGJvbmUuLi5cclxuICAgICAgICAgIC8vIHNvIGlmIHRoZXJlIGFscmVhZHkgaXMgYW4gZW50cnkgaW4gdGhlIGBodW1hbkJvbmVzYCwgc2hvdyBhIHdhcm5pbmcgYW5kIGlnbm9yZSBpdFxyXG4gICAgICAgICAgaWYgKGh1bWFuQm9uZXNbbmV3Qm9uZU5hbWVdICE9IG51bGwpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgICAgICAgIGBNdWx0aXBsZSBib25lIGVudHJpZXMgZm9yICR7bmV3Qm9uZU5hbWV9IGRldGVjdGVkIChpbmRleCA9ICR7aW5kZXh9KSwgaWdub3JpbmcgZHVwbGljYXRlZCBlbnRyaWVzLmAsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBzZXQgdG8gdGhlIGBodW1hbkJvbmVzYFxyXG4gICAgICAgICAgaHVtYW5Cb25lc1tuZXdCb25lTmFtZV0gPSB7IG5vZGUgfTtcclxuICAgICAgICB9KSxcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBodW1hbm9pZCA9IG5ldyBWUk1IdW1hbm9pZCh0aGlzLl9lbnN1cmVSZXF1aXJlZEJvbmVzRXhpc3QoaHVtYW5Cb25lcyksIHtcclxuICAgICAgYXV0b1VwZGF0ZUh1bWFuQm9uZXM6IHRoaXMuYXV0b1VwZGF0ZUh1bWFuQm9uZXMsXHJcbiAgICB9KTtcclxuICAgIGdsdGYuc2NlbmUuYWRkKGh1bWFub2lkLm5vcm1hbGl6ZWRIdW1hbkJvbmVzUm9vdCk7XHJcblxyXG4gICAgaWYgKHRoaXMuaGVscGVyUm9vdCkge1xyXG4gICAgICBjb25zdCBoZWxwZXIgPSBuZXcgVlJNSHVtYW5vaWRIZWxwZXIoaHVtYW5vaWQpO1xyXG4gICAgICB0aGlzLmhlbHBlclJvb3QuYWRkKGhlbHBlcik7XHJcbiAgICAgIGhlbHBlci5yZW5kZXJPcmRlciA9IHRoaXMuaGVscGVyUm9vdC5yZW5kZXJPcmRlcjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gaHVtYW5vaWQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBFbnN1cmUgcmVxdWlyZWQgYm9uZXMgZXhpc3QgaW4gZ2l2ZW4gaHVtYW4gYm9uZXMuXHJcbiAgICogQHBhcmFtIGh1bWFuQm9uZXMgSHVtYW4gYm9uZXNcclxuICAgKiBAcmV0dXJucyBIdW1hbiBib25lcywgbm8gbG9uZ2VyIHBhcnRpYWwhXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfZW5zdXJlUmVxdWlyZWRCb25lc0V4aXN0KGh1bWFuQm9uZXM6IFBhcnRpYWw8VlJNSHVtYW5Cb25lcz4pOiBWUk1IdW1hbkJvbmVzIHtcclxuICAgIC8vIGVuc3VyZSByZXF1aXJlZCBib25lcyBleGlzdFxyXG4gICAgY29uc3QgbWlzc2luZ1JlcXVpcmVkQm9uZXMgPSBPYmplY3QudmFsdWVzKFZSTVJlcXVpcmVkSHVtYW5Cb25lTmFtZSkuZmlsdGVyKFxyXG4gICAgICAocmVxdWlyZWRCb25lTmFtZSkgPT4gaHVtYW5Cb25lc1tyZXF1aXJlZEJvbmVOYW1lXSA9PSBudWxsLFxyXG4gICAgKTtcclxuXHJcbiAgICAvLyB0aHJvdyBhbiBlcnJvciBpZiB0aGVyZSBhcmUgbWlzc2luZyBib25lc1xyXG4gICAgaWYgKG1pc3NpbmdSZXF1aXJlZEJvbmVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgIGBWUk1IdW1hbm9pZExvYWRlclBsdWdpbjogVGhlc2UgaHVtYW5vaWQgYm9uZXMgYXJlIHJlcXVpcmVkIGJ1dCBub3QgZXhpc3Q6ICR7bWlzc2luZ1JlcXVpcmVkQm9uZXMuam9pbignLCAnKX1gLFxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBodW1hbkJvbmVzIGFzIFZSTUh1bWFuQm9uZXM7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuXHJcbmV4cG9ydCBjbGFzcyBGYW5CdWZmZXJHZW9tZXRyeSBleHRlbmRzIFRIUkVFLkJ1ZmZlckdlb21ldHJ5IHtcclxuICBwdWJsaWMgdGhldGE6IG51bWJlcjtcclxuICBwdWJsaWMgcmFkaXVzOiBudW1iZXI7XHJcbiAgcHJpdmF0ZSBfY3VycmVudFRoZXRhID0gMDtcclxuICBwcml2YXRlIF9jdXJyZW50UmFkaXVzID0gMDtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9hdHRyUG9zOiBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfYXR0ckluZGV4OiBUSFJFRS5CdWZmZXJBdHRyaWJ1dGU7XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcigpIHtcclxuICAgIHN1cGVyKCk7XHJcblxyXG4gICAgdGhpcy50aGV0YSA9IDAuMDtcclxuICAgIHRoaXMucmFkaXVzID0gMC4wO1xyXG4gICAgdGhpcy5fY3VycmVudFRoZXRhID0gMC4wO1xyXG4gICAgdGhpcy5fY3VycmVudFJhZGl1cyA9IDAuMDtcclxuXHJcbiAgICB0aGlzLl9hdHRyUG9zID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShuZXcgRmxvYXQzMkFycmF5KDY1ICogMyksIDMpO1xyXG4gICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ3Bvc2l0aW9uJywgdGhpcy5fYXR0clBvcyk7XHJcblxyXG4gICAgdGhpcy5fYXR0ckluZGV4ID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShuZXcgVWludDE2QXJyYXkoMyAqIDYzKSwgMSk7XHJcbiAgICB0aGlzLnNldEluZGV4KHRoaXMuX2F0dHJJbmRleCk7XHJcblxyXG4gICAgdGhpcy5fYnVpbGRJbmRleCgpO1xyXG4gICAgdGhpcy51cGRhdGUoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGUoKTogdm9pZCB7XHJcbiAgICBsZXQgc2hvdWxkVXBkYXRlR2VvbWV0cnkgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAodGhpcy5fY3VycmVudFRoZXRhICE9PSB0aGlzLnRoZXRhKSB7XHJcbiAgICAgIHRoaXMuX2N1cnJlbnRUaGV0YSA9IHRoaXMudGhldGE7XHJcbiAgICAgIHNob3VsZFVwZGF0ZUdlb21ldHJ5ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5fY3VycmVudFJhZGl1cyAhPT0gdGhpcy5yYWRpdXMpIHtcclxuICAgICAgdGhpcy5fY3VycmVudFJhZGl1cyA9IHRoaXMucmFkaXVzO1xyXG4gICAgICBzaG91bGRVcGRhdGVHZW9tZXRyeSA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNob3VsZFVwZGF0ZUdlb21ldHJ5KSB7XHJcbiAgICAgIHRoaXMuX2J1aWxkUG9zaXRpb24oKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2J1aWxkUG9zaXRpb24oKTogdm9pZCB7XHJcbiAgICB0aGlzLl9hdHRyUG9zLnNldFhZWigwLCAwLjAsIDAuMCwgMC4wKTtcclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDY0OyBpKyspIHtcclxuICAgICAgY29uc3QgdCA9IChpIC8gNjMuMCkgKiB0aGlzLl9jdXJyZW50VGhldGE7XHJcblxyXG4gICAgICB0aGlzLl9hdHRyUG9zLnNldFhZWihpICsgMSwgdGhpcy5fY3VycmVudFJhZGl1cyAqIE1hdGguc2luKHQpLCAwLjAsIHRoaXMuX2N1cnJlbnRSYWRpdXMgKiBNYXRoLmNvcyh0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fYXR0clBvcy5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9idWlsZEluZGV4KCk6IHZvaWQge1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCA2MzsgaSsrKSB7XHJcbiAgICAgIHRoaXMuX2F0dHJJbmRleC5zZXRYWVooaSAqIDMsIDAsIGkgKyAxLCBpICsgMik7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fYXR0ckluZGV4Lm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5cclxuZXhwb3J0IGNsYXNzIExpbmVBbmRTcGhlcmVCdWZmZXJHZW9tZXRyeSBleHRlbmRzIFRIUkVFLkJ1ZmZlckdlb21ldHJ5IHtcclxuICBwdWJsaWMgcmFkaXVzOiBudW1iZXI7XHJcbiAgcHVibGljIHRhaWw6IFRIUkVFLlZlY3RvcjM7XHJcbiAgcHJpdmF0ZSBfY3VycmVudFJhZGl1czogbnVtYmVyO1xyXG4gIHByaXZhdGUgX2N1cnJlbnRUYWlsOiBUSFJFRS5WZWN0b3IzO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2F0dHJQb3M6IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9hdHRySW5kZXg6IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLnJhZGl1cyA9IDAuMDtcclxuICAgIHRoaXMuX2N1cnJlbnRSYWRpdXMgPSAwLjA7XHJcblxyXG4gICAgdGhpcy50YWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuICAgIHRoaXMuX2N1cnJlbnRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbiAgICB0aGlzLl9hdHRyUG9zID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShuZXcgRmxvYXQzMkFycmF5KDI5NCksIDMpO1xyXG4gICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ3Bvc2l0aW9uJywgdGhpcy5fYXR0clBvcyk7XHJcblxyXG4gICAgdGhpcy5fYXR0ckluZGV4ID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShuZXcgVWludDE2QXJyYXkoMTk0KSwgMSk7XHJcbiAgICB0aGlzLnNldEluZGV4KHRoaXMuX2F0dHJJbmRleCk7XHJcblxyXG4gICAgdGhpcy5fYnVpbGRJbmRleCgpO1xyXG4gICAgdGhpcy51cGRhdGUoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGUoKTogdm9pZCB7XHJcbiAgICBsZXQgc2hvdWxkVXBkYXRlR2VvbWV0cnkgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAodGhpcy5fY3VycmVudFJhZGl1cyAhPT0gdGhpcy5yYWRpdXMpIHtcclxuICAgICAgdGhpcy5fY3VycmVudFJhZGl1cyA9IHRoaXMucmFkaXVzO1xyXG4gICAgICBzaG91bGRVcGRhdGVHZW9tZXRyeSA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCF0aGlzLl9jdXJyZW50VGFpbC5lcXVhbHModGhpcy50YWlsKSkge1xyXG4gICAgICB0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMudGFpbCk7XHJcbiAgICAgIHNob3VsZFVwZGF0ZUdlb21ldHJ5ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoc2hvdWxkVXBkYXRlR2VvbWV0cnkpIHtcclxuICAgICAgdGhpcy5fYnVpbGRQb3NpdGlvbigpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfYnVpbGRQb3NpdGlvbigpOiB2b2lkIHtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xyXG4gICAgICBjb25zdCB0ID0gKGkgLyAxNi4wKSAqIE1hdGguUEk7XHJcblxyXG4gICAgICB0aGlzLl9hdHRyUG9zLnNldFhZWihpLCBNYXRoLmNvcyh0KSwgTWF0aC5zaW4odCksIDAuMCk7XHJcbiAgICAgIHRoaXMuX2F0dHJQb3Muc2V0WFlaKDMyICsgaSwgMC4wLCBNYXRoLmNvcyh0KSwgTWF0aC5zaW4odCkpO1xyXG4gICAgICB0aGlzLl9hdHRyUG9zLnNldFhZWig2NCArIGksIE1hdGguc2luKHQpLCAwLjAsIE1hdGguY29zKHQpKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnNjYWxlKHRoaXMuX2N1cnJlbnRSYWRpdXMsIHRoaXMuX2N1cnJlbnRSYWRpdXMsIHRoaXMuX2N1cnJlbnRSYWRpdXMpO1xyXG4gICAgdGhpcy50cmFuc2xhdGUodGhpcy5fY3VycmVudFRhaWwueCwgdGhpcy5fY3VycmVudFRhaWwueSwgdGhpcy5fY3VycmVudFRhaWwueik7XHJcblxyXG4gICAgdGhpcy5fYXR0clBvcy5zZXRYWVooOTYsIDAsIDAsIDApO1xyXG4gICAgdGhpcy5fYXR0clBvcy5zZXRYWVooOTcsIHRoaXMuX2N1cnJlbnRUYWlsLngsIHRoaXMuX2N1cnJlbnRUYWlsLnksIHRoaXMuX2N1cnJlbnRUYWlsLnopO1xyXG5cclxuICAgIHRoaXMuX2F0dHJQb3MubmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfYnVpbGRJbmRleCgpOiB2b2lkIHtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xyXG4gICAgICBjb25zdCBpMSA9IChpICsgMSkgJSAzMjtcclxuXHJcbiAgICAgIHRoaXMuX2F0dHJJbmRleC5zZXRYWShpICogMiwgaSwgaTEpO1xyXG4gICAgICB0aGlzLl9hdHRySW5kZXguc2V0WFkoNjQgKyBpICogMiwgMzIgKyBpLCAzMiArIGkxKTtcclxuICAgICAgdGhpcy5fYXR0ckluZGV4LnNldFhZKDEyOCArIGkgKiAyLCA2NCArIGksIDY0ICsgaTEpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5fYXR0ckluZGV4LnNldFhZKDE5MiwgOTYsIDk3KTtcclxuXHJcbiAgICB0aGlzLl9hdHRySW5kZXgubmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTUxvb2tBdCB9IGZyb20gJy4uL1ZSTUxvb2tBdCc7XHJcbmltcG9ydCB7IEZhbkJ1ZmZlckdlb21ldHJ5IH0gZnJvbSAnLi91dGlscy9GYW5CdWZmZXJHZW9tZXRyeSc7XHJcbmltcG9ydCB7IExpbmVBbmRTcGhlcmVCdWZmZXJHZW9tZXRyeSB9IGZyb20gJy4vdXRpbHMvTGluZUFuZFNwaGVyZUJ1ZmZlckdlb21ldHJ5JztcclxuXHJcbmNvbnN0IF9xdWF0QSA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcbmNvbnN0IF9xdWF0QiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCk7XHJcbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbmNvbnN0IFNRUlRfMl9PVkVSXzIgPSBNYXRoLnNxcnQoMi4wKSAvIDIuMDtcclxuY29uc3QgUVVBVF9YWV9DVzkwID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oMCwgMCwgLVNRUlRfMl9PVkVSXzIsIFNRUlRfMl9PVkVSXzIpO1xyXG5jb25zdCBWRUMzX1BPU0lUSVZFX1kgPSBuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDEuMCwgMC4wKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRIZWxwZXIgZXh0ZW5kcyBUSFJFRS5Hcm91cCB7XHJcbiAgcHVibGljIHJlYWRvbmx5IHZybUxvb2tBdDogVlJNTG9va0F0O1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX21lc2hZYXc6IFRIUkVFLk1lc2g8RmFuQnVmZmVyR2VvbWV0cnksIFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsPjtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9tZXNoUGl0Y2g6IFRIUkVFLk1lc2g8RmFuQnVmZmVyR2VvbWV0cnksIFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsPjtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9saW5lVGFyZ2V0OiBUSFJFRS5MaW5lU2VnbWVudHM8TGluZUFuZFNwaGVyZUJ1ZmZlckdlb21ldHJ5LCBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbD47XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3Rvcihsb29rQXQ6IFZSTUxvb2tBdCkge1xyXG4gICAgc3VwZXIoKTtcclxuICAgIHRoaXMubWF0cml4QXV0b1VwZGF0ZSA9IGZhbHNlO1xyXG5cclxuICAgIHRoaXMudnJtTG9va0F0ID0gbG9va0F0O1xyXG5cclxuICAgIHtcclxuICAgICAgY29uc3QgZ2VvbWV0cnkgPSBuZXcgRmFuQnVmZmVyR2VvbWV0cnkoKTtcclxuICAgICAgZ2VvbWV0cnkucmFkaXVzID0gMC41O1xyXG5cclxuICAgICAgY29uc3QgbWF0ZXJpYWwgPSBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xyXG4gICAgICAgIGNvbG9yOiAweDAwZmYwMCxcclxuICAgICAgICB0cmFuc3BhcmVudDogdHJ1ZSxcclxuICAgICAgICBvcGFjaXR5OiAwLjUsXHJcbiAgICAgICAgc2lkZTogVEhSRUUuRG91YmxlU2lkZSxcclxuICAgICAgICBkZXB0aFRlc3Q6IGZhbHNlLFxyXG4gICAgICAgIGRlcHRoV3JpdGU6IGZhbHNlLFxyXG4gICAgICB9KTtcclxuXHJcbiAgICAgIHRoaXMuX21lc2hQaXRjaCA9IG5ldyBUSFJFRS5NZXNoKGdlb21ldHJ5LCBtYXRlcmlhbCk7XHJcbiAgICAgIHRoaXMuYWRkKHRoaXMuX21lc2hQaXRjaCk7XHJcbiAgICB9XHJcblxyXG4gICAge1xyXG4gICAgICBjb25zdCBnZW9tZXRyeSA9IG5ldyBGYW5CdWZmZXJHZW9tZXRyeSgpO1xyXG4gICAgICBnZW9tZXRyeS5yYWRpdXMgPSAwLjU7XHJcblxyXG4gICAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBUSFJFRS5NZXNoQmFzaWNNYXRlcmlhbCh7XHJcbiAgICAgICAgY29sb3I6IDB4ZmYwMDAwLFxyXG4gICAgICAgIHRyYW5zcGFyZW50OiB0cnVlLFxyXG4gICAgICAgIG9wYWNpdHk6IDAuNSxcclxuICAgICAgICBzaWRlOiBUSFJFRS5Eb3VibGVTaWRlLFxyXG4gICAgICAgIGRlcHRoVGVzdDogZmFsc2UsXHJcbiAgICAgICAgZGVwdGhXcml0ZTogZmFsc2UsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgdGhpcy5fbWVzaFlhdyA9IG5ldyBUSFJFRS5NZXNoKGdlb21ldHJ5LCBtYXRlcmlhbCk7XHJcbiAgICAgIHRoaXMuYWRkKHRoaXMuX21lc2hZYXcpO1xyXG4gICAgfVxyXG5cclxuICAgIHtcclxuICAgICAgY29uc3QgZ2VvbWV0cnkgPSBuZXcgTGluZUFuZFNwaGVyZUJ1ZmZlckdlb21ldHJ5KCk7XHJcbiAgICAgIGdlb21ldHJ5LnJhZGl1cyA9IDAuMTtcclxuXHJcbiAgICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcclxuICAgICAgICBjb2xvcjogMHhmZmZmZmYsXHJcbiAgICAgICAgZGVwdGhUZXN0OiBmYWxzZSxcclxuICAgICAgICBkZXB0aFdyaXRlOiBmYWxzZSxcclxuICAgICAgfSk7XHJcblxyXG4gICAgICB0aGlzLl9saW5lVGFyZ2V0ID0gbmV3IFRIUkVFLkxpbmVTZWdtZW50cyhnZW9tZXRyeSwgbWF0ZXJpYWwpO1xyXG4gICAgICB0aGlzLl9saW5lVGFyZ2V0LmZydXN0dW1DdWxsZWQgPSBmYWxzZTtcclxuICAgICAgdGhpcy5hZGQodGhpcy5fbGluZVRhcmdldCk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcclxuICAgIHRoaXMuX21lc2hZYXcuZ2VvbWV0cnkuZGlzcG9zZSgpO1xyXG4gICAgdGhpcy5fbWVzaFlhdy5tYXRlcmlhbC5kaXNwb3NlKCk7XHJcblxyXG4gICAgdGhpcy5fbWVzaFBpdGNoLmdlb21ldHJ5LmRpc3Bvc2UoKTtcclxuICAgIHRoaXMuX21lc2hQaXRjaC5tYXRlcmlhbC5kaXNwb3NlKCk7XHJcblxyXG4gICAgdGhpcy5fbGluZVRhcmdldC5nZW9tZXRyeS5kaXNwb3NlKCk7XHJcbiAgICB0aGlzLl9saW5lVGFyZ2V0Lm1hdGVyaWFsLmRpc3Bvc2UoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGVNYXRyaXhXb3JsZChmb3JjZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgLy8gdXBkYXRlIGdlb21ldHJpZXNcclxuICAgIGNvbnN0IHlhdyA9IFRIUkVFLk1hdGhVdGlscy5ERUcyUkFEICogdGhpcy52cm1Mb29rQXQueWF3O1xyXG4gICAgdGhpcy5fbWVzaFlhdy5nZW9tZXRyeS50aGV0YSA9IHlhdztcclxuICAgIHRoaXMuX21lc2hZYXcuZ2VvbWV0cnkudXBkYXRlKCk7XHJcblxyXG4gICAgY29uc3QgcGl0Y2ggPSBUSFJFRS5NYXRoVXRpbHMuREVHMlJBRCAqIHRoaXMudnJtTG9va0F0LnBpdGNoO1xyXG4gICAgdGhpcy5fbWVzaFBpdGNoLmdlb21ldHJ5LnRoZXRhID0gcGl0Y2g7XHJcbiAgICB0aGlzLl9tZXNoUGl0Y2guZ2VvbWV0cnkudXBkYXRlKCk7XHJcblxyXG4gICAgLy8gZ2V0IHdvcmxkIHBvc2l0aW9uIGFuZCBxdWF0ZXJuaW9uXHJcbiAgICB0aGlzLnZybUxvb2tBdC5nZXRMb29rQXRXb3JsZFBvc2l0aW9uKF92M0EpO1xyXG4gICAgdGhpcy52cm1Mb29rQXQuZ2V0TG9va0F0V29ybGRRdWF0ZXJuaW9uKF9xdWF0QSk7XHJcblxyXG4gICAgLy8gY2FsY3VsYXRlIHJvdGF0aW9uIHVzaW5nIGZhY2VGcm9udFxyXG4gICAgX3F1YXRBLm11bHRpcGx5KHRoaXMudnJtTG9va0F0LmdldEZhY2VGcm9udFF1YXRlcm5pb24oX3F1YXRCKSk7XHJcblxyXG4gICAgLy8gc2V0IHRyYW5zZm9ybSB0byBtZXNoZXNcclxuICAgIHRoaXMuX21lc2hZYXcucG9zaXRpb24uY29weShfdjNBKTtcclxuICAgIHRoaXMuX21lc2hZYXcucXVhdGVybmlvbi5jb3B5KF9xdWF0QSk7XHJcblxyXG4gICAgdGhpcy5fbWVzaFBpdGNoLnBvc2l0aW9uLmNvcHkoX3YzQSk7XHJcbiAgICB0aGlzLl9tZXNoUGl0Y2gucXVhdGVybmlvbi5jb3B5KF9xdWF0QSk7XHJcbiAgICB0aGlzLl9tZXNoUGl0Y2gucXVhdGVybmlvbi5tdWx0aXBseShfcXVhdEIuc2V0RnJvbUF4aXNBbmdsZShWRUMzX1BPU0lUSVZFX1ksIHlhdykpO1xyXG4gICAgdGhpcy5fbWVzaFBpdGNoLnF1YXRlcm5pb24ubXVsdGlwbHkoUVVBVF9YWV9DVzkwKTtcclxuXHJcbiAgICAvLyB1cGRhdGUgdGFyZ2V0IGxpbmUgYW5kIHNwaGVyZVxyXG4gICAgY29uc3QgeyB0YXJnZXQsIGF1dG9VcGRhdGUgfSA9IHRoaXMudnJtTG9va0F0O1xyXG4gICAgaWYgKHRhcmdldCAhPSBudWxsICYmIGF1dG9VcGRhdGUpIHtcclxuICAgICAgdGFyZ2V0LmdldFdvcmxkUG9zaXRpb24oX3YzQikuc3ViKF92M0EpO1xyXG4gICAgICB0aGlzLl9saW5lVGFyZ2V0Lmdlb21ldHJ5LnRhaWwuY29weShfdjNCKTtcclxuICAgICAgdGhpcy5fbGluZVRhcmdldC5nZW9tZXRyeS51cGRhdGUoKTtcclxuICAgICAgdGhpcy5fbGluZVRhcmdldC5wb3NpdGlvbi5jb3B5KF92M0EpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGFwcGx5IHRyYW5zZm9ybSB0byBtZXNoZXNcclxuICAgIHN1cGVyLnVwZGF0ZU1hdHJpeFdvcmxkKGZvcmNlKTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5cclxuY29uc3QgX3Bvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3NjYWxlID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbi8qKlxyXG4gKiBFeHRyYWN0IHdvcmxkIHJvdGF0aW9uIG9mIGFuIG9iamVjdCBmcm9tIGl0cyB3b3JsZCBzcGFjZSBtYXRyaXgsIGluIGNoZWFwZXIgd2F5LlxyXG4gKlxyXG4gKiBAcGFyYW0gb2JqZWN0IFRoZSBvYmplY3RcclxuICogQHBhcmFtIG91dCBUYXJnZXQgdmVjdG9yXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZShvYmplY3Q6IFRIUkVFLk9iamVjdDNELCBvdXQ6IFRIUkVFLlF1YXRlcm5pb24pOiBUSFJFRS5RdWF0ZXJuaW9uIHtcclxuICBvYmplY3QubWF0cml4V29ybGQuZGVjb21wb3NlKF9wb3NpdGlvbiwgb3V0LCBfc2NhbGUpO1xyXG4gIHJldHVybiBvdXQ7XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5cclxuLyoqXHJcbiAqIENhbGN1bGF0ZSBhemltdXRoIC8gYWx0aXR1ZGUgYW5nbGVzIGZyb20gYSB2ZWN0b3IuXHJcbiAqXHJcbiAqIFRoaXMgcmV0dXJucyBhIGRpZmZlcmVuY2Ugb2YgYW5nbGVzIGZyb20gKDEsIDAsIDApLlxyXG4gKiBBemltdXRoIHJlcHJlc2VudHMgYW4gYW5nbGUgYXJvdW5kIFkgYXhpcy5cclxuICogQWx0aXR1ZGUgcmVwcmVzZW50cyBhbiBhbmdsZSBhcm91bmQgWiBheGlzLlxyXG4gKiBJdCBpcyByb3RhdGVkIGluIGludHJpbnNpYyBZLVogb3JkZXIuXHJcbiAqXHJcbiAqIEBwYXJhbSB2ZWN0b3IgVGhlIHZlY3RvclxyXG4gKiBAcmV0dXJucyBBIHR1cGxlIGNvbnRhaW5zIHR3byBhbmdsZXMsIGBbIGF6aW11dGgsIGFsdGl0dWRlIF1gXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gY2FsY0F6aW11dGhBbHRpdHVkZSh2ZWN0b3I6IFRIUkVFLlZlY3RvcjMpOiBbYXppbXV0aDogbnVtYmVyLCBhbHRpdHVkZTogbnVtYmVyXSB7XHJcbiAgcmV0dXJuIFtNYXRoLmF0YW4yKC12ZWN0b3IueiwgdmVjdG9yLngpLCBNYXRoLmF0YW4yKHZlY3Rvci55LCBNYXRoLnNxcnQodmVjdG9yLnggKiB2ZWN0b3IueCArIHZlY3Rvci56ICogdmVjdG9yLnopKV07XHJcbn1cclxuIiwiLyoqXHJcbiAqIE1ha2Ugc3VyZSB0aGUgYW5nbGUgaXMgd2l0aGluIC1QSSB0byBQSS5cclxuICpcclxuICogQGV4YW1wbGVcclxuICogYGBganNcclxuICogc2FuaXRpemVBbmdsZSgxLjUgKiBNYXRoLlBJKSAvLyAtMC41ICogUElcclxuICogYGBgXHJcbiAqXHJcbiAqIEBwYXJhbSBhbmdsZSBBbiBpbnB1dCBhbmdsZVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplQW5nbGUoYW5nbGU6IG51bWJlcik6IG51bWJlciB7XHJcbiAgY29uc3Qgcm91bmRUdXJuID0gTWF0aC5yb3VuZChhbmdsZSAvIDIuMCAvIE1hdGguUEkpO1xyXG4gIHJldHVybiBhbmdsZSAtIDIuMCAqIE1hdGguUEkgKiByb3VuZFR1cm47XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcclxuaW1wb3J0IHsgZ2V0V29ybGRRdWF0ZXJuaW9uTGl0ZSB9IGZyb20gJy4uL3V0aWxzL2dldFdvcmxkUXVhdGVybmlvbkxpdGUnO1xyXG5pbXBvcnQgeyBxdWF0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi4vdXRpbHMvcXVhdEludmVydENvbXBhdCc7XHJcbmltcG9ydCB7IGNhbGNBemltdXRoQWx0aXR1ZGUgfSBmcm9tICcuL3V0aWxzL2NhbGNBemltdXRoQWx0aXR1ZGUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUxvb2tBdEFwcGxpZXIgfSBmcm9tICcuL1ZSTUxvb2tBdEFwcGxpZXInO1xyXG5pbXBvcnQgeyBzYW5pdGl6ZUFuZ2xlIH0gZnJvbSAnLi91dGlscy9zYW5pdGl6ZUFuZ2xlJztcclxuXHJcbmNvbnN0IFZFQzNfUE9TSVRJVkVfWiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAxLjApO1xyXG5cclxuY29uc3QgX3YzQSA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbmNvbnN0IF92M0IgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfdjNDID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuY29uc3QgX3F1YXRCID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuY29uc3QgX3F1YXRDID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuY29uc3QgX2V1bGVyQSA9IG5ldyBUSFJFRS5FdWxlcigpO1xyXG5cclxuLyoqXHJcbiAqIEEgY2xhc3MgY29udHJvbHMgZXllIGdhemUgbW92ZW1lbnRzIG9mIGEgVlJNLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdCB7XHJcbiAgcHVibGljIHN0YXRpYyByZWFkb25seSBFVUxFUl9PUkRFUiA9ICdZWFonOyAvLyB5YXctcGl0Y2gtcm9sbFxyXG5cclxuICAvKipcclxuICAgKiBUaGUgb3JpZ2luIG9mIExvb2tBdC4gUG9zaXRpb24gb2Zmc2V0IGZyb20gdGhlIGhlYWQgYm9uZS5cclxuICAgKi9cclxuICBwdWJsaWMgb2Zmc2V0RnJvbUhlYWRCb25lID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbiAgLyoqXHJcbiAgICogSXRzIGFzc29jaWF0ZWQge0BsaW5rIFZSTUh1bWFub2lkfS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaHVtYW5vaWQ6IFZSTUh1bWFub2lkO1xyXG5cclxuICAvKipcclxuICAgKiBUaGUge0BsaW5rIFZSTUxvb2tBdEFwcGxpZXJ9IG9mIHRoZSBMb29rQXQuXHJcbiAgICovXHJcbiAgcHVibGljIGFwcGxpZXI6IFZSTUxvb2tBdEFwcGxpZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIElmIHRoaXMgaXMgdHJ1ZSwgdGhlIExvb2tBdCB3aWxsIGJlIHVwZGF0ZWQgYXV0b21hdGljYWxseSBieSBjYWxsaW5nIHtAbGluayB1cGRhdGV9LCB0b3dhcmRpbmcgdGhlIGRpcmVjdGlvbiB0byB0aGUge0BsaW5rIHRhcmdldH0uXHJcbiAgICogYHRydWVgIGJ5IGRlZmF1bHQuXHJcbiAgICpcclxuICAgKiBTZWUgYWxzbzoge0BsaW5rIHRhcmdldH1cclxuICAgKi9cclxuICBwdWJsaWMgYXV0b1VwZGF0ZSA9IHRydWU7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSB0YXJnZXQgb2JqZWN0IG9mIHRoZSBMb29rQXQuXHJcbiAgICogTm90ZSB0aGF0IGl0IGRvZXMgbm90IG1ha2UgYW55IHNlbnNlIGlmIHtAbGluayBhdXRvVXBkYXRlfSBpcyBkaXNhYmxlZC5cclxuICAgKlxyXG4gICAqIFNlZSBhbHNvOiB7QGxpbmsgYXV0b1VwZGF0ZX1cclxuICAgKi9cclxuICBwdWJsaWMgdGFyZ2V0PzogVEhSRUUuT2JqZWN0M0QgfCBudWxsO1xyXG5cclxuICAvKipcclxuICAgKiBUaGUgZnJvbnQgZGlyZWN0aW9uIG9mIHRoZSBmYWNlLlxyXG4gICAqIEludGVuZGVkIHRvIGJlIHVzZWQgZm9yIFZSTSAwLjAgY29tcGF0IChWUk0gMC4wIG1vZGVscyBhcmUgZmFjaW5nIFotIGluc3RlYWQgb2YgWispLlxyXG4gICAqIFlvdSB1c3VhbGx5IGRvbid0IHdhbnQgdG8gdG91Y2ggdGhpcy5cclxuICAgKi9cclxuICBwdWJsaWMgZmFjZUZyb250ID0gbmV3IFRIUkVFLlZlY3RvcjMoMC4wLCAwLjAsIDEuMCk7XHJcblxyXG4gIC8qKlxyXG4gICAqIEl0cyBjdXJyZW50IGFuZ2xlIGFyb3VuZCBZIGF4aXMsIGluIGRlZ3JlZS5cclxuICAgKi9cclxuICBwcm90ZWN0ZWQgX3lhdzogbnVtYmVyO1xyXG5cclxuICAvKipcclxuICAgKiBJdHMgY3VycmVudCBhbmdsZSBhcm91bmQgWSBheGlzLCBpbiBkZWdyZWUuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCB5YXcoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLl95YXc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJdHMgY3VycmVudCBhbmdsZSBhcm91bmQgWSBheGlzLCBpbiBkZWdyZWUuXHJcbiAgICovXHJcbiAgcHVibGljIHNldCB5YXcodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy5feWF3ID0gdmFsdWU7XHJcbiAgICB0aGlzLl9uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJdHMgY3VycmVudCBhbmdsZSBhcm91bmQgWCBheGlzLCBpbiBkZWdyZWUuXHJcbiAgICovXHJcbiAgcHJvdGVjdGVkIF9waXRjaDogbnVtYmVyO1xyXG5cclxuICAvKipcclxuICAgKiBJdHMgY3VycmVudCBhbmdsZSBhcm91bmQgWCBheGlzLCBpbiBkZWdyZWUuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBwaXRjaCgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMuX3BpdGNoO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSXRzIGN1cnJlbnQgYW5nbGUgYXJvdW5kIFggYXhpcywgaW4gZGVncmVlLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBzZXQgcGl0Y2godmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy5fcGl0Y2ggPSB2YWx1ZTtcclxuICAgIHRoaXMuX25lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNwZWNpZmllcyB0aGF0IGFuZ2xlcyBuZWVkIHRvIGJlIGFwcGxpZWQgdG8gaXRzIFtAbGluayBhcHBsaWVyXS5cclxuICAgKi9cclxuICBwcm90ZWN0ZWQgX25lZWRzVXBkYXRlOiBib29sZWFuO1xyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBVc2Uge0BsaW5rIGdldEV1bGVyfSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgZXVsZXIoKTogVEhSRUUuRXVsZXIge1xyXG4gICAgY29uc29sZS53YXJuKCdWUk1Mb29rQXQ6IGV1bGVyIGlzIGRlcHJlY2F0ZWQuIHVzZSBnZXRFdWxlcigpIGluc3RlYWQuJyk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuZ2V0RXVsZXIobmV3IFRIUkVFLkV1bGVyKCkpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbmV3IHtAbGluayBWUk1Mb29rQXR9LlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGh1bWFub2lkIEEge0BsaW5rIFZSTUh1bWFub2lkfVxyXG4gICAqIEBwYXJhbSBhcHBsaWVyIEEge0BsaW5rIFZSTUxvb2tBdEFwcGxpZXJ9XHJcbiAgICovXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKGh1bWFub2lkOiBWUk1IdW1hbm9pZCwgYXBwbGllcjogVlJNTG9va0F0QXBwbGllcikge1xyXG4gICAgdGhpcy5odW1hbm9pZCA9IGh1bWFub2lkO1xyXG4gICAgdGhpcy5hcHBsaWVyID0gYXBwbGllcjtcclxuXHJcbiAgICB0aGlzLl95YXcgPSAwLjA7XHJcbiAgICB0aGlzLl9waXRjaCA9IDAuMDtcclxuICAgIHRoaXMuX25lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBpdHMgeWF3LXBpdGNoIGFuZ2xlcyBhcyBhbiBgRXVsZXJgLlxyXG4gICAqIERvZXMgTk9UIGNvbnNpZGVyIHtAbGluayBmYWNlRnJvbnR9LlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHRhcmdldCBUaGUgdGFyZ2V0IGV1bGVyXHJcbiAgICovXHJcbiAgcHVibGljIGdldEV1bGVyKHRhcmdldDogVEhSRUUuRXVsZXIpOiBUSFJFRS5FdWxlciB7XHJcbiAgICByZXR1cm4gdGFyZ2V0LnNldChUSFJFRS5NYXRoVXRpbHMuREVHMlJBRCAqIHRoaXMuX3BpdGNoLCBUSFJFRS5NYXRoVXRpbHMuREVHMlJBRCAqIHRoaXMuX3lhdywgMC4wLCAnWVhaJyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDb3B5IHRoZSBnaXZlbiB7QGxpbmsgVlJNTG9va0F0fSBpbnRvIHRoaXMgb25lLlxyXG4gICAqIHtAbGluayBodW1hbm9pZH0gbXVzdCBiZSBzYW1lIGFzIHRoZSBzb3VyY2Ugb25lLlxyXG4gICAqIHtAbGluayBhcHBsaWVyfSB3aWxsIHJlZmVyZW5jZSB0aGUgc2FtZSBpbnN0YW5jZSBhcyB0aGUgc291cmNlIG9uZS5cclxuICAgKiBAcGFyYW0gc291cmNlIFRoZSB7QGxpbmsgVlJNTG9va0F0fSB5b3Ugd2FudCB0byBjb3B5XHJcbiAgICogQHJldHVybnMgdGhpc1xyXG4gICAqL1xyXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogVlJNTG9va0F0KTogdGhpcyB7XHJcbiAgICBpZiAodGhpcy5odW1hbm9pZCAhPT0gc291cmNlLmh1bWFub2lkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVlJNTG9va0F0OiBodW1hbm9pZCBtdXN0IGJlIHNhbWUgaW4gb3JkZXIgdG8gY29weScpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMub2Zmc2V0RnJvbUhlYWRCb25lLmNvcHkoc291cmNlLm9mZnNldEZyb21IZWFkQm9uZSk7XHJcbiAgICB0aGlzLmFwcGxpZXIgPSBzb3VyY2UuYXBwbGllcjtcclxuICAgIHRoaXMuYXV0b1VwZGF0ZSA9IHNvdXJjZS5hdXRvVXBkYXRlO1xyXG4gICAgdGhpcy50YXJnZXQgPSBzb3VyY2UudGFyZ2V0O1xyXG4gICAgdGhpcy5mYWNlRnJvbnQuY29weShzb3VyY2UuZmFjZUZyb250KTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgYSBjbG9uZSBvZiB0aGlzIHtAbGluayBWUk1Mb29rQXR9LlxyXG4gICAqIE5vdGUgdGhhdCB7QGxpbmsgaHVtYW5vaWR9IGFuZCB7QGxpbmsgYXBwbGllcn0gd2lsbCByZWZlcmVuY2UgdGhlIHNhbWUgaW5zdGFuY2UgYXMgdGhpcyBvbmUuXHJcbiAgICogQHJldHVybnMgQ29waWVkIHtAbGluayBWUk1Mb29rQXR9XHJcbiAgICovXHJcbiAgcHVibGljIGNsb25lKCk6IFZSTUxvb2tBdCB7XHJcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdCh0aGlzLmh1bWFub2lkLCB0aGlzLmFwcGxpZXIpLmNvcHkodGhpcyk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBSZXNldCB0aGUgbG9va0F0IGRpcmVjdGlvbiB0byBpbml0aWFsIGRpcmVjdGlvbi5cclxuICAgKi9cclxuICBwdWJsaWMgcmVzZXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLl95YXcgPSAwLjA7XHJcbiAgICB0aGlzLl9waXRjaCA9IDAuMDtcclxuICAgIHRoaXMuX25lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBpdHMgaGVhZCBwb3NpdGlvbiBpbiB3b3JsZCBjb29yZGluYXRlLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHRhcmdldCBBIHRhcmdldCBgVEhSRUUuVmVjdG9yM2BcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0TG9va0F0V29ybGRQb3NpdGlvbih0YXJnZXQ6IFRIUkVFLlZlY3RvcjMpOiBUSFJFRS5WZWN0b3IzIHtcclxuICAgIGNvbnN0IGhlYWQgPSB0aGlzLmh1bWFub2lkLmdldFJhd0JvbmVOb2RlKCdoZWFkJykhO1xyXG5cclxuICAgIHJldHVybiB0YXJnZXQuY29weSh0aGlzLm9mZnNldEZyb21IZWFkQm9uZSkuYXBwbHlNYXRyaXg0KGhlYWQubWF0cml4V29ybGQpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGl0cyBMb29rQXQgb3JpZW50YXRpb24gaW4gd29ybGQgY29vcmRpbmF0ZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgYFRIUkVFLlZlY3RvcjNgXHJcbiAgICovXHJcbiAgcHVibGljIGdldExvb2tBdFdvcmxkUXVhdGVybmlvbih0YXJnZXQ6IFRIUkVFLlF1YXRlcm5pb24pOiBUSFJFRS5RdWF0ZXJuaW9uIHtcclxuICAgIGNvbnN0IGhlYWQgPSB0aGlzLmh1bWFub2lkLmdldFJhd0JvbmVOb2RlKCdoZWFkJykhO1xyXG5cclxuICAgIHJldHVybiBnZXRXb3JsZFF1YXRlcm5pb25MaXRlKGhlYWQsIHRhcmdldCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZXQgYSBxdWF0ZXJuaW9uIHRoYXQgcm90YXRlcyB0aGUgK1ogdW5pdCB2ZWN0b3Igb2YgdGhlIGh1bWFub2lkIEhlYWQgdG8gdGhlIHtAbGluayBmYWNlRnJvbnR9IGRpcmVjdGlvbi5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgYFRIUkVFLlZlY3RvcjNgXHJcbiAgICovXHJcbiAgcHVibGljIGdldEZhY2VGcm9udFF1YXRlcm5pb24odGFyZ2V0OiBUSFJFRS5RdWF0ZXJuaW9uKTogVEhSRUUuUXVhdGVybmlvbiB7XHJcbiAgICBpZiAodGhpcy5mYWNlRnJvbnQuZGlzdGFuY2VUb1NxdWFyZWQoVkVDM19QT1NJVElWRV9aKSA8IDAuMDEpIHtcclxuICAgICAgcmV0dXJuIHRhcmdldC5pZGVudGl0eSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IFtmYWNlRnJvbnRBemltdXRoLCBmYWNlRnJvbnRBbHRpdHVkZV0gPSBjYWxjQXppbXV0aEFsdGl0dWRlKHRoaXMuZmFjZUZyb250KTtcclxuICAgIF9ldWxlckEuc2V0KDAuMCwgMC41ICogTWF0aC5QSSArIGZhY2VGcm9udEF6aW11dGgsIGZhY2VGcm9udEFsdGl0dWRlLCAnWVpYJyk7XHJcbiAgICByZXR1cm4gdGFyZ2V0LnNldEZyb21FdWxlcihfZXVsZXJBKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdldCBpdHMgTG9va0F0IGRpcmVjdGlvbiBpbiB3b3JsZCBjb29yZGluYXRlLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHRhcmdldCBBIHRhcmdldCBgVEhSRUUuVmVjdG9yM2BcclxuICAgKi9cclxuICBwdWJsaWMgZ2V0TG9va0F0V29ybGREaXJlY3Rpb24odGFyZ2V0OiBUSFJFRS5WZWN0b3IzKTogVEhSRUUuVmVjdG9yMyB7XHJcbiAgICB0aGlzLmdldExvb2tBdFdvcmxkUXVhdGVybmlvbihfcXVhdEIpO1xyXG4gICAgdGhpcy5nZXRGYWNlRnJvbnRRdWF0ZXJuaW9uKF9xdWF0Qyk7XHJcblxyXG4gICAgcmV0dXJuIHRhcmdldFxyXG4gICAgICAuY29weShWRUMzX1BPU0lUSVZFX1opXHJcbiAgICAgIC5hcHBseVF1YXRlcm5pb24oX3F1YXRCKVxyXG4gICAgICAuYXBwbHlRdWF0ZXJuaW9uKF9xdWF0QylcclxuICAgICAgLmFwcGx5RXVsZXIodGhpcy5nZXRFdWxlcihfZXVsZXJBKSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBTZXQgaXRzIExvb2tBdCBwb3NpdGlvbi5cclxuICAgKiBOb3RlIHRoYXQgaXRzIHJlc3VsdCB3aWxsIGJlIGluc3RhbnRseSBvdmVyd3JpdHRlbiBpZiB7QGxpbmsgVlJNTG9va0F0SGVhZC5hdXRvVXBkYXRlfSBpcyBlbmFibGVkLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHBvc2l0aW9uIEEgdGFyZ2V0IHBvc2l0aW9uLCBpbiB3b3JsZCBzcGFjZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBsb29rQXQocG9zaXRpb246IFRIUkVFLlZlY3RvcjMpOiB2b2lkIHtcclxuICAgIC8vIExvb2sgYXQgZGlyZWN0aW9uIGluIGxvY2FsIGNvb3JkaW5hdGVcclxuICAgIGNvbnN0IGhlYWRSb3RJbnYgPSBxdWF0SW52ZXJ0Q29tcGF0KHRoaXMuZ2V0TG9va0F0V29ybGRRdWF0ZXJuaW9uKF9xdWF0QSkpO1xyXG4gICAgY29uc3QgaGVhZFBvcyA9IHRoaXMuZ2V0TG9va0F0V29ybGRQb3NpdGlvbihfdjNCKTtcclxuICAgIGNvbnN0IGxvb2tBdERpciA9IF92M0MuY29weShwb3NpdGlvbikuc3ViKGhlYWRQb3MpLmFwcGx5UXVhdGVybmlvbihoZWFkUm90SW52KS5ub3JtYWxpemUoKTtcclxuXHJcbiAgICAvLyBjYWxjdWxhdGUgYW5nbGVzXHJcbiAgICBjb25zdCBbYXppbXV0aEZyb20sIGFsdGl0dWRlRnJvbV0gPSBjYWxjQXppbXV0aEFsdGl0dWRlKHRoaXMuZmFjZUZyb250KTtcclxuICAgIGNvbnN0IFthemltdXRoVG8sIGFsdGl0dWRlVG9dID0gY2FsY0F6aW11dGhBbHRpdHVkZShsb29rQXREaXIpO1xyXG4gICAgY29uc3QgeWF3ID0gc2FuaXRpemVBbmdsZShhemltdXRoVG8gLSBhemltdXRoRnJvbSk7XHJcbiAgICBjb25zdCBwaXRjaCA9IHNhbml0aXplQW5nbGUoYWx0aXR1ZGVGcm9tIC0gYWx0aXR1ZGVUbyk7IC8vIHNwaW5uaW5nICgxLCAwLCAwKSBDQ1cgYXJvdW5kIFogYXhpcyBtYWtlcyB0aGUgdmVjdG9yIGxvb2sgdXAsIHdoaWxlIHNwaW5uaW5nICgwLCAwLCAxKSBDQ1cgYXJvdW5kIFggYXhpcyBtYWtlcyB0aGUgdmVjdG9yIGxvb2sgZG93blxyXG5cclxuICAgIC8vIGFwcGx5IGFuZ2xlc1xyXG4gICAgdGhpcy5feWF3ID0gVEhSRUUuTWF0aFV0aWxzLlJBRDJERUcgKiB5YXc7XHJcbiAgICB0aGlzLl9waXRjaCA9IFRIUkVFLk1hdGhVdGlscy5SQUQyREVHICogcGl0Y2g7XHJcblxyXG4gICAgdGhpcy5fbmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoZSBWUk1Mb29rQXRIZWFkLlxyXG4gICAqIElmIHtAbGluayBWUk1Mb29rQXRIZWFkLmF1dG9VcGRhdGV9IGlzIGRpc2FibGVkLCBpdCB3aWxsIGRvIG5vdGhpbmcuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lLCBpdCBpc24ndCB1c2VkIHRob3VnaC4gWW91IGNhbiB1c2UgdGhlIHBhcmFtZXRlciBpZiB5b3Ugd2FudCB0byB1c2UgdGhpcyBpbiB5b3VyIG93biBleHRlbmRlZCB7QGxpbmsgVlJNTG9va0F0fS5cclxuICAgKi9cclxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmICh0aGlzLnRhcmdldCAhPSBudWxsICYmIHRoaXMuYXV0b1VwZGF0ZSkge1xyXG4gICAgICB0aGlzLmxvb2tBdCh0aGlzLnRhcmdldC5nZXRXb3JsZFBvc2l0aW9uKF92M0EpKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5fbmVlZHNVcGRhdGUpIHtcclxuICAgICAgdGhpcy5fbmVlZHNVcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICAgIHRoaXMuYXBwbGllci5hcHBseVlhd1BpdGNoKHRoaXMuX3lhdywgdGhpcy5fcGl0Y2gpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4uL2h1bWFub2lkJztcclxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTUxvb2tBdEFwcGxpZXIgfSBmcm9tICcuL1ZSTUxvb2tBdEFwcGxpZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXRSYW5nZU1hcCB9IGZyb20gJy4vVlJNTG9va0F0UmFuZ2VNYXAnO1xyXG5pbXBvcnQgeyBjYWxjQXppbXV0aEFsdGl0dWRlIH0gZnJvbSAnLi91dGlscy9jYWxjQXppbXV0aEFsdGl0dWRlJztcclxuXHJcbmNvbnN0IFZFQzNfUE9TSVRJVkVfWiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAxLjApO1xyXG5cclxuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuY29uc3QgX3F1YXRCID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuY29uc3QgX2V1bGVyQSA9IG5ldyBUSFJFRS5FdWxlcigwLjAsIDAuMCwgMC4wLCAnWVhaJyk7XHJcblxyXG4vKipcclxuICogQSBjbGFzcyB0aGF0IGFwcGxpZXMgZXllIGdhemUgZGlyZWN0aW9ucyB0byBhIFZSTS5cclxuICogSXQgd2lsbCBiZSB1c2VkIGJ5IHtAbGluayBWUk1Mb29rQXR9LlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUxvb2tBdEJvbmVBcHBsaWVyIGltcGxlbWVudHMgVlJNTG9va0F0QXBwbGllciB7XHJcbiAgLyoqXHJcbiAgICogUmVwcmVzZW50IGl0cyB0eXBlIG9mIGFwcGxpZXIuXHJcbiAgICovXHJcbiAgcHVibGljIHN0YXRpYyByZWFkb25seSB0eXBlID0gJ2JvbmUnO1xyXG5cclxuICAvKipcclxuICAgKiBJdHMgYXNzb2NpYXRlZCB7QGxpbmsgVlJNSHVtYW5vaWR9LlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBodW1hbm9pZDogVlJNSHVtYW5vaWQ7XHJcblxyXG4gIC8qKlxyXG4gICAqIEEge0BsaW5rIFZSTUxvb2tBdFJhbmdlTWFwfSBmb3IgaG9yaXpvbnRhbCBpbndhcmQgbW92ZW1lbnQuIFRoZSBsZWZ0IGV5ZSBtb3ZlcyByaWdodC4gVGhlIHJpZ2h0IGV5ZSBtb3ZlcyBsZWZ0LlxyXG4gICAqL1xyXG4gIHB1YmxpYyByYW5nZU1hcEhvcml6b250YWxJbm5lcjogVlJNTG9va0F0UmFuZ2VNYXA7XHJcblxyXG4gIC8qKlxyXG4gICAqIEEge0BsaW5rIFZSTUxvb2tBdFJhbmdlTWFwfSBmb3IgaG9yaXpvbnRhbCBvdXR3YXJkIG1vdmVtZW50LiBUaGUgbGVmdCBleWUgbW92ZXMgbGVmdC4gVGhlIHJpZ2h0IGV5ZSBtb3ZlcyByaWdodC5cclxuICAgKi9cclxuICBwdWJsaWMgcmFuZ2VNYXBIb3Jpem9udGFsT3V0ZXI6IFZSTUxvb2tBdFJhbmdlTWFwO1xyXG5cclxuICAvKipcclxuICAgKiBBIHtAbGluayBWUk1Mb29rQXRSYW5nZU1hcH0gZm9yIHZlcnRpY2FsIGRvd253YXJkIG1vdmVtZW50LiBCb3RoIGV5ZXMgbW92ZSB1cHdhcmRzLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByYW5nZU1hcFZlcnRpY2FsRG93bjogVlJNTG9va0F0UmFuZ2VNYXA7XHJcblxyXG4gIC8qKlxyXG4gICAqIEEge0BsaW5rIFZSTUxvb2tBdFJhbmdlTWFwfSBmb3IgdmVydGljYWwgdXB3YXJkIG1vdmVtZW50LiBCb3RoIGV5ZXMgbW92ZSBkb3dud2FyZHMuXHJcbiAgICovXHJcbiAgcHVibGljIHJhbmdlTWFwVmVydGljYWxVcDogVlJNTG9va0F0UmFuZ2VNYXA7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSBmcm9udCBkaXJlY3Rpb24gb2YgdGhlIGZhY2UuXHJcbiAgICogSW50ZW5kZWQgdG8gYmUgdXNlZCBmb3IgVlJNIDAuMCBjb21wYXQgKFZSTSAwLjAgbW9kZWxzIGFyZSBmYWNpbmcgWi0gaW5zdGVhZCBvZiBaKykuXHJcbiAgICogWW91IHVzdWFsbHkgZG9uJ3Qgd2FudCB0byB0b3VjaCB0aGlzLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBmYWNlRnJvbnQ6IFRIUkVFLlZlY3RvcjM7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSByZXN0IHF1YXRlcm5pb24gb2YgTGVmdEV5ZSBib25lLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3Jlc3RRdWF0TGVmdEV5ZTogVEhSRUUuUXVhdGVybmlvbjtcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIHJlc3QgcXVhdGVybmlvbiBvZiBSaWdodEV5ZSBib25lLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3Jlc3RRdWF0UmlnaHRFeWU6IFRIUkVFLlF1YXRlcm5pb247XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyB7QGxpbmsgVlJNTG9va0F0Qm9uZUFwcGxpZXJ9LlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGh1bWFub2lkIEEge0BsaW5rIFZSTUh1bWFub2lkfVxyXG4gICAqIEBwYXJhbSByYW5nZU1hcEhvcml6b250YWxJbm5lciBBIHtAbGluayBWUk1Mb29rQXRSYW5nZU1hcH0gdXNlZCBmb3IgaW5uZXIgdHJhbnN2ZXJzZSBkaXJlY3Rpb25cclxuICAgKiBAcGFyYW0gcmFuZ2VNYXBIb3Jpem9udGFsT3V0ZXIgQSB7QGxpbmsgVlJNTG9va0F0UmFuZ2VNYXB9IHVzZWQgZm9yIG91dGVyIHRyYW5zdmVyc2UgZGlyZWN0aW9uXHJcbiAgICogQHBhcmFtIHJhbmdlTWFwVmVydGljYWxEb3duIEEge0BsaW5rIFZSTUxvb2tBdFJhbmdlTWFwfSB1c2VkIGZvciBkb3duIGRpcmVjdGlvblxyXG4gICAqIEBwYXJhbSByYW5nZU1hcFZlcnRpY2FsVXAgQSB7QGxpbmsgVlJNTG9va0F0UmFuZ2VNYXB9IHVzZWQgZm9yIHVwIGRpcmVjdGlvblxyXG4gICAqL1xyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihcclxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcclxuICAgIHJhbmdlTWFwSG9yaXpvbnRhbElubmVyOiBWUk1Mb29rQXRSYW5nZU1hcCxcclxuICAgIHJhbmdlTWFwSG9yaXpvbnRhbE91dGVyOiBWUk1Mb29rQXRSYW5nZU1hcCxcclxuICAgIHJhbmdlTWFwVmVydGljYWxEb3duOiBWUk1Mb29rQXRSYW5nZU1hcCxcclxuICAgIHJhbmdlTWFwVmVydGljYWxVcDogVlJNTG9va0F0UmFuZ2VNYXAsXHJcbiAgKSB7XHJcbiAgICB0aGlzLmh1bWFub2lkID0gaHVtYW5vaWQ7XHJcblxyXG4gICAgdGhpcy5yYW5nZU1hcEhvcml6b250YWxJbm5lciA9IHJhbmdlTWFwSG9yaXpvbnRhbElubmVyO1xyXG4gICAgdGhpcy5yYW5nZU1hcEhvcml6b250YWxPdXRlciA9IHJhbmdlTWFwSG9yaXpvbnRhbE91dGVyO1xyXG4gICAgdGhpcy5yYW5nZU1hcFZlcnRpY2FsRG93biA9IHJhbmdlTWFwVmVydGljYWxEb3duO1xyXG4gICAgdGhpcy5yYW5nZU1hcFZlcnRpY2FsVXAgPSByYW5nZU1hcFZlcnRpY2FsVXA7XHJcblxyXG4gICAgdGhpcy5mYWNlRnJvbnQgPSBuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgMS4wKTtcclxuXHJcbiAgICAvLyBzZXQgcmVzdCBxdWF0ZXJuaW9uc1xyXG4gICAgdGhpcy5fcmVzdFF1YXRMZWZ0RXllID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuICAgIHRoaXMuX3Jlc3RRdWF0UmlnaHRFeWUgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpO1xyXG5cclxuICAgIGNvbnN0IGxlZnRFeWUgPSB0aGlzLmh1bWFub2lkLmdldFJhd0JvbmVOb2RlKCdsZWZ0RXllJyk7XHJcbiAgICBjb25zdCByaWdodEV5ZSA9IHRoaXMuaHVtYW5vaWQuZ2V0UmF3Qm9uZU5vZGUoJ2xlZnRFeWUnKTtcclxuXHJcbiAgICBpZiAobGVmdEV5ZSkge1xyXG4gICAgICB0aGlzLl9yZXN0UXVhdExlZnRFeWUuY29weShsZWZ0RXllLnF1YXRlcm5pb24pO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChyaWdodEV5ZSkge1xyXG4gICAgICB0aGlzLl9yZXN0UXVhdFJpZ2h0RXllLmNvcHkocmlnaHRFeWUucXVhdGVybmlvbik7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBBcHBseSB0aGUgaW5wdXQgYW5nbGUgdG8gaXRzIGFzc29jaWF0ZWQgVlJNIG1vZGVsLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIHlhdyBSb3RhdGlvbiBhcm91bmQgWSBheGlzLCBpbiBkZWdyZWVcclxuICAgKiBAcGFyYW0gcGl0Y2ggUm90YXRpb24gYXJvdW5kIFggYXhpcywgaW4gZGVncmVlXHJcbiAgICovXHJcbiAgcHVibGljIGFwcGx5WWF3UGl0Y2goeWF3OiBudW1iZXIsIHBpdGNoOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IGxlZnRFeWUgPSB0aGlzLmh1bWFub2lkLmdldFJhd0JvbmVOb2RlKCdsZWZ0RXllJyk7XHJcbiAgICBjb25zdCByaWdodEV5ZSA9IHRoaXMuaHVtYW5vaWQuZ2V0UmF3Qm9uZU5vZGUoJ3JpZ2h0RXllJyk7XHJcbiAgICBjb25zdCBsZWZ0RXllTm9ybWFsaXplZCA9IHRoaXMuaHVtYW5vaWQuZ2V0Tm9ybWFsaXplZEJvbmVOb2RlKCdsZWZ0RXllJyk7XHJcbiAgICBjb25zdCByaWdodEV5ZU5vcm1hbGl6ZWQgPSB0aGlzLmh1bWFub2lkLmdldE5vcm1hbGl6ZWRCb25lTm9kZSgncmlnaHRFeWUnKTtcclxuICAgIC8vIGxlZnRcclxuICAgIGlmIChsZWZ0RXllKSB7XHJcbiAgICAgIGlmIChwaXRjaCA8IDAuMCkge1xyXG4gICAgICAgIF9ldWxlckEueCA9IC1USFJFRS5NYXRoVXRpbHMuREVHMlJBRCAqIHRoaXMucmFuZ2VNYXBWZXJ0aWNhbERvd24ubWFwKC1waXRjaCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgX2V1bGVyQS54ID0gVEhSRUUuTWF0aFV0aWxzLkRFRzJSQUQgKiB0aGlzLnJhbmdlTWFwVmVydGljYWxVcC5tYXAocGl0Y2gpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoeWF3IDwgMC4wKSB7XHJcbiAgICAgICAgX2V1bGVyQS55ID0gLVRIUkVFLk1hdGhVdGlscy5ERUcyUkFEICogdGhpcy5yYW5nZU1hcEhvcml6b250YWxJbm5lci5tYXAoLXlhdyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgX2V1bGVyQS55ID0gVEhSRUUuTWF0aFV0aWxzLkRFRzJSQUQgKiB0aGlzLnJhbmdlTWFwSG9yaXpvbnRhbE91dGVyLm1hcCh5YXcpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBfcXVhdEEuc2V0RnJvbUV1bGVyKF9ldWxlckEpO1xyXG4gICAgICB0aGlzLl9nZXRGYWNlRnJvbnRRdWF0ZXJuaW9uKF9xdWF0Qik7XHJcblxyXG4gICAgICAvLyBxdWF0Ql4tMSAqIHF1YXRBICogcXVhdEIgKiByZXN0UXVhdExlZnRFeWVcclxuICAgICAgbGVmdEV5ZS5xdWF0ZXJuaW9uLmNvcHkoX3F1YXRCKS5wcmVtdWx0aXBseShfcXVhdEEpLnByZW11bHRpcGx5KF9xdWF0Qi5pbnZlcnQoKSkubXVsdGlwbHkodGhpcy5fcmVzdFF1YXRMZWZ0RXllKTtcclxuICAgICAgbGVmdEV5ZU5vcm1hbGl6ZWQhLnF1YXRlcm5pb24uY29weShfcXVhdEIpLnByZW11bHRpcGx5KF9xdWF0QSkucHJlbXVsdGlwbHkoX3F1YXRCLmludmVydCgpKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyByaWdodFxyXG4gICAgaWYgKHJpZ2h0RXllKSB7XHJcbiAgICAgIGlmIChwaXRjaCA8IDAuMCkge1xyXG4gICAgICAgIF9ldWxlckEueCA9IC1USFJFRS5NYXRoVXRpbHMuREVHMlJBRCAqIHRoaXMucmFuZ2VNYXBWZXJ0aWNhbERvd24ubWFwKC1waXRjaCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgX2V1bGVyQS54ID0gVEhSRUUuTWF0aFV0aWxzLkRFRzJSQUQgKiB0aGlzLnJhbmdlTWFwVmVydGljYWxVcC5tYXAocGl0Y2gpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZiAoeWF3IDwgMC4wKSB7XHJcbiAgICAgICAgX2V1bGVyQS55ID0gLVRIUkVFLk1hdGhVdGlscy5ERUcyUkFEICogdGhpcy5yYW5nZU1hcEhvcml6b250YWxPdXRlci5tYXAoLXlhdyk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgX2V1bGVyQS55ID0gVEhSRUUuTWF0aFV0aWxzLkRFRzJSQUQgKiB0aGlzLnJhbmdlTWFwSG9yaXpvbnRhbElubmVyLm1hcCh5YXcpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBfcXVhdEEuc2V0RnJvbUV1bGVyKF9ldWxlckEpO1xyXG4gICAgICB0aGlzLl9nZXRGYWNlRnJvbnRRdWF0ZXJuaW9uKF9xdWF0Qik7XHJcblxyXG4gICAgICAvLyBxdWF0Ql4tMSAqIHF1YXRBICogcXVhdEIgKiByZXN0UXVhdFJpZ2h0RXllXHJcbiAgICAgIHJpZ2h0RXllLnF1YXRlcm5pb25cclxuICAgICAgICAuY29weShfcXVhdEIpXHJcbiAgICAgICAgLnByZW11bHRpcGx5KF9xdWF0QSlcclxuICAgICAgICAucHJlbXVsdGlwbHkoX3F1YXRCLmludmVydCgpKVxyXG4gICAgICAgIC5tdWx0aXBseSh0aGlzLl9yZXN0UXVhdFJpZ2h0RXllKTtcclxuICAgICAgcmlnaHRFeWVOb3JtYWxpemVkIS5xdWF0ZXJuaW9uLmNvcHkoX3F1YXRCKS5wcmVtdWx0aXBseShfcXVhdEEpLnByZW11bHRpcGx5KF9xdWF0Qi5pbnZlcnQoKSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBVc2Uge0BsaW5rIGFwcGx5WWF3UGl0Y2h9IGluc3RlYWQuXHJcbiAgICovXHJcbiAgcHVibGljIGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkIHtcclxuICAgIGNvbnNvbGUud2FybignVlJNTG9va0F0Qm9uZUFwcGxpZXI6IGxvb2tBdCgpIGlzIGRlcHJlY2F0ZWQuIHVzZSBhcHBseSgpIGluc3RlYWQuJyk7XHJcblxyXG4gICAgY29uc3QgeWF3ID0gVEhSRUUuTWF0aFV0aWxzLlJBRDJERUcgKiBldWxlci55O1xyXG4gICAgY29uc3QgcGl0Y2ggPSBUSFJFRS5NYXRoVXRpbHMuUkFEMkRFRyAqIGV1bGVyLng7XHJcblxyXG4gICAgdGhpcy5hcHBseVlhd1BpdGNoKHlhdywgcGl0Y2gpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogR2V0IGEgcXVhdGVybmlvbiB0aGF0IHJvdGF0ZXMgdGhlICtaIHVuaXQgdmVjdG9yIG9mIHRoZSBodW1hbm9pZCBIZWFkIHRvIHRoZSB7QGxpbmsgZmFjZUZyb250fSBkaXJlY3Rpb24uXHJcbiAgICpcclxuICAgKiBAcGFyYW0gdGFyZ2V0IEEgdGFyZ2V0IGBUSFJFRS5WZWN0b3IzYFxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dldEZhY2VGcm9udFF1YXRlcm5pb24odGFyZ2V0OiBUSFJFRS5RdWF0ZXJuaW9uKTogVEhSRUUuUXVhdGVybmlvbiB7XHJcbiAgICBpZiAodGhpcy5mYWNlRnJvbnQuZGlzdGFuY2VUb1NxdWFyZWQoVkVDM19QT1NJVElWRV9aKSA8IDAuMDEpIHtcclxuICAgICAgcmV0dXJuIHRhcmdldC5pZGVudGl0eSgpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IFtmYWNlRnJvbnRBemltdXRoLCBmYWNlRnJvbnRBbHRpdHVkZV0gPSBjYWxjQXppbXV0aEFsdGl0dWRlKHRoaXMuZmFjZUZyb250KTtcclxuICAgIF9ldWxlckEuc2V0KDAuMCwgMC41ICogTWF0aC5QSSArIGZhY2VGcm9udEF6aW11dGgsIGZhY2VGcm9udEFsdGl0dWRlLCAnWVpYJyk7XHJcbiAgICByZXR1cm4gdGFyZ2V0LnNldEZyb21FdWxlcihfZXVsZXJBKTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHsgVlJNRXhwcmVzc2lvbk1hbmFnZXIgfSBmcm9tICcuLi9leHByZXNzaW9ucyc7XHJcbmltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHR5cGUgeyBWUk1Mb29rQXRBcHBsaWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRBcHBsaWVyJztcclxuaW1wb3J0IHsgVlJNTG9va0F0UmFuZ2VNYXAgfSBmcm9tICcuL1ZSTUxvb2tBdFJhbmdlTWFwJztcclxuXHJcbi8qKlxyXG4gKiBBIGNsYXNzIHRoYXQgYXBwbGllcyBleWUgZ2F6ZSBkaXJlY3Rpb25zIHRvIGEgVlJNLlxyXG4gKiBJdCB3aWxsIGJlIHVzZWQgYnkge0BsaW5rIFZSTUxvb2tBdH0uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNTG9va0F0RXhwcmVzc2lvbkFwcGxpZXIgaW1wbGVtZW50cyBWUk1Mb29rQXRBcHBsaWVyIHtcclxuICAvKipcclxuICAgKiBSZXByZXNlbnQgaXRzIHR5cGUgb2YgYXBwbGllci5cclxuICAgKi9cclxuICBwdWJsaWMgc3RhdGljIHJlYWRvbmx5IHR5cGUgPSAnZXhwcmVzc2lvbic7XHJcblxyXG4gIC8qKlxyXG4gICAqIEl0cyBhc3NvY2lhdGVkIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn0uXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGV4cHJlc3Npb25zOiBWUk1FeHByZXNzaW9uTWFuYWdlcjtcclxuXHJcbiAgLyoqXHJcbiAgICogSXQgd29uJ3QgYmUgdXNlZCBpbiBleHByZXNzaW9uIGFwcGxpZXIuXHJcbiAgICogU2VlIGFsc286IHtAbGluayByYW5nZU1hcEhvcml6b250YWxPdXRlcn1cclxuICAgKi9cclxuICBwdWJsaWMgcmFuZ2VNYXBIb3Jpem9udGFsSW5uZXI6IFZSTUxvb2tBdFJhbmdlTWFwO1xyXG5cclxuICAvKipcclxuICAgKiBBIHtAbGluayBWUk1Mb29rQXRSYW5nZU1hcH0gZm9yIGhvcml6b250YWwgbW92ZW1lbnQuIEJvdGggZXllcyBtb3ZlIGxlZnQgb3IgcmlnaHQuXHJcbiAgICovXHJcbiAgcHVibGljIHJhbmdlTWFwSG9yaXpvbnRhbE91dGVyOiBWUk1Mb29rQXRSYW5nZU1hcDtcclxuXHJcbiAgLyoqXHJcbiAgICogQSB7QGxpbmsgVlJNTG9va0F0UmFuZ2VNYXB9IGZvciB2ZXJ0aWNhbCBkb3dud2FyZCBtb3ZlbWVudC4gQm90aCBleWVzIG1vdmUgdXB3YXJkcy5cclxuICAgKi9cclxuICBwdWJsaWMgcmFuZ2VNYXBWZXJ0aWNhbERvd246IFZSTUxvb2tBdFJhbmdlTWFwO1xyXG5cclxuICAvKipcclxuICAgKiBBIHtAbGluayBWUk1Mb29rQXRSYW5nZU1hcH0gZm9yIHZlcnRpY2FsIHVwd2FyZCBtb3ZlbWVudC4gQm90aCBleWVzIG1vdmUgZG93bndhcmRzLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByYW5nZU1hcFZlcnRpY2FsVXA6IFZSTUxvb2tBdFJhbmdlTWFwO1xyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcge0BsaW5rIFZSTUxvb2tBdEV4cHJlc3Npb25BcHBsaWVyfS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBleHByZXNzaW9ucyBBIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlcn1cclxuICAgKiBAcGFyYW0gcmFuZ2VNYXBIb3Jpem9udGFsSW5uZXIgQSB7QGxpbmsgVlJNTG9va0F0UmFuZ2VNYXB9IHVzZWQgZm9yIGlubmVyIHRyYW5zdmVyc2UgZGlyZWN0aW9uXHJcbiAgICogQHBhcmFtIHJhbmdlTWFwSG9yaXpvbnRhbE91dGVyIEEge0BsaW5rIFZSTUxvb2tBdFJhbmdlTWFwfSB1c2VkIGZvciBvdXRlciB0cmFuc3ZlcnNlIGRpcmVjdGlvblxyXG4gICAqIEBwYXJhbSByYW5nZU1hcFZlcnRpY2FsRG93biBBIHtAbGluayBWUk1Mb29rQXRSYW5nZU1hcH0gdXNlZCBmb3IgZG93biBkaXJlY3Rpb25cclxuICAgKiBAcGFyYW0gcmFuZ2VNYXBWZXJ0aWNhbFVwIEEge0BsaW5rIFZSTUxvb2tBdFJhbmdlTWFwfSB1c2VkIGZvciB1cCBkaXJlY3Rpb25cclxuICAgKi9cclxuICBwdWJsaWMgY29uc3RydWN0b3IoXHJcbiAgICBleHByZXNzaW9uczogVlJNRXhwcmVzc2lvbk1hbmFnZXIsXHJcbiAgICByYW5nZU1hcEhvcml6b250YWxJbm5lcjogVlJNTG9va0F0UmFuZ2VNYXAsXHJcbiAgICByYW5nZU1hcEhvcml6b250YWxPdXRlcjogVlJNTG9va0F0UmFuZ2VNYXAsXHJcbiAgICByYW5nZU1hcFZlcnRpY2FsRG93bjogVlJNTG9va0F0UmFuZ2VNYXAsXHJcbiAgICByYW5nZU1hcFZlcnRpY2FsVXA6IFZSTUxvb2tBdFJhbmdlTWFwLFxyXG4gICkge1xyXG4gICAgdGhpcy5leHByZXNzaW9ucyA9IGV4cHJlc3Npb25zO1xyXG5cclxuICAgIHRoaXMucmFuZ2VNYXBIb3Jpem9udGFsSW5uZXIgPSByYW5nZU1hcEhvcml6b250YWxJbm5lcjtcclxuICAgIHRoaXMucmFuZ2VNYXBIb3Jpem9udGFsT3V0ZXIgPSByYW5nZU1hcEhvcml6b250YWxPdXRlcjtcclxuICAgIHRoaXMucmFuZ2VNYXBWZXJ0aWNhbERvd24gPSByYW5nZU1hcFZlcnRpY2FsRG93bjtcclxuICAgIHRoaXMucmFuZ2VNYXBWZXJ0aWNhbFVwID0gcmFuZ2VNYXBWZXJ0aWNhbFVwO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQXBwbHkgdGhlIGlucHV0IGFuZ2xlIHRvIGl0cyBhc3NvY2lhdGVkIFZSTSBtb2RlbC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB5YXcgUm90YXRpb24gYXJvdW5kIFkgYXhpcywgaW4gZGVncmVlXHJcbiAgICogQHBhcmFtIHBpdGNoIFJvdGF0aW9uIGFyb3VuZCBYIGF4aXMsIGluIGRlZ3JlZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBhcHBseVlhd1BpdGNoKHlhdzogbnVtYmVyLCBwaXRjaDogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBpZiAocGl0Y2ggPCAwLjApIHtcclxuICAgICAgdGhpcy5leHByZXNzaW9ucy5zZXRWYWx1ZSgnbG9va0Rvd24nLCAwLjApO1xyXG4gICAgICB0aGlzLmV4cHJlc3Npb25zLnNldFZhbHVlKCdsb29rVXAnLCB0aGlzLnJhbmdlTWFwVmVydGljYWxVcC5tYXAoLXBpdGNoKSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0aGlzLmV4cHJlc3Npb25zLnNldFZhbHVlKCdsb29rVXAnLCAwLjApO1xyXG4gICAgICB0aGlzLmV4cHJlc3Npb25zLnNldFZhbHVlKCdsb29rRG93bicsIHRoaXMucmFuZ2VNYXBWZXJ0aWNhbERvd24ubWFwKHBpdGNoKSk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHlhdyA8IDAuMCkge1xyXG4gICAgICB0aGlzLmV4cHJlc3Npb25zLnNldFZhbHVlKCdsb29rTGVmdCcsIDAuMCk7XHJcbiAgICAgIHRoaXMuZXhwcmVzc2lvbnMuc2V0VmFsdWUoJ2xvb2tSaWdodCcsIHRoaXMucmFuZ2VNYXBIb3Jpem9udGFsT3V0ZXIubWFwKC15YXcpKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRoaXMuZXhwcmVzc2lvbnMuc2V0VmFsdWUoJ2xvb2tSaWdodCcsIDAuMCk7XHJcbiAgICAgIHRoaXMuZXhwcmVzc2lvbnMuc2V0VmFsdWUoJ2xvb2tMZWZ0JywgdGhpcy5yYW5nZU1hcEhvcml6b250YWxPdXRlci5tYXAoeWF3KSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBVc2Uge0BsaW5rIGFwcGx5WWF3UGl0Y2h9IGluc3RlYWQuXHJcbiAgICovXHJcbiAgcHVibGljIGxvb2tBdChldWxlcjogVEhSRUUuRXVsZXIpOiB2b2lkIHtcclxuICAgIGNvbnNvbGUud2FybignVlJNTG9va0F0Qm9uZUFwcGxpZXI6IGxvb2tBdCgpIGlzIGRlcHJlY2F0ZWQuIHVzZSBhcHBseSgpIGluc3RlYWQuJyk7XHJcblxyXG4gICAgY29uc3QgeWF3ID0gVEhSRUUuTWF0aFV0aWxzLlJBRDJERUcgKiBldWxlci55O1xyXG4gICAgY29uc3QgcGl0Y2ggPSBUSFJFRS5NYXRoVXRpbHMuUkFEMkRFRyAqIGV1bGVyLng7XHJcblxyXG4gICAgdGhpcy5hcHBseVlhd1BpdGNoKHlhdywgcGl0Y2gpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgeyBzYXR1cmF0ZSB9IGZyb20gJy4uL3V0aWxzL3NhdHVyYXRlJztcclxuXHJcbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRSYW5nZU1hcCB7XHJcbiAgLyoqXHJcbiAgICogTGltaXRzIHRoZSBtYXhpbXVtIGFuZ2xlIG9mIHRoZSBpbnB1dCBhbmdsZSBvZiB0aGUgTG9va0F0IHZlY3RvciBmcm9tIHRoZSBmcm9udCBvZiB0aGUgaGVhZCAodGhlIHBvc2l0aXZlIHogYXhpcykuXHJcbiAgICovXHJcbiAgcHVibGljIGlucHV0TWF4VmFsdWU6IG51bWJlcjtcclxuXHJcbiAgLyoqXHJcbiAgICogUmVwcmVzZW50cyBhbiBhbmdsZSAoaW4gZGVncmVlcykgZm9yIGJvbmUgdHlwZSBvZiBMb29rQXQgYXBwbGllcnMsIG9yIGEgd2VpZ2h0IGZvciBleHByZXNzaW9uIHR5cGUgb2YgTG9va0F0IGFwcGxpZXJzLlxyXG4gICAqIFRoZSBpbnB1dCB2YWx1ZSB3aWxsIHRha2UgYDEuMGAgd2hlbiB0aGUgaW5wdXQgYW5nbGUgZXF1YWxzIChvciBncmVhdGVyKSB0byB7QGxpbmsgaW5wdXRNYXhWYWx1ZX0uXHJcbiAgICovXHJcbiAgcHVibGljIG91dHB1dFNjYWxlOiBudW1iZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyB7QGxpbmsgVlJNTG9va0F0UmFuZ2VNYXB9LlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGlucHV0TWF4VmFsdWUgVGhlIHtAbGluayBpbnB1dE1heFZhbHVlfSBvZiB0aGUgbWFwXHJcbiAgICogQHBhcmFtIG91dHB1dFNjYWxlIFRoZSB7QGxpbmsgb3V0cHV0U2NhbGV9IG9mIHRoZSBtYXBcclxuICAgKi9cclxuICBwdWJsaWMgY29uc3RydWN0b3IoaW5wdXRNYXhWYWx1ZTogbnVtYmVyLCBvdXRwdXRTY2FsZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLmlucHV0TWF4VmFsdWUgPSBpbnB1dE1heFZhbHVlO1xyXG4gICAgdGhpcy5vdXRwdXRTY2FsZSA9IG91dHB1dFNjYWxlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRXZhbHVhdGUgYW4gaW5wdXQgdmFsdWUgYW5kIG91dHB1dCBhIG1hcHBlZCB2YWx1ZS5cclxuICAgKiBAcGFyYW0gc3JjIFRoZSBpbnB1dCB2YWx1ZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBtYXAoc3JjOiBudW1iZXIpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMub3V0cHV0U2NhbGUgKiBzYXR1cmF0ZShzcmMgLyB0aGlzLmlucHV0TWF4VmFsdWUpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgdHlwZSAqIGFzIFYwVlJNIGZyb20gJ0BwaXhpdi90eXBlcy12cm0tMC4wJztcclxuaW1wb3J0IHR5cGUgKiBhcyBWMVZSTVNjaGVtYSBmcm9tICdAcGl4aXYvdHlwZXMtdnJtYy12cm0tMS4wJztcclxuaW1wb3J0IHR5cGUgeyBHTFRGLCBHTFRGTG9hZGVyUGx1Z2luLCBHTFRGUGFyc2VyIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XHJcbmltcG9ydCB0eXBlIHsgVlJNRXhwcmVzc2lvbk1hbmFnZXIgfSBmcm9tICcuLi9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uTWFuYWdlcic7XHJcbmltcG9ydCB0eXBlIHsgVlJNSHVtYW5vaWQgfSBmcm9tICcuLi9odW1hbm9pZC9WUk1IdW1hbm9pZCc7XHJcbmltcG9ydCB7IFZSTUxvb2tBdEhlbHBlciB9IGZyb20gJy4vaGVscGVycy9WUk1Mb29rQXRIZWxwZXInO1xyXG5pbXBvcnQgeyBWUk1Mb29rQXQgfSBmcm9tICcuL1ZSTUxvb2tBdCc7XHJcbmltcG9ydCB0eXBlIHsgVlJNTG9va0F0QXBwbGllciB9IGZyb20gJy4vVlJNTG9va0F0QXBwbGllcic7XHJcbmltcG9ydCB7IFZSTUxvb2tBdEJvbmVBcHBsaWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRCb25lQXBwbGllcic7XHJcbmltcG9ydCB7IFZSTUxvb2tBdEV4cHJlc3Npb25BcHBsaWVyIH0gZnJvbSAnLi9WUk1Mb29rQXRFeHByZXNzaW9uQXBwbGllcic7XHJcbmltcG9ydCB0eXBlIHsgVlJNTG9va0F0TG9hZGVyUGx1Z2luT3B0aW9ucyB9IGZyb20gJy4vVlJNTG9va0F0TG9hZGVyUGx1Z2luT3B0aW9ucyc7XHJcbmltcG9ydCB7IFZSTUxvb2tBdFJhbmdlTWFwIH0gZnJvbSAnLi9WUk1Mb29rQXRSYW5nZU1hcCc7XHJcbmltcG9ydCB7IEdMVEYgYXMgR0xURlNjaGVtYSB9IGZyb20gJ0BnbHRmLXRyYW5zZm9ybS9jb3JlJztcclxuXHJcbi8qKlxyXG4gKiBBIHBsdWdpbiBvZiBHTFRGTG9hZGVyIHRoYXQgaW1wb3J0cyBhIHtAbGluayBWUk1Mb29rQXR9IGZyb20gYSBWUk0gZXh0ZW5zaW9uIG9mIGEgR0xURi5cclxuICovXHJcbmV4cG9ydCBjbGFzcyBWUk1Mb29rQXRMb2FkZXJQbHVnaW4gaW1wbGVtZW50cyBHTFRGTG9hZGVyUGx1Z2luIHtcclxuICAvKipcclxuICAgKiBTcGVjaWZ5IGFuIE9iamVjdDNEIHRvIGFkZCB7QGxpbmsgVlJNTG9va0F0SGVscGVyfSBzLlxyXG4gICAqIElmIG5vdCBzcGVjaWZpZWQsIGhlbHBlciB3aWxsIG5vdCBiZSBjcmVhdGVkLlxyXG4gICAqIElmIGByZW5kZXJPcmRlcmAgaXMgc2V0IHRvIHRoZSByb290LCBoZWxwZXJzIHdpbGwgY29weSB0aGUgc2FtZSBgcmVuZGVyT3JkZXJgIC5cclxuICAgKi9cclxuICBwdWJsaWMgaGVscGVyUm9vdD86IFRIUkVFLk9iamVjdDNEO1xyXG5cclxuICBwdWJsaWMgcmVhZG9ubHkgcGFyc2VyOiBHTFRGUGFyc2VyO1xyXG5cclxuICBwdWJsaWMgZ2V0IG5hbWUoKTogc3RyaW5nIHtcclxuICAgIC8vIFdlIHNob3VsZCB1c2UgdGhlIGV4dGVuc2lvbiBuYW1lIGluc3RlYWQgYnV0IHdlIGhhdmUgbXVsdGlwbGUgcGx1Z2lucyBmb3IgYW4gZXh0ZW5zaW9uLi4uXHJcbiAgICByZXR1cm4gJ1ZSTUxvb2tBdExvYWRlclBsdWdpbic7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyc2VyOiBHTFRGUGFyc2VyLCBvcHRpb25zPzogVlJNTG9va0F0TG9hZGVyUGx1Z2luT3B0aW9ucykge1xyXG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XHJcblxyXG4gICAgdGhpcy5oZWxwZXJSb290ID0gb3B0aW9ucz8uaGVscGVyUm9vdDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBhZnRlclJvb3QoZ2x0ZjogR0xURik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgdnJtSHVtYW5vaWQgPSBnbHRmLnVzZXJEYXRhLnZybUh1bWFub2lkIGFzIFZSTUh1bWFub2lkIHwgdW5kZWZpbmVkO1xyXG5cclxuICAgIC8vIGV4cGxpY2l0bHkgZGlzdGluZ3Vpc2ggbnVsbCBhbmQgdW5kZWZpbmVkXHJcbiAgICAvLyBzaW5jZSB2cm1IdW1hbm9pZCBtaWdodCBiZSBudWxsIGFzIGEgcmVzdWx0XHJcbiAgICBpZiAodnJtSHVtYW5vaWQgPT09IG51bGwpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfSBlbHNlIGlmICh2cm1IdW1hbm9pZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcihcclxuICAgICAgICAnVlJNRmlyc3RQZXJzb25Mb2FkZXJQbHVnaW46IHZybUh1bWFub2lkIGlzIHVuZGVmaW5lZC4gVlJNSHVtYW5vaWRMb2FkZXJQbHVnaW4gaGF2ZSB0byBiZSB1c2VkIGZpcnN0JyxcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB2cm1FeHByZXNzaW9uTWFuYWdlciA9IGdsdGYudXNlckRhdGEudnJtRXhwcmVzc2lvbk1hbmFnZXIgYXMgVlJNRXhwcmVzc2lvbk1hbmFnZXIgfCB1bmRlZmluZWQ7XHJcblxyXG4gICAgaWYgKHZybUV4cHJlc3Npb25NYW5hZ2VyID09PSBudWxsKSB7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH0gZWxzZSBpZiAodnJtRXhwcmVzc2lvbk1hbmFnZXIgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgJ1ZSTUZpcnN0UGVyc29uTG9hZGVyUGx1Z2luOiB2cm1FeHByZXNzaW9uTWFuYWdlciBpcyB1bmRlZmluZWQuIFZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW4gaGF2ZSB0byBiZSB1c2VkIGZpcnN0JyxcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBnbHRmLnVzZXJEYXRhLnZybUxvb2tBdCA9IGF3YWl0IHRoaXMuX2ltcG9ydChnbHRmLCB2cm1IdW1hbm9pZCwgdnJtRXhwcmVzc2lvbk1hbmFnZXIpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW1wb3J0IGEge0BsaW5rIFZSTUxvb2tBdH0gZnJvbSBhIFZSTS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBnbHRmIEEgcGFyc2VkIHJlc3VsdCBvZiBHTFRGIHRha2VuIGZyb20gR0xURkxvYWRlclxyXG4gICAqIEBwYXJhbSBodW1hbm9pZCBBIHtAbGluayBWUk1IdW1hbm9pZH0gaW5zdGFuY2UgdGhhdCByZXByZXNlbnRzIHRoZSBWUk1cclxuICAgKiBAcGFyYW0gZXhwcmVzc2lvbnMgQSB7QGxpbmsgVlJNRXhwcmVzc2lvbk1hbmFnZXJ9IGluc3RhbmNlIHRoYXQgcmVwcmVzZW50cyB0aGUgVlJNXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBhc3luYyBfaW1wb3J0KFxyXG4gICAgZ2x0ZjogR0xURixcclxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCB8IG51bGwsXHJcbiAgICBleHByZXNzaW9uczogVlJNRXhwcmVzc2lvbk1hbmFnZXIgfCBudWxsLFxyXG4gICk6IFByb21pc2U8VlJNTG9va0F0IHwgbnVsbD4ge1xyXG4gICAgaWYgKGh1bWFub2lkID09IG51bGwgfHwgZXhwcmVzc2lvbnMgPT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCB2MVJlc3VsdCA9IGF3YWl0IHRoaXMuX3YxSW1wb3J0KGdsdGYsIGh1bWFub2lkLCBleHByZXNzaW9ucyk7XHJcbiAgICBpZiAodjFSZXN1bHQpIHtcclxuICAgICAgcmV0dXJuIHYxUmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHYwUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjBJbXBvcnQoZ2x0ZiwgaHVtYW5vaWQsIGV4cHJlc3Npb25zKTtcclxuICAgIGlmICh2MFJlc3VsdCkge1xyXG4gICAgICByZXR1cm4gdjBSZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIF92MUltcG9ydChcclxuICAgIGdsdGY6IEdMVEYsXHJcbiAgICBodW1hbm9pZDogVlJNSHVtYW5vaWQsXHJcbiAgICBleHByZXNzaW9uczogVlJNRXhwcmVzc2lvbk1hbmFnZXIsXHJcbiAgKTogUHJvbWlzZTxWUk1Mb29rQXQgfCBudWxsPiB7XHJcbiAgICBjb25zdCBqc29uID0gdGhpcy5wYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIC8vIGVhcmx5IGFib3J0IGlmIGl0IGRvZXNuJ3QgdXNlIHZybVxyXG4gICAgY29uc3QgaXNWUk1Vc2VkID0ganNvbi5leHRlbnNpb25zVXNlZD8uaW5kZXhPZignVlJNQ192cm0nKSAhPT0gLTE7XHJcbiAgICBpZiAoIWlzVlJNVXNlZCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LlsnVlJNQ192cm0nXSBhcyBWMVZSTVNjaGVtYS5WUk1DVlJNIHwgdW5kZWZpbmVkO1xyXG4gICAgaWYgKCFleHRlbnNpb24pIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3BlY1ZlcnNpb24gPSBleHRlbnNpb24uc3BlY1ZlcnNpb247XHJcbiAgICBpZiAoc3BlY1ZlcnNpb24gIT09ICcxLjAtYmV0YScpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc2NoZW1hTG9va0F0ID0gZXh0ZW5zaW9uLmxvb2tBdDtcclxuICAgIGlmICghc2NoZW1hTG9va0F0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGRlZmF1bHRPdXRwdXRTY2FsZSA9IHNjaGVtYUxvb2tBdC50eXBlID09PSAnZXhwcmVzc2lvbicgPyAxLjAgOiAxMC4wO1xyXG5cclxuICAgIGNvbnN0IG1hcEhJID0gdGhpcy5fdjFJbXBvcnRSYW5nZU1hcChzY2hlbWFMb29rQXQucmFuZ2VNYXBIb3Jpem9udGFsSW5uZXIsIGRlZmF1bHRPdXRwdXRTY2FsZSk7XHJcbiAgICBjb25zdCBtYXBITyA9IHRoaXMuX3YxSW1wb3J0UmFuZ2VNYXAoc2NoZW1hTG9va0F0LnJhbmdlTWFwSG9yaXpvbnRhbE91dGVyLCBkZWZhdWx0T3V0cHV0U2NhbGUpO1xyXG4gICAgY29uc3QgbWFwVkQgPSB0aGlzLl92MUltcG9ydFJhbmdlTWFwKHNjaGVtYUxvb2tBdC5yYW5nZU1hcFZlcnRpY2FsRG93biwgZGVmYXVsdE91dHB1dFNjYWxlKTtcclxuICAgIGNvbnN0IG1hcFZVID0gdGhpcy5fdjFJbXBvcnRSYW5nZU1hcChzY2hlbWFMb29rQXQucmFuZ2VNYXBWZXJ0aWNhbFVwLCBkZWZhdWx0T3V0cHV0U2NhbGUpO1xyXG5cclxuICAgIGxldCBhcHBsaWVyO1xyXG5cclxuICAgIGlmIChzY2hlbWFMb29rQXQudHlwZSA9PT0gJ2V4cHJlc3Npb24nKSB7XHJcbiAgICAgIGFwcGxpZXIgPSBuZXcgVlJNTG9va0F0RXhwcmVzc2lvbkFwcGxpZXIoZXhwcmVzc2lvbnMsIG1hcEhJLCBtYXBITywgbWFwVkQsIG1hcFZVKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGFwcGxpZXIgPSBuZXcgVlJNTG9va0F0Qm9uZUFwcGxpZXIoaHVtYW5vaWQsIG1hcEhJLCBtYXBITywgbWFwVkQsIG1hcFZVKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBsb29rQXQgPSB0aGlzLl9pbXBvcnRMb29rQXQoaHVtYW5vaWQsIGFwcGxpZXIpO1xyXG5cclxuICAgIGxvb2tBdC5vZmZzZXRGcm9tSGVhZEJvbmUuZnJvbUFycmF5KHNjaGVtYUxvb2tBdC5vZmZzZXRGcm9tSGVhZEJvbmUgPz8gWzAuMCwgMC4wNiwgMC4wXSk7XHJcblxyXG4gICAgcmV0dXJuIGxvb2tBdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3YxSW1wb3J0UmFuZ2VNYXAoXHJcbiAgICBzY2hlbWFSYW5nZU1hcDogVjFWUk1TY2hlbWEuTG9va0F0UmFuZ2VNYXAgfCB1bmRlZmluZWQsXHJcbiAgICBkZWZhdWx0T3V0cHV0U2NhbGU6IG51bWJlcixcclxuICApOiBWUk1Mb29rQXRSYW5nZU1hcCB7XHJcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdFJhbmdlTWFwKFxyXG4gICAgICBzY2hlbWFSYW5nZU1hcD8uaW5wdXRNYXhWYWx1ZSA/PyA5MC4wLFxyXG4gICAgICBzY2hlbWFSYW5nZU1hcD8ub3V0cHV0U2NhbGUgPz8gZGVmYXVsdE91dHB1dFNjYWxlLFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgX3YwSW1wb3J0KFxyXG4gICAgZ2x0ZjogR0xURixcclxuICAgIGh1bWFub2lkOiBWUk1IdW1hbm9pZCxcclxuICAgIGV4cHJlc3Npb25zOiBWUk1FeHByZXNzaW9uTWFuYWdlcixcclxuICApOiBQcm9taXNlPFZSTUxvb2tBdCB8IG51bGw+IHtcclxuICAgIGNvbnN0IGpzb24gPSB0aGlzLnBhcnNlci5qc29uIGFzIEdMVEZTY2hlbWEuSUdMVEY7XHJcblxyXG4gICAgLy8gZWFybHkgYWJvcnQgaWYgaXQgZG9lc24ndCB1c2UgdnJtXHJcbiAgICBjb25zdCB2cm1FeHQgPSBqc29uLmV4dGVuc2lvbnM/LlZSTSBhcyBWMFZSTS5WUk0gfCB1bmRlZmluZWQ7XHJcbiAgICBpZiAoIXZybUV4dCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzY2hlbWFGaXJzdFBlcnNvbiA9IHZybUV4dC5maXJzdFBlcnNvbjtcclxuICAgIGlmICghc2NoZW1hRmlyc3RQZXJzb24pIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZGVmYXVsdE91dHB1dFNjYWxlID0gc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VHlwZU5hbWUgPT09ICdCbGVuZFNoYXBlJyA/IDEuMCA6IDEwLjA7XHJcblxyXG4gICAgY29uc3QgbWFwSEkgPSB0aGlzLl92MEltcG9ydERlZ3JlZU1hcChzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRIb3Jpem9udGFsSW5uZXIsIGRlZmF1bHRPdXRwdXRTY2FsZSk7XHJcbiAgICBjb25zdCBtYXBITyA9IHRoaXMuX3YwSW1wb3J0RGVncmVlTWFwKHNjaGVtYUZpcnN0UGVyc29uLmxvb2tBdEhvcml6b250YWxPdXRlciwgZGVmYXVsdE91dHB1dFNjYWxlKTtcclxuICAgIGNvbnN0IG1hcFZEID0gdGhpcy5fdjBJbXBvcnREZWdyZWVNYXAoc2NoZW1hRmlyc3RQZXJzb24ubG9va0F0VmVydGljYWxEb3duLCBkZWZhdWx0T3V0cHV0U2NhbGUpO1xyXG4gICAgY29uc3QgbWFwVlUgPSB0aGlzLl92MEltcG9ydERlZ3JlZU1hcChzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRWZXJ0aWNhbFVwLCBkZWZhdWx0T3V0cHV0U2NhbGUpO1xyXG5cclxuICAgIGxldCBhcHBsaWVyO1xyXG5cclxuICAgIGlmIChzY2hlbWFGaXJzdFBlcnNvbi5sb29rQXRUeXBlTmFtZSA9PT0gJ0JsZW5kU2hhcGUnKSB7XHJcbiAgICAgIGFwcGxpZXIgPSBuZXcgVlJNTG9va0F0RXhwcmVzc2lvbkFwcGxpZXIoZXhwcmVzc2lvbnMsIG1hcEhJLCBtYXBITywgbWFwVkQsIG1hcFZVKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIGFwcGxpZXIgPSBuZXcgVlJNTG9va0F0Qm9uZUFwcGxpZXIoaHVtYW5vaWQsIG1hcEhJLCBtYXBITywgbWFwVkQsIG1hcFZVKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBsb29rQXQgPSB0aGlzLl9pbXBvcnRMb29rQXQoaHVtYW5vaWQsIGFwcGxpZXIpO1xyXG5cclxuICAgIGlmIChzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXQpIHtcclxuICAgICAgbG9va0F0Lm9mZnNldEZyb21IZWFkQm9uZS5zZXQoXHJcbiAgICAgICAgc2NoZW1hRmlyc3RQZXJzb24uZmlyc3RQZXJzb25Cb25lT2Zmc2V0LnggPz8gMC4wLFxyXG4gICAgICAgIHNjaGVtYUZpcnN0UGVyc29uLmZpcnN0UGVyc29uQm9uZU9mZnNldC55ID8/IDAuMDYsXHJcbiAgICAgICAgLShzY2hlbWFGaXJzdFBlcnNvbi5maXJzdFBlcnNvbkJvbmVPZmZzZXQueiA/PyAwLjApLFxyXG4gICAgICApO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgbG9va0F0Lm9mZnNldEZyb21IZWFkQm9uZS5zZXQoMC4wLCAwLjA2LCAwLjApO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIFZSTSAwLjAgYXJlIGZhY2luZyBaLSBpbnN0ZWFkIG9mIForXHJcbiAgICBsb29rQXQuZmFjZUZyb250LnNldCgwLjAsIDAuMCwgLTEuMCk7XHJcblxyXG4gICAgaWYgKGFwcGxpZXIgaW5zdGFuY2VvZiBWUk1Mb29rQXRCb25lQXBwbGllcikge1xyXG4gICAgICBhcHBsaWVyLmZhY2VGcm9udC5zZXQoMC4wLCAwLjAsIC0xLjApO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBsb29rQXQ7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF92MEltcG9ydERlZ3JlZU1hcChcclxuICAgIHNjaGVtYURlZ3JlZU1hcDogVjBWUk0uRmlyc3RQZXJzb25EZWdyZWVNYXAgfCB1bmRlZmluZWQsXHJcbiAgICBkZWZhdWx0T3V0cHV0U2NhbGU6IG51bWJlcixcclxuICApOiBWUk1Mb29rQXRSYW5nZU1hcCB7XHJcbiAgICBjb25zdCBjdXJ2ZSA9IHNjaGVtYURlZ3JlZU1hcD8uY3VydmU7XHJcbiAgICBpZiAoSlNPTi5zdHJpbmdpZnkoY3VydmUpICE9PSAnWzAsMCwwLDEsMSwxLDEsMF0nKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybignQ3VydmVzIG9mIExvb2tBdERlZ3JlZU1hcCBkZWZpbmVkIGluIFZSTSAwLjAgYXJlIG5vdCBzdXBwb3J0ZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbmV3IFZSTUxvb2tBdFJhbmdlTWFwKHNjaGVtYURlZ3JlZU1hcD8ueFJhbmdlID8/IDkwLjAsIHNjaGVtYURlZ3JlZU1hcD8ueVJhbmdlID8/IGRlZmF1bHRPdXRwdXRTY2FsZSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9pbXBvcnRMb29rQXQoaHVtYW5vaWQ6IFZSTUh1bWFub2lkLCBhcHBsaWVyOiBWUk1Mb29rQXRBcHBsaWVyKTogVlJNTG9va0F0IHtcclxuICAgIGNvbnN0IGxvb2tBdCA9IG5ldyBWUk1Mb29rQXQoaHVtYW5vaWQsIGFwcGxpZXIpO1xyXG5cclxuICAgIGlmICh0aGlzLmhlbHBlclJvb3QpIHtcclxuICAgICAgY29uc3QgaGVscGVyID0gbmV3IFZSTUxvb2tBdEhlbHBlcihsb29rQXQpO1xyXG4gICAgICB0aGlzLmhlbHBlclJvb3QuYWRkKGhlbHBlcik7XHJcbiAgICAgIGhlbHBlci5yZW5kZXJPcmRlciA9IHRoaXMuaGVscGVyUm9vdC5yZW5kZXJPcmRlcjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbG9va0F0O1xyXG4gIH1cclxufVxyXG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgdHlwZSBvZiBhcHBsaWVyLlxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IFZSTUxvb2tBdFR5cGVOYW1lID0ge1xyXG4gIEJvbmU6ICdib25lJyxcclxuICBFeHByZXNzaW9uOiAnZXhwcmVzc2lvbicsXHJcbn07XHJcblxyXG5leHBvcnQgdHlwZSBWUk1Mb29rQXRUeXBlTmFtZSA9IHR5cGVvZiBWUk1Mb29rQXRUeXBlTmFtZVtrZXlvZiB0eXBlb2YgVlJNTG9va0F0VHlwZU5hbWVdO1xyXG4iLCIvKipcbiAqIEV2YWx1YXRlIGEgaGVybWl0ZSBzcGxpbmUuXG4gKlxuICogQHBhcmFtIHkwIHkgb24gc3RhcnRcbiAqIEBwYXJhbSB5MSB5IG9uIGVuZFxuICogQHBhcmFtIHQwIGRlbHRhIHkgb24gc3RhcnRcbiAqIEBwYXJhbSB0MSBkZWx0YSB5IG9uIGVuZFxuICogQHBhcmFtIHggaW5wdXQgdmFsdWVcbiAqL1xuY29uc3QgaGVybWl0ZVNwbGluZSA9ICh5MDogbnVtYmVyLCB5MTogbnVtYmVyLCB0MDogbnVtYmVyLCB0MTogbnVtYmVyLCB4OiBudW1iZXIpOiBudW1iZXIgPT4ge1xuICBjb25zdCB4YyA9IHggKiB4ICogeDtcbiAgY29uc3QgeHMgPSB4ICogeDtcbiAgY29uc3QgZHkgPSB5MSAtIHkwO1xuICBjb25zdCBoMDEgPSAtMi4wICogeGMgKyAzLjAgKiB4cztcbiAgY29uc3QgaDEwID0geGMgLSAyLjAgKiB4cyArIHg7XG4gIGNvbnN0IGgxMSA9IHhjIC0geHM7XG4gIHJldHVybiB5MCArIGR5ICogaDAxICsgdDAgKiBoMTAgKyB0MSAqIGgxMTtcbn07XG5cbi8qKlxuICogRXZhbHVhdGUgYW4gQW5pbWF0aW9uQ3VydmUgYXJyYXkuIFNlZSBBbmltYXRpb25DdXJ2ZSBjbGFzcyBvZiBVbml0eSBmb3IgaXRzIGRldGFpbHMuXG4gKlxuICogU2VlOiBodHRwczovL2RvY3MudW5pdHkzZC5jb20vamEvY3VycmVudC9TY3JpcHRSZWZlcmVuY2UvQW5pbWF0aW9uQ3VydmUuaHRtbFxuICpcbiAqIEBwYXJhbSBhcnIgQW4gYXJyYXkgcmVwcmVzZW50cyBhIGN1cnZlXG4gKiBAcGFyYW0geCBBbiBpbnB1dCB2YWx1ZVxuICovXG5jb25zdCBldmFsdWF0ZUN1cnZlID0gKGFycjogbnVtYmVyW10sIHg6IG51bWJlcik6IG51bWJlciA9PiB7XG4gIC8vIC0tIHNhbml0eSBjaGVjayAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICBpZiAoYXJyLmxlbmd0aCA8IDgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2V2YWx1YXRlQ3VydmU6IEludmFsaWQgY3VydmUgZGV0ZWN0ZWQhIChBcnJheSBsZW5ndGggbXVzdCBiZSA4IGF0IGxlYXN0KScpO1xuICB9XG4gIGlmIChhcnIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcignZXZhbHVhdGVDdXJ2ZTogSW52YWxpZCBjdXJ2ZSBkZXRlY3RlZCEgKEFycmF5IGxlbmd0aCBtdXN0IGJlIG11bHRpcGxlcyBvZiA0Jyk7XG4gIH1cblxuICAvLyAtLSBjaGVjayByYW5nZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgbGV0IG91dE5vZGU7XG4gIGZvciAob3V0Tm9kZSA9IDA7IDsgb3V0Tm9kZSsrKSB7XG4gICAgaWYgKGFyci5sZW5ndGggPD0gNCAqIG91dE5vZGUpIHtcbiAgICAgIHJldHVybiBhcnJbNCAqIG91dE5vZGUgLSAzXTsgLy8gdG9vIGZ1cnRoZXIhISBhc3N1bWUgYXMgXCJDbGFtcFwiXG4gICAgfSBlbHNlIGlmICh4IDw9IGFycls0ICogb3V0Tm9kZV0pIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGluTm9kZSA9IG91dE5vZGUgLSAxO1xuICBpZiAoaW5Ob2RlIDwgMCkge1xuICAgIHJldHVybiBhcnJbNCAqIGluTm9kZSArIDVdOyAvLyB0b28gYmVoaW5kISEgYXNzdW1lIGFzIFwiQ2xhbXBcIlxuICB9XG5cbiAgLy8gLS0gY2FsY3VsYXRlIGxvY2FsIHggLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGNvbnN0IHgwID0gYXJyWzQgKiBpbk5vZGVdO1xuICBjb25zdCB4MSA9IGFycls0ICogb3V0Tm9kZV07XG4gIGNvbnN0IHhIZXJtaXRlID0gKHggLSB4MCkgLyAoeDEgLSB4MCk7XG5cbiAgLy8gLS0gZmluYWxseSBkbyB0aGUgaGVybWl0ZSBzcGxpbmUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gIGNvbnN0IHkwID0gYXJyWzQgKiBpbk5vZGUgKyAxXTtcbiAgY29uc3QgeTEgPSBhcnJbNCAqIG91dE5vZGUgKyAxXTtcbiAgY29uc3QgdDAgPSBhcnJbNCAqIGluTm9kZSArIDNdO1xuICBjb25zdCB0MSA9IGFycls0ICogb3V0Tm9kZSArIDJdO1xuICByZXR1cm4gaGVybWl0ZVNwbGluZSh5MCwgeTEsIHQwLCB0MSwgeEhlcm1pdGUpO1xufTtcblxuLyoqXG4gKiBUaGlzIGlzIGFuIGVxdWl2YWxlbnQgb2YgQ3VydmVNYXBwZXIgY2xhc3MgZGVmaW5lZCBpbiBVbmlWUk0uXG4gKiBXaWxsIGJlIHVzZWQgZm9yIFtbVlJNTG9va0F0QXBwbHllcl1dcywgdG8gZGVmaW5lIGJlaGF2aW9yIG9mIExvb2tBdC5cbiAqXG4gKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS92cm0tYy9VbmlWUk0vYmxvYi9tYXN0ZXIvQXNzZXRzL1ZSTS9VbmlWUk0vU2NyaXB0cy9Mb29rQXQvQ3VydmVNYXBwZXIuY3NcbiAqL1xuZXhwb3J0IGNsYXNzIFZSTUN1cnZlTWFwcGVyIHtcbiAgLyoqXG4gICAqIEFuIGFycmF5IHJlcHJlc2VudHMgdGhlIGN1cnZlLiBTZWUgQW5pbWF0aW9uQ3VydmUgY2xhc3Mgb2YgVW5pdHkgZm9yIGl0cyBkZXRhaWxzLlxuICAgKlxuICAgKiBTZWU6IGh0dHBzOi8vZG9jcy51bml0eTNkLmNvbS9qYS9jdXJyZW50L1NjcmlwdFJlZmVyZW5jZS9BbmltYXRpb25DdXJ2ZS5odG1sXG4gICAqL1xuICBwdWJsaWMgY3VydmU6IG51bWJlcltdID0gWzAuMCwgMC4wLCAwLjAsIDEuMCwgMS4wLCAxLjAsIDEuMCwgMC4wXTtcblxuICAvKipcbiAgICogVGhlIG1heGltdW0gaW5wdXQgcmFuZ2Ugb2YgdGhlIFtbVlJNQ3VydmVNYXBwZXJdXS5cbiAgICovXG4gIHB1YmxpYyBjdXJ2ZVhSYW5nZURlZ3JlZSA9IDkwLjA7XG5cbiAgLyoqXG4gICAqIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZSBvZiB0aGUgW1tWUk1DdXJ2ZU1hcHBlcl1dLlxuICAgKi9cbiAgcHVibGljIGN1cnZlWVJhbmdlRGVncmVlID0gMTAuMDtcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IFtbVlJNQ3VydmVNYXBwZXJdXS5cbiAgICpcbiAgICogQHBhcmFtIHhSYW5nZSBUaGUgbWF4aW11bSBpbnB1dCByYW5nZVxuICAgKiBAcGFyYW0geVJhbmdlIFRoZSBtYXhpbXVtIG91dHB1dCB2YWx1ZVxuICAgKiBAcGFyYW0gY3VydmUgQW4gYXJyYXkgcmVwcmVzZW50cyB0aGUgY3VydmVcbiAgICovXG4gIGNvbnN0cnVjdG9yKHhSYW5nZT86IG51bWJlciwgeVJhbmdlPzogbnVtYmVyLCBjdXJ2ZT86IG51bWJlcltdKSB7XG4gICAgaWYgKHhSYW5nZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmN1cnZlWFJhbmdlRGVncmVlID0geFJhbmdlO1xuICAgIH1cblxuICAgIGlmICh5UmFuZ2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jdXJ2ZVlSYW5nZURlZ3JlZSA9IHlSYW5nZTtcbiAgICB9XG5cbiAgICBpZiAoY3VydmUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5jdXJ2ZSA9IGN1cnZlO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBFdmFsdWF0ZSBhbiBpbnB1dCB2YWx1ZSBhbmQgb3V0cHV0IGEgbWFwcGVkIHZhbHVlLlxuICAgKlxuICAgKiBAcGFyYW0gc3JjIFRoZSBpbnB1dCB2YWx1ZVxuICAgKi9cbiAgcHVibGljIG1hcChzcmM6IG51bWJlcik6IG51bWJlciB7XG4gICAgY29uc3QgY2xhbXBlZFNyYyA9IE1hdGgubWluKE1hdGgubWF4KHNyYywgMC4wKSwgdGhpcy5jdXJ2ZVhSYW5nZURlZ3JlZSk7XG4gICAgY29uc3QgeCA9IGNsYW1wZWRTcmMgLyB0aGlzLmN1cnZlWFJhbmdlRGVncmVlO1xuICAgIHJldHVybiB0aGlzLmN1cnZlWVJhbmdlRGVncmVlICogZXZhbHVhdGVDdXJ2ZSh0aGlzLmN1cnZlLCB4KTtcbiAgfVxufVxuIiwiLyoqXHJcbiAqIFlvaW5rZWQgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2Jsb2IvbWFzdGVyL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanNcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZXNvbHZlVVJMKHVybDogc3RyaW5nLCBwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gIC8vIEludmFsaWQgVVJMXHJcbiAgaWYgKHR5cGVvZiB1cmwgIT09ICdzdHJpbmcnIHx8IHVybCA9PT0gJycpIHJldHVybiAnJztcclxuXHJcbiAgLy8gSG9zdCBSZWxhdGl2ZSBVUkxcclxuICBpZiAoL15odHRwcz86XFwvXFwvL2kudGVzdChwYXRoKSAmJiAvXlxcLy8udGVzdCh1cmwpKSB7XHJcbiAgICBwYXRoID0gcGF0aC5yZXBsYWNlKC8oXmh0dHBzPzpcXC9cXC9bXi9dKykuKi9pLCAnJDEnKTtcclxuICB9XHJcblxyXG4gIC8vIEFic29sdXRlIFVSTCBodHRwOi8vLGh0dHBzOi8vLC8vXHJcbiAgaWYgKC9eKGh0dHBzPzopP1xcL1xcLy9pLnRlc3QodXJsKSkgcmV0dXJuIHVybDtcclxuXHJcbiAgLy8gRGF0YSBVUklcclxuICBpZiAoL15kYXRhOi4qLC4qJC9pLnRlc3QodXJsKSkgcmV0dXJuIHVybDtcclxuXHJcbiAgLy8gQmxvYiBVUkxcclxuICBpZiAoL15ibG9iOi4qJC9pLnRlc3QodXJsKSkgcmV0dXJuIHVybDtcclxuXHJcbiAgLy8gUmVsYXRpdmUgVVJMXHJcbiAgcmV0dXJuIHBhdGggKyB1cmw7XHJcbn1cclxuIiwiaW1wb3J0IHR5cGUgeyBHTFRGLCBHTFRGTG9hZGVyUGx1Z2luLCBHTFRGUGFyc2VyIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XHJcbmltcG9ydCB0eXBlIHsgVlJNME1ldGEgfSBmcm9tICcuL1ZSTTBNZXRhJztcclxuaW1wb3J0IHR5cGUgeyBWUk0xTWV0YSB9IGZyb20gJy4vVlJNMU1ldGEnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTU1ldGEgfSBmcm9tICcuL1ZSTU1ldGEnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTU1ldGFMb2FkZXJQbHVnaW5PcHRpb25zIH0gZnJvbSAnLi9WUk1NZXRhTG9hZGVyUGx1Z2luT3B0aW9ucyc7XHJcbmltcG9ydCB0eXBlICogYXMgVjBWUk0gZnJvbSAnQHBpeGl2L3R5cGVzLXZybS0wLjAnO1xyXG5pbXBvcnQgdHlwZSAqIGFzIFYxVlJNU2NoZW1hIGZyb20gJ0BwaXhpdi90eXBlcy12cm1jLXZybS0xLjAnO1xyXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IHJlc29sdmVVUkwgfSBmcm9tICcuLi91dGlscy9yZXNvbHZlVVJMJztcclxuaW1wb3J0IHsgR0xURiBhcyBHTFRGU2NoZW1hIH0gZnJvbSAnQGdsdGYtdHJhbnNmb3JtL2NvcmUnO1xyXG5cclxuLyoqXHJcbiAqIEEgcGx1Z2luIG9mIEdMVEZMb2FkZXIgdGhhdCBpbXBvcnRzIGEge0BsaW5rIFZSTTFNZXRhfSBmcm9tIGEgVlJNIGV4dGVuc2lvbiBvZiBhIEdMVEYuXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNTWV0YUxvYWRlclBsdWdpbiBpbXBsZW1lbnRzIEdMVEZMb2FkZXJQbHVnaW4ge1xyXG4gIHB1YmxpYyByZWFkb25seSBwYXJzZXI6IEdMVEZQYXJzZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIElmIGBmYWxzZWAsIGl0IHdvbid0IGxvYWQgaXRzIHRodW1ibmFpbCBpbWFnZSAoe0BsaW5rIFZSTTFNZXRhLnRodW1ibmFpbEltYWdlfSkuXHJcbiAgICogYHRydWVgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgcHVibGljIG5lZWRUaHVtYm5haWxJbWFnZTogYm9vbGVhbjtcclxuXHJcbiAgLyoqXHJcbiAgICogQSBsaXN0IG9mIGxpY2Vuc2UgdXJscy5cclxuICAgKiBUaGlzIG1ldGEgbG9hZGVyIHdpbGwgYWNjZXB0IHRoZXNlIGBsaWNlbnNlVXJsYHMuXHJcbiAgICogT3RoZXJ3aXNlIGl0IHdvbid0IGJlIGxvYWRlZC5cclxuICAgKi9cclxuICBwdWJsaWMgYWNjZXB0TGljZW5zZVVybHM6IHN0cmluZ1tdO1xyXG5cclxuICAvKipcclxuICAgKiBXaGV0aGVyIGl0IHNob3VsZCBhY2NlcHQgVlJNMC4wIG1ldGEgb3Igbm90LlxyXG4gICAqIE5vdGUgdGhhdCBpdCBtaWdodCBsb2FkIHtAbGluayBWUk0wTWV0YX0gaW5zdGVhZCBvZiB7QGxpbmsgVlJNMU1ldGF9IHdoZW4gdGhpcyBpcyBgdHJ1ZWAuXHJcbiAgICogYHRydWVgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgcHVibGljIGFjY2VwdFYwTWV0YTogYm9vbGVhbjtcclxuXHJcbiAgcHVibGljIGdldCBuYW1lKCk6IHN0cmluZyB7XHJcbiAgICAvLyBXZSBzaG91bGQgdXNlIHRoZSBleHRlbnNpb24gbmFtZSBpbnN0ZWFkIGJ1dCB3ZSBoYXZlIG11bHRpcGxlIHBsdWdpbnMgZm9yIGFuIGV4dGVuc2lvbi4uLlxyXG4gICAgcmV0dXJuICdWUk1NZXRhTG9hZGVyUGx1Z2luJztcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihwYXJzZXI6IEdMVEZQYXJzZXIsIG9wdGlvbnM/OiBWUk1NZXRhTG9hZGVyUGx1Z2luT3B0aW9ucykge1xyXG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XHJcblxyXG4gICAgdGhpcy5uZWVkVGh1bWJuYWlsSW1hZ2UgPSBvcHRpb25zPy5uZWVkVGh1bWJuYWlsSW1hZ2UgPz8gdHJ1ZTtcclxuICAgIHRoaXMuYWNjZXB0TGljZW5zZVVybHMgPSBvcHRpb25zPy5hY2NlcHRMaWNlbnNlVXJscyA/PyBbJ2h0dHBzOi8vdnJtLmRldi9saWNlbnNlcy8xLjAvJ107XHJcbiAgICB0aGlzLmFjY2VwdFYwTWV0YSA9IG9wdGlvbnM/LmFjY2VwdFYwTWV0YSA/PyB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGFmdGVyUm9vdChnbHRmOiBHTFRGKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBnbHRmLnVzZXJEYXRhLnZybU1ldGEgPSBhd2FpdCB0aGlzLl9pbXBvcnQoZ2x0Zik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIF9pbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNTWV0YSB8IG51bGw+IHtcclxuICAgIGNvbnN0IHYxUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjFJbXBvcnQoZ2x0Zik7XHJcbiAgICBpZiAodjFSZXN1bHQgIT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gdjFSZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgdjBSZXN1bHQgPSBhd2FpdCB0aGlzLl92MEltcG9ydChnbHRmKTtcclxuICAgIGlmICh2MFJlc3VsdCAhPSBudWxsKSB7XHJcbiAgICAgIHJldHVybiB2MFJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gbnVsbDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgX3YxSW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTTFNZXRhIHwgbnVsbD4ge1xyXG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcclxuXHJcbiAgICAvLyBlYXJseSBhYm9ydCBpZiBpdCBkb2Vzbid0IHVzZSB2cm1cclxuICAgIGNvbnN0IGlzVlJNVXNlZCA9IGpzb24uZXh0ZW5zaW9uc1VzZWQ/LmluZGV4T2YoJ1ZSTUNfdnJtJykgIT09IC0xO1xyXG4gICAgaWYgKCFpc1ZSTVVzZWQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgZXh0ZW5zaW9uID0ganNvbi5leHRlbnNpb25zPy5bJ1ZSTUNfdnJtJ10gYXMgVjFWUk1TY2hlbWEuVlJNQ1ZSTSB8IHVuZGVmaW5lZDtcclxuICAgIGlmIChleHRlbnNpb24gPT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzcGVjVmVyc2lvbiA9IGV4dGVuc2lvbi5zcGVjVmVyc2lvbjtcclxuICAgIGlmIChzcGVjVmVyc2lvbiAhPT0gJzEuMC1iZXRhJykge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzY2hlbWFNZXRhID0gZXh0ZW5zaW9uLm1ldGE7XHJcbiAgICBpZiAoIXNjaGVtYU1ldGEpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gdGhyb3cgYW4gZXJyb3IgaWYgYWNjZXB0VjBNZXRhIGlzIGZhbHNlXHJcbiAgICBjb25zdCBsaWNlbnNlVXJsID0gc2NoZW1hTWV0YS5saWNlbnNlVXJsO1xyXG4gICAgY29uc3QgYWNjZXB0TGljZW5zZVVybHNTZXQgPSBuZXcgU2V0KHRoaXMuYWNjZXB0TGljZW5zZVVybHMpO1xyXG4gICAgaWYgKCFhY2NlcHRMaWNlbnNlVXJsc1NldC5oYXMobGljZW5zZVVybCkpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBWUk1NZXRhTG9hZGVyUGx1Z2luOiBUaGUgbGljZW5zZSB1cmwgXCIke2xpY2Vuc2VVcmx9XCIgaXMgbm90IGFjY2VwdGVkYCk7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHRodW1ibmFpbEltYWdlOiBIVE1MSW1hZ2VFbGVtZW50IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xyXG4gICAgaWYgKHRoaXMubmVlZFRodW1ibmFpbEltYWdlICYmIHNjaGVtYU1ldGEudGh1bWJuYWlsSW1hZ2UgIT0gbnVsbCkge1xyXG4gICAgICB0aHVtYm5haWxJbWFnZSA9IChhd2FpdCB0aGlzLl9leHRyYWN0R0xURkltYWdlKHNjaGVtYU1ldGEudGh1bWJuYWlsSW1hZ2UpKSA/PyB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgbWV0YVZlcnNpb246ICcxJyxcclxuICAgICAgbmFtZTogc2NoZW1hTWV0YS5uYW1lLFxyXG4gICAgICB2ZXJzaW9uOiBzY2hlbWFNZXRhLnZlcnNpb24sXHJcbiAgICAgIGF1dGhvcnM6IHNjaGVtYU1ldGEuYXV0aG9ycyxcclxuICAgICAgY29weXJpZ2h0SW5mb3JtYXRpb246IHNjaGVtYU1ldGEuY29weXJpZ2h0SW5mb3JtYXRpb24sXHJcbiAgICAgIGNvbnRhY3RJbmZvcm1hdGlvbjogc2NoZW1hTWV0YS5jb250YWN0SW5mb3JtYXRpb24sXHJcbiAgICAgIHJlZmVyZW5jZXM6IHNjaGVtYU1ldGEucmVmZXJlbmNlcyxcclxuICAgICAgdGhpcmRQYXJ0eUxpY2Vuc2VzOiBzY2hlbWFNZXRhLnRoaXJkUGFydHlMaWNlbnNlcyxcclxuICAgICAgdGh1bWJuYWlsSW1hZ2UsXHJcbiAgICAgIGxpY2Vuc2VVcmw6IHNjaGVtYU1ldGEubGljZW5zZVVybCxcclxuICAgICAgYXZhdGFyUGVybWlzc2lvbjogc2NoZW1hTWV0YS5hdmF0YXJQZXJtaXNzaW9uLFxyXG4gICAgICBhbGxvd0V4Y2Vzc2l2ZWx5VmlvbGVudFVzYWdlOiBzY2hlbWFNZXRhLmFsbG93RXhjZXNzaXZlbHlWaW9sZW50VXNhZ2UsXHJcbiAgICAgIGFsbG93RXhjZXNzaXZlbHlTZXh1YWxVc2FnZTogc2NoZW1hTWV0YS5hbGxvd0V4Y2Vzc2l2ZWx5U2V4dWFsVXNhZ2UsXHJcbiAgICAgIGNvbW1lcmNpYWxVc2FnZTogc2NoZW1hTWV0YS5jb21tZXJjaWFsVXNhZ2UsXHJcbiAgICAgIGFsbG93UG9saXRpY2FsT3JSZWxpZ2lvdXNVc2FnZTogc2NoZW1hTWV0YS5hbGxvd1BvbGl0aWNhbE9yUmVsaWdpb3VzVXNhZ2UsXHJcbiAgICAgIGFsbG93QW50aXNvY2lhbE9ySGF0ZVVzYWdlOiBzY2hlbWFNZXRhLmFsbG93QW50aXNvY2lhbE9ySGF0ZVVzYWdlLFxyXG4gICAgICBjcmVkaXROb3RhdGlvbjogc2NoZW1hTWV0YS5jcmVkaXROb3RhdGlvbixcclxuICAgICAgYWxsb3dSZWRpc3RyaWJ1dGlvbjogc2NoZW1hTWV0YS5hbGxvd1JlZGlzdHJpYnV0aW9uLFxyXG4gICAgICBtb2RpZmljYXRpb246IHNjaGVtYU1ldGEubW9kaWZpY2F0aW9uLFxyXG4gICAgICBvdGhlckxpY2Vuc2VVcmw6IHNjaGVtYU1ldGEub3RoZXJMaWNlbnNlVXJsLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgX3YwSW1wb3J0KGdsdGY6IEdMVEYpOiBQcm9taXNlPFZSTTBNZXRhIHwgbnVsbD4ge1xyXG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcclxuXHJcbiAgICAvLyBlYXJseSBhYm9ydCBpZiBpdCBkb2Vzbid0IHVzZSB2cm1cclxuICAgIGNvbnN0IHZybUV4dCA9IGpzb24uZXh0ZW5zaW9ucz8uVlJNIGFzIFYwVlJNLlZSTSB8IHVuZGVmaW5lZDtcclxuICAgIGlmICghdnJtRXh0KSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNjaGVtYU1ldGEgPSB2cm1FeHQubWV0YTtcclxuICAgIGlmICghc2NoZW1hTWV0YSkge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvLyB0aHJvdyBhbiBlcnJvciBpZiBhY2NlcHRWME1ldGEgaXMgZmFsc2VcclxuICAgIGlmICghdGhpcy5hY2NlcHRWME1ldGEpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdWUk1NZXRhTG9hZGVyUGx1Z2luOiBBdHRlbXB0ZWQgdG8gbG9hZCBWUk0wLjAgbWV0YSBidXQgYWNjZXB0VjBNZXRhIGlzIGZhbHNlJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbG9hZCB0aHVtYm5haWwgdGV4dHVyZVxyXG4gICAgbGV0IHRleHR1cmU6IFRIUkVFLlRleHR1cmUgfCBudWxsIHwgdW5kZWZpbmVkO1xyXG4gICAgaWYgKHRoaXMubmVlZFRodW1ibmFpbEltYWdlICYmIHNjaGVtYU1ldGEudGV4dHVyZSAhPSBudWxsICYmIHNjaGVtYU1ldGEudGV4dHVyZSAhPT0gLTEpIHtcclxuICAgICAgdGV4dHVyZSA9IGF3YWl0IHRoaXMucGFyc2VyLmdldERlcGVuZGVuY3koJ3RleHR1cmUnLCBzY2hlbWFNZXRhLnRleHR1cmUpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIG1ldGFWZXJzaW9uOiAnMCcsXHJcbiAgICAgIGFsbG93ZWRVc2VyTmFtZTogc2NoZW1hTWV0YS5hbGxvd2VkVXNlck5hbWUsXHJcbiAgICAgIGF1dGhvcjogc2NoZW1hTWV0YS5hdXRob3IsXHJcbiAgICAgIGNvbW1lcmNpYWxVc3NhZ2VOYW1lOiBzY2hlbWFNZXRhLmNvbW1lcmNpYWxVc3NhZ2VOYW1lLFxyXG4gICAgICBjb250YWN0SW5mb3JtYXRpb246IHNjaGVtYU1ldGEuY29udGFjdEluZm9ybWF0aW9uLFxyXG4gICAgICBsaWNlbnNlTmFtZTogc2NoZW1hTWV0YS5saWNlbnNlTmFtZSxcclxuICAgICAgb3RoZXJMaWNlbnNlVXJsOiBzY2hlbWFNZXRhLm90aGVyTGljZW5zZVVybCxcclxuICAgICAgb3RoZXJQZXJtaXNzaW9uVXJsOiBzY2hlbWFNZXRhLm90aGVyUGVybWlzc2lvblVybCxcclxuICAgICAgcmVmZXJlbmNlOiBzY2hlbWFNZXRhLnJlZmVyZW5jZSxcclxuICAgICAgc2V4dWFsVXNzYWdlTmFtZTogc2NoZW1hTWV0YS5zZXh1YWxVc3NhZ2VOYW1lLFxyXG4gICAgICB0ZXh0dXJlOiB0ZXh0dXJlID8/IHVuZGVmaW5lZCxcclxuICAgICAgdGl0bGU6IHNjaGVtYU1ldGEudGl0bGUsXHJcbiAgICAgIHZlcnNpb246IHNjaGVtYU1ldGEudmVyc2lvbixcclxuICAgICAgdmlvbGVudFVzc2FnZU5hbWU6IHNjaGVtYU1ldGEudmlvbGVudFVzc2FnZU5hbWUsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBfZXh0cmFjdEdMVEZJbWFnZShpbmRleDogbnVtYmVyKTogUHJvbWlzZTxIVE1MSW1hZ2VFbGVtZW50IHwgbnVsbD4ge1xyXG4gICAgY29uc3QganNvbiA9IHRoaXMucGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcclxuXHJcbiAgICBjb25zdCBzb3VyY2UgPSBqc29uLmltYWdlcz8uW2luZGV4XTtcclxuXHJcbiAgICBpZiAoc291cmNlID09IG51bGwpIHtcclxuICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgIGBWUk1NZXRhTG9hZGVyUGx1Z2luOiBBdHRlbXB0IHRvIHVzZSBpbWFnZXNbJHtpbmRleH1dIG9mIGdsVEYgYXMgYSB0aHVtYm5haWwgYnV0IHRoZSBpbWFnZSBkb2Vzbid0IGV4aXN0YCxcclxuICAgICAgKTtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gUmVmOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2Jsb2IvcjEyNC9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzI0wyNDY3XHJcblxyXG4gICAgLy8gYHNvdXJjZS51cmlgIG1pZ2h0IGJlIGEgcmVmZXJlbmNlIHRvIGEgZmlsZVxyXG4gICAgbGV0IHNvdXJjZVVSSTogc3RyaW5nIHwgdW5kZWZpbmVkID0gc291cmNlLnVyaTtcclxuXHJcbiAgICAvLyBMb2FkIHRoZSBiaW5hcnkgYXMgYSBibG9iXHJcbiAgICBpZiAoc291cmNlLmJ1ZmZlclZpZXcgIT0gbnVsbCkge1xyXG4gICAgICBjb25zdCBidWZmZXJWaWV3ID0gYXdhaXQgdGhpcy5wYXJzZXIuZ2V0RGVwZW5kZW5jeSgnYnVmZmVyVmlldycsIHNvdXJjZS5idWZmZXJWaWV3KTtcclxuICAgICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKFtidWZmZXJWaWV3XSwgeyB0eXBlOiBzb3VyY2UubWltZVR5cGUgfSk7XHJcbiAgICAgIHNvdXJjZVVSSSA9IFVSTC5jcmVhdGVPYmplY3RVUkwoYmxvYik7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNvdXJjZVVSSSA9PSBudWxsKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybihcclxuICAgICAgICBgVlJNTWV0YUxvYWRlclBsdWdpbjogQXR0ZW1wdCB0byB1c2UgaW1hZ2VzWyR7aW5kZXh9XSBvZiBnbFRGIGFzIGEgdGh1bWJuYWlsIGJ1dCB0aGUgaW1hZ2UgY291bGRuJ3QgbG9hZCBwcm9wZXJseWAsXHJcbiAgICAgICk7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGxvYWRlciA9IG5ldyBUSFJFRS5JbWFnZUxvYWRlcigpO1xyXG4gICAgcmV0dXJuIGF3YWl0IGxvYWRlci5sb2FkQXN5bmMocmVzb2x2ZVVSTChzb3VyY2VVUkksICh0aGlzLnBhcnNlciBhcyBhbnkpLm9wdGlvbnMucGF0aCkpLmNhdGNoKChlcnJvcikgPT4ge1xyXG4gICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgY29uc29sZS53YXJuKCdWUk1NZXRhTG9hZGVyUGx1Z2luOiBGYWlsZWQgdG8gbG9hZCBhIHRodW1ibmFpbCBpbWFnZScpO1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTUV4cHJlc3Npb25NYW5hZ2VyIH0gZnJvbSAnLi9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uTWFuYWdlcic7XHJcbmltcG9ydCB7IFZSTUZpcnN0UGVyc29uIH0gZnJvbSAnLi9maXJzdFBlcnNvbi9WUk1GaXJzdFBlcnNvbic7XHJcbmltcG9ydCB7IFZSTUh1bWFub2lkIH0gZnJvbSAnLi9odW1hbm9pZC9WUk1IdW1hbm9pZCc7XHJcbmltcG9ydCB7IFZSTUxvb2tBdCB9IGZyb20gJy4vbG9va0F0L1ZSTUxvb2tBdCc7XHJcbmltcG9ydCB7IFZSTU1ldGEgfSBmcm9tICcuL21ldGEvVlJNTWV0YSc7XHJcbmltcG9ydCB7IFZSTUNvcmVQYXJhbWV0ZXJzIH0gZnJvbSAnLi9WUk1Db3JlUGFyYW1ldGVycyc7XHJcblxyXG4vKipcclxuICogQSBjbGFzcyB0aGF0IHJlcHJlc2VudHMgYSBzaW5nbGUgVlJNIG1vZGVsLlxyXG4gKiBUaGlzIGNsYXNzIG9ubHkgaW5jbHVkZXMgY29yZSBzcGVjIG9mIHRoZSBWUk0gKGBWUk1DX3ZybWApLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTUNvcmUge1xyXG4gIC8qKlxyXG4gICAqIGBUSFJFRS5Hcm91cGAgdGhhdCBjb250YWlucyB0aGUgZW50aXJlIFZSTS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgc2NlbmU6IFRIUkVFLkdyb3VwO1xyXG5cclxuICAvKipcclxuICAgKiBDb250YWlucyBtZXRhIGZpZWxkcyBvZiB0aGUgVlJNLlxyXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIHJlZmVyIHRoZXNlIGxpY2Vuc2UgZmllbGRzIGJlZm9yZSB1c2UgeW91ciBWUk1zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBtZXRhOiBWUk1NZXRhO1xyXG5cclxuICAvKipcclxuICAgKiBDb250YWlucyB7QGxpbmsgVlJNSHVtYW5vaWR9IG9mIHRoZSBWUk0uXHJcbiAgICogWW91IGNhbiBjb250cm9sIGVhY2ggYm9uZXMgdXNpbmcge0BsaW5rIFZSTUh1bWFub2lkLmdldE5vcm1hbGl6ZWRCb25lTm9kZX0gb3Ige0BsaW5rIFZSTUh1bWFub2lkLmdldFJhd0JvbmVOb2RlfS5cclxuICAgKlxyXG4gICAqIEBUT0RPIEFkZCBhIGxpbmsgdG8gVlJNIHNwZWNcclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgaHVtYW5vaWQ6IFZSTUh1bWFub2lkO1xyXG5cclxuICAvKipcclxuICAgKiBDb250YWlucyB7QGxpbmsgVlJNRXhwcmVzc2lvbk1hbmFnZXJ9IG9mIHRoZSBWUk0uXHJcbiAgICogWW91IG1pZ2h0IHdhbnQgdG8gY29udHJvbCB0aGVzZSBmYWNpYWwgZXhwcmVzc2lvbnMgdmlhIHtAbGluayBWUk1FeHByZXNzaW9uTWFuYWdlci5zZXRWYWx1ZX0uXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IGV4cHJlc3Npb25NYW5hZ2VyPzogVlJNRXhwcmVzc2lvbk1hbmFnZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIENvbnRhaW5zIHtAbGluayBWUk1GaXJzdFBlcnNvbn0gb2YgdGhlIFZSTS5cclxuICAgKiBWUk1GaXJzdFBlcnNvbiBpcyBtb3N0bHkgdXNlZCBmb3IgbWVzaCBjdWxsaW5nIGZvciBmaXJzdCBwZXJzb24gdmlldy5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgZmlyc3RQZXJzb24/OiBWUk1GaXJzdFBlcnNvbjtcclxuXHJcbiAgLyoqXHJcbiAgICogQ29udGFpbnMge0BsaW5rIFZSTUxvb2tBdH0gb2YgdGhlIFZSTS5cclxuICAgKiBZb3UgbWlnaHQgd2FudCB0byB1c2Uge0BsaW5rIFZSTUxvb2tBdC50YXJnZXR9IHRvIGNvbnRyb2wgdGhlIGV5ZSBkaXJlY3Rpb24gb2YgeW91ciBWUk1zLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZWFkb25seSBsb29rQXQ/OiBWUk1Mb29rQXQ7XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG5ldyBWUk0gaW5zdGFuY2UuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gcGFyYW1zIFtbVlJNUGFyYW1ldGVyc11dIHRoYXQgcmVwcmVzZW50cyBjb21wb25lbnRzIG9mIHRoZSBWUk1cclxuICAgKi9cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyYW1zOiBWUk1Db3JlUGFyYW1ldGVycykge1xyXG4gICAgdGhpcy5zY2VuZSA9IHBhcmFtcy5zY2VuZTtcclxuICAgIHRoaXMubWV0YSA9IHBhcmFtcy5tZXRhO1xyXG4gICAgdGhpcy5odW1hbm9pZCA9IHBhcmFtcy5odW1hbm9pZDtcclxuICAgIHRoaXMuZXhwcmVzc2lvbk1hbmFnZXIgPSBwYXJhbXMuZXhwcmVzc2lvbk1hbmFnZXI7XHJcbiAgICB0aGlzLmZpcnN0UGVyc29uID0gcGFyYW1zLmZpcnN0UGVyc29uO1xyXG4gICAgdGhpcy5sb29rQXQgPSBwYXJhbXMubG9va0F0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogKipZb3UgbmVlZCB0byBjYWxsIHRoaXMgb24geW91ciB1cGRhdGUgbG9vcC4qKlxyXG4gICAqXHJcbiAgICogVGhpcyBmdW5jdGlvbiB1cGRhdGVzIGV2ZXJ5IFZSTSBjb21wb25lbnRzLlxyXG4gICAqXHJcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxyXG4gICAqL1xyXG4gIHB1YmxpYyB1cGRhdGUoZGVsdGE6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy5odW1hbm9pZC51cGRhdGUoKTtcclxuXHJcbiAgICBpZiAodGhpcy5sb29rQXQpIHtcclxuICAgICAgdGhpcy5sb29rQXQudXBkYXRlKGRlbHRhKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAodGhpcy5leHByZXNzaW9uTWFuYWdlcikge1xyXG4gICAgICB0aGlzLmV4cHJlc3Npb25NYW5hZ2VyLnVwZGF0ZSgpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgeyBHTFRGLCBHTFRGTG9hZGVyUGx1Z2luLCBHTFRGUGFyc2VyIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XHJcbmltcG9ydCB7IFZSTUNvcmVMb2FkZXJQbHVnaW5PcHRpb25zIH0gZnJvbSAnLi9WUk1Db3JlTG9hZGVyUGx1Z2luT3B0aW9ucyc7XHJcbmltcG9ydCB7IFZSTUNvcmUgfSBmcm9tICcuL1ZSTUNvcmUnO1xyXG5pbXBvcnQgeyBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luIH0gZnJvbSAnLi9leHByZXNzaW9ucy9WUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luJztcclxuaW1wb3J0IHsgVlJNRmlyc3RQZXJzb25Mb2FkZXJQbHVnaW4gfSBmcm9tICcuL2ZpcnN0UGVyc29uL1ZSTUZpcnN0UGVyc29uTG9hZGVyUGx1Z2luJztcclxuaW1wb3J0IHsgVlJNSHVtYW5vaWRMb2FkZXJQbHVnaW4gfSBmcm9tICcuL2h1bWFub2lkL1ZSTUh1bWFub2lkTG9hZGVyUGx1Z2luJztcclxuaW1wb3J0IHsgVlJNTWV0YUxvYWRlclBsdWdpbiB9IGZyb20gJy4vbWV0YS9WUk1NZXRhTG9hZGVyUGx1Z2luJztcclxuaW1wb3J0IHsgVlJNTG9va0F0TG9hZGVyUGx1Z2luIH0gZnJvbSAnLi9sb29rQXQvVlJNTG9va0F0TG9hZGVyUGx1Z2luJztcclxuaW1wb3J0IHR5cGUgeyBWUk1IdW1hbm9pZCB9IGZyb20gJy4vaHVtYW5vaWQnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTU1ldGEgfSBmcm9tICcuL21ldGEnO1xyXG5cclxuZXhwb3J0IGNsYXNzIFZSTUNvcmVMb2FkZXJQbHVnaW4gaW1wbGVtZW50cyBHTFRGTG9hZGVyUGx1Z2luIHtcclxuICBwdWJsaWMgZ2V0IG5hbWUoKTogc3RyaW5nIHtcclxuICAgIC8vIFdlIHNob3VsZCB1c2UgdGhlIGV4dGVuc2lvbiBuYW1lIGluc3RlYWQgYnV0IHdlIGhhdmUgbXVsdGlwbGUgcGx1Z2lucyBmb3IgYW4gZXh0ZW5zaW9uLi4uXHJcbiAgICByZXR1cm4gJ1ZSTUNfdnJtJztcclxuICB9XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBwYXJzZXI6IEdMVEZQYXJzZXI7XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBleHByZXNzaW9uUGx1Z2luOiBWUk1FeHByZXNzaW9uTG9hZGVyUGx1Z2luO1xyXG4gIHB1YmxpYyByZWFkb25seSBmaXJzdFBlcnNvblBsdWdpbjogVlJNRmlyc3RQZXJzb25Mb2FkZXJQbHVnaW47XHJcbiAgcHVibGljIHJlYWRvbmx5IGh1bWFub2lkUGx1Z2luOiBWUk1IdW1hbm9pZExvYWRlclBsdWdpbjtcclxuICBwdWJsaWMgcmVhZG9ubHkgbG9va0F0UGx1Z2luOiBWUk1Mb29rQXRMb2FkZXJQbHVnaW47XHJcbiAgcHVibGljIHJlYWRvbmx5IG1ldGFQbHVnaW46IFZSTU1ldGFMb2FkZXJQbHVnaW47XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihwYXJzZXI6IEdMVEZQYXJzZXIsIG9wdGlvbnM/OiBWUk1Db3JlTG9hZGVyUGx1Z2luT3B0aW9ucykge1xyXG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XHJcblxyXG4gICAgY29uc3QgaGVscGVyUm9vdCA9IG9wdGlvbnM/LmhlbHBlclJvb3Q7XHJcbiAgICBjb25zdCBhdXRvVXBkYXRlSHVtYW5Cb25lcyA9IG9wdGlvbnM/LmF1dG9VcGRhdGVIdW1hbkJvbmVzO1xyXG5cclxuICAgIHRoaXMuZXhwcmVzc2lvblBsdWdpbiA9IG9wdGlvbnM/LmV4cHJlc3Npb25QbHVnaW4gPz8gbmV3IFZSTUV4cHJlc3Npb25Mb2FkZXJQbHVnaW4ocGFyc2VyKTtcclxuICAgIHRoaXMuZmlyc3RQZXJzb25QbHVnaW4gPSBvcHRpb25zPy5maXJzdFBlcnNvblBsdWdpbiA/PyBuZXcgVlJNRmlyc3RQZXJzb25Mb2FkZXJQbHVnaW4ocGFyc2VyKTtcclxuICAgIHRoaXMuaHVtYW5vaWRQbHVnaW4gPVxyXG4gICAgICBvcHRpb25zPy5odW1hbm9pZFBsdWdpbiA/PyBuZXcgVlJNSHVtYW5vaWRMb2FkZXJQbHVnaW4ocGFyc2VyLCB7IGhlbHBlclJvb3QsIGF1dG9VcGRhdGVIdW1hbkJvbmVzIH0pO1xyXG4gICAgdGhpcy5sb29rQXRQbHVnaW4gPSBvcHRpb25zPy5sb29rQXRQbHVnaW4gPz8gbmV3IFZSTUxvb2tBdExvYWRlclBsdWdpbihwYXJzZXIsIHsgaGVscGVyUm9vdCB9KTtcclxuICAgIHRoaXMubWV0YVBsdWdpbiA9IG9wdGlvbnM/Lm1ldGFQbHVnaW4gPz8gbmV3IFZSTU1ldGFMb2FkZXJQbHVnaW4ocGFyc2VyKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBhZnRlclJvb3QoZ2x0ZjogR0xURik6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgYXdhaXQgdGhpcy5tZXRhUGx1Z2luLmFmdGVyUm9vdChnbHRmKTtcclxuICAgIGF3YWl0IHRoaXMuaHVtYW5vaWRQbHVnaW4uYWZ0ZXJSb290KGdsdGYpO1xyXG4gICAgYXdhaXQgdGhpcy5leHByZXNzaW9uUGx1Z2luLmFmdGVyUm9vdChnbHRmKTtcclxuICAgIGF3YWl0IHRoaXMubG9va0F0UGx1Z2luLmFmdGVyUm9vdChnbHRmKTtcclxuICAgIGF3YWl0IHRoaXMuZmlyc3RQZXJzb25QbHVnaW4uYWZ0ZXJSb290KGdsdGYpO1xyXG5cclxuICAgIGNvbnN0IG1ldGEgPSBnbHRmLnVzZXJEYXRhLnZybU1ldGEgYXMgVlJNTWV0YSB8IG51bGw7XHJcbiAgICBjb25zdCBodW1hbm9pZCA9IGdsdGYudXNlckRhdGEudnJtSHVtYW5vaWQgYXMgVlJNSHVtYW5vaWQgfCBudWxsO1xyXG5cclxuICAgIC8vIG1ldGEgYW5kIGh1bWFub2lkIGFyZSByZXF1aXJlZCB0byBiZSBhIFZSTS5cclxuICAgIC8vIERvbid0IGNyZWF0ZSBWUk0gaWYgdGhleSBhcmUgbnVsbFxyXG4gICAgaWYgKG1ldGEgJiYgaHVtYW5vaWQpIHtcclxuICAgICAgY29uc3QgdnJtQ29yZSA9IG5ldyBWUk1Db3JlKHtcclxuICAgICAgICBzY2VuZTogZ2x0Zi5zY2VuZSxcclxuICAgICAgICBleHByZXNzaW9uTWFuYWdlcjogZ2x0Zi51c2VyRGF0YS52cm1FeHByZXNzaW9uTWFuYWdlcixcclxuICAgICAgICBmaXJzdFBlcnNvbjogZ2x0Zi51c2VyRGF0YS52cm1GaXJzdFBlcnNvbixcclxuICAgICAgICBodW1hbm9pZCxcclxuICAgICAgICBsb29rQXQ6IGdsdGYudXNlckRhdGEudnJtTG9va0F0LFxyXG4gICAgICAgIG1ldGEsXHJcbiAgICAgIH0pO1xyXG5cclxuICAgICAgZ2x0Zi51c2VyRGF0YS52cm1Db3JlID0gdnJtQ29yZTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl0sIm5hbWVzIjpbIl92M0EiLCJfdjNCIiwiX3F1YXRBIiwiX3F1YXRCIiwiVkVDM19QT1NJVElWRV9aIiwiX2V1bGVyQSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUlBO0FBQ0E7TUFDYSxhQUFjLFNBQVEsS0FBSyxDQUFDLFFBQVE7SUE0RS9DLFlBQVksY0FBc0I7UUFDaEMsS0FBSyxFQUFFLENBQUM7Ozs7UUFuRUgsV0FBTSxHQUFHLEdBQUcsQ0FBQzs7OztRQUtiLGFBQVEsR0FBRyxLQUFLLENBQUM7Ozs7UUFLakIsa0JBQWEsR0FBOEIsTUFBTSxDQUFDOzs7O1FBS2xELG1CQUFjLEdBQThCLE1BQU0sQ0FBQzs7OztRQUtuRCxrQkFBYSxHQUE4QixNQUFNLENBQUM7UUFFakQsV0FBTSxHQUF3QixFQUFFLENBQUM7UUErQ3ZDLElBQUksQ0FBQyxJQUFJLEdBQUcsaUJBQWlCLGNBQWMsRUFBRSxDQUFDO1FBQzlDLElBQUksQ0FBQyxjQUFjLEdBQUcsY0FBYyxDQUFDOztRQUdyQyxJQUFJLENBQUMsSUFBSSxHQUFHLGVBQWUsQ0FBQzs7O1FBRzVCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO0tBQ3RCOzs7OztJQWpERCxJQUFXLG1CQUFtQjtRQUM1QixJQUFJLElBQUksQ0FBQyxhQUFhLEtBQUssT0FBTyxFQUFFO1lBQ2xDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxNQUFNLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztTQUN0QzthQUFNLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxPQUFPLEVBQUU7WUFDekMsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDO1NBQ3BCO2FBQU07WUFDTCxPQUFPLEdBQUcsQ0FBQztTQUNaO0tBQ0Y7Ozs7O0lBTUQsSUFBVyxvQkFBb0I7UUFDN0IsSUFBSSxJQUFJLENBQUMsY0FBYyxLQUFLLE9BQU8sRUFBRTtZQUNuQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7U0FDdEM7YUFBTSxJQUFJLElBQUksQ0FBQyxjQUFjLEtBQUssT0FBTyxFQUFFO1lBQzFDLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztTQUNwQjthQUFNO1lBQ0wsT0FBTyxHQUFHLENBQUM7U0FDWjtLQUNGOzs7OztJQU1ELElBQVcsbUJBQW1CO1FBQzVCLElBQUksSUFBSSxDQUFDLGFBQWEsS0FBSyxPQUFPLEVBQUU7WUFDbEMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLE1BQU0sR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO1NBQ3RDO2FBQU0sSUFBSSxJQUFJLENBQUMsYUFBYSxLQUFLLE9BQU8sRUFBRTtZQUN6QyxPQUFPLElBQUksQ0FBQyxNQUFNLENBQUM7U0FDcEI7YUFBTTtZQUNMLE9BQU8sR0FBRyxDQUFDO1NBQ1o7S0FDRjtJQWVNLE9BQU8sQ0FBQyxJQUF1QjtRQUNwQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztLQUN4Qjs7Ozs7SUFNTSxXQUFXLENBQUMsT0FPbEI7O1FBQ0MsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLFFBQVEsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDbkYsWUFBWSxVQUFJLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxVQUFVLG1DQUFJLEdBQUcsQ0FBQztRQUUzQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7S0FDL0Q7Ozs7SUFLTSxrQkFBa0I7UUFDdkIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUMsQ0FBQztLQUMxRDs7O0FDMUhIO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUF1REE7QUFDTyxTQUFTLFNBQVMsQ0FBQyxPQUFPLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxTQUFTLEVBQUU7QUFDN0QsSUFBSSxTQUFTLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxPQUFPLEtBQUssWUFBWSxDQUFDLEdBQUcsS0FBSyxHQUFHLElBQUksQ0FBQyxDQUFDLFVBQVUsT0FBTyxFQUFFLEVBQUUsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEVBQUU7QUFDaEgsSUFBSSxPQUFPLEtBQUssQ0FBQyxLQUFLLENBQUMsR0FBRyxPQUFPLENBQUMsRUFBRSxVQUFVLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDL0QsUUFBUSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ25HLFFBQVEsU0FBUyxRQUFRLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFO0FBQ3RHLFFBQVEsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsTUFBTSxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxFQUFFO0FBQ3RILFFBQVEsSUFBSSxDQUFDLENBQUMsU0FBUyxHQUFHLFNBQVMs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
