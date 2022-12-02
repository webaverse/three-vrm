/*!
 * @pixiv/three-vrm-springbone v1.0.0-beta.19
 * Spring bone module for @pixiv/three-vrm
 *
 * Copyright (c) 2020-2021 pixiv Inc.
 * @pixiv/three-vrm-springbone is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE_VRM_SPRINGBONE = {}, global.THREE));
}(this, (function (exports, THREE) { 'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () {
                            return e[k];
                        }
                    });
                }
            });
        }
        n['default'] = e;
        return Object.freeze(n);
    }

    var THREE__namespace = /*#__PURE__*/_interopNamespace(THREE);

    /**
     * Represents a shape of a collider.
     */
    class VRMSpringBoneColliderShape {
    }

    const _v3A$1 = new THREE__namespace.Vector3();
    const _v3B$1 = new THREE__namespace.Vector3();
    class VRMSpringBoneColliderShapeCapsule extends VRMSpringBoneColliderShape {
        constructor(params) {
            var _a, _b, _c;
            super();
            this.offset = (_a = params === null || params === void 0 ? void 0 : params.offset) !== null && _a !== void 0 ? _a : new THREE__namespace.Vector3(0.0, 0.0, 0.0);
            this.tail = (_b = params === null || params === void 0 ? void 0 : params.tail) !== null && _b !== void 0 ? _b : new THREE__namespace.Vector3(0.0, 0.0, 0.0);
            this.radius = (_c = params === null || params === void 0 ? void 0 : params.radius) !== null && _c !== void 0 ? _c : 0.0;
        }
        get type() {
            return 'capsule';
        }
        calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
            _v3A$1.copy(this.offset).applyMatrix4(colliderMatrix); // transformed head
            _v3B$1.copy(this.tail).applyMatrix4(colliderMatrix); // transformed tail
            _v3B$1.sub(_v3A$1); // from head to tail
            const lengthSqCapsule = _v3B$1.lengthSq();
            target.copy(objectPosition).sub(_v3A$1); // from head to object
            const dot = _v3B$1.dot(target); // dot product of offsetToTail and offsetToObject
            if (dot <= 0.0) ;
            else if (lengthSqCapsule <= dot) {
                // if object is near from the tail
                target.sub(_v3B$1); // from tail to object
            }
            else {
                // if object is between two ends
                _v3B$1.multiplyScalar(dot / lengthSqCapsule); // from head to the nearest point of the shaft
                target.sub(_v3B$1); // from the shaft point to object
            }
            const radius = objectRadius + this.radius;
            const distance = target.length() - radius;
            target.normalize();
            return distance;
        }
    }

    class VRMSpringBoneColliderShapeSphere extends VRMSpringBoneColliderShape {
        constructor(params) {
            var _a, _b;
            super();
            this.offset = (_a = params === null || params === void 0 ? void 0 : params.offset) !== null && _a !== void 0 ? _a : new THREE__namespace.Vector3(0.0, 0.0, 0.0);
            this.radius = (_b = params === null || params === void 0 ? void 0 : params.radius) !== null && _b !== void 0 ? _b : 0.0;
        }
        get type() {
            return 'sphere';
        }
        calculateCollision(colliderMatrix, objectPosition, objectRadius, target) {
            target.copy(this.offset).applyMatrix4(colliderMatrix); // transformed offset
            target.negate().add(objectPosition); // a vector from collider center to object position
            const radius = objectRadius + this.radius;
            const distance = target.length() - radius;
            target.normalize();
            return distance;
        }
    }

    const _vecA = new THREE__namespace.Vector3();
    class ColliderShapeCapsuleBufferGeometry extends THREE__namespace.BufferGeometry {
        constructor(shape) {
            super();
            this._currentRadius = 0;
            this._currentOffset = new THREE__namespace.Vector3();
            this._currentTail = new THREE__namespace.Vector3();
            this._shape = shape;
            this._attrPos = new THREE__namespace.BufferAttribute(new Float32Array(396), 3);
            this.setAttribute('position', this._attrPos);
            this._attrIndex = new THREE__namespace.BufferAttribute(new Uint16Array(264), 1);
            this.setIndex(this._attrIndex);
            this._buildIndex();
            this.update();
        }
        update() {
            let shouldUpdateGeometry = false;
            if (this._currentRadius !== this._shape.radius) {
                this._currentRadius = this._shape.radius;
                shouldUpdateGeometry = true;
            }
            if (!this._currentOffset.equals(this._shape.offset)) {
                this._currentOffset.copy(this._shape.offset);
                shouldUpdateGeometry = true;
            }
            if (!this._currentTail.equals(this._shape.tail)) {
                this._currentTail.copy(this._shape.tail);
                shouldUpdateGeometry = true;
            }
            if (shouldUpdateGeometry) {
                this._buildPosition();
            }
        }
        _buildPosition() {
            _vecA.copy(this._currentTail).sub(this._currentOffset);
            const l = _vecA.length() / this._currentRadius;
            for (let i = 0; i <= 16; i++) {
                const t = (i / 16.0) * Math.PI;
                this._attrPos.setXYZ(i, -Math.sin(t), -Math.cos(t), 0.0);
                this._attrPos.setXYZ(17 + i, l + Math.sin(t), Math.cos(t), 0.0);
                this._attrPos.setXYZ(34 + i, -Math.sin(t), 0.0, -Math.cos(t));
                this._attrPos.setXYZ(51 + i, l + Math.sin(t), 0.0, Math.cos(t));
            }
            for (let i = 0; i < 32; i++) {
                const t = (i / 16.0) * Math.PI;
                this._attrPos.setXYZ(68 + i, 0.0, Math.sin(t), Math.cos(t));
                this._attrPos.setXYZ(100 + i, l, Math.sin(t), Math.cos(t));
            }
            const theta = Math.atan2(_vecA.y, Math.sqrt(_vecA.x * _vecA.x + _vecA.z * _vecA.z));
            const phi = -Math.atan2(_vecA.z, _vecA.x);
            this.rotateZ(theta);
            this.rotateY(phi);
            this.scale(this._currentRadius, this._currentRadius, this._currentRadius);
            this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
            this._attrPos.needsUpdate = true;
        }
        _buildIndex() {
            for (let i = 0; i < 34; i++) {
                const i1 = (i + 1) % 34;
                this._attrIndex.setXY(i * 2, i, i1);
                this._attrIndex.setXY(68 + i * 2, 34 + i, 34 + i1);
            }
            for (let i = 0; i < 32; i++) {
                const i1 = (i + 1) % 32;
                this._attrIndex.setXY(136 + i * 2, 68 + i, 68 + i1);
                this._attrIndex.setXY(200 + i * 2, 100 + i, 100 + i1);
            }
            this._attrIndex.needsUpdate = true;
        }
    }

    class ColliderShapeSphereBufferGeometry extends THREE__namespace.BufferGeometry {
        constructor(shape) {
            super();
            this._currentRadius = 0;
            this._currentOffset = new THREE__namespace.Vector3();
            this._shape = shape;
            this._attrPos = new THREE__namespace.BufferAttribute(new Float32Array(32 * 3 * 3), 3);
            this.setAttribute('position', this._attrPos);
            this._attrIndex = new THREE__namespace.BufferAttribute(new Uint16Array(64 * 3), 1);
            this.setIndex(this._attrIndex);
            this._buildIndex();
            this.update();
        }
        update() {
            let shouldUpdateGeometry = false;
            if (this._currentRadius !== this._shape.radius) {
                this._currentRadius = this._shape.radius;
                shouldUpdateGeometry = true;
            }
            if (!this._currentOffset.equals(this._shape.offset)) {
                this._currentOffset.copy(this._shape.offset);
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
            this.translate(this._currentOffset.x, this._currentOffset.y, this._currentOffset.z);
            this._attrPos.needsUpdate = true;
        }
        _buildIndex() {
            for (let i = 0; i < 32; i++) {
                const i1 = (i + 1) % 32;
                this._attrIndex.setXY(i * 2, i, i1);
                this._attrIndex.setXY(64 + i * 2, 32 + i, 32 + i1);
                this._attrIndex.setXY(128 + i * 2, 64 + i, 64 + i1);
            }
            this._attrIndex.needsUpdate = true;
        }
    }

    class VRMSpringBoneColliderHelper extends THREE__namespace.Group {
        constructor(collider) {
            super();
            this.matrixAutoUpdate = false;
            this.collider = collider;
            if (this.collider.shape instanceof VRMSpringBoneColliderShapeSphere) {
                this._geometry = new ColliderShapeSphereBufferGeometry(this.collider.shape);
            }
            else if (this.collider.shape instanceof VRMSpringBoneColliderShapeCapsule) {
                this._geometry = new ColliderShapeCapsuleBufferGeometry(this.collider.shape);
            }
            else {
                throw new Error('VRMSpringBoneColliderHelper: Unknown collider shape type detected');
            }
            const material = new THREE__namespace.LineBasicMaterial({
                color: 0xff00ff,
                depthTest: false,
                depthWrite: false,
            });
            this._line = new THREE__namespace.LineSegments(this._geometry, material);
            this.add(this._line);
        }
        dispose() {
            this._geometry.dispose();
        }
        updateMatrixWorld(force) {
            this.collider.updateWorldMatrix(true, false);
            this.matrix.copy(this.collider.matrixWorld);
            this._geometry.update();
            super.updateMatrixWorld(force);
        }
    }

    class SpringBoneBufferGeometry extends THREE__namespace.BufferGeometry {
        constructor(springBone) {
            super();
            this._currentRadius = 0;
            this._currentTail = new THREE__namespace.Vector3();
            this._springBone = springBone;
            this._attrPos = new THREE__namespace.BufferAttribute(new Float32Array(294), 3);
            this.setAttribute('position', this._attrPos);
            this._attrIndex = new THREE__namespace.BufferAttribute(new Uint16Array(194), 1);
            this.setIndex(this._attrIndex);
            this._buildIndex();
            this.update();
        }
        update() {
            let shouldUpdateGeometry = false;
            if (this._currentRadius !== this._springBone.settings.hitRadius) {
                this._currentRadius = this._springBone.settings.hitRadius;
                shouldUpdateGeometry = true;
            }
            if (!this._currentTail.equals(this._springBone.initialLocalChildPosition)) {
                this._currentTail.copy(this._springBone.initialLocalChildPosition);
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

    class VRMSpringBoneJointHelper extends THREE__namespace.Group {
        constructor(springBone) {
            super();
            this.matrixAutoUpdate = false;
            this.springBone = springBone;
            this._geometry = new SpringBoneBufferGeometry(this.springBone);
            const material = new THREE__namespace.LineBasicMaterial({
                color: 0xffff00,
                depthTest: false,
                depthWrite: false,
            });
            this._line = new THREE__namespace.LineSegments(this._geometry, material);
            this.add(this._line);
        }
        dispose() {
            this._geometry.dispose();
        }
        updateMatrixWorld(force) {
            this.springBone.bone.updateWorldMatrix(true, false);
            this.matrix.copy(this.springBone.bone.matrixWorld);
            this._geometry.update();
            super.updateMatrixWorld(force);
        }
    }

    /**
     * Represents a collider of a VRM.
     */
    class VRMSpringBoneCollider extends THREE__namespace.Object3D {
        constructor(shape) {
            super();
            this.shape = shape;
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
                this._inverseCache.copy(this.matrix);
                mat4InvertCompat(this._inverseCache);
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
    const IDENTITY_MATRIX4 = new THREE__namespace.Matrix4();
    // 計算中の一時保存用変数（一度インスタンスを作ったらあとは使い回す）
    const _v3A = new THREE__namespace.Vector3();
    const _v3B = new THREE__namespace.Vector3();
    const _v3C = new THREE__namespace.Vector3();
    /**
     * A temporary variable which is used in `update`
     */
    const _worldSpacePosition = new THREE__namespace.Vector3();
    /**
     * A temporary variable which is used in `update`
     */
    const _centerSpacePosition = new THREE__namespace.Vector3();
    /**
     * A temporary variable which is used in `update`
     */
    const _nextTail = new THREE__namespace.Vector3();
    const _quatA = new THREE__namespace.Quaternion();
    const _matA = new THREE__namespace.Matrix4();
    const _matB = new THREE__namespace.Matrix4();
    /**
     * A class represents a single joint of a spring bone.
     * It should be managed by a [[VRMSpringBoneManager]].
     */
    class VRMSpringBoneJoint {
        /**
         * Create a new VRMSpringBone.
         *
         * @param bone An Object3D that will be attached to this bone
         * @param child An Object3D that will be used as a tail of this spring bone. It can be null when the spring bone is imported from VRM 0.0
         * @param settings Several parameters related to behavior of the spring bone
         * @param colliderGroups Collider groups that will be collided with this spring bone
         */
        constructor(bone, child, settings = {}, colliderGroups = []) {
            var _a, _b, _c, _d, _e, _f;
            /**
             * Current position of child tail, in center unit. Will be used for verlet integration.
             */
            this._currentTail = new THREE__namespace.Vector3();
            /**
             * Previous position of child tail, in center unit. Will be used for verlet integration.
             */
            this._prevTail = new THREE__namespace.Vector3();
            /**
             * Initial axis of the bone, in local unit.
             */
            this._boneAxis = new THREE__namespace.Vector3();
            /**
             * Length of the bone in world unit. Will be used for normalization in update loop.
             * It's same as local unit length unless there are scale transformations in the world space.
             */
            this._worldSpaceBoneLength = 0.0;
            /**
             * This springbone will be calculated based on the space relative from this object.
             * If this is `null`, springbone will be calculated in world space.
             */
            this._center = null;
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
            this.child = child;
            this.settings = {
                hitRadius: (_a = settings.hitRadius) !== null && _a !== void 0 ? _a : 0.0,
                stiffness: (_b = settings.stiffness) !== null && _b !== void 0 ? _b : 1.0,
                gravityPower: (_c = settings.gravityPower) !== null && _c !== void 0 ? _c : 0.0,
                gravityDir: (_e = (_d = settings.gravityDir) === null || _d === void 0 ? void 0 : _d.clone()) !== null && _e !== void 0 ? _e : new THREE__namespace.Vector3(0.0, -1.0, 0.0),
                dragForce: (_f = settings.dragForce) !== null && _f !== void 0 ? _f : 0.4,
            };
            this.colliderGroups = colliderGroups;
        }
        get center() {
            return this._center;
        }
        set center(center) {
            var _a;
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
        }
        get initialLocalChildPosition() {
            return this._initialLocalChildPosition;
        }
        /**
         * Returns the world matrix of its parent object.
         * Note that it returns a reference to the matrix. Don't mutate this directly!
         */
        get _parentMatrixWorld() {
            return this.bone.parent ? this.bone.parent.matrixWorld : IDENTITY_MATRIX4;
        }
        /**
         * Set the initial state of this spring bone.
         * You might want to call {@link VRMSpringBoneManager.setInitState} instead.
         */
        setInitState() {
            // remember initial position of itself
            this._initialLocalMatrix.copy(this.bone.matrix);
            this._initialLocalRotation.copy(this.bone.quaternion);
            // see initial position of its local child
            if (this.child) {
                this._initialLocalChildPosition.copy(this.child.position);
            }
            else {
                // vrm0 requires a 7cm fixed bone length for the final node in a chain
                // See: https://github.com/vrm-c/vrm-specification/tree/master/specification/VRMC_springBone-1.0-beta#about-spring-configuration
                this._initialLocalChildPosition.copy(this.bone.position).normalize().multiplyScalar(0.07);
            }
            // copy the child position to tails
            this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition));
            this._prevTail.copy(this._currentTail);
            // set initial states that are related to local child position
            this._boneAxis.copy(this._initialLocalChildPosition).normalize();
            this._worldSpaceBoneLength = _v3A
                .copy(this._initialLocalChildPosition)
                .applyMatrix4(this.bone.matrixWorld)
                .sub(_v3B.setFromMatrixPosition(this.bone.matrixWorld))
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
            this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld, this.bone.matrix);
            // Apply updated position to tail states
            const matrixWorldToCenter = this._getMatrixWorldToCenter(_matA);
            this.bone.localToWorld(this._currentTail.copy(this._initialLocalChildPosition)).applyMatrix4(matrixWorldToCenter);
            this._prevTail.copy(this._currentTail);
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
            // Get bone position in center space
            _worldSpacePosition.setFromMatrixPosition(this.bone.matrixWorld);
            let matrixWorldToCenter = this._getMatrixWorldToCenter(_matA);
            _centerSpacePosition.copy(_worldSpacePosition).applyMatrix4(matrixWorldToCenter);
            const quatWorldToCenter = _quatA.setFromRotationMatrix(matrixWorldToCenter);
            // Get parent matrix in center space
            const centerSpaceParentMatrix = _matB.copy(matrixWorldToCenter).multiply(this._parentMatrixWorld);
            // Get boneAxis in center space
            const centerSpaceBoneAxis = _v3B
                .copy(this._boneAxis)
                .applyMatrix4(this._initialLocalMatrix)
                .applyMatrix4(centerSpaceParentMatrix)
                .sub(_centerSpacePosition)
                .normalize();
            // gravity in center space
            const centerSpaceGravity = _v3C.copy(this.settings.gravityDir).applyQuaternion(quatWorldToCenter).normalize();
            const matrixCenterToWorld = this._getMatrixCenterToWorld(_matA);
            // verlet積分で次の位置を計算
            _nextTail
                .copy(this._currentTail)
                .add(_v3A
                .copy(this._currentTail)
                .sub(this._prevTail)
                .multiplyScalar(1 - this.settings.dragForce)) // 前フレームの移動を継続する(減衰もあるよ)
                .add(_v3A.copy(centerSpaceBoneAxis).multiplyScalar(this.settings.stiffness * delta)) // 親の回転による子ボーンの移動目標
                .add(_v3A.copy(centerSpaceGravity).multiplyScalar(this.settings.gravityPower * delta)) // 外力による移動量
                .applyMatrix4(matrixCenterToWorld); // tailをworld spaceに戻す
            // normalize bone length
            _nextTail.sub(_worldSpacePosition).normalize().multiplyScalar(this._worldSpaceBoneLength).add(_worldSpacePosition);
            // Collisionで移動
            this._collision(_nextTail);
            // update prevTail and currentTail
            matrixWorldToCenter = this._getMatrixWorldToCenter(_matA);
            this._prevTail.copy(this._currentTail);
            this._currentTail.copy(_v3A.copy(_nextTail).applyMatrix4(matrixWorldToCenter));
            // Apply rotation, convert vector3 thing into actual quaternion
            // Original UniVRM is doing center unit calculus at here but we're gonna do this on local unit
            const worldSpaceInitialMatrixInv = mat4InvertCompat(_matA.copy(this._parentMatrixWorld).multiply(this._initialLocalMatrix));
            const applyRotation = _quatA.setFromUnitVectors(this._boneAxis, _v3A.copy(_nextTail).applyMatrix4(worldSpaceInitialMatrixInv).normalize());
            this.bone.quaternion.copy(this._initialLocalRotation).multiply(applyRotation);
            // We need to update its matrixWorld manually, since we tweaked the bone by our hand
            this.bone.updateMatrix();
            this.bone.matrixWorld.multiplyMatrices(this._parentMatrixWorld, this.bone.matrix);
        }
        /**
         * Do collision math against every colliders attached to this bone.
         *
         * @param tail The tail you want to process
         */
        _collision(tail) {
            this.colliderGroups.forEach((colliderGroup) => {
                colliderGroup.colliders.forEach((collider) => {
                    const dist = collider.shape.calculateCollision(collider.matrixWorld, tail, this.settings.hitRadius, _v3A);
                    if (dist < 0.0) {
                        // hit
                        tail.add(_v3A.multiplyScalar(-dist));
                        // normalize bone length
                        tail.sub(_worldSpacePosition).normalize().multiplyScalar(this._worldSpaceBoneLength).add(_worldSpacePosition);
                    }
                });
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

    function traverseAncestorsFromRoot(object, callback) {
        const ancestors = [];
        let head = object;
        while (head !== null) {
            ancestors.unshift(head);
            head = head.parent;
        }
        ancestors.forEach((ancestor) => {
            callback(ancestor);
        });
    }

    /**
     * Traverse children of given object and execute given callback.
     * The given object itself wont be given to the callback.
     * If the return value of the callback is `true`, it will halt the traversal of its children.
     * @param object A root object
     * @param callback A callback function called for each children
     */
    function traverseChildrenUntilConditionMet(object, callback) {
        object.children.forEach((child) => {
            const result = callback(child);
            if (!result) {
                traverseChildrenUntilConditionMet(child, callback);
            }
        });
    }

    class VRMSpringBoneManager {
        constructor() {
            this._joints = new Set();
            this._objectSpringBonesMap = new Map();
        }
        get joints() {
            return this._joints;
        }
        /**
         * @deprecated Use {@link joints} instead.
         */
        get springBones() {
            console.warn('VRMLookAt: springBones is deprecated. use joints instead.');
            return this._joints;
        }
        get colliderGroups() {
            const set = new Set();
            this._joints.forEach((springBone) => {
                springBone.colliderGroups.forEach((colliderGroup) => {
                    set.add(colliderGroup);
                });
            });
            return Array.from(set);
        }
        get colliders() {
            const set = new Set();
            this.colliderGroups.forEach((colliderGroup) => {
                colliderGroup.colliders.forEach((collider) => {
                    set.add(collider);
                });
            });
            return Array.from(set);
        }
        addJoint(joint) {
            this._joints.add(joint);
            let objectSet = this._objectSpringBonesMap.get(joint.bone);
            if (objectSet == null) {
                objectSet = new Set();
                this._objectSpringBonesMap.set(joint.bone, objectSet);
            }
            objectSet.add(joint);
        }
        /**
         * @deprecated Use {@link addJoint} instead.
         */
        addSpringBone(joint) {
            console.warn('VRMLookAt: addSpringBone() is deprecated. use addJoint() instead.');
            this.addJoint(joint);
        }
        deleteJoint(joint) {
            this._joints.delete(joint);
            const objectSet = this._objectSpringBonesMap.get(joint.bone);
            objectSet.delete(joint);
        }
        /**
         * @deprecated Use {@link deleteJoint} instead.
         */
        deleteSpringBone(joint) {
            console.warn('VRMLookAt: deleteSpringBone() is deprecated. use deleteJoint() instead.');
            this.deleteJoint(joint);
        }
        setInitState() {
            const springBonesTried = new Set();
            const springBonesDone = new Set();
            const objectUpdated = new Set();
            for (const springBone of this._joints) {
                this._processSpringBone(springBone, springBonesTried, springBonesDone, objectUpdated, (springBone) => springBone.setInitState());
            }
        }
        reset() {
            const springBonesTried = new Set();
            const springBonesDone = new Set();
            const objectUpdated = new Set();
            for (const springBone of this._joints) {
                this._processSpringBone(springBone, springBonesTried, springBonesDone, objectUpdated, (springBone) => springBone.reset());
            }
        }
        update(delta) {
            const springBonesTried = new Set();
            const springBonesDone = new Set();
            const objectUpdated = new Set();
            for (const springBone of this._joints) {
                // update the springbone
                this._processSpringBone(springBone, springBonesTried, springBonesDone, objectUpdated, (springBone) => springBone.update(delta));
                // update children world matrices
                // it is required when the spring bone chain is sparse
                traverseChildrenUntilConditionMet(springBone.bone, (object) => {
                    var _a, _b;
                    // if the object has attached springbone, halt the traversal
                    if (((_b = (_a = this._objectSpringBonesMap.get(object)) === null || _a === void 0 ? void 0 : _a.size) !== null && _b !== void 0 ? _b : 0) > 0) {
                        return true;
                    }
                    // otherwise update its world matrix
                    object.updateWorldMatrix(false, false);
                    return false;
                });
            }
        }
        /**
         * Update a spring bone.
         * If there are other spring bone that are dependant, it will try to update them recursively.
         * It updates matrixWorld of all ancestors and myself.
         * It might throw an error if there are circular dependencies.
         *
         * Intended to be used in {@link update} and {@link _processSpringBone} itself recursively.
         *
         * @param springBone A springBone you want to update
         * @param springBonesTried Set of springBones that are already tried to be updated
         * @param springBonesDone Set of springBones that are already up to date
         * @param objectUpdated Set of object3D whose matrixWorld is updated
         */
        _processSpringBone(springBone, springBonesTried, springBonesDone, objectUpdated, callback) {
            if (springBonesDone.has(springBone)) {
                return;
            }
            if (springBonesTried.has(springBone)) {
                throw new Error('VRMSpringBoneManager: Circular dependency detected while updating springbones');
            }
            springBonesTried.add(springBone);
            const depObjects = this._getDependencies(springBone);
            for (const depObject of depObjects) {
                traverseAncestorsFromRoot(depObject, (depObjectAncestor) => {
                    const objectSet = this._objectSpringBonesMap.get(depObjectAncestor);
                    if (objectSet) {
                        for (const depSpringBone of objectSet) {
                            this._processSpringBone(depSpringBone, springBonesTried, springBonesDone, objectUpdated, callback);
                        }
                    }
                    else if (!objectUpdated.has(depObjectAncestor)) {
                        // update matrix of non-springbone
                        depObjectAncestor.updateWorldMatrix(false, false);
                        objectUpdated.add(depObjectAncestor);
                    }
                });
            }
            // update my matrix
            springBone.bone.updateMatrix();
            springBone.bone.updateWorldMatrix(false, false);
            callback(springBone);
            objectUpdated.add(springBone.bone);
            springBonesDone.add(springBone);
        }
        /**
         * Return a set of objects that are dependant of given spring bone.
         * @param springBone A spring bone
         * @return A set of objects that are dependant of given spring bone
         */
        _getDependencies(springBone) {
            const set = new Set();
            const parent = springBone.bone.parent;
            if (parent) {
                set.add(parent);
            }
            springBone.colliderGroups.forEach((colliderGroup) => {
                colliderGroup.colliders.forEach((collider) => {
                    set.add(collider);
                });
            });
            return set;
        }
    }

    class VRMSpringBoneLoaderPlugin {
        constructor(parser, options) {
            this.parser = parser;
            this.jointHelperRoot = options === null || options === void 0 ? void 0 : options.jointHelperRoot;
            this.colliderHelperRoot = options === null || options === void 0 ? void 0 : options.colliderHelperRoot;
        }
        get name() {
            return VRMSpringBoneLoaderPlugin.EXTENSION_NAME;
        }
        afterRoot(gltf) {
            return __awaiter(this, void 0, void 0, function* () {
                gltf.userData.vrmSpringBoneManager = yield this._import(gltf);
            });
        }
        /**
         * Import spring bones from a GLTF and return a {@link VRMSpringBoneManager}.
         * It might return `null` instead when it does not need to be created or something go wrong.
         *
         * @param gltf A parsed result of GLTF taken from GLTFLoader
         */
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
            var _a, _b, _c, _d, _e;
            return __awaiter(this, void 0, void 0, function* () {
                const json = gltf.parser.json;
                // early abort if it doesn't use spring bones
                const isSpringBoneUsed = ((_a = json.extensionsUsed) === null || _a === void 0 ? void 0 : _a.indexOf(VRMSpringBoneLoaderPlugin.EXTENSION_NAME)) !== -1;
                if (!isSpringBoneUsed) {
                    return null;
                }
                const manager = new VRMSpringBoneManager();
                const threeNodes = yield gltf.parser.getDependencies('node');
                const extension = (_b = json.extensions) === null || _b === void 0 ? void 0 : _b[VRMSpringBoneLoaderPlugin.EXTENSION_NAME];
                if (!extension) {
                    return null;
                }
                const specVersion = extension.specVersion;
                if (specVersion !== '1.0-beta') {
                    return null;
                }
                const colliders = (_c = extension.colliders) === null || _c === void 0 ? void 0 : _c.map((schemaCollider, iCollider) => {
                    var _a, _b, _c, _d, _e;
                    const node = threeNodes[schemaCollider.node];
                    const schemaShape = schemaCollider.shape;
                    if (schemaShape.sphere) {
                        return this._importSphereCollider(node, {
                            offset: new THREE__namespace.Vector3().fromArray((_a = schemaShape.sphere.offset) !== null && _a !== void 0 ? _a : [0.0, 0.0, 0.0]),
                            radius: (_b = schemaShape.sphere.radius) !== null && _b !== void 0 ? _b : 0.0,
                        });
                    }
                    else if (schemaShape.capsule) {
                        return this._importCapsuleCollider(node, {
                            offset: new THREE__namespace.Vector3().fromArray((_c = schemaShape.capsule.offset) !== null && _c !== void 0 ? _c : [0.0, 0.0, 0.0]),
                            radius: (_d = schemaShape.capsule.radius) !== null && _d !== void 0 ? _d : 0.0,
                            tail: new THREE__namespace.Vector3().fromArray((_e = schemaShape.capsule.tail) !== null && _e !== void 0 ? _e : [0.0, 0.0, 0.0]),
                        });
                    }
                    throw new Error(`VRMSpringBoneLoaderPlugin: The collider #${iCollider} has no valid shape`);
                });
                const colliderGroups = (_d = extension.colliderGroups) === null || _d === void 0 ? void 0 : _d.map((schemaColliderGroup, iColliderGroup) => {
                    var _a;
                    const cols = ((_a = schemaColliderGroup.colliders) !== null && _a !== void 0 ? _a : []).map((iCollider) => {
                        const col = colliders === null || colliders === void 0 ? void 0 : colliders[iCollider];
                        if (col == null) {
                            throw new Error(`VRMSpringBoneLoaderPlugin: The colliderGroup #${iColliderGroup} attempted to use a collider #${iCollider} but not found`);
                        }
                        return col;
                    });
                    return {
                        colliders: cols,
                        name: schemaColliderGroup.name,
                    };
                });
                (_e = extension.springs) === null || _e === void 0 ? void 0 : _e.forEach((schemaSpring, iSpring) => {
                    var _a;
                    const schemaJoints = schemaSpring.joints;
                    // prepare colliders
                    const colliderGroupsForSpring = (_a = schemaSpring.colliderGroups) === null || _a === void 0 ? void 0 : _a.map((iColliderGroup) => {
                        const group = colliderGroups === null || colliderGroups === void 0 ? void 0 : colliderGroups[iColliderGroup];
                        if (group == null) {
                            throw new Error(`VRMSpringBoneLoaderPlugin: The spring #${iSpring} attempted to use a colliderGroup ${iColliderGroup} but not found`);
                        }
                        return group;
                    });
                    const center = schemaSpring.center != null ? threeNodes[schemaSpring.center] : undefined;
                    let prevSchemaJoint;
                    schemaJoints.forEach((schemaJoint) => {
                        if (prevSchemaJoint) {
                            // prepare node
                            const nodeIndex = prevSchemaJoint.node;
                            const node = threeNodes[nodeIndex];
                            const childIndex = schemaJoint.node;
                            const child = threeNodes[childIndex];
                            // prepare setting
                            const setting = {
                                hitRadius: prevSchemaJoint.hitRadius,
                                dragForce: prevSchemaJoint.dragForce,
                                gravityPower: prevSchemaJoint.gravityPower,
                                stiffness: prevSchemaJoint.stiffness,
                                gravityDir: prevSchemaJoint.gravityDir != null
                                    ? new THREE__namespace.Vector3().fromArray(prevSchemaJoint.gravityDir)
                                    : undefined,
                            };
                            // create spring bones
                            const joint = this._importJoint(node, child, setting, colliderGroupsForSpring);
                            if (center) {
                                joint.center = center;
                            }
                            manager.addJoint(joint);
                        }
                        prevSchemaJoint = schemaJoint;
                    });
                });
                // init spring bones
                manager.setInitState();
                return manager;
            });
        }
        _v0Import(gltf) {
            var _a, _b, _c;
            return __awaiter(this, void 0, void 0, function* () {
                const json = gltf.parser.json;
                // early abort if it doesn't use vrm
                const isVRMUsed = ((_a = json.extensionsUsed) === null || _a === void 0 ? void 0 : _a.indexOf('VRM')) !== -1;
                if (!isVRMUsed) {
                    return null;
                }
                // early abort if it doesn't have bone groups
                const extension = (_b = json.extensions) === null || _b === void 0 ? void 0 : _b['VRM'];
                const schemaSecondaryAnimation = extension === null || extension === void 0 ? void 0 : extension.secondaryAnimation;
                if (!schemaSecondaryAnimation) {
                    return null;
                }
                const schemaBoneGroups = schemaSecondaryAnimation === null || schemaSecondaryAnimation === void 0 ? void 0 : schemaSecondaryAnimation.boneGroups;
                if (!schemaBoneGroups) {
                    return null;
                }
                const manager = new VRMSpringBoneManager();
                const threeNodes = yield gltf.parser.getDependencies('node');
                const colliderGroups = (_c = schemaSecondaryAnimation.colliderGroups) === null || _c === void 0 ? void 0 : _c.map((schemaColliderGroup) => {
                    var _a;
                    const node = threeNodes[schemaColliderGroup.node];
                    const colliders = ((_a = schemaColliderGroup.colliders) !== null && _a !== void 0 ? _a : []).map((schemaCollider, iCollider) => {
                        var _a, _b, _c;
                        const offset = new THREE__namespace.Vector3(0.0, 0.0, 0.0);
                        if (schemaCollider.offset) {
                            offset.set((_a = schemaCollider.offset.x) !== null && _a !== void 0 ? _a : 0.0, (_b = schemaCollider.offset.y) !== null && _b !== void 0 ? _b : 0.0, schemaCollider.offset.z ? -schemaCollider.offset.z : 0.0);
                        }
                        return this._importSphereCollider(node, {
                            offset,
                            radius: (_c = schemaCollider.radius) !== null && _c !== void 0 ? _c : 0.0,
                        });
                    });
                    return { colliders };
                });
                // import spring bones for each spring bone groups
                schemaBoneGroups === null || schemaBoneGroups === void 0 ? void 0 : schemaBoneGroups.forEach((schemaBoneGroup, iBoneGroup) => {
                    const rootIndices = schemaBoneGroup.bones;
                    if (!rootIndices) {
                        return;
                    }
                    rootIndices.forEach((rootIndex) => {
                        var _a, _b, _c, _d;
                        const root = threeNodes[rootIndex];
                        // prepare setting
                        const gravityDir = new THREE__namespace.Vector3();
                        if (schemaBoneGroup.gravityDir) {
                            gravityDir.set((_a = schemaBoneGroup.gravityDir.x) !== null && _a !== void 0 ? _a : 0.0, (_b = schemaBoneGroup.gravityDir.y) !== null && _b !== void 0 ? _b : 0.0, (_c = schemaBoneGroup.gravityDir.z) !== null && _c !== void 0 ? _c : 0.0);
                        }
                        else {
                            gravityDir.set(0.0, -1.0, 0.0);
                        }
                        const center = schemaBoneGroup.center != null ? threeNodes[schemaBoneGroup.center] : undefined;
                        const setting = {
                            hitRadius: schemaBoneGroup.hitRadius,
                            dragForce: schemaBoneGroup.dragForce,
                            gravityPower: schemaBoneGroup.gravityPower,
                            stiffness: schemaBoneGroup.stiffiness,
                            gravityDir,
                        };
                        // prepare colliders
                        const colliderGroupsForSpring = (_d = schemaBoneGroup.colliderGroups) === null || _d === void 0 ? void 0 : _d.map((iColliderGroup) => {
                            const group = colliderGroups === null || colliderGroups === void 0 ? void 0 : colliderGroups[iColliderGroup];
                            if (group == null) {
                                throw new Error(`VRMSpringBoneLoaderPlugin: The spring #${iBoneGroup} attempted to use a colliderGroup ${iColliderGroup} but not found`);
                            }
                            return group;
                        });
                        // create spring bones
                        root.traverse((node) => {
                            var _a;
                            const child = (_a = node.children[0]) !== null && _a !== void 0 ? _a : null;
                            const joint = this._importJoint(node, child, setting, colliderGroupsForSpring);
                            if (center) {
                                joint.center = center;
                            }
                            manager.addJoint(joint);
                        });
                    });
                });
                // init spring bones
                gltf.scene.updateMatrixWorld();
                manager.setInitState();
                return manager;
            });
        }
        _importJoint(node, child, setting, colliderGroupsForSpring) {
            const springBone = new VRMSpringBoneJoint(node, child, setting, colliderGroupsForSpring);
            if (this.jointHelperRoot) {
                const helper = new VRMSpringBoneJointHelper(springBone);
                this.jointHelperRoot.add(helper);
                helper.renderOrder = this.jointHelperRoot.renderOrder;
            }
            return springBone;
        }
        _importSphereCollider(destination, params) {
            const { offset, radius } = params;
            const shape = new VRMSpringBoneColliderShapeSphere({ offset, radius });
            const collider = new VRMSpringBoneCollider(shape);
            destination.add(collider);
            if (this.colliderHelperRoot) {
                const helper = new VRMSpringBoneColliderHelper(collider);
                this.colliderHelperRoot.add(helper);
                helper.renderOrder = this.colliderHelperRoot.renderOrder;
            }
            return collider;
        }
        _importCapsuleCollider(destination, params) {
            const { offset, radius, tail } = params;
            const shape = new VRMSpringBoneColliderShapeCapsule({ offset, radius, tail });
            const collider = new VRMSpringBoneCollider(shape);
            destination.add(collider);
            if (this.colliderHelperRoot) {
                const helper = new VRMSpringBoneColliderHelper(collider);
                this.colliderHelperRoot.add(helper);
                helper.renderOrder = this.colliderHelperRoot.renderOrder;
            }
            return collider;
        }
    }
    VRMSpringBoneLoaderPlugin.EXTENSION_NAME = 'VRMC_springBone';

    exports.VRMSpringBoneCollider = VRMSpringBoneCollider;
    exports.VRMSpringBoneColliderHelper = VRMSpringBoneColliderHelper;
    exports.VRMSpringBoneColliderShape = VRMSpringBoneColliderShape;
    exports.VRMSpringBoneColliderShapeCapsule = VRMSpringBoneColliderShapeCapsule;
    exports.VRMSpringBoneColliderShapeSphere = VRMSpringBoneColliderShapeSphere;
    exports.VRMSpringBoneJoint = VRMSpringBoneJoint;
    exports.VRMSpringBoneJointHelper = VRMSpringBoneJointHelper;
    exports.VRMSpringBoneLoaderPlugin = VRMSpringBoneLoaderPlugin;
    exports.VRMSpringBoneManager = VRMSpringBoneManager;

    Object.defineProperty(exports, '__esModule', { value: true });

    Object.assign(THREE, exports);

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLXNwcmluZ2JvbmUuanMiLCJzb3VyY2VzIjpbIi4uL3NyYy9WUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZS50cyIsIi4uL3NyYy9WUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZUNhcHN1bGUudHMiLCIuLi9zcmMvVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVTcGhlcmUudHMiLCIuLi9zcmMvaGVscGVycy91dGlscy9Db2xsaWRlclNoYXBlQ2Fwc3VsZUJ1ZmZlckdlb21ldHJ5LnRzIiwiLi4vc3JjL2hlbHBlcnMvdXRpbHMvQ29sbGlkZXJTaGFwZVNwaGVyZUJ1ZmZlckdlb21ldHJ5LnRzIiwiLi4vc3JjL2hlbHBlcnMvVlJNU3ByaW5nQm9uZUNvbGxpZGVySGVscGVyLnRzIiwiLi4vc3JjL2hlbHBlcnMvdXRpbHMvU3ByaW5nQm9uZUJ1ZmZlckdlb21ldHJ5LnRzIiwiLi4vc3JjL2hlbHBlcnMvVlJNU3ByaW5nQm9uZUpvaW50SGVscGVyLnRzIiwiLi4vc3JjL1ZSTVNwcmluZ0JvbmVDb2xsaWRlci50cyIsIi4uL3NyYy91dGlscy9tYXQ0SW52ZXJ0Q29tcGF0LnRzIiwiLi4vc3JjL3V0aWxzL01hdHJpeDRJbnZlcnNlQ2FjaGUudHMiLCIuLi9zcmMvVlJNU3ByaW5nQm9uZUpvaW50LnRzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uL3NyYy91dGlscy90cmF2ZXJzZUFuY2VzdG9yc0Zyb21Sb290LnRzIiwiLi4vc3JjL3V0aWxzL3RyYXZlcnNlQ2hpbGRyZW5VbnRpbENvbmRpdGlvbk1ldC50cyIsIi4uL3NyYy9WUk1TcHJpbmdCb25lTWFuYWdlci50cyIsIi4uL3NyYy9WUk1TcHJpbmdCb25lTG9hZGVyUGx1Z2luLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgc2hhcGUgb2YgYSBjb2xsaWRlci5cclxuICovXHJcbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZSB7XHJcbiAgLyoqXHJcbiAgICogVGhlIHR5cGUgb2YgdGhlIHNoYXBlLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBhYnN0cmFjdCBnZXQgdHlwZSgpOiBzdHJpbmc7XHJcblxyXG4gIC8qKlxyXG4gICAqIENhbGN1bGF0ZSBhIGRpc3RhbmNlIGFuZCBhIGRpcmVjdGlvbiBmcm9tIHRoZSBjb2xsaWRlciB0byBhIHRhcmdldCBvYmplY3QuXHJcbiAgICogSXQncyBoaXQgaWYgdGhlIGRpc3RhbmNlIGlzIG5lZ2F0aXZlLlxyXG4gICAqIFRoZSBkaXJlY3Rpb24gd2lsbCBiZSBjb250YWluZWQgaW4gdGhlIGdpdmVuIHRhcmdldCB2ZWN0b3IuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gY29sbGlkZXJNYXRyaXggQSBtYXRyaXggcmVwcmVzZW50cyB0aGUgdHJhbnNmb3JtIG9mIHRoZSBjb2xsaWRlclxyXG4gICAqIEBwYXJhbSBvYmplY3RQb3NpdGlvbiBBIHZlY3RvciByZXByZXNlbnRzIHRoZSBwb3NpdGlvbiBvZiB0aGUgdGFyZ2V0IG9iamVjdFxyXG4gICAqIEBwYXJhbSBvYmplY3RSYWRpdXMgVGhlIHJhZGl1cyBvZiB0aGUgb2JqZWN0XHJcbiAgICogQHBhcmFtIHRhcmdldCBUaGUgcmVzdWx0IGRpcmVjdGlvbiB3aWxsIGJlIGNvbnRhaW5lZCBpbiB0aGlzIHZlY3RvclxyXG4gICAqL1xyXG4gIHB1YmxpYyBhYnN0cmFjdCBjYWxjdWxhdGVDb2xsaXNpb24oXHJcbiAgICBjb2xsaWRlck1hdHJpeDogVEhSRUUuTWF0cml4NCxcclxuICAgIG9iamVjdFBvc2l0aW9uOiBUSFJFRS5WZWN0b3IzLFxyXG4gICAgb2JqZWN0UmFkaXVzOiBudW1iZXIsXHJcbiAgICB0YXJnZXQ6IFRIUkVFLlZlY3RvcjMsXHJcbiAgKTogbnVtYmVyO1xyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGUgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlJztcclxuXHJcbmNvbnN0IF92M0EgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5jb25zdCBfdjNCID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZUNhcHN1bGUgZXh0ZW5kcyBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZSB7XHJcbiAgcHVibGljIGdldCB0eXBlKCk6ICdjYXBzdWxlJyB7XHJcbiAgICByZXR1cm4gJ2NhcHN1bGUnO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIG9mZnNldCBvZiB0aGUgaGVhZCBmcm9tIHRoZSBvcmlnaW4uXHJcbiAgICovXHJcbiAgcHVibGljIG9mZnNldDogVEhSRUUuVmVjdG9yMztcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlIG9mZnNldCBvZiB0aGUgdGFpbCBmcm9tIHRoZSBvcmlnaW4uXHJcbiAgICovXHJcbiAgcHVibGljIHRhaWw6IFRIUkVFLlZlY3RvcjM7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSByYWRpdXMuXHJcbiAgICovXHJcbiAgcHVibGljIHJhZGl1czogbnVtYmVyO1xyXG5cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyYW1zPzogeyByYWRpdXM/OiBudW1iZXI7IG9mZnNldD86IFRIUkVFLlZlY3RvcjM7IHRhaWw/OiBUSFJFRS5WZWN0b3IzIH0pIHtcclxuICAgIHN1cGVyKCk7XHJcblxyXG4gICAgdGhpcy5vZmZzZXQgPSBwYXJhbXM/Lm9mZnNldCA/PyBuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgMC4wKTtcclxuICAgIHRoaXMudGFpbCA9IHBhcmFtcz8udGFpbCA/PyBuZXcgVEhSRUUuVmVjdG9yMygwLjAsIDAuMCwgMC4wKTtcclxuICAgIHRoaXMucmFkaXVzID0gcGFyYW1zPy5yYWRpdXMgPz8gMC4wO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNhbGN1bGF0ZUNvbGxpc2lvbihcclxuICAgIGNvbGxpZGVyTWF0cml4OiBUSFJFRS5NYXRyaXg0LFxyXG4gICAgb2JqZWN0UG9zaXRpb246IFRIUkVFLlZlY3RvcjMsXHJcbiAgICBvYmplY3RSYWRpdXM6IG51bWJlcixcclxuICAgIHRhcmdldDogVEhSRUUuVmVjdG9yMyxcclxuICApOiBudW1iZXIge1xyXG4gICAgX3YzQS5jb3B5KHRoaXMub2Zmc2V0KS5hcHBseU1hdHJpeDQoY29sbGlkZXJNYXRyaXgpOyAvLyB0cmFuc2Zvcm1lZCBoZWFkXHJcbiAgICBfdjNCLmNvcHkodGhpcy50YWlsKS5hcHBseU1hdHJpeDQoY29sbGlkZXJNYXRyaXgpOyAvLyB0cmFuc2Zvcm1lZCB0YWlsXHJcbiAgICBfdjNCLnN1YihfdjNBKTsgLy8gZnJvbSBoZWFkIHRvIHRhaWxcclxuICAgIGNvbnN0IGxlbmd0aFNxQ2Fwc3VsZSA9IF92M0IubGVuZ3RoU3EoKTtcclxuXHJcbiAgICB0YXJnZXQuY29weShvYmplY3RQb3NpdGlvbikuc3ViKF92M0EpOyAvLyBmcm9tIGhlYWQgdG8gb2JqZWN0XHJcbiAgICBjb25zdCBkb3QgPSBfdjNCLmRvdCh0YXJnZXQpOyAvLyBkb3QgcHJvZHVjdCBvZiBvZmZzZXRUb1RhaWwgYW5kIG9mZnNldFRvT2JqZWN0XHJcblxyXG4gICAgaWYgKGRvdCA8PSAwLjApIHtcclxuICAgICAgLy8gaWYgb2JqZWN0IGlzIG5lYXIgZnJvbSB0aGUgaGVhZFxyXG4gICAgICAvLyBkbyBub3RoaW5nLCB1c2UgdGhlIGN1cnJlbnQgdmFsdWUgZGlyZWN0bHlcclxuICAgIH0gZWxzZSBpZiAobGVuZ3RoU3FDYXBzdWxlIDw9IGRvdCkge1xyXG4gICAgICAvLyBpZiBvYmplY3QgaXMgbmVhciBmcm9tIHRoZSB0YWlsXHJcbiAgICAgIHRhcmdldC5zdWIoX3YzQik7IC8vIGZyb20gdGFpbCB0byBvYmplY3RcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIC8vIGlmIG9iamVjdCBpcyBiZXR3ZWVuIHR3byBlbmRzXHJcbiAgICAgIF92M0IubXVsdGlwbHlTY2FsYXIoZG90IC8gbGVuZ3RoU3FDYXBzdWxlKTsgLy8gZnJvbSBoZWFkIHRvIHRoZSBuZWFyZXN0IHBvaW50IG9mIHRoZSBzaGFmdFxyXG4gICAgICB0YXJnZXQuc3ViKF92M0IpOyAvLyBmcm9tIHRoZSBzaGFmdCBwb2ludCB0byBvYmplY3RcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCByYWRpdXMgPSBvYmplY3RSYWRpdXMgKyB0aGlzLnJhZGl1cztcclxuICAgIGNvbnN0IGRpc3RhbmNlID0gdGFyZ2V0Lmxlbmd0aCgpIC0gcmFkaXVzO1xyXG4gICAgdGFyZ2V0Lm5vcm1hbGl6ZSgpO1xyXG4gICAgcmV0dXJuIGRpc3RhbmNlO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZSc7XHJcblxyXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVTcGhlcmUgZXh0ZW5kcyBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZSB7XHJcbiAgcHVibGljIGdldCB0eXBlKCk6ICdzcGhlcmUnIHtcclxuICAgIHJldHVybiAnc3BoZXJlJztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSBvZmZzZXQgZnJvbSB0aGUgb3JpZ2luLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBvZmZzZXQ6IFRIUkVFLlZlY3RvcjM7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZSByYWRpdXMuXHJcbiAgICovXHJcbiAgcHVibGljIHJhZGl1czogbnVtYmVyO1xyXG5cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyYW1zPzogeyByYWRpdXM/OiBudW1iZXI7IG9mZnNldD86IFRIUkVFLlZlY3RvcjMgfSkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLm9mZnNldCA9IHBhcmFtcz8ub2Zmc2V0ID8/IG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAwLjApO1xyXG4gICAgdGhpcy5yYWRpdXMgPSBwYXJhbXM/LnJhZGl1cyA/PyAwLjA7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY2FsY3VsYXRlQ29sbGlzaW9uKFxyXG4gICAgY29sbGlkZXJNYXRyaXg6IFRIUkVFLk1hdHJpeDQsXHJcbiAgICBvYmplY3RQb3NpdGlvbjogVEhSRUUuVmVjdG9yMyxcclxuICAgIG9iamVjdFJhZGl1czogbnVtYmVyLFxyXG4gICAgdGFyZ2V0OiBUSFJFRS5WZWN0b3IzLFxyXG4gICk6IG51bWJlciB7XHJcbiAgICB0YXJnZXQuY29weSh0aGlzLm9mZnNldCkuYXBwbHlNYXRyaXg0KGNvbGxpZGVyTWF0cml4KTsgLy8gdHJhbnNmb3JtZWQgb2Zmc2V0XHJcbiAgICB0YXJnZXQubmVnYXRlKCkuYWRkKG9iamVjdFBvc2l0aW9uKTsgLy8gYSB2ZWN0b3IgZnJvbSBjb2xsaWRlciBjZW50ZXIgdG8gb2JqZWN0IHBvc2l0aW9uXHJcbiAgICBjb25zdCByYWRpdXMgPSBvYmplY3RSYWRpdXMgKyB0aGlzLnJhZGl1cztcclxuICAgIGNvbnN0IGRpc3RhbmNlID0gdGFyZ2V0Lmxlbmd0aCgpIC0gcmFkaXVzO1xyXG4gICAgdGFyZ2V0Lm5vcm1hbGl6ZSgpO1xyXG4gICAgcmV0dXJuIGRpc3RhbmNlO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlQ2Fwc3VsZSB9IGZyb20gJy4uLy4uL1ZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlQ2Fwc3VsZSc7XHJcbmltcG9ydCB7IENvbGxpZGVyU2hhcGVCdWZmZXJHZW9tZXRyeSB9IGZyb20gJy4vQ29sbGlkZXJTaGFwZUJ1ZmZlckdlb21ldHJ5JztcclxuXHJcbmNvbnN0IF92ZWNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBDb2xsaWRlclNoYXBlQ2Fwc3VsZUJ1ZmZlckdlb21ldHJ5IGV4dGVuZHMgVEhSRUUuQnVmZmVyR2VvbWV0cnkgaW1wbGVtZW50cyBDb2xsaWRlclNoYXBlQnVmZmVyR2VvbWV0cnkge1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2F0dHJQb3M6IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9hdHRySW5kZXg6IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZTtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9zaGFwZTogVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVDYXBzdWxlO1xyXG4gIHByaXZhdGUgX2N1cnJlbnRSYWRpdXMgPSAwO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRPZmZzZXQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2N1cnJlbnRUYWlsID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHNoYXBlOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZUNhcHN1bGUpIHtcclxuICAgIHN1cGVyKCk7XHJcblxyXG4gICAgdGhpcy5fc2hhcGUgPSBzaGFwZTtcclxuXHJcbiAgICB0aGlzLl9hdHRyUG9zID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShuZXcgRmxvYXQzMkFycmF5KDM5NiksIDMpO1xyXG4gICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ3Bvc2l0aW9uJywgdGhpcy5fYXR0clBvcyk7XHJcblxyXG4gICAgdGhpcy5fYXR0ckluZGV4ID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShuZXcgVWludDE2QXJyYXkoMjY0KSwgMSk7XHJcbiAgICB0aGlzLnNldEluZGV4KHRoaXMuX2F0dHJJbmRleCk7XHJcblxyXG4gICAgdGhpcy5fYnVpbGRJbmRleCgpO1xyXG4gICAgdGhpcy51cGRhdGUoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGUoKTogdm9pZCB7XHJcbiAgICBsZXQgc2hvdWxkVXBkYXRlR2VvbWV0cnkgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAodGhpcy5fY3VycmVudFJhZGl1cyAhPT0gdGhpcy5fc2hhcGUucmFkaXVzKSB7XHJcbiAgICAgIHRoaXMuX2N1cnJlbnRSYWRpdXMgPSB0aGlzLl9zaGFwZS5yYWRpdXM7XHJcbiAgICAgIHNob3VsZFVwZGF0ZUdlb21ldHJ5ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMuX2N1cnJlbnRPZmZzZXQuZXF1YWxzKHRoaXMuX3NoYXBlLm9mZnNldCkpIHtcclxuICAgICAgdGhpcy5fY3VycmVudE9mZnNldC5jb3B5KHRoaXMuX3NoYXBlLm9mZnNldCk7XHJcbiAgICAgIHNob3VsZFVwZGF0ZUdlb21ldHJ5ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMuX2N1cnJlbnRUYWlsLmVxdWFscyh0aGlzLl9zaGFwZS50YWlsKSkge1xyXG4gICAgICB0aGlzLl9jdXJyZW50VGFpbC5jb3B5KHRoaXMuX3NoYXBlLnRhaWwpO1xyXG4gICAgICBzaG91bGRVcGRhdGVHZW9tZXRyeSA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNob3VsZFVwZGF0ZUdlb21ldHJ5KSB7XHJcbiAgICAgIHRoaXMuX2J1aWxkUG9zaXRpb24oKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2J1aWxkUG9zaXRpb24oKTogdm9pZCB7XHJcbiAgICBfdmVjQS5jb3B5KHRoaXMuX2N1cnJlbnRUYWlsKS5zdWIodGhpcy5fY3VycmVudE9mZnNldCk7XHJcbiAgICBjb25zdCBsID0gX3ZlY0EubGVuZ3RoKCkgLyB0aGlzLl9jdXJyZW50UmFkaXVzO1xyXG5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IDE2OyBpKyspIHtcclxuICAgICAgY29uc3QgdCA9IChpIC8gMTYuMCkgKiBNYXRoLlBJO1xyXG5cclxuICAgICAgdGhpcy5fYXR0clBvcy5zZXRYWVooaSwgLU1hdGguc2luKHQpLCAtTWF0aC5jb3ModCksIDAuMCk7XHJcbiAgICAgIHRoaXMuX2F0dHJQb3Muc2V0WFlaKDE3ICsgaSwgbCArIE1hdGguc2luKHQpLCBNYXRoLmNvcyh0KSwgMC4wKTtcclxuICAgICAgdGhpcy5fYXR0clBvcy5zZXRYWVooMzQgKyBpLCAtTWF0aC5zaW4odCksIDAuMCwgLU1hdGguY29zKHQpKTtcclxuICAgICAgdGhpcy5fYXR0clBvcy5zZXRYWVooNTEgKyBpLCBsICsgTWF0aC5zaW4odCksIDAuMCwgTWF0aC5jb3ModCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xyXG4gICAgICBjb25zdCB0ID0gKGkgLyAxNi4wKSAqIE1hdGguUEk7XHJcbiAgICAgIHRoaXMuX2F0dHJQb3Muc2V0WFlaKDY4ICsgaSwgMC4wLCBNYXRoLnNpbih0KSwgTWF0aC5jb3ModCkpO1xyXG4gICAgICB0aGlzLl9hdHRyUG9zLnNldFhZWigxMDAgKyBpLCBsLCBNYXRoLnNpbih0KSwgTWF0aC5jb3ModCkpO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHRoZXRhID0gTWF0aC5hdGFuMihfdmVjQS55LCBNYXRoLnNxcnQoX3ZlY0EueCAqIF92ZWNBLnggKyBfdmVjQS56ICogX3ZlY0EueikpO1xyXG4gICAgY29uc3QgcGhpID0gLU1hdGguYXRhbjIoX3ZlY0EueiwgX3ZlY0EueCk7XHJcblxyXG4gICAgdGhpcy5yb3RhdGVaKHRoZXRhKTtcclxuICAgIHRoaXMucm90YXRlWShwaGkpO1xyXG4gICAgdGhpcy5zY2FsZSh0aGlzLl9jdXJyZW50UmFkaXVzLCB0aGlzLl9jdXJyZW50UmFkaXVzLCB0aGlzLl9jdXJyZW50UmFkaXVzKTtcclxuICAgIHRoaXMudHJhbnNsYXRlKHRoaXMuX2N1cnJlbnRPZmZzZXQueCwgdGhpcy5fY3VycmVudE9mZnNldC55LCB0aGlzLl9jdXJyZW50T2Zmc2V0LnopO1xyXG5cclxuICAgIHRoaXMuX2F0dHJQb3MubmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfYnVpbGRJbmRleCgpOiB2b2lkIHtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzQ7IGkrKykge1xyXG4gICAgICBjb25zdCBpMSA9IChpICsgMSkgJSAzNDtcclxuXHJcbiAgICAgIHRoaXMuX2F0dHJJbmRleC5zZXRYWShpICogMiwgaSwgaTEpO1xyXG4gICAgICB0aGlzLl9hdHRySW5kZXguc2V0WFkoNjggKyBpICogMiwgMzQgKyBpLCAzNCArIGkxKTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDMyOyBpKyspIHtcclxuICAgICAgY29uc3QgaTEgPSAoaSArIDEpICUgMzI7XHJcblxyXG4gICAgICB0aGlzLl9hdHRySW5kZXguc2V0WFkoMTM2ICsgaSAqIDIsIDY4ICsgaSwgNjggKyBpMSk7XHJcbiAgICAgIHRoaXMuX2F0dHJJbmRleC5zZXRYWSgyMDAgKyBpICogMiwgMTAwICsgaSwgMTAwICsgaTEpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuX2F0dHJJbmRleC5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVTcGhlcmUgfSBmcm9tICcuLi8uLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZVNwaGVyZSc7XHJcbmltcG9ydCB7IENvbGxpZGVyU2hhcGVCdWZmZXJHZW9tZXRyeSB9IGZyb20gJy4vQ29sbGlkZXJTaGFwZUJ1ZmZlckdlb21ldHJ5JztcclxuXHJcbmV4cG9ydCBjbGFzcyBDb2xsaWRlclNoYXBlU3BoZXJlQnVmZmVyR2VvbWV0cnkgZXh0ZW5kcyBUSFJFRS5CdWZmZXJHZW9tZXRyeSBpbXBsZW1lbnRzIENvbGxpZGVyU2hhcGVCdWZmZXJHZW9tZXRyeSB7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfYXR0clBvczogVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2F0dHJJbmRleDogVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX3NoYXBlOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZVNwaGVyZTtcclxuICBwcml2YXRlIF9jdXJyZW50UmFkaXVzID0gMDtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50T2Zmc2V0ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHNoYXBlOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZVNwaGVyZSkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLl9zaGFwZSA9IHNoYXBlO1xyXG5cclxuICAgIHRoaXMuX2F0dHJQb3MgPSBuZXcgVEhSRUUuQnVmZmVyQXR0cmlidXRlKG5ldyBGbG9hdDMyQXJyYXkoMzIgKiAzICogMyksIDMpO1xyXG4gICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ3Bvc2l0aW9uJywgdGhpcy5fYXR0clBvcyk7XHJcblxyXG4gICAgdGhpcy5fYXR0ckluZGV4ID0gbmV3IFRIUkVFLkJ1ZmZlckF0dHJpYnV0ZShuZXcgVWludDE2QXJyYXkoNjQgKiAzKSwgMSk7XHJcbiAgICB0aGlzLnNldEluZGV4KHRoaXMuX2F0dHJJbmRleCk7XHJcblxyXG4gICAgdGhpcy5fYnVpbGRJbmRleCgpO1xyXG4gICAgdGhpcy51cGRhdGUoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGUoKTogdm9pZCB7XHJcbiAgICBsZXQgc2hvdWxkVXBkYXRlR2VvbWV0cnkgPSBmYWxzZTtcclxuXHJcbiAgICBpZiAodGhpcy5fY3VycmVudFJhZGl1cyAhPT0gdGhpcy5fc2hhcGUucmFkaXVzKSB7XHJcbiAgICAgIHRoaXMuX2N1cnJlbnRSYWRpdXMgPSB0aGlzLl9zaGFwZS5yYWRpdXM7XHJcbiAgICAgIHNob3VsZFVwZGF0ZUdlb21ldHJ5ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXRoaXMuX2N1cnJlbnRPZmZzZXQuZXF1YWxzKHRoaXMuX3NoYXBlLm9mZnNldCkpIHtcclxuICAgICAgdGhpcy5fY3VycmVudE9mZnNldC5jb3B5KHRoaXMuX3NoYXBlLm9mZnNldCk7XHJcbiAgICAgIHNob3VsZFVwZGF0ZUdlb21ldHJ5ID0gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoc2hvdWxkVXBkYXRlR2VvbWV0cnkpIHtcclxuICAgICAgdGhpcy5fYnVpbGRQb3NpdGlvbigpO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfYnVpbGRQb3NpdGlvbigpOiB2b2lkIHtcclxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkrKykge1xyXG4gICAgICBjb25zdCB0ID0gKGkgLyAxNi4wKSAqIE1hdGguUEk7XHJcblxyXG4gICAgICB0aGlzLl9hdHRyUG9zLnNldFhZWihpLCBNYXRoLmNvcyh0KSwgTWF0aC5zaW4odCksIDAuMCk7XHJcbiAgICAgIHRoaXMuX2F0dHJQb3Muc2V0WFlaKDMyICsgaSwgMC4wLCBNYXRoLmNvcyh0KSwgTWF0aC5zaW4odCkpO1xyXG4gICAgICB0aGlzLl9hdHRyUG9zLnNldFhZWig2NCArIGksIE1hdGguc2luKHQpLCAwLjAsIE1hdGguY29zKHQpKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnNjYWxlKHRoaXMuX2N1cnJlbnRSYWRpdXMsIHRoaXMuX2N1cnJlbnRSYWRpdXMsIHRoaXMuX2N1cnJlbnRSYWRpdXMpO1xyXG4gICAgdGhpcy50cmFuc2xhdGUodGhpcy5fY3VycmVudE9mZnNldC54LCB0aGlzLl9jdXJyZW50T2Zmc2V0LnksIHRoaXMuX2N1cnJlbnRPZmZzZXQueik7XHJcblxyXG4gICAgdGhpcy5fYXR0clBvcy5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9idWlsZEluZGV4KCk6IHZvaWQge1xyXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCAzMjsgaSsrKSB7XHJcbiAgICAgIGNvbnN0IGkxID0gKGkgKyAxKSAlIDMyO1xyXG5cclxuICAgICAgdGhpcy5fYXR0ckluZGV4LnNldFhZKGkgKiAyLCBpLCBpMSk7XHJcbiAgICAgIHRoaXMuX2F0dHJJbmRleC5zZXRYWSg2NCArIGkgKiAyLCAzMiArIGksIDMyICsgaTEpO1xyXG4gICAgICB0aGlzLl9hdHRySW5kZXguc2V0WFkoMTI4ICsgaSAqIDIsIDY0ICsgaSwgNjQgKyBpMSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5fYXR0ckluZGV4Lm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXIgfSBmcm9tICcuLi9WUk1TcHJpbmdCb25lQ29sbGlkZXInO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZUNhcHN1bGUgfSBmcm9tICcuLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZUNhcHN1bGUnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZVNwaGVyZSB9IGZyb20gJy4uL1ZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlU3BoZXJlJztcclxuaW1wb3J0IHsgQ29sbGlkZXJTaGFwZUJ1ZmZlckdlb21ldHJ5IH0gZnJvbSAnLi91dGlscy9Db2xsaWRlclNoYXBlQnVmZmVyR2VvbWV0cnknO1xyXG5pbXBvcnQgeyBDb2xsaWRlclNoYXBlQ2Fwc3VsZUJ1ZmZlckdlb21ldHJ5IH0gZnJvbSAnLi91dGlscy9Db2xsaWRlclNoYXBlQ2Fwc3VsZUJ1ZmZlckdlb21ldHJ5JztcclxuaW1wb3J0IHsgQ29sbGlkZXJTaGFwZVNwaGVyZUJ1ZmZlckdlb21ldHJ5IH0gZnJvbSAnLi91dGlscy9Db2xsaWRlclNoYXBlU3BoZXJlQnVmZmVyR2VvbWV0cnknO1xyXG5cclxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVDb2xsaWRlckhlbHBlciBleHRlbmRzIFRIUkVFLkdyb3VwIHtcclxuICBwdWJsaWMgcmVhZG9ubHkgY29sbGlkZXI6IFZSTVNwcmluZ0JvbmVDb2xsaWRlcjtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9nZW9tZXRyeTogQ29sbGlkZXJTaGFwZUJ1ZmZlckdlb21ldHJ5O1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2xpbmU6IFRIUkVFLkxpbmVTZWdtZW50cztcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKGNvbGxpZGVyOiBWUk1TcHJpbmdCb25lQ29sbGlkZXIpIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLm1hdHJpeEF1dG9VcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLmNvbGxpZGVyID0gY29sbGlkZXI7XHJcblxyXG4gICAgaWYgKHRoaXMuY29sbGlkZXIuc2hhcGUgaW5zdGFuY2VvZiBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZVNwaGVyZSkge1xyXG4gICAgICB0aGlzLl9nZW9tZXRyeSA9IG5ldyBDb2xsaWRlclNoYXBlU3BoZXJlQnVmZmVyR2VvbWV0cnkodGhpcy5jb2xsaWRlci5zaGFwZSk7XHJcbiAgICB9IGVsc2UgaWYgKHRoaXMuY29sbGlkZXIuc2hhcGUgaW5zdGFuY2VvZiBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZUNhcHN1bGUpIHtcclxuICAgICAgdGhpcy5fZ2VvbWV0cnkgPSBuZXcgQ29sbGlkZXJTaGFwZUNhcHN1bGVCdWZmZXJHZW9tZXRyeSh0aGlzLmNvbGxpZGVyLnNoYXBlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVlJNU3ByaW5nQm9uZUNvbGxpZGVySGVscGVyOiBVbmtub3duIGNvbGxpZGVyIHNoYXBlIHR5cGUgZGV0ZWN0ZWQnKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBtYXRlcmlhbCA9IG5ldyBUSFJFRS5MaW5lQmFzaWNNYXRlcmlhbCh7XHJcbiAgICAgIGNvbG9yOiAweGZmMDBmZixcclxuICAgICAgZGVwdGhUZXN0OiBmYWxzZSxcclxuICAgICAgZGVwdGhXcml0ZTogZmFsc2UsXHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLl9saW5lID0gbmV3IFRIUkVFLkxpbmVTZWdtZW50cyh0aGlzLl9nZW9tZXRyeSwgbWF0ZXJpYWwpO1xyXG4gICAgdGhpcy5hZGQodGhpcy5fbGluZSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZGlzcG9zZSgpOiB2b2lkIHtcclxuICAgIHRoaXMuX2dlb21ldHJ5LmRpc3Bvc2UoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1cGRhdGVNYXRyaXhXb3JsZChmb3JjZTogYm9vbGVhbik6IHZvaWQge1xyXG4gICAgdGhpcy5jb2xsaWRlci51cGRhdGVXb3JsZE1hdHJpeCh0cnVlLCBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5tYXRyaXguY29weSh0aGlzLmNvbGxpZGVyLm1hdHJpeFdvcmxkKTtcclxuXHJcbiAgICB0aGlzLl9nZW9tZXRyeS51cGRhdGUoKTtcclxuXHJcbiAgICBzdXBlci51cGRhdGVNYXRyaXhXb3JsZChmb3JjZSk7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUpvaW50IH0gZnJvbSAnLi4vLi4vVlJNU3ByaW5nQm9uZUpvaW50JztcclxuXHJcbmV4cG9ydCBjbGFzcyBTcHJpbmdCb25lQnVmZmVyR2VvbWV0cnkgZXh0ZW5kcyBUSFJFRS5CdWZmZXJHZW9tZXRyeSB7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfYXR0clBvczogVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX2F0dHJJbmRleDogVEhSRUUuQnVmZmVyQXR0cmlidXRlO1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX3NwcmluZ0JvbmU6IFZSTVNwcmluZ0JvbmVKb2ludDtcclxuICBwcml2YXRlIF9jdXJyZW50UmFkaXVzID0gMDtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50VGFpbCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihzcHJpbmdCb25lOiBWUk1TcHJpbmdCb25lSm9pbnQpIHtcclxuICAgIHN1cGVyKCk7XHJcblxyXG4gICAgdGhpcy5fc3ByaW5nQm9uZSA9IHNwcmluZ0JvbmU7XHJcblxyXG4gICAgdGhpcy5fYXR0clBvcyA9IG5ldyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGUobmV3IEZsb2F0MzJBcnJheSgyOTQpLCAzKTtcclxuICAgIHRoaXMuc2V0QXR0cmlidXRlKCdwb3NpdGlvbicsIHRoaXMuX2F0dHJQb3MpO1xyXG5cclxuICAgIHRoaXMuX2F0dHJJbmRleCA9IG5ldyBUSFJFRS5CdWZmZXJBdHRyaWJ1dGUobmV3IFVpbnQxNkFycmF5KDE5NCksIDEpO1xyXG4gICAgdGhpcy5zZXRJbmRleCh0aGlzLl9hdHRySW5kZXgpO1xyXG5cclxuICAgIHRoaXMuX2J1aWxkSW5kZXgoKTtcclxuICAgIHRoaXMudXBkYXRlKCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgdXBkYXRlKCk6IHZvaWQge1xyXG4gICAgbGV0IHNob3VsZFVwZGF0ZUdlb21ldHJ5ID0gZmFsc2U7XHJcblxyXG4gICAgaWYgKHRoaXMuX2N1cnJlbnRSYWRpdXMgIT09IHRoaXMuX3NwcmluZ0JvbmUuc2V0dGluZ3MuaGl0UmFkaXVzKSB7XHJcbiAgICAgIHRoaXMuX2N1cnJlbnRSYWRpdXMgPSB0aGlzLl9zcHJpbmdCb25lLnNldHRpbmdzLmhpdFJhZGl1cztcclxuICAgICAgc2hvdWxkVXBkYXRlR2VvbWV0cnkgPSB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGlmICghdGhpcy5fY3VycmVudFRhaWwuZXF1YWxzKHRoaXMuX3NwcmluZ0JvbmUuaW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbikpIHtcclxuICAgICAgdGhpcy5fY3VycmVudFRhaWwuY29weSh0aGlzLl9zcHJpbmdCb25lLmluaXRpYWxMb2NhbENoaWxkUG9zaXRpb24pO1xyXG4gICAgICBzaG91bGRVcGRhdGVHZW9tZXRyeSA9IHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNob3VsZFVwZGF0ZUdlb21ldHJ5KSB7XHJcbiAgICAgIHRoaXMuX2J1aWxkUG9zaXRpb24oKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2J1aWxkUG9zaXRpb24oKTogdm9pZCB7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDMyOyBpKyspIHtcclxuICAgICAgY29uc3QgdCA9IChpIC8gMTYuMCkgKiBNYXRoLlBJO1xyXG5cclxuICAgICAgdGhpcy5fYXR0clBvcy5zZXRYWVooaSwgTWF0aC5jb3ModCksIE1hdGguc2luKHQpLCAwLjApO1xyXG4gICAgICB0aGlzLl9hdHRyUG9zLnNldFhZWigzMiArIGksIDAuMCwgTWF0aC5jb3ModCksIE1hdGguc2luKHQpKTtcclxuICAgICAgdGhpcy5fYXR0clBvcy5zZXRYWVooNjQgKyBpLCBNYXRoLnNpbih0KSwgMC4wLCBNYXRoLmNvcyh0KSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5zY2FsZSh0aGlzLl9jdXJyZW50UmFkaXVzLCB0aGlzLl9jdXJyZW50UmFkaXVzLCB0aGlzLl9jdXJyZW50UmFkaXVzKTtcclxuICAgIHRoaXMudHJhbnNsYXRlKHRoaXMuX2N1cnJlbnRUYWlsLngsIHRoaXMuX2N1cnJlbnRUYWlsLnksIHRoaXMuX2N1cnJlbnRUYWlsLnopO1xyXG5cclxuICAgIHRoaXMuX2F0dHJQb3Muc2V0WFlaKDk2LCAwLCAwLCAwKTtcclxuICAgIHRoaXMuX2F0dHJQb3Muc2V0WFlaKDk3LCB0aGlzLl9jdXJyZW50VGFpbC54LCB0aGlzLl9jdXJyZW50VGFpbC55LCB0aGlzLl9jdXJyZW50VGFpbC56KTtcclxuXHJcbiAgICB0aGlzLl9hdHRyUG9zLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2J1aWxkSW5kZXgoKTogdm9pZCB7XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDMyOyBpKyspIHtcclxuICAgICAgY29uc3QgaTEgPSAoaSArIDEpICUgMzI7XHJcblxyXG4gICAgICB0aGlzLl9hdHRySW5kZXguc2V0WFkoaSAqIDIsIGksIGkxKTtcclxuICAgICAgdGhpcy5fYXR0ckluZGV4LnNldFhZKDY0ICsgaSAqIDIsIDMyICsgaSwgMzIgKyBpMSk7XHJcbiAgICAgIHRoaXMuX2F0dHJJbmRleC5zZXRYWSgxMjggKyBpICogMiwgNjQgKyBpLCA2NCArIGkxKTtcclxuICAgIH1cclxuICAgIHRoaXMuX2F0dHJJbmRleC5zZXRYWSgxOTIsIDk2LCA5Nyk7XHJcblxyXG4gICAgdGhpcy5fYXR0ckluZGV4Lm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lSm9pbnQgfSBmcm9tICcuLi9WUk1TcHJpbmdCb25lSm9pbnQnO1xyXG5pbXBvcnQgeyBTcHJpbmdCb25lQnVmZmVyR2VvbWV0cnkgfSBmcm9tICcuL3V0aWxzL1NwcmluZ0JvbmVCdWZmZXJHZW9tZXRyeSc7XHJcblxyXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUpvaW50SGVscGVyIGV4dGVuZHMgVEhSRUUuR3JvdXAge1xyXG4gIHB1YmxpYyByZWFkb25seSBzcHJpbmdCb25lOiBWUk1TcHJpbmdCb25lSm9pbnQ7XHJcbiAgcHJpdmF0ZSByZWFkb25seSBfZ2VvbWV0cnk6IFNwcmluZ0JvbmVCdWZmZXJHZW9tZXRyeTtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9saW5lOiBUSFJFRS5MaW5lU2VnbWVudHM7XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihzcHJpbmdCb25lOiBWUk1TcHJpbmdCb25lSm9pbnQpIHtcclxuICAgIHN1cGVyKCk7XHJcbiAgICB0aGlzLm1hdHJpeEF1dG9VcGRhdGUgPSBmYWxzZTtcclxuXHJcbiAgICB0aGlzLnNwcmluZ0JvbmUgPSBzcHJpbmdCb25lO1xyXG5cclxuICAgIHRoaXMuX2dlb21ldHJ5ID0gbmV3IFNwcmluZ0JvbmVCdWZmZXJHZW9tZXRyeSh0aGlzLnNwcmluZ0JvbmUpO1xyXG5cclxuICAgIGNvbnN0IG1hdGVyaWFsID0gbmV3IFRIUkVFLkxpbmVCYXNpY01hdGVyaWFsKHtcclxuICAgICAgY29sb3I6IDB4ZmZmZjAwLFxyXG4gICAgICBkZXB0aFRlc3Q6IGZhbHNlLFxyXG4gICAgICBkZXB0aFdyaXRlOiBmYWxzZSxcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuX2xpbmUgPSBuZXcgVEhSRUUuTGluZVNlZ21lbnRzKHRoaXMuX2dlb21ldHJ5LCBtYXRlcmlhbCk7XHJcbiAgICB0aGlzLmFkZCh0aGlzLl9saW5lKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xyXG4gICAgdGhpcy5fZ2VvbWV0cnkuZGlzcG9zZSgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHVwZGF0ZU1hdHJpeFdvcmxkKGZvcmNlOiBib29sZWFuKTogdm9pZCB7XHJcbiAgICB0aGlzLnNwcmluZ0JvbmUuYm9uZS51cGRhdGVXb3JsZE1hdHJpeCh0cnVlLCBmYWxzZSk7XHJcblxyXG4gICAgdGhpcy5tYXRyaXguY29weSh0aGlzLnNwcmluZ0JvbmUuYm9uZS5tYXRyaXhXb3JsZCk7XHJcblxyXG4gICAgdGhpcy5fZ2VvbWV0cnkudXBkYXRlKCk7XHJcblxyXG4gICAgc3VwZXIudXBkYXRlTWF0cml4V29ybGQoZm9yY2UpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB0eXBlIHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGUgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlJztcclxuXHJcbi8qKlxyXG4gKiBSZXByZXNlbnRzIGEgY29sbGlkZXIgb2YgYSBWUk0uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUNvbGxpZGVyIGV4dGVuZHMgVEhSRUUuT2JqZWN0M0Qge1xyXG4gIC8qKlxyXG4gICAqIFRoZSBzaGFwZSBvZiB0aGUgY29sbGlkZXIuXHJcbiAgICovXHJcbiAgcHVibGljIHJlYWRvbmx5IHNoYXBlOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZTtcclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHNoYXBlOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZSkge1xyXG4gICAgc3VwZXIoKTtcclxuXHJcbiAgICB0aGlzLnNoYXBlID0gc2hhcGU7XHJcbiAgfVxyXG59XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuXHJcbmNvbnN0IF9tYXRBID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcclxuXHJcbi8qKlxyXG4gKiBBIGNvbXBhdCBmdW5jdGlvbiBmb3IgYE1hdHJpeDQuaW52ZXJ0KClgIC8gYE1hdHJpeDQuZ2V0SW52ZXJzZSgpYC5cclxuICogYE1hdHJpeDQuaW52ZXJ0KClgIGlzIGludHJvZHVjZWQgaW4gcjEyMyBhbmQgYE1hdHJpeDQuZ2V0SW52ZXJzZSgpYCBlbWl0cyBhIHdhcm5pbmcuXHJcbiAqIFdlIGFyZSBnb2luZyB0byB1c2UgdGhpcyBjb21wYXQgZm9yIGEgd2hpbGUuXHJcbiAqIEBwYXJhbSB0YXJnZXQgQSB0YXJnZXQgbWF0cml4XHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWF0NEludmVydENvbXBhdDxUIGV4dGVuZHMgVEhSRUUuTWF0cml4ND4odGFyZ2V0OiBUKTogVCB7XHJcbiAgaWYgKCh0YXJnZXQgYXMgYW55KS5pbnZlcnQpIHtcclxuICAgIHRhcmdldC5pbnZlcnQoKTtcclxuICB9IGVsc2Uge1xyXG4gICAgKHRhcmdldCBhcyBhbnkpLmdldEludmVyc2UoX21hdEEuY29weSh0YXJnZXQpKTtcclxuICB9XHJcblxyXG4gIHJldHVybiB0YXJnZXQ7XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBtYXQ0SW52ZXJ0Q29tcGF0IH0gZnJvbSAnLi9tYXQ0SW52ZXJ0Q29tcGF0JztcclxuXHJcbmV4cG9ydCBjbGFzcyBNYXRyaXg0SW52ZXJzZUNhY2hlIHtcclxuICAvKipcclxuICAgKiBUaGUgdGFyZ2V0IG1hdHJpeC5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgbWF0cml4OiBUSFJFRS5NYXRyaXg0O1xyXG5cclxuICAvKipcclxuICAgKiBBIGNhY2hlIG9mIGludmVyc2Ugb2YgY3VycmVudCBtYXRyaXguXHJcbiAgICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfaW52ZXJzZUNhY2hlID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcclxuXHJcbiAgLyoqXHJcbiAgICogQSBmbGFnIHRoYXQgbWFrZXMgaXQgd2FudCB0byByZWNhbGN1bGF0ZSBpdHMge0BsaW5rIF9pbnZlcnNlQ2FjaGV9LlxyXG4gICAqIFdpbGwgYmUgc2V0IGB0cnVlYCB3aGVuIGBlbGVtZW50c2AgYXJlIG11dGF0ZWQgYW5kIGJlIHVzZWQgaW4gYGdldEludmVyc2VgLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3Nob3VsZFVwZGF0ZUludmVyc2UgPSB0cnVlO1xyXG5cclxuICAvKipcclxuICAgKiBUaGUgb3JpZ2luYWwgb2YgYG1hdHJpeC5lbGVtZW50c2BcclxuICAgKi9cclxuICBwcml2YXRlIHJlYWRvbmx5IF9vcmlnaW5hbEVsZW1lbnRzOiBudW1iZXJbXTtcclxuXHJcbiAgLyoqXHJcbiAgICogSW52ZXJzZSBvZiBnaXZlbiBtYXRyaXguXHJcbiAgICogTm90ZSB0aGF0IGl0IHdpbGwgcmV0dXJuIGl0cyBpbnRlcm5hbCBwcml2YXRlIGluc3RhbmNlLlxyXG4gICAqIE1ha2Ugc3VyZSBjb3B5aW5nIHRoaXMgYmVmb3JlIG11dGF0ZSB0aGlzLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgaW52ZXJzZSgpOiBUSFJFRS5NYXRyaXg0IHtcclxuICAgIGlmICh0aGlzLl9zaG91bGRVcGRhdGVJbnZlcnNlKSB7XHJcbiAgICAgIHRoaXMuX2ludmVyc2VDYWNoZS5jb3B5KHRoaXMubWF0cml4KTtcclxuICAgICAgbWF0NEludmVydENvbXBhdCh0aGlzLl9pbnZlcnNlQ2FjaGUpO1xyXG4gICAgICB0aGlzLl9zaG91bGRVcGRhdGVJbnZlcnNlID0gZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuX2ludmVyc2VDYWNoZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihtYXRyaXg6IFRIUkVFLk1hdHJpeDQpIHtcclxuICAgIHRoaXMubWF0cml4ID0gbWF0cml4O1xyXG5cclxuICAgIGNvbnN0IGhhbmRsZXI6IFByb3h5SGFuZGxlcjxudW1iZXJbXT4gPSB7XHJcbiAgICAgIHNldDogKG9iaiwgcHJvcDogbnVtYmVyLCBuZXdWYWwpID0+IHtcclxuICAgICAgICB0aGlzLl9zaG91bGRVcGRhdGVJbnZlcnNlID0gdHJ1ZTtcclxuICAgICAgICBvYmpbcHJvcF0gPSBuZXdWYWw7XHJcblxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICB9LFxyXG4gICAgfTtcclxuXHJcbiAgICB0aGlzLl9vcmlnaW5hbEVsZW1lbnRzID0gbWF0cml4LmVsZW1lbnRzO1xyXG4gICAgbWF0cml4LmVsZW1lbnRzID0gbmV3IFByb3h5KG1hdHJpeC5lbGVtZW50cywgaGFuZGxlcik7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgcmV2ZXJ0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5tYXRyaXguZWxlbWVudHMgPSB0aGlzLl9vcmlnaW5hbEVsZW1lbnRzO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IG1hdDRJbnZlcnRDb21wYXQgfSBmcm9tICcuL3V0aWxzL21hdDRJbnZlcnRDb21wYXQnO1xyXG5pbXBvcnQgeyBNYXRyaXg0SW52ZXJzZUNhY2hlIH0gZnJvbSAnLi91dGlscy9NYXRyaXg0SW52ZXJzZUNhY2hlJztcclxuaW1wb3J0IHR5cGUgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTVNwcmluZ0JvbmVKb2ludFNldHRpbmdzIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lSm9pbnRTZXR0aW5ncyc7XHJcblxyXG4vLyBiYXNlZCBvblxyXG4vLyBodHRwOi8vcm9ja2V0anVtcC5za3IuanAvdW5pdHkzZC8xMDkvXHJcbi8vIGh0dHBzOi8vZ2l0aHViLmNvbS9kd2FuZ28vVW5pVlJNL2Jsb2IvbWFzdGVyL1NjcmlwdHMvU3ByaW5nQm9uZS9WUk1TcHJpbmdCb25lLmNzXHJcblxyXG5jb25zdCBJREVOVElUWV9NQVRSSVg0ID0gbmV3IFRIUkVFLk1hdHJpeDQoKTtcclxuXHJcbi8vIOioiOeul+S4reOBruS4gOaZguS/neWtmOeUqOWkieaVsO+8iOS4gOW6puOCpOODs+OCueOCv+ODs+OCueOCkuS9nOOBo+OBn+OCieOBguOBqOOBr+S9v+OBhOWbnuOBme+8iVxyXG5jb25zdCBfdjNBID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuY29uc3QgX3YzQiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XHJcbmNvbnN0IF92M0MgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuLyoqXHJcbiAqIEEgdGVtcG9yYXJ5IHZhcmlhYmxlIHdoaWNoIGlzIHVzZWQgaW4gYHVwZGF0ZWBcclxuICovXHJcbmNvbnN0IF93b3JsZFNwYWNlUG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuLyoqXHJcbiAqIEEgdGVtcG9yYXJ5IHZhcmlhYmxlIHdoaWNoIGlzIHVzZWQgaW4gYHVwZGF0ZWBcclxuICovXHJcbmNvbnN0IF9jZW50ZXJTcGFjZVBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcclxuXHJcbi8qKlxyXG4gKiBBIHRlbXBvcmFyeSB2YXJpYWJsZSB3aGljaCBpcyB1c2VkIGluIGB1cGRhdGVgXHJcbiAqL1xyXG5jb25zdCBfbmV4dFRhaWwgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuY29uc3QgX3F1YXRBID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuY29uc3QgX21hdEEgPSBuZXcgVEhSRUUuTWF0cml4NCgpO1xyXG5jb25zdCBfbWF0QiA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XHJcblxyXG4vKipcclxuICogQSBjbGFzcyByZXByZXNlbnRzIGEgc2luZ2xlIGpvaW50IG9mIGEgc3ByaW5nIGJvbmUuXHJcbiAqIEl0IHNob3VsZCBiZSBtYW5hZ2VkIGJ5IGEgW1tWUk1TcHJpbmdCb25lTWFuYWdlcl1dLlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFZSTVNwcmluZ0JvbmVKb2ludCB7XHJcbiAgLyoqXHJcbiAgICogU2V0dGluZ3Mgb2YgdGhlIGJvbmUuXHJcbiAgICovXHJcbiAgcHVibGljIHNldHRpbmdzOiBWUk1TcHJpbmdCb25lSm9pbnRTZXR0aW5ncztcclxuXHJcbiAgLyoqXHJcbiAgICogQ29sbGlkZXIgZ3JvdXBzIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cclxuICAgKi9cclxuICBwdWJsaWMgY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW107XHJcblxyXG4gIC8qKlxyXG4gICAqIEFuIE9iamVjdDNEIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgYm9uZTogVEhSRUUuT2JqZWN0M0Q7XHJcblxyXG4gIC8qKlxyXG4gICAqIEFuIE9iamVjdDNEIHRoYXQgd2lsbCBiZSB1c2VkIGFzIGEgdGFpbCBvZiB0aGlzIHNwcmluZyBib25lLlxyXG4gICAqIEl0IGNhbiBiZSBudWxsIHdoZW4gdGhlIHNwcmluZyBib25lIGlzIGltcG9ydGVkIGZyb20gVlJNIDAuMC5cclxuICAgKi9cclxuICBwdWJsaWMgcmVhZG9ubHkgY2hpbGQ6IFRIUkVFLk9iamVjdDNEIHwgbnVsbDtcclxuXHJcbiAgLyoqXHJcbiAgICogQ3VycmVudCBwb3NpdGlvbiBvZiBjaGlsZCB0YWlsLCBpbiBjZW50ZXIgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfY3VycmVudFRhaWwgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuICAvKipcclxuICAgKiBQcmV2aW91cyBwb3NpdGlvbiBvZiBjaGlsZCB0YWlsLCBpbiBjZW50ZXIgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciB2ZXJsZXQgaW50ZWdyYXRpb24uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfcHJldlRhaWwgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuICAvKipcclxuICAgKiBJbml0aWFsIGF4aXMgb2YgdGhlIGJvbmUsIGluIGxvY2FsIHVuaXQuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfYm9uZUF4aXMgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG5cclxuICAvKipcclxuICAgKiBMZW5ndGggb2YgdGhlIGJvbmUgaW4gd29ybGQgdW5pdC4gV2lsbCBiZSB1c2VkIGZvciBub3JtYWxpemF0aW9uIGluIHVwZGF0ZSBsb29wLlxyXG4gICAqIEl0J3Mgc2FtZSBhcyBsb2NhbCB1bml0IGxlbmd0aCB1bmxlc3MgdGhlcmUgYXJlIHNjYWxlIHRyYW5zZm9ybWF0aW9ucyBpbiB0aGUgd29ybGQgc3BhY2UuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfd29ybGRTcGFjZUJvbmVMZW5ndGggPSAwLjA7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoaXMgc3ByaW5nYm9uZSB3aWxsIGJlIGNhbGN1bGF0ZWQgYmFzZWQgb24gdGhlIHNwYWNlIHJlbGF0aXZlIGZyb20gdGhpcyBvYmplY3QuXHJcbiAgICogSWYgdGhpcyBpcyBgbnVsbGAsIHNwcmluZ2JvbmUgd2lsbCBiZSBjYWxjdWxhdGVkIGluIHdvcmxkIHNwYWNlLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2NlbnRlcjogVEhSRUUuT2JqZWN0M0QgfCBudWxsID0gbnVsbDtcclxuICBwdWJsaWMgZ2V0IGNlbnRlcigpOiBUSFJFRS5PYmplY3QzRCB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMuX2NlbnRlcjtcclxuICB9XHJcbiAgcHVibGljIHNldCBjZW50ZXIoY2VudGVyOiBUSFJFRS5PYmplY3QzRCB8IG51bGwpIHtcclxuICAgIC8vIHVuaW5zdGFsbCBpbnZlcnNlIGNhY2hlXHJcbiAgICBpZiAodGhpcy5fY2VudGVyPy51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSkge1xyXG4gICAgICAodGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5IGFzIE1hdHJpeDRJbnZlcnNlQ2FjaGUpLnJldmVydCgpO1xyXG4gICAgICBkZWxldGUgdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5O1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGNoYW5nZSB0aGUgY2VudGVyXHJcbiAgICB0aGlzLl9jZW50ZXIgPSBjZW50ZXI7XHJcblxyXG4gICAgLy8gaW5zdGFsbCBpbnZlcnNlIGNhY2hlXHJcbiAgICBpZiAodGhpcy5fY2VudGVyKSB7XHJcbiAgICAgIGlmICghdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5KSB7XHJcbiAgICAgICAgdGhpcy5fY2VudGVyLnVzZXJEYXRhLmludmVyc2VDYWNoZVByb3h5ID0gbmV3IE1hdHJpeDRJbnZlcnNlQ2FjaGUodGhpcy5fY2VudGVyLm1hdHJpeFdvcmxkKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgbG9jYWwgbWF0cml4IG9mIHRoZSBib25lLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbE1hdHJpeCA9IG5ldyBUSFJFRS5NYXRyaXg0KCk7XHJcblxyXG4gIC8qKlxyXG4gICAqIEluaXRpYWwgc3RhdGUgb2YgdGhlIHJvdGF0aW9uIG9mIHRoZSBib25lLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbFJvdGF0aW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKTtcclxuXHJcbiAgLyoqXHJcbiAgICogSW5pdGlhbCBzdGF0ZSBvZiB0aGUgcG9zaXRpb24gb2YgaXRzIGNoaWxkLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24gPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG4gIHB1YmxpYyBnZXQgaW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbigpOiBUSFJFRS5WZWN0b3IzIHtcclxuICAgIHJldHVybiB0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyB0aGUgd29ybGQgbWF0cml4IG9mIGl0cyBwYXJlbnQgb2JqZWN0LlxyXG4gICAqIE5vdGUgdGhhdCBpdCByZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBtYXRyaXguIERvbid0IG11dGF0ZSB0aGlzIGRpcmVjdGx5IVxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0IF9wYXJlbnRNYXRyaXhXb3JsZCgpOiBUSFJFRS5NYXRyaXg0IHtcclxuICAgIHJldHVybiB0aGlzLmJvbmUucGFyZW50ID8gdGhpcy5ib25lLnBhcmVudC5tYXRyaXhXb3JsZCA6IElERU5USVRZX01BVFJJWDQ7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBDcmVhdGUgYSBuZXcgVlJNU3ByaW5nQm9uZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBib25lIEFuIE9iamVjdDNEIHRoYXQgd2lsbCBiZSBhdHRhY2hlZCB0byB0aGlzIGJvbmVcclxuICAgKiBAcGFyYW0gY2hpbGQgQW4gT2JqZWN0M0QgdGhhdCB3aWxsIGJlIHVzZWQgYXMgYSB0YWlsIG9mIHRoaXMgc3ByaW5nIGJvbmUuIEl0IGNhbiBiZSBudWxsIHdoZW4gdGhlIHNwcmluZyBib25lIGlzIGltcG9ydGVkIGZyb20gVlJNIDAuMFxyXG4gICAqIEBwYXJhbSBzZXR0aW5ncyBTZXZlcmFsIHBhcmFtZXRlcnMgcmVsYXRlZCB0byBiZWhhdmlvciBvZiB0aGUgc3ByaW5nIGJvbmVcclxuICAgKiBAcGFyYW0gY29sbGlkZXJHcm91cHMgQ29sbGlkZXIgZ3JvdXBzIHRoYXQgd2lsbCBiZSBjb2xsaWRlZCB3aXRoIHRoaXMgc3ByaW5nIGJvbmVcclxuICAgKi9cclxuICBjb25zdHJ1Y3RvcihcclxuICAgIGJvbmU6IFRIUkVFLk9iamVjdDNELFxyXG4gICAgY2hpbGQ6IFRIUkVFLk9iamVjdDNEIHwgbnVsbCxcclxuICAgIHNldHRpbmdzOiBQYXJ0aWFsPFZSTVNwcmluZ0JvbmVKb2ludFNldHRpbmdzPiA9IHt9LFxyXG4gICAgY29sbGlkZXJHcm91cHM6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwW10gPSBbXSxcclxuICApIHtcclxuICAgIHRoaXMuYm9uZSA9IGJvbmU7IC8vIHVuaVZSTeOBp+OBriBwYXJlbnRcclxuICAgIHRoaXMuYm9uZS5tYXRyaXhBdXRvVXBkYXRlID0gZmFsc2U7IC8vIHVwZGF0ZeOBq+OCiOOCiuioiOeul+OBleOCjOOCi+OBruOBp3RocmVlLmpz5YaF44Gn44Gu6Ieq5YuV5Yem55CG44Gv5LiN6KaBXHJcblxyXG4gICAgdGhpcy5jaGlsZCA9IGNoaWxkO1xyXG5cclxuICAgIHRoaXMuc2V0dGluZ3MgPSB7XHJcbiAgICAgIGhpdFJhZGl1czogc2V0dGluZ3MuaGl0UmFkaXVzID8/IDAuMCxcclxuICAgICAgc3RpZmZuZXNzOiBzZXR0aW5ncy5zdGlmZm5lc3MgPz8gMS4wLFxyXG4gICAgICBncmF2aXR5UG93ZXI6IHNldHRpbmdzLmdyYXZpdHlQb3dlciA/PyAwLjAsXHJcbiAgICAgIGdyYXZpdHlEaXI6IHNldHRpbmdzLmdyYXZpdHlEaXI/LmNsb25lKCkgPz8gbmV3IFRIUkVFLlZlY3RvcjMoMC4wLCAtMS4wLCAwLjApLFxyXG4gICAgICBkcmFnRm9yY2U6IHNldHRpbmdzLmRyYWdGb3JjZSA/PyAwLjQsXHJcbiAgICB9O1xyXG5cclxuICAgIHRoaXMuY29sbGlkZXJHcm91cHMgPSBjb2xsaWRlckdyb3VwcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFNldCB0aGUgaW5pdGlhbCBzdGF0ZSBvZiB0aGlzIHNwcmluZyBib25lLlxyXG4gICAqIFlvdSBtaWdodCB3YW50IHRvIGNhbGwge0BsaW5rIFZSTVNwcmluZ0JvbmVNYW5hZ2VyLnNldEluaXRTdGF0ZX0gaW5zdGVhZC5cclxuICAgKi9cclxuICBwdWJsaWMgc2V0SW5pdFN0YXRlKCk6IHZvaWQge1xyXG4gICAgLy8gcmVtZW1iZXIgaW5pdGlhbCBwb3NpdGlvbiBvZiBpdHNlbGZcclxuICAgIHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeC5jb3B5KHRoaXMuYm9uZS5tYXRyaXgpO1xyXG4gICAgdGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24uY29weSh0aGlzLmJvbmUucXVhdGVybmlvbik7XHJcblxyXG4gICAgLy8gc2VlIGluaXRpYWwgcG9zaXRpb24gb2YgaXRzIGxvY2FsIGNoaWxkXHJcbiAgICBpZiAodGhpcy5jaGlsZCkge1xyXG4gICAgICB0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uLmNvcHkodGhpcy5jaGlsZC5wb3NpdGlvbik7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAvLyB2cm0wIHJlcXVpcmVzIGEgN2NtIGZpeGVkIGJvbmUgbGVuZ3RoIGZvciB0aGUgZmluYWwgbm9kZSBpbiBhIGNoYWluXHJcbiAgICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL3ZybS1jL3ZybS1zcGVjaWZpY2F0aW9uL3RyZWUvbWFzdGVyL3NwZWNpZmljYXRpb24vVlJNQ19zcHJpbmdCb25lLTEuMC1iZXRhI2Fib3V0LXNwcmluZy1jb25maWd1cmF0aW9uXHJcbiAgICAgIHRoaXMuX2luaXRpYWxMb2NhbENoaWxkUG9zaXRpb24uY29weSh0aGlzLmJvbmUucG9zaXRpb24pLm5vcm1hbGl6ZSgpLm11bHRpcGx5U2NhbGFyKDAuMDcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGNvcHkgdGhlIGNoaWxkIHBvc2l0aW9uIHRvIHRhaWxzXHJcbiAgICB0aGlzLmJvbmUubG9jYWxUb1dvcmxkKHRoaXMuX2N1cnJlbnRUYWlsLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbikpO1xyXG4gICAgdGhpcy5fcHJldlRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XHJcblxyXG4gICAgLy8gc2V0IGluaXRpYWwgc3RhdGVzIHRoYXQgYXJlIHJlbGF0ZWQgdG8gbG9jYWwgY2hpbGQgcG9zaXRpb25cclxuICAgIHRoaXMuX2JvbmVBeGlzLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbikubm9ybWFsaXplKCk7XHJcbiAgICB0aGlzLl93b3JsZFNwYWNlQm9uZUxlbmd0aCA9IF92M0FcclxuICAgICAgLmNvcHkodGhpcy5faW5pdGlhbExvY2FsQ2hpbGRQb3NpdGlvbilcclxuICAgICAgLmFwcGx5TWF0cml4NCh0aGlzLmJvbmUubWF0cml4V29ybGQpXHJcbiAgICAgIC5zdWIoX3YzQi5zZXRGcm9tTWF0cml4UG9zaXRpb24odGhpcy5ib25lLm1hdHJpeFdvcmxkKSlcclxuICAgICAgLmxlbmd0aCgpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVzZXQgdGhlIHN0YXRlIG9mIHRoaXMgYm9uZS5cclxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjYWxsIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXIucmVzZXRdXSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZXNldCgpOiB2b2lkIHtcclxuICAgIHRoaXMuYm9uZS5xdWF0ZXJuaW9uLmNvcHkodGhpcy5faW5pdGlhbExvY2FsUm90YXRpb24pO1xyXG5cclxuICAgIC8vIFdlIG5lZWQgdG8gdXBkYXRlIGl0cyBtYXRyaXhXb3JsZCBtYW51YWxseSwgc2luY2Ugd2UgdHdlYWtlZCB0aGUgYm9uZSBieSBvdXIgaGFuZFxyXG4gICAgdGhpcy5ib25lLnVwZGF0ZU1hdHJpeCgpO1xyXG4gICAgdGhpcy5ib25lLm1hdHJpeFdvcmxkLm11bHRpcGx5TWF0cmljZXModGhpcy5fcGFyZW50TWF0cml4V29ybGQsIHRoaXMuYm9uZS5tYXRyaXgpO1xyXG5cclxuICAgIC8vIEFwcGx5IHVwZGF0ZWQgcG9zaXRpb24gdG8gdGFpbCBzdGF0ZXNcclxuICAgIGNvbnN0IG1hdHJpeFdvcmxkVG9DZW50ZXIgPSB0aGlzLl9nZXRNYXRyaXhXb3JsZFRvQ2VudGVyKF9tYXRBKTtcclxuICAgIHRoaXMuYm9uZS5sb2NhbFRvV29ybGQodGhpcy5fY3VycmVudFRhaWwuY29weSh0aGlzLl9pbml0aWFsTG9jYWxDaGlsZFBvc2l0aW9uKSkuYXBwbHlNYXRyaXg0KG1hdHJpeFdvcmxkVG9DZW50ZXIpO1xyXG4gICAgdGhpcy5fcHJldlRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhlIHN0YXRlIG9mIHRoaXMgYm9uZS5cclxuICAgKiBZb3UgbWlnaHQgd2FudCB0byBjYWxsIFtbVlJNU3ByaW5nQm9uZU1hbmFnZXIudXBkYXRlXV0gaW5zdGVhZC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWVcclxuICAgKi9cclxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGlmIChkZWx0YSA8PSAwKSByZXR1cm47XHJcblxyXG4gICAgLy8gR2V0IGJvbmUgcG9zaXRpb24gaW4gY2VudGVyIHNwYWNlXHJcbiAgICBfd29ybGRTcGFjZVBvc2l0aW9uLnNldEZyb21NYXRyaXhQb3NpdGlvbih0aGlzLmJvbmUubWF0cml4V29ybGQpO1xyXG4gICAgbGV0IG1hdHJpeFdvcmxkVG9DZW50ZXIgPSB0aGlzLl9nZXRNYXRyaXhXb3JsZFRvQ2VudGVyKF9tYXRBKTtcclxuICAgIF9jZW50ZXJTcGFjZVBvc2l0aW9uLmNvcHkoX3dvcmxkU3BhY2VQb3NpdGlvbikuYXBwbHlNYXRyaXg0KG1hdHJpeFdvcmxkVG9DZW50ZXIpO1xyXG4gICAgY29uc3QgcXVhdFdvcmxkVG9DZW50ZXIgPSBfcXVhdEEuc2V0RnJvbVJvdGF0aW9uTWF0cml4KG1hdHJpeFdvcmxkVG9DZW50ZXIpO1xyXG5cclxuICAgIC8vIEdldCBwYXJlbnQgbWF0cml4IGluIGNlbnRlciBzcGFjZVxyXG4gICAgY29uc3QgY2VudGVyU3BhY2VQYXJlbnRNYXRyaXggPSBfbWF0Qi5jb3B5KG1hdHJpeFdvcmxkVG9DZW50ZXIpLm11bHRpcGx5KHRoaXMuX3BhcmVudE1hdHJpeFdvcmxkKTtcclxuXHJcbiAgICAvLyBHZXQgYm9uZUF4aXMgaW4gY2VudGVyIHNwYWNlXHJcbiAgICBjb25zdCBjZW50ZXJTcGFjZUJvbmVBeGlzID0gX3YzQlxyXG4gICAgICAuY29weSh0aGlzLl9ib25lQXhpcylcclxuICAgICAgLmFwcGx5TWF0cml4NCh0aGlzLl9pbml0aWFsTG9jYWxNYXRyaXgpXHJcbiAgICAgIC5hcHBseU1hdHJpeDQoY2VudGVyU3BhY2VQYXJlbnRNYXRyaXgpXHJcbiAgICAgIC5zdWIoX2NlbnRlclNwYWNlUG9zaXRpb24pXHJcbiAgICAgIC5ub3JtYWxpemUoKTtcclxuXHJcbiAgICAvLyBncmF2aXR5IGluIGNlbnRlciBzcGFjZVxyXG4gICAgY29uc3QgY2VudGVyU3BhY2VHcmF2aXR5ID0gX3YzQy5jb3B5KHRoaXMuc2V0dGluZ3MuZ3Jhdml0eURpcikuYXBwbHlRdWF0ZXJuaW9uKHF1YXRXb3JsZFRvQ2VudGVyKS5ub3JtYWxpemUoKTtcclxuXHJcbiAgICBjb25zdCBtYXRyaXhDZW50ZXJUb1dvcmxkID0gdGhpcy5fZ2V0TWF0cml4Q2VudGVyVG9Xb3JsZChfbWF0QSk7XHJcblxyXG4gICAgLy8gdmVybGV056mN5YiG44Gn5qyh44Gu5L2N572u44KS6KiI566XXHJcbiAgICBfbmV4dFRhaWxcclxuICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXHJcbiAgICAgIC5hZGQoXHJcbiAgICAgICAgX3YzQVxyXG4gICAgICAgICAgLmNvcHkodGhpcy5fY3VycmVudFRhaWwpXHJcbiAgICAgICAgICAuc3ViKHRoaXMuX3ByZXZUYWlsKVxyXG4gICAgICAgICAgLm11bHRpcGx5U2NhbGFyKDEgLSB0aGlzLnNldHRpbmdzLmRyYWdGb3JjZSksXHJcbiAgICAgICkgLy8g5YmN44OV44Os44O844Og44Gu56e75YuV44KS57aZ57aa44GZ44KLKOa4m+ihsOOCguOBguOCi+OCiClcclxuICAgICAgLmFkZChfdjNBLmNvcHkoY2VudGVyU3BhY2VCb25lQXhpcykubXVsdGlwbHlTY2FsYXIodGhpcy5zZXR0aW5ncy5zdGlmZm5lc3MgKiBkZWx0YSkpIC8vIOimquOBruWbnui7ouOBq+OCiOOCi+WtkOODnOODvOODs+OBruenu+WLleebruaomVxyXG4gICAgICAuYWRkKF92M0EuY29weShjZW50ZXJTcGFjZUdyYXZpdHkpLm11bHRpcGx5U2NhbGFyKHRoaXMuc2V0dGluZ3MuZ3Jhdml0eVBvd2VyICogZGVsdGEpKSAvLyDlpJblipvjgavjgojjgovnp7vli5Xph49cclxuICAgICAgLmFwcGx5TWF0cml4NChtYXRyaXhDZW50ZXJUb1dvcmxkKTsgLy8gdGFpbOOCkndvcmxkIHNwYWNl44Gr5oi744GZXHJcblxyXG4gICAgLy8gbm9ybWFsaXplIGJvbmUgbGVuZ3RoXHJcbiAgICBfbmV4dFRhaWwuc3ViKF93b3JsZFNwYWNlUG9zaXRpb24pLm5vcm1hbGl6ZSgpLm11bHRpcGx5U2NhbGFyKHRoaXMuX3dvcmxkU3BhY2VCb25lTGVuZ3RoKS5hZGQoX3dvcmxkU3BhY2VQb3NpdGlvbik7XHJcblxyXG4gICAgLy8gQ29sbGlzaW9u44Gn56e75YuVXHJcbiAgICB0aGlzLl9jb2xsaXNpb24oX25leHRUYWlsKTtcclxuXHJcbiAgICAvLyB1cGRhdGUgcHJldlRhaWwgYW5kIGN1cnJlbnRUYWlsXHJcbiAgICBtYXRyaXhXb3JsZFRvQ2VudGVyID0gdGhpcy5fZ2V0TWF0cml4V29ybGRUb0NlbnRlcihfbWF0QSk7XHJcblxyXG4gICAgdGhpcy5fcHJldlRhaWwuY29weSh0aGlzLl9jdXJyZW50VGFpbCk7XHJcbiAgICB0aGlzLl9jdXJyZW50VGFpbC5jb3B5KF92M0EuY29weShfbmV4dFRhaWwpLmFwcGx5TWF0cml4NChtYXRyaXhXb3JsZFRvQ2VudGVyKSk7XHJcblxyXG4gICAgLy8gQXBwbHkgcm90YXRpb24sIGNvbnZlcnQgdmVjdG9yMyB0aGluZyBpbnRvIGFjdHVhbCBxdWF0ZXJuaW9uXHJcbiAgICAvLyBPcmlnaW5hbCBVbmlWUk0gaXMgZG9pbmcgY2VudGVyIHVuaXQgY2FsY3VsdXMgYXQgaGVyZSBidXQgd2UncmUgZ29ubmEgZG8gdGhpcyBvbiBsb2NhbCB1bml0XHJcbiAgICBjb25zdCB3b3JsZFNwYWNlSW5pdGlhbE1hdHJpeEludiA9IG1hdDRJbnZlcnRDb21wYXQoXHJcbiAgICAgIF9tYXRBLmNvcHkodGhpcy5fcGFyZW50TWF0cml4V29ybGQpLm11bHRpcGx5KHRoaXMuX2luaXRpYWxMb2NhbE1hdHJpeCksXHJcbiAgICApO1xyXG4gICAgY29uc3QgYXBwbHlSb3RhdGlvbiA9IF9xdWF0QS5zZXRGcm9tVW5pdFZlY3RvcnMoXHJcbiAgICAgIHRoaXMuX2JvbmVBeGlzLFxyXG4gICAgICBfdjNBLmNvcHkoX25leHRUYWlsKS5hcHBseU1hdHJpeDQod29ybGRTcGFjZUluaXRpYWxNYXRyaXhJbnYpLm5vcm1hbGl6ZSgpLFxyXG4gICAgKTtcclxuXHJcbiAgICB0aGlzLmJvbmUucXVhdGVybmlvbi5jb3B5KHRoaXMuX2luaXRpYWxMb2NhbFJvdGF0aW9uKS5tdWx0aXBseShhcHBseVJvdGF0aW9uKTtcclxuXHJcbiAgICAvLyBXZSBuZWVkIHRvIHVwZGF0ZSBpdHMgbWF0cml4V29ybGQgbWFudWFsbHksIHNpbmNlIHdlIHR3ZWFrZWQgdGhlIGJvbmUgYnkgb3VyIGhhbmRcclxuICAgIHRoaXMuYm9uZS51cGRhdGVNYXRyaXgoKTtcclxuICAgIHRoaXMuYm9uZS5tYXRyaXhXb3JsZC5tdWx0aXBseU1hdHJpY2VzKHRoaXMuX3BhcmVudE1hdHJpeFdvcmxkLCB0aGlzLmJvbmUubWF0cml4KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERvIGNvbGxpc2lvbiBtYXRoIGFnYWluc3QgZXZlcnkgY29sbGlkZXJzIGF0dGFjaGVkIHRvIHRoaXMgYm9uZS5cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0YWlsIFRoZSB0YWlsIHlvdSB3YW50IHRvIHByb2Nlc3NcclxuICAgKi9cclxuICBwcml2YXRlIF9jb2xsaXNpb24odGFpbDogVEhSRUUuVmVjdG9yMyk6IHZvaWQge1xyXG4gICAgdGhpcy5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckdyb3VwKSA9PiB7XHJcbiAgICAgIGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XHJcbiAgICAgICAgY29uc3QgZGlzdCA9IGNvbGxpZGVyLnNoYXBlLmNhbGN1bGF0ZUNvbGxpc2lvbihjb2xsaWRlci5tYXRyaXhXb3JsZCwgdGFpbCwgdGhpcy5zZXR0aW5ncy5oaXRSYWRpdXMsIF92M0EpO1xyXG5cclxuICAgICAgICBpZiAoZGlzdCA8IDAuMCkge1xyXG4gICAgICAgICAgLy8gaGl0XHJcbiAgICAgICAgICB0YWlsLmFkZChfdjNBLm11bHRpcGx5U2NhbGFyKC1kaXN0KSk7XHJcblxyXG4gICAgICAgICAgLy8gbm9ybWFsaXplIGJvbmUgbGVuZ3RoXHJcbiAgICAgICAgICB0YWlsLnN1Yihfd29ybGRTcGFjZVBvc2l0aW9uKS5ub3JtYWxpemUoKS5tdWx0aXBseVNjYWxhcih0aGlzLl93b3JsZFNwYWNlQm9uZUxlbmd0aCkuYWRkKF93b3JsZFNwYWNlUG9zaXRpb24pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIENyZWF0ZSBhIG1hdHJpeCB0aGF0IGNvbnZlcnRzIGNlbnRlciBzcGFjZSBpbnRvIHdvcmxkIHNwYWNlLlxyXG4gICAqIEBwYXJhbSB0YXJnZXQgVGFyZ2V0IG1hdHJpeFxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dldE1hdHJpeENlbnRlclRvV29ybGQodGFyZ2V0OiBUSFJFRS5NYXRyaXg0KTogVEhSRUUuTWF0cml4NCB7XHJcbiAgICBpZiAodGhpcy5fY2VudGVyKSB7XHJcbiAgICAgIHRhcmdldC5jb3B5KHRoaXMuX2NlbnRlci5tYXRyaXhXb3JsZCk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICB0YXJnZXQuaWRlbnRpdHkoKTtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gdGFyZ2V0O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogQ3JlYXRlIGEgbWF0cml4IHRoYXQgY29udmVydHMgd29ybGQgc3BhY2UgaW50byBjZW50ZXIgc3BhY2UuXHJcbiAgICogQHBhcmFtIHRhcmdldCBUYXJnZXQgbWF0cml4XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfZ2V0TWF0cml4V29ybGRUb0NlbnRlcih0YXJnZXQ6IFRIUkVFLk1hdHJpeDQpOiBUSFJFRS5NYXRyaXg0IHtcclxuICAgIGlmICh0aGlzLl9jZW50ZXIpIHtcclxuICAgICAgdGFyZ2V0LmNvcHkoKHRoaXMuX2NlbnRlci51c2VyRGF0YS5pbnZlcnNlQ2FjaGVQcm94eSBhcyBNYXRyaXg0SW52ZXJzZUNhY2hlKS5pbnZlcnNlKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIHRhcmdldC5pZGVudGl0eSgpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiB0YXJnZXQ7XHJcbiAgfVxyXG59XHJcbiIsIi8qISAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKSB7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QubWV0YWRhdGEgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIFJlZmxlY3QubWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdGVyKHRoaXNBcmcsIF9hcmd1bWVudHMsIFAsIGdlbmVyYXRvcikge1xyXG4gICAgZnVuY3Rpb24gYWRvcHQodmFsdWUpIHsgcmV0dXJuIHZhbHVlIGluc3RhbmNlb2YgUCA/IHZhbHVlIDogbmV3IFAoZnVuY3Rpb24gKHJlc29sdmUpIHsgcmVzb2x2ZSh2YWx1ZSk7IH0pOyB9XHJcbiAgICByZXR1cm4gbmV3IChQIHx8IChQID0gUHJvbWlzZSkpKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcclxuICAgICAgICBmdW5jdGlvbiBmdWxmaWxsZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3IubmV4dCh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gcmVqZWN0ZWQodmFsdWUpIHsgdHJ5IHsgc3RlcChnZW5lcmF0b3JbXCJ0aHJvd1wiXSh2YWx1ZSkpOyB9IGNhdGNoIChlKSB7IHJlamVjdChlKTsgfSB9XHJcbiAgICAgICAgZnVuY3Rpb24gc3RlcChyZXN1bHQpIHsgcmVzdWx0LmRvbmUgPyByZXNvbHZlKHJlc3VsdC52YWx1ZSkgOiBhZG9wdChyZXN1bHQudmFsdWUpLnRoZW4oZnVsZmlsbGVkLCByZWplY3RlZCk7IH1cclxuICAgICAgICBzdGVwKChnZW5lcmF0b3IgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSkpLm5leHQoKSk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZ2VuZXJhdG9yKHRoaXNBcmcsIGJvZHkpIHtcclxuICAgIHZhciBfID0geyBsYWJlbDogMCwgc2VudDogZnVuY3Rpb24oKSB7IGlmICh0WzBdICYgMSkgdGhyb3cgdFsxXTsgcmV0dXJuIHRbMV07IH0sIHRyeXM6IFtdLCBvcHM6IFtdIH0sIGYsIHksIHQsIGc7XHJcbiAgICByZXR1cm4gZyA9IHsgbmV4dDogdmVyYigwKSwgXCJ0aHJvd1wiOiB2ZXJiKDEpLCBcInJldHVyblwiOiB2ZXJiKDIpIH0sIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiAoZ1tTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24oKSB7IHJldHVybiB0aGlzOyB9KSwgZztcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyByZXR1cm4gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIHN0ZXAoW24sIHZdKTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc3RlcChvcCkge1xyXG4gICAgICAgIGlmIChmKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiR2VuZXJhdG9yIGlzIGFscmVhZHkgZXhlY3V0aW5nLlwiKTtcclxuICAgICAgICB3aGlsZSAoXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBmdW5jdGlvbigpIHsgcmV0dXJuIG1ba107IH0gfSk7XHJcbn0pIDogKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgb1trMl0gPSBtW2tdO1xyXG59KTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4cG9ydFN0YXIobSwgbykge1xyXG4gICAgZm9yICh2YXIgcCBpbiBtKSBpZiAocCAhPT0gXCJkZWZhdWx0XCIgJiYgIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvLCBwKSkgX19jcmVhdGVCaW5kaW5nKG8sIG0sIHApO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX192YWx1ZXMobykge1xyXG4gICAgdmFyIHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLml0ZXJhdG9yLCBtID0gcyAmJiBvW3NdLCBpID0gMDtcclxuICAgIGlmIChtKSByZXR1cm4gbS5jYWxsKG8pO1xyXG4gICAgaWYgKG8gJiYgdHlwZW9mIG8ubGVuZ3RoID09PSBcIm51bWJlclwiKSByZXR1cm4ge1xyXG4gICAgICAgIG5leHQ6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgaWYgKG8gJiYgaSA+PSBvLmxlbmd0aCkgbyA9IHZvaWQgMDtcclxuICAgICAgICAgICAgcmV0dXJuIHsgdmFsdWU6IG8gJiYgb1tpKytdLCBkb25lOiAhbyB9O1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHMgPyBcIk9iamVjdCBpcyBub3QgaXRlcmFibGUuXCIgOiBcIlN5bWJvbC5pdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3JlYWQobywgbikge1xyXG4gICAgdmFyIG0gPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb1tTeW1ib2wuaXRlcmF0b3JdO1xyXG4gICAgaWYgKCFtKSByZXR1cm4gbztcclxuICAgIHZhciBpID0gbS5jYWxsKG8pLCByLCBhciA9IFtdLCBlO1xyXG4gICAgdHJ5IHtcclxuICAgICAgICB3aGlsZSAoKG4gPT09IHZvaWQgMCB8fCBuLS0gPiAwKSAmJiAhKHIgPSBpLm5leHQoKSkuZG9uZSkgYXIucHVzaChyLnZhbHVlKTtcclxuICAgIH1cclxuICAgIGNhdGNoIChlcnJvcikgeyBlID0geyBlcnJvcjogZXJyb3IgfTsgfVxyXG4gICAgZmluYWxseSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKHIgJiYgIXIuZG9uZSAmJiAobSA9IGlbXCJyZXR1cm5cIl0pKSBtLmNhbGwoaSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZpbmFsbHkgeyBpZiAoZSkgdGhyb3cgZS5lcnJvcjsgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkKCkge1xyXG4gICAgZm9yICh2YXIgYXIgPSBbXSwgaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspXHJcbiAgICAgICAgYXIgPSBhci5jb25jYXQoX19yZWFkKGFyZ3VtZW50c1tpXSkpO1xyXG4gICAgcmV0dXJuIGFyO1xyXG59XHJcblxyXG4vKiogQGRlcHJlY2F0ZWQgKi9cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXlzKCkge1xyXG4gICAgZm9yICh2YXIgcyA9IDAsIGkgPSAwLCBpbCA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBpbDsgaSsrKSBzICs9IGFyZ3VtZW50c1tpXS5sZW5ndGg7XHJcbiAgICBmb3IgKHZhciByID0gQXJyYXkocyksIGsgPSAwLCBpID0gMDsgaSA8IGlsOyBpKyspXHJcbiAgICAgICAgZm9yICh2YXIgYSA9IGFyZ3VtZW50c1tpXSwgaiA9IDAsIGpsID0gYS5sZW5ndGg7IGogPCBqbDsgaisrLCBrKyspXHJcbiAgICAgICAgICAgIHJba10gPSBhW2pdO1xyXG4gICAgcmV0dXJuIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5KHRvLCBmcm9tKSB7XHJcbiAgICBmb3IgKHZhciBpID0gMCwgaWwgPSBmcm9tLmxlbmd0aCwgaiA9IHRvLmxlbmd0aDsgaSA8IGlsOyBpKyssIGorKylcclxuICAgICAgICB0b1tqXSA9IGZyb21baV07XHJcbiAgICByZXR1cm4gdG87XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0KHYpIHtcclxuICAgIHJldHVybiB0aGlzIGluc3RhbmNlb2YgX19hd2FpdCA/ICh0aGlzLnYgPSB2LCB0aGlzKSA6IG5ldyBfX2F3YWl0KHYpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0dlbmVyYXRvcih0aGlzQXJnLCBfYXJndW1lbnRzLCBnZW5lcmF0b3IpIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgZyA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSwgaSwgcSA9IFtdO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlmIChnW25dKSBpW25dID0gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChhLCBiKSB7IHEucHVzaChbbiwgdiwgYSwgYl0pID4gMSB8fCByZXN1bWUobiwgdik7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiByZXN1bWUobiwgdikgeyB0cnkgeyBzdGVwKGdbbl0odikpOyB9IGNhdGNoIChlKSB7IHNldHRsZShxWzBdWzNdLCBlKTsgfSB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKHIpIHsgci52YWx1ZSBpbnN0YW5jZW9mIF9fYXdhaXQgPyBQcm9taXNlLnJlc29sdmUoci52YWx1ZS52KS50aGVuKGZ1bGZpbGwsIHJlamVjdCkgOiBzZXR0bGUocVswXVsyXSwgcik7IH1cclxuICAgIGZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHsgcmVzdW1lKFwibmV4dFwiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHJlamVjdCh2YWx1ZSkgeyByZXN1bWUoXCJ0aHJvd1wiLCB2YWx1ZSk7IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShmLCB2KSB7IGlmIChmKHYpLCBxLnNoaWZ0KCksIHEubGVuZ3RoKSByZXN1bWUocVswXVswXSwgcVswXVsxXSk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNEZWxlZ2F0b3Iobykge1xyXG4gICAgdmFyIGksIHA7XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIsIGZ1bmN0aW9uIChlKSB7IHRocm93IGU7IH0pLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuLCBmKSB7IGlbbl0gPSBvW25dID8gZnVuY3Rpb24gKHYpIHsgcmV0dXJuIChwID0gIXApID8geyB2YWx1ZTogX19hd2FpdChvW25dKHYpKSwgZG9uZTogbiA9PT0gXCJyZXR1cm5cIiB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHByaXZhdGVNYXApIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBnZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gcHJpdmF0ZU1hcC5nZXQocmVjZWl2ZXIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZFNldChyZWNlaXZlciwgcHJpdmF0ZU1hcCwgdmFsdWUpIHtcclxuICAgIGlmICghcHJpdmF0ZU1hcC5oYXMocmVjZWl2ZXIpKSB7XHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImF0dGVtcHRlZCB0byBzZXQgcHJpdmF0ZSBmaWVsZCBvbiBub24taW5zdGFuY2VcIik7XHJcbiAgICB9XHJcbiAgICBwcml2YXRlTWFwLnNldChyZWNlaXZlciwgdmFsdWUpO1xyXG4gICAgcmV0dXJuIHZhbHVlO1xyXG59XHJcbiIsImltcG9ydCB0eXBlICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIHRyYXZlcnNlQW5jZXN0b3JzRnJvbVJvb3Qob2JqZWN0OiBUSFJFRS5PYmplY3QzRCwgY2FsbGJhY2s6IChvYmplY3Q6IFRIUkVFLk9iamVjdDNEKSA9PiB2b2lkKTogdm9pZCB7XHJcbiAgY29uc3QgYW5jZXN0b3JzOiBUSFJFRS5PYmplY3QzRFtdID0gW107XHJcblxyXG4gIGxldCBoZWFkOiBUSFJFRS5PYmplY3QzRCB8IG51bGwgPSBvYmplY3Q7XHJcbiAgd2hpbGUgKGhlYWQgIT09IG51bGwpIHtcclxuICAgIGFuY2VzdG9ycy51bnNoaWZ0KGhlYWQpO1xyXG4gICAgaGVhZCA9IGhlYWQucGFyZW50O1xyXG4gIH1cclxuXHJcbiAgYW5jZXN0b3JzLmZvckVhY2goKGFuY2VzdG9yKSA9PiB7XHJcbiAgICBjYWxsYmFjayhhbmNlc3Rvcik7XHJcbiAgfSk7XHJcbn1cclxuIiwiLyoqXHJcbiAqIFRyYXZlcnNlIGNoaWxkcmVuIG9mIGdpdmVuIG9iamVjdCBhbmQgZXhlY3V0ZSBnaXZlbiBjYWxsYmFjay5cclxuICogVGhlIGdpdmVuIG9iamVjdCBpdHNlbGYgd29udCBiZSBnaXZlbiB0byB0aGUgY2FsbGJhY2suXHJcbiAqIElmIHRoZSByZXR1cm4gdmFsdWUgb2YgdGhlIGNhbGxiYWNrIGlzIGB0cnVlYCwgaXQgd2lsbCBoYWx0IHRoZSB0cmF2ZXJzYWwgb2YgaXRzIGNoaWxkcmVuLlxyXG4gKiBAcGFyYW0gb2JqZWN0IEEgcm9vdCBvYmplY3RcclxuICogQHBhcmFtIGNhbGxiYWNrIEEgY2FsbGJhY2sgZnVuY3Rpb24gY2FsbGVkIGZvciBlYWNoIGNoaWxkcmVuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gdHJhdmVyc2VDaGlsZHJlblVudGlsQ29uZGl0aW9uTWV0KFxyXG4gIG9iamVjdDogVEhSRUUuT2JqZWN0M0QsXHJcbiAgY2FsbGJhY2s6IChvYmplY3Q6IFRIUkVFLk9iamVjdDNEKSA9PiBib29sZWFuLFxyXG4pOiB2b2lkIHtcclxuICBvYmplY3QuY2hpbGRyZW4uZm9yRWFjaCgoY2hpbGQpID0+IHtcclxuICAgIGNvbnN0IHJlc3VsdCA9IGNhbGxiYWNrKGNoaWxkKTtcclxuICAgIGlmICghcmVzdWx0KSB7XHJcbiAgICAgIHRyYXZlcnNlQ2hpbGRyZW5VbnRpbENvbmRpdGlvbk1ldChjaGlsZCwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59XHJcbiIsImltcG9ydCB0eXBlICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgdHlwZSB7IFZSTVNwcmluZ0JvbmVKb2ludCB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUpvaW50JztcclxuaW1wb3J0IHsgdHJhdmVyc2VBbmNlc3RvcnNGcm9tUm9vdCB9IGZyb20gJy4vdXRpbHMvdHJhdmVyc2VBbmNlc3RvcnNGcm9tUm9vdCc7XHJcbmltcG9ydCB0eXBlIHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXInO1xyXG5pbXBvcnQgdHlwZSB7IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCc7XHJcbmltcG9ydCB7IHRyYXZlcnNlQ2hpbGRyZW5VbnRpbENvbmRpdGlvbk1ldCB9IGZyb20gJy4vdXRpbHMvdHJhdmVyc2VDaGlsZHJlblVudGlsQ29uZGl0aW9uTWV0JztcclxuXHJcbmV4cG9ydCBjbGFzcyBWUk1TcHJpbmdCb25lTWFuYWdlciB7XHJcbiAgcHJpdmF0ZSBfam9pbnRzID0gbmV3IFNldDxWUk1TcHJpbmdCb25lSm9pbnQ+KCk7XHJcbiAgcHVibGljIGdldCBqb2ludHMoKTogU2V0PFZSTVNwcmluZ0JvbmVKb2ludD4ge1xyXG4gICAgcmV0dXJuIHRoaXMuX2pvaW50cztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEBkZXByZWNhdGVkIFVzZSB7QGxpbmsgam9pbnRzfSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgc3ByaW5nQm9uZXMoKTogU2V0PFZSTVNwcmluZ0JvbmVKb2ludD4ge1xyXG4gICAgY29uc29sZS53YXJuKCdWUk1Mb29rQXQ6IHNwcmluZ0JvbmVzIGlzIGRlcHJlY2F0ZWQuIHVzZSBqb2ludHMgaW5zdGVhZC4nKTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5fam9pbnRzO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBjb2xsaWRlckdyb3VwcygpOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdIHtcclxuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8VlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXA+KCk7XHJcbiAgICB0aGlzLl9qb2ludHMuZm9yRWFjaCgoc3ByaW5nQm9uZSkgPT4ge1xyXG4gICAgICBzcHJpbmdCb25lLmNvbGxpZGVyR3JvdXBzLmZvckVhY2goKGNvbGxpZGVyR3JvdXApID0+IHtcclxuICAgICAgICBzZXQuYWRkKGNvbGxpZGVyR3JvdXApO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIEFycmF5LmZyb20oc2V0KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgY29sbGlkZXJzKCk6IFZSTVNwcmluZ0JvbmVDb2xsaWRlcltdIHtcclxuICAgIGNvbnN0IHNldCA9IG5ldyBTZXQ8VlJNU3ByaW5nQm9uZUNvbGxpZGVyPigpO1xyXG4gICAgdGhpcy5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckdyb3VwKSA9PiB7XHJcbiAgICAgIGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XHJcbiAgICAgICAgc2V0LmFkZChjb2xsaWRlcik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gQXJyYXkuZnJvbShzZXQpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfb2JqZWN0U3ByaW5nQm9uZXNNYXAgPSBuZXcgTWFwPFRIUkVFLk9iamVjdDNELCBTZXQ8VlJNU3ByaW5nQm9uZUpvaW50Pj4oKTtcclxuXHJcbiAgcHVibGljIGFkZEpvaW50KGpvaW50OiBWUk1TcHJpbmdCb25lSm9pbnQpOiB2b2lkIHtcclxuICAgIHRoaXMuX2pvaW50cy5hZGQoam9pbnQpO1xyXG5cclxuICAgIGxldCBvYmplY3RTZXQgPSB0aGlzLl9vYmplY3RTcHJpbmdCb25lc01hcC5nZXQoam9pbnQuYm9uZSk7XHJcbiAgICBpZiAob2JqZWN0U2V0ID09IG51bGwpIHtcclxuICAgICAgb2JqZWN0U2V0ID0gbmV3IFNldDxWUk1TcHJpbmdCb25lSm9pbnQ+KCk7XHJcbiAgICAgIHRoaXMuX29iamVjdFNwcmluZ0JvbmVzTWFwLnNldChqb2ludC5ib25lLCBvYmplY3RTZXQpO1xyXG4gICAgfVxyXG4gICAgb2JqZWN0U2V0LmFkZChqb2ludCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBVc2Uge0BsaW5rIGFkZEpvaW50fSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBhZGRTcHJpbmdCb25lKGpvaW50OiBWUk1TcHJpbmdCb25lSm9pbnQpOiB2b2lkIHtcclxuICAgIGNvbnNvbGUud2FybignVlJNTG9va0F0OiBhZGRTcHJpbmdCb25lKCkgaXMgZGVwcmVjYXRlZC4gdXNlIGFkZEpvaW50KCkgaW5zdGVhZC4nKTtcclxuXHJcbiAgICB0aGlzLmFkZEpvaW50KGpvaW50KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBkZWxldGVKb2ludChqb2ludDogVlJNU3ByaW5nQm9uZUpvaW50KTogdm9pZCB7XHJcbiAgICB0aGlzLl9qb2ludHMuZGVsZXRlKGpvaW50KTtcclxuXHJcbiAgICBjb25zdCBvYmplY3RTZXQgPSB0aGlzLl9vYmplY3RTcHJpbmdCb25lc01hcC5nZXQoam9pbnQuYm9uZSkhO1xyXG4gICAgb2JqZWN0U2V0LmRlbGV0ZShqb2ludCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBAZGVwcmVjYXRlZCBVc2Uge0BsaW5rIGRlbGV0ZUpvaW50fSBpbnN0ZWFkLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBkZWxldGVTcHJpbmdCb25lKGpvaW50OiBWUk1TcHJpbmdCb25lSm9pbnQpOiB2b2lkIHtcclxuICAgIGNvbnNvbGUud2FybignVlJNTG9va0F0OiBkZWxldGVTcHJpbmdCb25lKCkgaXMgZGVwcmVjYXRlZC4gdXNlIGRlbGV0ZUpvaW50KCkgaW5zdGVhZC4nKTtcclxuXHJcbiAgICB0aGlzLmRlbGV0ZUpvaW50KGpvaW50KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzZXRJbml0U3RhdGUoKTogdm9pZCB7XHJcbiAgICBjb25zdCBzcHJpbmdCb25lc1RyaWVkID0gbmV3IFNldDxWUk1TcHJpbmdCb25lSm9pbnQ+KCk7XHJcbiAgICBjb25zdCBzcHJpbmdCb25lc0RvbmUgPSBuZXcgU2V0PFZSTVNwcmluZ0JvbmVKb2ludD4oKTtcclxuICAgIGNvbnN0IG9iamVjdFVwZGF0ZWQgPSBuZXcgU2V0PFRIUkVFLk9iamVjdDNEPigpO1xyXG5cclxuICAgIGZvciAoY29uc3Qgc3ByaW5nQm9uZSBvZiB0aGlzLl9qb2ludHMpIHtcclxuICAgICAgdGhpcy5fcHJvY2Vzc1NwcmluZ0JvbmUoc3ByaW5nQm9uZSwgc3ByaW5nQm9uZXNUcmllZCwgc3ByaW5nQm9uZXNEb25lLCBvYmplY3RVcGRhdGVkLCAoc3ByaW5nQm9uZSkgPT5cclxuICAgICAgICBzcHJpbmdCb25lLnNldEluaXRTdGF0ZSgpLFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIHJlc2V0KCk6IHZvaWQge1xyXG4gICAgY29uc3Qgc3ByaW5nQm9uZXNUcmllZCA9IG5ldyBTZXQ8VlJNU3ByaW5nQm9uZUpvaW50PigpO1xyXG4gICAgY29uc3Qgc3ByaW5nQm9uZXNEb25lID0gbmV3IFNldDxWUk1TcHJpbmdCb25lSm9pbnQ+KCk7XHJcbiAgICBjb25zdCBvYmplY3RVcGRhdGVkID0gbmV3IFNldDxUSFJFRS5PYmplY3QzRD4oKTtcclxuXHJcbiAgICBmb3IgKGNvbnN0IHNwcmluZ0JvbmUgb2YgdGhpcy5fam9pbnRzKSB7XHJcbiAgICAgIHRoaXMuX3Byb2Nlc3NTcHJpbmdCb25lKHNwcmluZ0JvbmUsIHNwcmluZ0JvbmVzVHJpZWQsIHNwcmluZ0JvbmVzRG9uZSwgb2JqZWN0VXBkYXRlZCwgKHNwcmluZ0JvbmUpID0+XHJcbiAgICAgICAgc3ByaW5nQm9uZS5yZXNldCgpLFxyXG4gICAgICApO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICBjb25zdCBzcHJpbmdCb25lc1RyaWVkID0gbmV3IFNldDxWUk1TcHJpbmdCb25lSm9pbnQ+KCk7XHJcbiAgICBjb25zdCBzcHJpbmdCb25lc0RvbmUgPSBuZXcgU2V0PFZSTVNwcmluZ0JvbmVKb2ludD4oKTtcclxuICAgIGNvbnN0IG9iamVjdFVwZGF0ZWQgPSBuZXcgU2V0PFRIUkVFLk9iamVjdDNEPigpO1xyXG5cclxuICAgIGZvciAoY29uc3Qgc3ByaW5nQm9uZSBvZiB0aGlzLl9qb2ludHMpIHtcclxuICAgICAgLy8gdXBkYXRlIHRoZSBzcHJpbmdib25lXHJcbiAgICAgIHRoaXMuX3Byb2Nlc3NTcHJpbmdCb25lKHNwcmluZ0JvbmUsIHNwcmluZ0JvbmVzVHJpZWQsIHNwcmluZ0JvbmVzRG9uZSwgb2JqZWN0VXBkYXRlZCwgKHNwcmluZ0JvbmUpID0+XHJcbiAgICAgICAgc3ByaW5nQm9uZS51cGRhdGUoZGVsdGEpLFxyXG4gICAgICApO1xyXG5cclxuICAgICAgLy8gdXBkYXRlIGNoaWxkcmVuIHdvcmxkIG1hdHJpY2VzXHJcbiAgICAgIC8vIGl0IGlzIHJlcXVpcmVkIHdoZW4gdGhlIHNwcmluZyBib25lIGNoYWluIGlzIHNwYXJzZVxyXG4gICAgICB0cmF2ZXJzZUNoaWxkcmVuVW50aWxDb25kaXRpb25NZXQoc3ByaW5nQm9uZS5ib25lLCAob2JqZWN0KSA9PiB7XHJcbiAgICAgICAgLy8gaWYgdGhlIG9iamVjdCBoYXMgYXR0YWNoZWQgc3ByaW5nYm9uZSwgaGFsdCB0aGUgdHJhdmVyc2FsXHJcbiAgICAgICAgaWYgKCh0aGlzLl9vYmplY3RTcHJpbmdCb25lc01hcC5nZXQob2JqZWN0KT8uc2l6ZSA/PyAwKSA+IDApIHtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gb3RoZXJ3aXNlIHVwZGF0ZSBpdHMgd29ybGQgbWF0cml4XHJcbiAgICAgICAgb2JqZWN0LnVwZGF0ZVdvcmxkTWF0cml4KGZhbHNlLCBmYWxzZSk7XHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBhIHNwcmluZyBib25lLlxyXG4gICAqIElmIHRoZXJlIGFyZSBvdGhlciBzcHJpbmcgYm9uZSB0aGF0IGFyZSBkZXBlbmRhbnQsIGl0IHdpbGwgdHJ5IHRvIHVwZGF0ZSB0aGVtIHJlY3Vyc2l2ZWx5LlxyXG4gICAqIEl0IHVwZGF0ZXMgbWF0cml4V29ybGQgb2YgYWxsIGFuY2VzdG9ycyBhbmQgbXlzZWxmLlxyXG4gICAqIEl0IG1pZ2h0IHRocm93IGFuIGVycm9yIGlmIHRoZXJlIGFyZSBjaXJjdWxhciBkZXBlbmRlbmNpZXMuXHJcbiAgICpcclxuICAgKiBJbnRlbmRlZCB0byBiZSB1c2VkIGluIHtAbGluayB1cGRhdGV9IGFuZCB7QGxpbmsgX3Byb2Nlc3NTcHJpbmdCb25lfSBpdHNlbGYgcmVjdXJzaXZlbHkuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gc3ByaW5nQm9uZSBBIHNwcmluZ0JvbmUgeW91IHdhbnQgdG8gdXBkYXRlXHJcbiAgICogQHBhcmFtIHNwcmluZ0JvbmVzVHJpZWQgU2V0IG9mIHNwcmluZ0JvbmVzIHRoYXQgYXJlIGFscmVhZHkgdHJpZWQgdG8gYmUgdXBkYXRlZFxyXG4gICAqIEBwYXJhbSBzcHJpbmdCb25lc0RvbmUgU2V0IG9mIHNwcmluZ0JvbmVzIHRoYXQgYXJlIGFscmVhZHkgdXAgdG8gZGF0ZVxyXG4gICAqIEBwYXJhbSBvYmplY3RVcGRhdGVkIFNldCBvZiBvYmplY3QzRCB3aG9zZSBtYXRyaXhXb3JsZCBpcyB1cGRhdGVkXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfcHJvY2Vzc1NwcmluZ0JvbmUoXHJcbiAgICBzcHJpbmdCb25lOiBWUk1TcHJpbmdCb25lSm9pbnQsXHJcbiAgICBzcHJpbmdCb25lc1RyaWVkOiBTZXQ8VlJNU3ByaW5nQm9uZUpvaW50PixcclxuICAgIHNwcmluZ0JvbmVzRG9uZTogU2V0PFZSTVNwcmluZ0JvbmVKb2ludD4sXHJcbiAgICBvYmplY3RVcGRhdGVkOiBTZXQ8VEhSRUUuT2JqZWN0M0Q+LFxyXG4gICAgY2FsbGJhY2s6IChzcHJpbmdCb25lOiBWUk1TcHJpbmdCb25lSm9pbnQpID0+IHZvaWQsXHJcbiAgKTogdm9pZCB7XHJcbiAgICBpZiAoc3ByaW5nQm9uZXNEb25lLmhhcyhzcHJpbmdCb25lKSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNwcmluZ0JvbmVzVHJpZWQuaGFzKHNwcmluZ0JvbmUpKSB7XHJcbiAgICAgIHRocm93IG5ldyBFcnJvcignVlJNU3ByaW5nQm9uZU1hbmFnZXI6IENpcmN1bGFyIGRlcGVuZGVuY3kgZGV0ZWN0ZWQgd2hpbGUgdXBkYXRpbmcgc3ByaW5nYm9uZXMnKTtcclxuICAgIH1cclxuICAgIHNwcmluZ0JvbmVzVHJpZWQuYWRkKHNwcmluZ0JvbmUpO1xyXG5cclxuICAgIGNvbnN0IGRlcE9iamVjdHMgPSB0aGlzLl9nZXREZXBlbmRlbmNpZXMoc3ByaW5nQm9uZSk7XHJcbiAgICBmb3IgKGNvbnN0IGRlcE9iamVjdCBvZiBkZXBPYmplY3RzKSB7XHJcbiAgICAgIHRyYXZlcnNlQW5jZXN0b3JzRnJvbVJvb3QoZGVwT2JqZWN0LCAoZGVwT2JqZWN0QW5jZXN0b3IpID0+IHtcclxuICAgICAgICBjb25zdCBvYmplY3RTZXQgPSB0aGlzLl9vYmplY3RTcHJpbmdCb25lc01hcC5nZXQoZGVwT2JqZWN0QW5jZXN0b3IpO1xyXG4gICAgICAgIGlmIChvYmplY3RTZXQpIHtcclxuICAgICAgICAgIGZvciAoY29uc3QgZGVwU3ByaW5nQm9uZSBvZiBvYmplY3RTZXQpIHtcclxuICAgICAgICAgICAgdGhpcy5fcHJvY2Vzc1NwcmluZ0JvbmUoZGVwU3ByaW5nQm9uZSwgc3ByaW5nQm9uZXNUcmllZCwgc3ByaW5nQm9uZXNEb25lLCBvYmplY3RVcGRhdGVkLCBjYWxsYmFjayk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmICghb2JqZWN0VXBkYXRlZC5oYXMoZGVwT2JqZWN0QW5jZXN0b3IpKSB7XHJcbiAgICAgICAgICAvLyB1cGRhdGUgbWF0cml4IG9mIG5vbi1zcHJpbmdib25lXHJcbiAgICAgICAgICBkZXBPYmplY3RBbmNlc3Rvci51cGRhdGVXb3JsZE1hdHJpeChmYWxzZSwgZmFsc2UpO1xyXG4gICAgICAgICAgb2JqZWN0VXBkYXRlZC5hZGQoZGVwT2JqZWN0QW5jZXN0b3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gdXBkYXRlIG15IG1hdHJpeFxyXG4gICAgc3ByaW5nQm9uZS5ib25lLnVwZGF0ZU1hdHJpeCgpO1xyXG4gICAgc3ByaW5nQm9uZS5ib25lLnVwZGF0ZVdvcmxkTWF0cml4KGZhbHNlLCBmYWxzZSk7XHJcblxyXG4gICAgY2FsbGJhY2soc3ByaW5nQm9uZSk7XHJcblxyXG4gICAgb2JqZWN0VXBkYXRlZC5hZGQoc3ByaW5nQm9uZS5ib25lKTtcclxuXHJcbiAgICBzcHJpbmdCb25lc0RvbmUuYWRkKHNwcmluZ0JvbmUpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJuIGEgc2V0IG9mIG9iamVjdHMgdGhhdCBhcmUgZGVwZW5kYW50IG9mIGdpdmVuIHNwcmluZyBib25lLlxyXG4gICAqIEBwYXJhbSBzcHJpbmdCb25lIEEgc3ByaW5nIGJvbmVcclxuICAgKiBAcmV0dXJuIEEgc2V0IG9mIG9iamVjdHMgdGhhdCBhcmUgZGVwZW5kYW50IG9mIGdpdmVuIHNwcmluZyBib25lXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfZ2V0RGVwZW5kZW5jaWVzKHNwcmluZ0JvbmU6IFZSTVNwcmluZ0JvbmVKb2ludCk6IFNldDxUSFJFRS5PYmplY3QzRD4ge1xyXG4gICAgY29uc3Qgc2V0ID0gbmV3IFNldDxUSFJFRS5PYmplY3QzRD4oKTtcclxuXHJcbiAgICBjb25zdCBwYXJlbnQgPSBzcHJpbmdCb25lLmJvbmUucGFyZW50O1xyXG4gICAgaWYgKHBhcmVudCkge1xyXG4gICAgICBzZXQuYWRkKHBhcmVudCk7XHJcbiAgICB9XHJcblxyXG4gICAgc3ByaW5nQm9uZS5jb2xsaWRlckdyb3Vwcy5mb3JFYWNoKChjb2xsaWRlckdyb3VwKSA9PiB7XHJcbiAgICAgIGNvbGxpZGVyR3JvdXAuY29sbGlkZXJzLmZvckVhY2goKGNvbGxpZGVyKSA9PiB7XHJcbiAgICAgICAgc2V0LmFkZChjb2xsaWRlcik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHNldDtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0IHR5cGUgKiBhcyBWMFZSTSBmcm9tICdAcGl4aXYvdHlwZXMtdnJtLTAuMCc7XHJcbmltcG9ydCB0eXBlICogYXMgVjFTcHJpbmdCb25lU2NoZW1hIGZyb20gJ0BwaXhpdi90eXBlcy12cm1jLXNwcmluZ2JvbmUtMS4wJztcclxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgdHlwZSB7IEdMVEYsIEdMVEZMb2FkZXJQbHVnaW4sIEdMVEZQYXJzZXIgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVySGVscGVyLCBWUk1TcHJpbmdCb25lSm9pbnRIZWxwZXIgfSBmcm9tICcuL2hlbHBlcnMnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXIgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVDb2xsaWRlcic7XHJcbmltcG9ydCB0eXBlIHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyR3JvdXAgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVDYXBzdWxlIH0gZnJvbSAnLi9WUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZUNhcHN1bGUnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lQ29sbGlkZXJTaGFwZVNwaGVyZSB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUNvbGxpZGVyU2hhcGVTcGhlcmUnO1xyXG5pbXBvcnQgeyBWUk1TcHJpbmdCb25lSm9pbnQgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVKb2ludCc7XHJcbmltcG9ydCB0eXBlIHsgVlJNU3ByaW5nQm9uZUxvYWRlclBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVMb2FkZXJQbHVnaW5PcHRpb25zJztcclxuaW1wb3J0IHsgVlJNU3ByaW5nQm9uZU1hbmFnZXIgfSBmcm9tICcuL1ZSTVNwcmluZ0JvbmVNYW5hZ2VyJztcclxuaW1wb3J0IHR5cGUgeyBWUk1TcHJpbmdCb25lSm9pbnRTZXR0aW5ncyB9IGZyb20gJy4vVlJNU3ByaW5nQm9uZUpvaW50U2V0dGluZ3MnO1xyXG5pbXBvcnQgeyBHTFRGIGFzIEdMVEZTY2hlbWEgfSBmcm9tICdAZ2x0Zi10cmFuc2Zvcm0vY29yZSc7XHJcblxyXG5leHBvcnQgY2xhc3MgVlJNU3ByaW5nQm9uZUxvYWRlclBsdWdpbiBpbXBsZW1lbnRzIEdMVEZMb2FkZXJQbHVnaW4ge1xyXG4gIHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgRVhURU5TSU9OX05BTUUgPSAnVlJNQ19zcHJpbmdCb25lJztcclxuXHJcbiAgLyoqXHJcbiAgICogU3BlY2lmeSBhbiBPYmplY3QzRCB0byBhZGQge0BsaW5rIFZSTVNwcmluZ0JvbmVKb2ludEhlbHBlcn0gcy5cclxuICAgKiBJZiBub3Qgc3BlY2lmaWVkLCBoZWxwZXIgd2lsbCBub3QgYmUgY3JlYXRlZC5cclxuICAgKiBJZiBgcmVuZGVyT3JkZXJgIGlzIHNldCB0byB0aGUgcm9vdCwgaGVscGVycyB3aWxsIGNvcHkgdGhlIHNhbWUgYHJlbmRlck9yZGVyYCAuXHJcbiAgICovXHJcbiAgcHVibGljIGpvaW50SGVscGVyUm9vdD86IFRIUkVFLk9iamVjdDNEO1xyXG5cclxuICAvKipcclxuICAgKiBTcGVjaWZ5IGFuIE9iamVjdDNEIHRvIGFkZCB7QGxpbmsgVlJNU3ByaW5nQm9uZUpvaW50SGVscGVyfSBzLlxyXG4gICAqIElmIG5vdCBzcGVjaWZpZWQsIGhlbHBlciB3aWxsIG5vdCBiZSBjcmVhdGVkLlxyXG4gICAqIElmIGByZW5kZXJPcmRlcmAgaXMgc2V0IHRvIHRoZSByb290LCBoZWxwZXJzIHdpbGwgY29weSB0aGUgc2FtZSBgcmVuZGVyT3JkZXJgIC5cclxuICAgKi9cclxuICBwdWJsaWMgY29sbGlkZXJIZWxwZXJSb290PzogVEhSRUUuT2JqZWN0M0Q7XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBwYXJzZXI6IEdMVEZQYXJzZXI7XHJcblxyXG4gIHB1YmxpYyBnZXQgbmFtZSgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIFZSTVNwcmluZ0JvbmVMb2FkZXJQbHVnaW4uRVhURU5TSU9OX05BTUU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyc2VyOiBHTFRGUGFyc2VyLCBvcHRpb25zPzogVlJNU3ByaW5nQm9uZUxvYWRlclBsdWdpbk9wdGlvbnMpIHtcclxuICAgIHRoaXMucGFyc2VyID0gcGFyc2VyO1xyXG5cclxuICAgIHRoaXMuam9pbnRIZWxwZXJSb290ID0gb3B0aW9ucz8uam9pbnRIZWxwZXJSb290O1xyXG4gICAgdGhpcy5jb2xsaWRlckhlbHBlclJvb3QgPSBvcHRpb25zPy5jb2xsaWRlckhlbHBlclJvb3Q7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgYWZ0ZXJSb290KGdsdGY6IEdMVEYpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGdsdGYudXNlckRhdGEudnJtU3ByaW5nQm9uZU1hbmFnZXIgPSBhd2FpdCB0aGlzLl9pbXBvcnQoZ2x0Zik7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBJbXBvcnQgc3ByaW5nIGJvbmVzIGZyb20gYSBHTFRGIGFuZCByZXR1cm4gYSB7QGxpbmsgVlJNU3ByaW5nQm9uZU1hbmFnZXJ9LlxyXG4gICAqIEl0IG1pZ2h0IHJldHVybiBgbnVsbGAgaW5zdGVhZCB3aGVuIGl0IGRvZXMgbm90IG5lZWQgdG8gYmUgY3JlYXRlZCBvciBzb21ldGhpbmcgZ28gd3JvbmcuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZ2x0ZiBBIHBhcnNlZCByZXN1bHQgb2YgR0xURiB0YWtlbiBmcm9tIEdMVEZMb2FkZXJcclxuICAgKi9cclxuICBwcml2YXRlIGFzeW5jIF9pbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNU3ByaW5nQm9uZU1hbmFnZXIgfCBudWxsPiB7XHJcbiAgICBjb25zdCB2MVJlc3VsdCA9IGF3YWl0IHRoaXMuX3YxSW1wb3J0KGdsdGYpO1xyXG4gICAgaWYgKHYxUmVzdWx0ICE9IG51bGwpIHtcclxuICAgICAgcmV0dXJuIHYxUmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHYwUmVzdWx0ID0gYXdhaXQgdGhpcy5fdjBJbXBvcnQoZ2x0Zik7XHJcbiAgICBpZiAodjBSZXN1bHQgIT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gdjBSZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGFzeW5jIF92MUltcG9ydChnbHRmOiBHTFRGKTogUHJvbWlzZTxWUk1TcHJpbmdCb25lTWFuYWdlciB8IG51bGw+IHtcclxuICAgIGNvbnN0IGpzb24gPSBnbHRmLnBhcnNlci5qc29uIGFzIEdMVEZTY2hlbWEuSUdMVEY7XHJcblxyXG4gICAgLy8gZWFybHkgYWJvcnQgaWYgaXQgZG9lc24ndCB1c2Ugc3ByaW5nIGJvbmVzXHJcbiAgICBjb25zdCBpc1NwcmluZ0JvbmVVc2VkID0ganNvbi5leHRlbnNpb25zVXNlZD8uaW5kZXhPZihWUk1TcHJpbmdCb25lTG9hZGVyUGx1Z2luLkVYVEVOU0lPTl9OQU1FKSAhPT0gLTE7XHJcbiAgICBpZiAoIWlzU3ByaW5nQm9uZVVzZWQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbWFuYWdlciA9IG5ldyBWUk1TcHJpbmdCb25lTWFuYWdlcigpO1xyXG5cclxuICAgIGNvbnN0IHRocmVlTm9kZXM6IFRIUkVFLk9iamVjdDNEW10gPSBhd2FpdCBnbHRmLnBhcnNlci5nZXREZXBlbmRlbmNpZXMoJ25vZGUnKTtcclxuXHJcbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LltWUk1TcHJpbmdCb25lTG9hZGVyUGx1Z2luLkVYVEVOU0lPTl9OQU1FXSBhc1xyXG4gICAgICB8IFYxU3ByaW5nQm9uZVNjaGVtYS5WUk1DU3ByaW5nQm9uZVxyXG4gICAgICB8IHVuZGVmaW5lZDtcclxuICAgIGlmICghZXh0ZW5zaW9uKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNwZWNWZXJzaW9uID0gZXh0ZW5zaW9uLnNwZWNWZXJzaW9uO1xyXG4gICAgaWYgKHNwZWNWZXJzaW9uICE9PSAnMS4wLWJldGEnKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGNvbGxpZGVycyA9IGV4dGVuc2lvbi5jb2xsaWRlcnM/Lm1hcCgoc2NoZW1hQ29sbGlkZXIsIGlDb2xsaWRlcikgPT4ge1xyXG4gICAgICBjb25zdCBub2RlID0gdGhyZWVOb2Rlc1tzY2hlbWFDb2xsaWRlci5ub2RlIV07XHJcbiAgICAgIGNvbnN0IHNjaGVtYVNoYXBlID0gc2NoZW1hQ29sbGlkZXIuc2hhcGUhO1xyXG5cclxuICAgICAgaWYgKHNjaGVtYVNoYXBlLnNwaGVyZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9pbXBvcnRTcGhlcmVDb2xsaWRlcihub2RlLCB7XHJcbiAgICAgICAgICBvZmZzZXQ6IG5ldyBUSFJFRS5WZWN0b3IzKCkuZnJvbUFycmF5KHNjaGVtYVNoYXBlLnNwaGVyZS5vZmZzZXQgPz8gWzAuMCwgMC4wLCAwLjBdKSxcclxuICAgICAgICAgIHJhZGl1czogc2NoZW1hU2hhcGUuc3BoZXJlLnJhZGl1cyA/PyAwLjAsXHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0gZWxzZSBpZiAoc2NoZW1hU2hhcGUuY2Fwc3VsZSkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9pbXBvcnRDYXBzdWxlQ29sbGlkZXIobm9kZSwge1xyXG4gICAgICAgICAgb2Zmc2V0OiBuZXcgVEhSRUUuVmVjdG9yMygpLmZyb21BcnJheShzY2hlbWFTaGFwZS5jYXBzdWxlLm9mZnNldCA/PyBbMC4wLCAwLjAsIDAuMF0pLFxyXG4gICAgICAgICAgcmFkaXVzOiBzY2hlbWFTaGFwZS5jYXBzdWxlLnJhZGl1cyA/PyAwLjAsXHJcbiAgICAgICAgICB0YWlsOiBuZXcgVEhSRUUuVmVjdG9yMygpLmZyb21BcnJheShzY2hlbWFTaGFwZS5jYXBzdWxlLnRhaWwgPz8gWzAuMCwgMC4wLCAwLjBdKSxcclxuICAgICAgICB9KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhyb3cgbmV3IEVycm9yKGBWUk1TcHJpbmdCb25lTG9hZGVyUGx1Z2luOiBUaGUgY29sbGlkZXIgIyR7aUNvbGxpZGVyfSBoYXMgbm8gdmFsaWQgc2hhcGVgKTtcclxuICAgIH0pO1xyXG5cclxuICAgIGNvbnN0IGNvbGxpZGVyR3JvdXBzID0gZXh0ZW5zaW9uLmNvbGxpZGVyR3JvdXBzPy5tYXAoXHJcbiAgICAgIChzY2hlbWFDb2xsaWRlckdyb3VwLCBpQ29sbGlkZXJHcm91cCk6IFZSTVNwcmluZ0JvbmVDb2xsaWRlckdyb3VwID0+IHtcclxuICAgICAgICBjb25zdCBjb2xzID0gKHNjaGVtYUNvbGxpZGVyR3JvdXAuY29sbGlkZXJzID8/IFtdKS5tYXAoKGlDb2xsaWRlcikgPT4ge1xyXG4gICAgICAgICAgY29uc3QgY29sID0gY29sbGlkZXJzPy5baUNvbGxpZGVyXTtcclxuXHJcbiAgICAgICAgICBpZiAoY29sID09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgIGBWUk1TcHJpbmdCb25lTG9hZGVyUGx1Z2luOiBUaGUgY29sbGlkZXJHcm91cCAjJHtpQ29sbGlkZXJHcm91cH0gYXR0ZW1wdGVkIHRvIHVzZSBhIGNvbGxpZGVyICMke2lDb2xsaWRlcn0gYnV0IG5vdCBmb3VuZGAsXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmV0dXJuIGNvbDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgIGNvbGxpZGVyczogY29scyxcclxuICAgICAgICAgIG5hbWU6IHNjaGVtYUNvbGxpZGVyR3JvdXAubmFtZSxcclxuICAgICAgICB9O1xyXG4gICAgICB9LFxyXG4gICAgKTtcclxuXHJcbiAgICBleHRlbnNpb24uc3ByaW5ncz8uZm9yRWFjaCgoc2NoZW1hU3ByaW5nLCBpU3ByaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNjaGVtYUpvaW50cyA9IHNjaGVtYVNwcmluZy5qb2ludHM7XHJcblxyXG4gICAgICAvLyBwcmVwYXJlIGNvbGxpZGVyc1xyXG4gICAgICBjb25zdCBjb2xsaWRlckdyb3Vwc0ZvclNwcmluZyA9IHNjaGVtYVNwcmluZy5jb2xsaWRlckdyb3Vwcz8ubWFwKChpQ29sbGlkZXJHcm91cCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGdyb3VwID0gY29sbGlkZXJHcm91cHM/LltpQ29sbGlkZXJHcm91cF07XHJcblxyXG4gICAgICAgIGlmIChncm91cCA9PSBudWxsKSB7XHJcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgICAgIGBWUk1TcHJpbmdCb25lTG9hZGVyUGx1Z2luOiBUaGUgc3ByaW5nICMke2lTcHJpbmd9IGF0dGVtcHRlZCB0byB1c2UgYSBjb2xsaWRlckdyb3VwICR7aUNvbGxpZGVyR3JvdXB9IGJ1dCBub3QgZm91bmRgLFxyXG4gICAgICAgICAgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBncm91cDtcclxuICAgICAgfSk7XHJcblxyXG4gICAgICBjb25zdCBjZW50ZXIgPSBzY2hlbWFTcHJpbmcuY2VudGVyICE9IG51bGwgPyB0aHJlZU5vZGVzW3NjaGVtYVNwcmluZy5jZW50ZXJdIDogdW5kZWZpbmVkO1xyXG5cclxuICAgICAgbGV0IHByZXZTY2hlbWFKb2ludDogVjFTcHJpbmdCb25lU2NoZW1hLlNwcmluZ0JvbmVKb2ludCB8IHVuZGVmaW5lZDtcclxuICAgICAgc2NoZW1hSm9pbnRzLmZvckVhY2goKHNjaGVtYUpvaW50KSA9PiB7XHJcbiAgICAgICAgaWYgKHByZXZTY2hlbWFKb2ludCkge1xyXG4gICAgICAgICAgLy8gcHJlcGFyZSBub2RlXHJcbiAgICAgICAgICBjb25zdCBub2RlSW5kZXggPSBwcmV2U2NoZW1hSm9pbnQubm9kZTtcclxuICAgICAgICAgIGNvbnN0IG5vZGUgPSB0aHJlZU5vZGVzW25vZGVJbmRleF07XHJcbiAgICAgICAgICBjb25zdCBjaGlsZEluZGV4ID0gc2NoZW1hSm9pbnQubm9kZTtcclxuICAgICAgICAgIGNvbnN0IGNoaWxkID0gdGhyZWVOb2Rlc1tjaGlsZEluZGV4XTtcclxuXHJcbiAgICAgICAgICAvLyBwcmVwYXJlIHNldHRpbmdcclxuICAgICAgICAgIGNvbnN0IHNldHRpbmc6IFBhcnRpYWw8VlJNU3ByaW5nQm9uZUpvaW50U2V0dGluZ3M+ID0ge1xyXG4gICAgICAgICAgICBoaXRSYWRpdXM6IHByZXZTY2hlbWFKb2ludC5oaXRSYWRpdXMsXHJcbiAgICAgICAgICAgIGRyYWdGb3JjZTogcHJldlNjaGVtYUpvaW50LmRyYWdGb3JjZSxcclxuICAgICAgICAgICAgZ3Jhdml0eVBvd2VyOiBwcmV2U2NoZW1hSm9pbnQuZ3Jhdml0eVBvd2VyLFxyXG4gICAgICAgICAgICBzdGlmZm5lc3M6IHByZXZTY2hlbWFKb2ludC5zdGlmZm5lc3MsXHJcbiAgICAgICAgICAgIGdyYXZpdHlEaXI6XHJcbiAgICAgICAgICAgICAgcHJldlNjaGVtYUpvaW50LmdyYXZpdHlEaXIgIT0gbnVsbFxyXG4gICAgICAgICAgICAgICAgPyBuZXcgVEhSRUUuVmVjdG9yMygpLmZyb21BcnJheShwcmV2U2NoZW1hSm9pbnQuZ3Jhdml0eURpcilcclxuICAgICAgICAgICAgICAgIDogdW5kZWZpbmVkLFxyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAvLyBjcmVhdGUgc3ByaW5nIGJvbmVzXHJcbiAgICAgICAgICBjb25zdCBqb2ludCA9IHRoaXMuX2ltcG9ydEpvaW50KG5vZGUsIGNoaWxkLCBzZXR0aW5nLCBjb2xsaWRlckdyb3Vwc0ZvclNwcmluZyk7XHJcbiAgICAgICAgICBpZiAoY2VudGVyKSB7XHJcbiAgICAgICAgICAgIGpvaW50LmNlbnRlciA9IGNlbnRlcjtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICBtYW5hZ2VyLmFkZEpvaW50KGpvaW50KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHByZXZTY2hlbWFKb2ludCA9IHNjaGVtYUpvaW50O1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIGluaXQgc3ByaW5nIGJvbmVzXHJcbiAgICBtYW5hZ2VyLnNldEluaXRTdGF0ZSgpO1xyXG5cclxuICAgIHJldHVybiBtYW5hZ2VyO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBfdjBJbXBvcnQoZ2x0ZjogR0xURik6IFByb21pc2U8VlJNU3ByaW5nQm9uZU1hbmFnZXIgfCBudWxsPiB7XHJcbiAgICBjb25zdCBqc29uID0gZ2x0Zi5wYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIC8vIGVhcmx5IGFib3J0IGlmIGl0IGRvZXNuJ3QgdXNlIHZybVxyXG4gICAgY29uc3QgaXNWUk1Vc2VkID0ganNvbi5leHRlbnNpb25zVXNlZD8uaW5kZXhPZignVlJNJykgIT09IC0xO1xyXG4gICAgaWYgKCFpc1ZSTVVzZWQpIHtcclxuICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gZWFybHkgYWJvcnQgaWYgaXQgZG9lc24ndCBoYXZlIGJvbmUgZ3JvdXBzXHJcbiAgICBjb25zdCBleHRlbnNpb24gPSBqc29uLmV4dGVuc2lvbnM/LlsnVlJNJ10gYXMgVjBWUk0uVlJNIHwgdW5kZWZpbmVkO1xyXG4gICAgY29uc3Qgc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uID0gZXh0ZW5zaW9uPy5zZWNvbmRhcnlBbmltYXRpb247XHJcbiAgICBpZiAoIXNjaGVtYVNlY29uZGFyeUFuaW1hdGlvbikge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBzY2hlbWFCb25lR3JvdXBzID0gc2NoZW1hU2Vjb25kYXJ5QW5pbWF0aW9uPy5ib25lR3JvdXBzO1xyXG4gICAgaWYgKCFzY2hlbWFCb25lR3JvdXBzKSB7XHJcbiAgICAgIHJldHVybiBudWxsO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IG1hbmFnZXIgPSBuZXcgVlJNU3ByaW5nQm9uZU1hbmFnZXIoKTtcclxuXHJcbiAgICBjb25zdCB0aHJlZU5vZGVzOiBUSFJFRS5PYmplY3QzRFtdID0gYXdhaXQgZ2x0Zi5wYXJzZXIuZ2V0RGVwZW5kZW5jaWVzKCdub2RlJyk7XHJcblxyXG4gICAgY29uc3QgY29sbGlkZXJHcm91cHMgPSBzY2hlbWFTZWNvbmRhcnlBbmltYXRpb24uY29sbGlkZXJHcm91cHM/Lm1hcChcclxuICAgICAgKHNjaGVtYUNvbGxpZGVyR3JvdXApOiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cCA9PiB7XHJcbiAgICAgICAgY29uc3Qgbm9kZSA9IHRocmVlTm9kZXNbc2NoZW1hQ29sbGlkZXJHcm91cC5ub2RlIV07XHJcbiAgICAgICAgY29uc3QgY29sbGlkZXJzID0gKHNjaGVtYUNvbGxpZGVyR3JvdXAuY29sbGlkZXJzID8/IFtdKS5tYXAoKHNjaGVtYUNvbGxpZGVyLCBpQ29sbGlkZXIpID0+IHtcclxuICAgICAgICAgIGNvbnN0IG9mZnNldCA9IG5ldyBUSFJFRS5WZWN0b3IzKDAuMCwgMC4wLCAwLjApO1xyXG4gICAgICAgICAgaWYgKHNjaGVtYUNvbGxpZGVyLm9mZnNldCkge1xyXG4gICAgICAgICAgICBvZmZzZXQuc2V0KFxyXG4gICAgICAgICAgICAgIHNjaGVtYUNvbGxpZGVyLm9mZnNldC54ID8/IDAuMCxcclxuICAgICAgICAgICAgICBzY2hlbWFDb2xsaWRlci5vZmZzZXQueSA/PyAwLjAsXHJcbiAgICAgICAgICAgICAgc2NoZW1hQ29sbGlkZXIub2Zmc2V0LnogPyAtc2NoZW1hQ29sbGlkZXIub2Zmc2V0LnogOiAwLjAsIC8vIHogaXMgb3Bwb3NpdGUgaW4gVlJNMC4wXHJcbiAgICAgICAgICAgICk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuX2ltcG9ydFNwaGVyZUNvbGxpZGVyKG5vZGUsIHtcclxuICAgICAgICAgICAgb2Zmc2V0LFxyXG4gICAgICAgICAgICByYWRpdXM6IHNjaGVtYUNvbGxpZGVyLnJhZGl1cyA/PyAwLjAsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgcmV0dXJuIHsgY29sbGlkZXJzIH07XHJcbiAgICAgIH0sXHJcbiAgICApO1xyXG5cclxuICAgIC8vIGltcG9ydCBzcHJpbmcgYm9uZXMgZm9yIGVhY2ggc3ByaW5nIGJvbmUgZ3JvdXBzXHJcbiAgICBzY2hlbWFCb25lR3JvdXBzPy5mb3JFYWNoKChzY2hlbWFCb25lR3JvdXAsIGlCb25lR3JvdXApID0+IHtcclxuICAgICAgY29uc3Qgcm9vdEluZGljZXMgPSBzY2hlbWFCb25lR3JvdXAuYm9uZXM7XHJcbiAgICAgIGlmICghcm9vdEluZGljZXMpIHtcclxuICAgICAgICByZXR1cm47XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHJvb3RJbmRpY2VzLmZvckVhY2goKHJvb3RJbmRleCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IHJvb3QgPSB0aHJlZU5vZGVzW3Jvb3RJbmRleF07XHJcblxyXG4gICAgICAgIC8vIHByZXBhcmUgc2V0dGluZ1xyXG4gICAgICAgIGNvbnN0IGdyYXZpdHlEaXIgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xyXG4gICAgICAgIGlmIChzY2hlbWFCb25lR3JvdXAuZ3Jhdml0eURpcikge1xyXG4gICAgICAgICAgZ3Jhdml0eURpci5zZXQoXHJcbiAgICAgICAgICAgIHNjaGVtYUJvbmVHcm91cC5ncmF2aXR5RGlyLnggPz8gMC4wLFxyXG4gICAgICAgICAgICBzY2hlbWFCb25lR3JvdXAuZ3Jhdml0eURpci55ID8/IDAuMCxcclxuICAgICAgICAgICAgc2NoZW1hQm9uZUdyb3VwLmdyYXZpdHlEaXIueiA/PyAwLjAsXHJcbiAgICAgICAgICApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBncmF2aXR5RGlyLnNldCgwLjAsIC0xLjAsIDAuMCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBjZW50ZXIgPSBzY2hlbWFCb25lR3JvdXAuY2VudGVyICE9IG51bGwgPyB0aHJlZU5vZGVzW3NjaGVtYUJvbmVHcm91cC5jZW50ZXJdIDogdW5kZWZpbmVkO1xyXG5cclxuICAgICAgICBjb25zdCBzZXR0aW5nOiBQYXJ0aWFsPFZSTVNwcmluZ0JvbmVKb2ludFNldHRpbmdzPiA9IHtcclxuICAgICAgICAgIGhpdFJhZGl1czogc2NoZW1hQm9uZUdyb3VwLmhpdFJhZGl1cyxcclxuICAgICAgICAgIGRyYWdGb3JjZTogc2NoZW1hQm9uZUdyb3VwLmRyYWdGb3JjZSxcclxuICAgICAgICAgIGdyYXZpdHlQb3dlcjogc2NoZW1hQm9uZUdyb3VwLmdyYXZpdHlQb3dlcixcclxuICAgICAgICAgIHN0aWZmbmVzczogc2NoZW1hQm9uZUdyb3VwLnN0aWZmaW5lc3MsXHJcbiAgICAgICAgICBncmF2aXR5RGlyLFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vIHByZXBhcmUgY29sbGlkZXJzXHJcbiAgICAgICAgY29uc3QgY29sbGlkZXJHcm91cHNGb3JTcHJpbmcgPSBzY2hlbWFCb25lR3JvdXAuY29sbGlkZXJHcm91cHM/Lm1hcCgoaUNvbGxpZGVyR3JvdXApID0+IHtcclxuICAgICAgICAgIGNvbnN0IGdyb3VwID0gY29sbGlkZXJHcm91cHM/LltpQ29sbGlkZXJHcm91cF07XHJcblxyXG4gICAgICAgICAgaWYgKGdyb3VwID09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgICAgICAgIGBWUk1TcHJpbmdCb25lTG9hZGVyUGx1Z2luOiBUaGUgc3ByaW5nICMke2lCb25lR3JvdXB9IGF0dGVtcHRlZCB0byB1c2UgYSBjb2xsaWRlckdyb3VwICR7aUNvbGxpZGVyR3JvdXB9IGJ1dCBub3QgZm91bmRgLFxyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHJldHVybiBncm91cDtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gY3JlYXRlIHNwcmluZyBib25lc1xyXG4gICAgICAgIHJvb3QudHJhdmVyc2UoKG5vZGUpID0+IHtcclxuICAgICAgICAgIGNvbnN0IGNoaWxkOiBUSFJFRS5PYmplY3QzRCB8IG51bGwgPSBub2RlLmNoaWxkcmVuWzBdID8/IG51bGw7XHJcblxyXG4gICAgICAgICAgY29uc3Qgam9pbnQgPSB0aGlzLl9pbXBvcnRKb2ludChub2RlLCBjaGlsZCwgc2V0dGluZywgY29sbGlkZXJHcm91cHNGb3JTcHJpbmcpO1xyXG4gICAgICAgICAgaWYgKGNlbnRlcikge1xyXG4gICAgICAgICAgICBqb2ludC5jZW50ZXIgPSBjZW50ZXI7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgbWFuYWdlci5hZGRKb2ludChqb2ludCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gaW5pdCBzcHJpbmcgYm9uZXNcclxuICAgIGdsdGYuc2NlbmUudXBkYXRlTWF0cml4V29ybGQoKTtcclxuICAgIG1hbmFnZXIuc2V0SW5pdFN0YXRlKCk7XHJcblxyXG4gICAgcmV0dXJuIG1hbmFnZXI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9pbXBvcnRKb2ludChcclxuICAgIG5vZGU6IFRIUkVFLk9iamVjdDNELFxyXG4gICAgY2hpbGQ6IFRIUkVFLk9iamVjdDNELFxyXG4gICAgc2V0dGluZz86IFBhcnRpYWw8VlJNU3ByaW5nQm9uZUpvaW50U2V0dGluZ3M+LFxyXG4gICAgY29sbGlkZXJHcm91cHNGb3JTcHJpbmc/OiBWUk1TcHJpbmdCb25lQ29sbGlkZXJHcm91cFtdLFxyXG4gICk6IFZSTVNwcmluZ0JvbmVKb2ludCB7XHJcbiAgICBjb25zdCBzcHJpbmdCb25lID0gbmV3IFZSTVNwcmluZ0JvbmVKb2ludChub2RlLCBjaGlsZCwgc2V0dGluZywgY29sbGlkZXJHcm91cHNGb3JTcHJpbmcpO1xyXG5cclxuICAgIGlmICh0aGlzLmpvaW50SGVscGVyUm9vdCkge1xyXG4gICAgICBjb25zdCBoZWxwZXIgPSBuZXcgVlJNU3ByaW5nQm9uZUpvaW50SGVscGVyKHNwcmluZ0JvbmUpO1xyXG4gICAgICB0aGlzLmpvaW50SGVscGVyUm9vdC5hZGQoaGVscGVyKTtcclxuICAgICAgaGVscGVyLnJlbmRlck9yZGVyID0gdGhpcy5qb2ludEhlbHBlclJvb3QucmVuZGVyT3JkZXI7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIHNwcmluZ0JvbmU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9pbXBvcnRTcGhlcmVDb2xsaWRlcihcclxuICAgIGRlc3RpbmF0aW9uOiBUSFJFRS5PYmplY3QzRCxcclxuICAgIHBhcmFtczoge1xyXG4gICAgICBvZmZzZXQ6IFRIUkVFLlZlY3RvcjM7XHJcbiAgICAgIHJhZGl1czogbnVtYmVyO1xyXG4gICAgfSxcclxuICApOiBWUk1TcHJpbmdCb25lQ29sbGlkZXIge1xyXG4gICAgY29uc3QgeyBvZmZzZXQsIHJhZGl1cyB9ID0gcGFyYW1zO1xyXG5cclxuICAgIGNvbnN0IHNoYXBlID0gbmV3IFZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlU3BoZXJlKHsgb2Zmc2V0LCByYWRpdXMgfSk7XHJcblxyXG4gICAgY29uc3QgY29sbGlkZXIgPSBuZXcgVlJNU3ByaW5nQm9uZUNvbGxpZGVyKHNoYXBlKTtcclxuXHJcbiAgICBkZXN0aW5hdGlvbi5hZGQoY29sbGlkZXIpO1xyXG5cclxuICAgIGlmICh0aGlzLmNvbGxpZGVySGVscGVyUm9vdCkge1xyXG4gICAgICBjb25zdCBoZWxwZXIgPSBuZXcgVlJNU3ByaW5nQm9uZUNvbGxpZGVySGVscGVyKGNvbGxpZGVyKTtcclxuICAgICAgdGhpcy5jb2xsaWRlckhlbHBlclJvb3QuYWRkKGhlbHBlcik7XHJcbiAgICAgIGhlbHBlci5yZW5kZXJPcmRlciA9IHRoaXMuY29sbGlkZXJIZWxwZXJSb290LnJlbmRlck9yZGVyO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBjb2xsaWRlcjtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2ltcG9ydENhcHN1bGVDb2xsaWRlcihcclxuICAgIGRlc3RpbmF0aW9uOiBUSFJFRS5PYmplY3QzRCxcclxuICAgIHBhcmFtczoge1xyXG4gICAgICBvZmZzZXQ6IFRIUkVFLlZlY3RvcjM7XHJcbiAgICAgIHJhZGl1czogbnVtYmVyO1xyXG4gICAgICB0YWlsOiBUSFJFRS5WZWN0b3IzO1xyXG4gICAgfSxcclxuICApOiBWUk1TcHJpbmdCb25lQ29sbGlkZXIge1xyXG4gICAgY29uc3QgeyBvZmZzZXQsIHJhZGl1cywgdGFpbCB9ID0gcGFyYW1zO1xyXG5cclxuICAgIGNvbnN0IHNoYXBlID0gbmV3IFZSTVNwcmluZ0JvbmVDb2xsaWRlclNoYXBlQ2Fwc3VsZSh7IG9mZnNldCwgcmFkaXVzLCB0YWlsIH0pO1xyXG5cclxuICAgIGNvbnN0IGNvbGxpZGVyID0gbmV3IFZSTVNwcmluZ0JvbmVDb2xsaWRlcihzaGFwZSk7XHJcblxyXG4gICAgZGVzdGluYXRpb24uYWRkKGNvbGxpZGVyKTtcclxuXHJcbiAgICBpZiAodGhpcy5jb2xsaWRlckhlbHBlclJvb3QpIHtcclxuICAgICAgY29uc3QgaGVscGVyID0gbmV3IFZSTVNwcmluZ0JvbmVDb2xsaWRlckhlbHBlcihjb2xsaWRlcik7XHJcbiAgICAgIHRoaXMuY29sbGlkZXJIZWxwZXJSb290LmFkZChoZWxwZXIpO1xyXG4gICAgICBoZWxwZXIucmVuZGVyT3JkZXIgPSB0aGlzLmNvbGxpZGVySGVscGVyUm9vdC5yZW5kZXJPcmRlcjtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gY29sbGlkZXI7XHJcbiAgfVxyXG59XHJcbiJdLCJuYW1lcyI6WyJfdjNBIiwiVEhSRUUiLCJfdjNCIiwiX21hdEEiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBOzs7VUFHc0IsMEJBQTBCOzs7SUNBaEQsTUFBTUEsTUFBSSxHQUFHLElBQUlDLGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDakMsTUFBTUMsTUFBSSxHQUFHLElBQUlELGdCQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7VUFFcEIsaUNBQWtDLFNBQVEsMEJBQTBCO1FBb0IvRSxZQUFtQixNQUEwRTs7WUFDM0YsS0FBSyxFQUFFLENBQUM7WUFFUixJQUFJLENBQUMsTUFBTSxTQUFHLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxNQUFNLG1DQUFJLElBQUlBLGdCQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDakUsSUFBSSxDQUFDLElBQUksU0FBRyxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsSUFBSSxtQ0FBSSxJQUFJQSxnQkFBSyxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzdELElBQUksQ0FBQyxNQUFNLFNBQUcsTUFBTSxhQUFOLE1BQU0sdUJBQU4sTUFBTSxDQUFFLE1BQU0sbUNBQUksR0FBRyxDQUFDO1NBQ3JDO1FBekJELElBQVcsSUFBSTtZQUNiLE9BQU8sU0FB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
