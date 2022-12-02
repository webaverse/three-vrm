/*!
 * @pixiv/three-vrm-materials-mtoon v1.0.0-beta.19
 * MToon (toon material) module for @pixiv/three-vrm
 *
 * Copyright (c) 2020-2021 pixiv Inc.
 * @pixiv/three-vrm-materials-mtoon is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('three')) :
    typeof define === 'function' && define.amd ? define(['exports', 'three'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.THREE_VRM_MATERIALS_MTOON = {}, global.THREE));
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

    var vertexShader = "// #define PHONG\r\n\r\nvarying vec3 vViewPosition;\r\n\r\n#ifndef FLAT_SHADED\r\n  varying vec3 vNormal;\r\n#endif\r\n\r\n#include <common>\r\n\r\n// #include <uv_pars_vertex>\r\n#ifdef MTOON_USE_UV\r\n  varying vec2 vUv;\r\n  uniform mat3 uvTransform;\r\n#endif\r\n\r\n#include <uv2_pars_vertex>\r\n// #include <displacementmap_pars_vertex>\r\n// #include <envmap_pars_vertex>\r\n#include <color_pars_vertex>\r\n#include <fog_pars_vertex>\r\n#include <morphtarget_pars_vertex>\r\n#include <skinning_pars_vertex>\r\n#include <shadowmap_pars_vertex>\r\n#include <logdepthbuf_pars_vertex>\r\n#include <clipping_planes_pars_vertex>\r\n\r\n#ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE\r\n  uniform sampler2D outlineWidthMultiplyTexture;\r\n  uniform mat3 outlineWidthMultiplyTextureUvTransform;\r\n#endif\r\n\r\nuniform float outlineWidthFactor;\r\n\r\nvoid main() {\r\n\r\n  // #include <uv_vertex>\r\n  #ifdef MTOON_USE_UV\r\n    vUv = ( uvTransform * vec3( uv, 1 ) ).xy;\r\n  #endif\r\n\r\n  #include <uv2_vertex>\r\n  #include <color_vertex>\r\n\r\n  #include <beginnormal_vertex>\r\n  #include <morphnormal_vertex>\r\n  #include <skinbase_vertex>\r\n  #include <skinnormal_vertex>\r\n\r\n  // we need this to compute the outline properly\r\n  objectNormal = normalize( objectNormal );\r\n\r\n  #include <defaultnormal_vertex>\r\n\r\n  #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED\r\n    vNormal = normalize( transformedNormal );\r\n  #endif\r\n\r\n  #include <begin_vertex>\r\n\r\n  #include <morphtarget_vertex>\r\n  #include <skinning_vertex>\r\n  // #include <displacementmap_vertex>\r\n  #include <project_vertex>\r\n  #include <logdepthbuf_vertex>\r\n  #include <clipping_planes_vertex>\r\n\r\n  vViewPosition = - mvPosition.xyz;\r\n\r\n  float outlineTex = 1.0;\r\n\r\n  #ifdef OUTLINE\r\n    #ifdef USE_OUTLINEWIDTHMULTIPLYTEXTURE\r\n      vec2 outlineWidthMultiplyTextureUv = ( outlineWidthMultiplyTextureUvTransform * vec3( vUv, 1 ) ).xy;\r\n      outlineTex = texture2D( outlineWidthMultiplyTexture, outlineWidthMultiplyTextureUv ).g;\r\n    #endif\r\n\r\n    #ifdef OUTLINE_WIDTH_WORLD\r\n      float worldNormalLength = length( transformedNormal );\r\n      vec3 outlineOffset = outlineWidthFactor * outlineTex * worldNormalLength * objectNormal;\r\n      gl_Position = projectionMatrix * modelViewMatrix * vec4( outlineOffset + transformed, 1.0 );\r\n    #endif\r\n\r\n    #ifdef OUTLINE_WIDTH_SCREEN\r\n      vec3 clipNormal = ( projectionMatrix * modelViewMatrix * vec4( objectNormal, 0.0 ) ).xyz;\r\n      vec2 projectedNormal = normalize( clipNormal.xy );\r\n      projectedNormal.x *= projectionMatrix[ 0 ].x / projectionMatrix[ 1 ].y;\r\n      gl_Position.xy += 2.0 * outlineWidthFactor * outlineTex * projectedNormal.xy;\r\n    #endif\r\n\r\n    gl_Position.z += 1E-6 * gl_Position.w; // anti-artifact magic\r\n  #endif\r\n\r\n  #include <worldpos_vertex>\r\n  // #include <envmap_vertex>\r\n  #include <shadowmap_vertex>\r\n  #include <fog_vertex>\r\n\r\n}";

    var fragmentShader = "// #define PHONG\r\n\r\nuniform vec3 litFactor;\r\n\r\nuniform float opacity;\r\n\r\nuniform vec3 shadeColorFactor;\r\n#ifdef USE_SHADEMULTIPLYTEXTURE\r\n  uniform sampler2D shadeMultiplyTexture;\r\n  uniform mat3 shadeMultiplyTextureUvTransform;\r\n#endif\r\n\r\nuniform float shadingShiftFactor;\r\nuniform float shadingToonyFactor;\r\n\r\n#ifdef USE_SHADINGSHIFTTEXTURE\r\n  uniform sampler2D shadingShiftTexture;\r\n  uniform mat3 shadingShiftTextureUvTransform;\r\n  uniform float shadingShiftTextureScale;\r\n#endif\r\n\r\nuniform float giEqualizationFactor;\r\n\r\nuniform vec3 parametricRimColorFactor;\r\n#ifdef USE_RIMMULTIPLYTEXTURE\r\n  uniform sampler2D rimMultiplyTexture;\r\n  uniform mat3 rimMultiplyTextureUvTransform;\r\n#endif\r\nuniform float rimLightingMixFactor;\r\nuniform float parametricRimFresnelPowerFactor;\r\nuniform float parametricRimLiftFactor;\r\n\r\n#ifdef USE_MATCAPTEXTURE\r\n  uniform vec3 matcapFactor;\r\n  uniform sampler2D matcapTexture;\r\n  uniform mat3 matcapTextureUvTransform;\r\n#endif\r\n\r\nuniform vec3 emissive;\r\nuniform float emissiveIntensity;\r\n\r\nuniform vec3 outlineColorFactor;\r\nuniform float outlineLightingMixFactor;\r\n\r\n#ifdef USE_UVANIMATIONMASKTEXTURE\r\n  uniform sampler2D uvAnimationMaskTexture;\r\n  uniform mat3 uvAnimationMaskTextureUvTransform;\r\n#endif\r\n\r\nuniform float uvAnimationScrollXOffset;\r\nuniform float uvAnimationScrollYOffset;\r\nuniform float uvAnimationRotationPhase;\r\n\r\n#include <common>\r\n#include <packing>\r\n#include <dithering_pars_fragment>\r\n#include <color_pars_fragment>\r\n\r\n// #include <uv_pars_fragment>\r\n#if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\r\n  varying vec2 vUv;\r\n#endif\r\n\r\n#include <uv2_pars_fragment>\r\n#include <map_pars_fragment>\r\n\r\n#ifdef USE_MAP\r\n  uniform mat3 mapUvTransform;\r\n#endif\r\n\r\n// #include <alphamap_pars_fragment>\r\n\r\n#if THREE_VRM_THREE_REVISION >= 132\r\n  #include <alphatest_pars_fragment>\r\n#endif\r\n\r\n#include <aomap_pars_fragment>\r\n// #include <lightmap_pars_fragment>\r\n#include <emissivemap_pars_fragment>\r\n\r\n#ifdef USE_EMISSIVEMAP\r\n  uniform mat3 emissiveMapUvTransform;\r\n#endif\r\n\r\n// #include <envmap_common_pars_fragment>\r\n// #include <envmap_pars_fragment>\r\n// #include <cube_uv_reflection_fragment>\r\n#include <fog_pars_fragment>\r\n\r\n// #include <bsdfs>\r\nvec3 BRDF_Lambert( const in vec3 diffuseColor ) {\r\n  return RECIPROCAL_PI * diffuseColor;\r\n}\r\n\r\n#include <lights_pars_begin>\r\n\r\n#if THREE_VRM_THREE_REVISION >= 132\r\n  #include <normal_pars_fragment>\r\n#endif\r\n\r\n// #include <lights_phong_pars_fragment>\r\nvarying vec3 vViewPosition;\r\n\r\n#if THREE_VRM_THREE_REVISION < 132\r\n  #ifndef FLAT_SHADED\r\n    varying vec3 vNormal;\r\n  #endif\r\n#endif\r\n\r\nstruct MToonMaterial {\r\n  vec3 diffuseColor;\r\n  vec3 shadeColor;\r\n  float shadingShift;\r\n};\r\n\r\nfloat linearstep( float a, float b, float t ) {\r\n  return clamp( ( t - a ) / ( b - a ), 0.0, 1.0 );\r\n}\r\n\r\n/**\r\n * Convert NdotL into toon shading factor using shadingShift and shadingToony\r\n */\r\nfloat getShading(\r\n  const in float dotNL,\r\n  const in float shadow,\r\n  const in float shadingShift\r\n) {\r\n  float shading = dotNL;\r\n  shading = shading + shadingShift;\r\n  shading = linearstep( -1.0 + shadingToonyFactor, 1.0 - shadingToonyFactor, shading );\r\n  shading *= shadow;\r\n  return shading;\r\n}\r\n\r\n/**\r\n * Mix diffuseColor and shadeColor using shading factor and light color\r\n */\r\nvec3 getDiffuse(\r\n  const in MToonMaterial material,\r\n  const in float shading,\r\n  in vec3 lightColor\r\n) {\r\n  #ifdef DEBUG_LITSHADERATE\r\n    return vec3( BRDF_Lambert( shading * lightColor ) );\r\n  #endif\r\n\r\n  #if THREE_VRM_THREE_REVISION < 132\r\n    #ifndef PHYSICALLY_CORRECT_LIGHTS\r\n      lightColor *= PI;\r\n    #endif\r\n  #endif\r\n\r\n  vec3 col = lightColor * BRDF_Lambert( mix( material.shadeColor, material.diffuseColor, shading ) );\r\n\r\n  // The \"comment out if you want to PBR absolutely\" line\r\n  #ifdef V0_COMPAT_SHADE\r\n    col = min( col, material.diffuseColor );\r\n  #endif\r\n\r\n  return col;\r\n}\r\n\r\nvoid RE_Direct_MToon( const in IncidentLight directLight, const in GeometricContext geometry, const in MToonMaterial material, const in float shadow, inout ReflectedLight reflectedLight ) {\r\n  float dotNL = saturate( dot( geometry.normal, directLight.direction ) );\r\n  vec3 irradiance = directLight.color;\r\n\r\n  #if THREE_VRM_THREE_REVISION < 132\r\n    #ifndef PHYSICALLY_CORRECT_LIGHTS\r\n      irradiance *= PI;\r\n    #endif\r\n  #endif\r\n\r\n  // directSpecular will be used for rim lighting, not an actual specular\r\n  reflectedLight.directSpecular += irradiance;\r\n\r\n  irradiance *= dotNL;\r\n\r\n  float shading = getShading( dotNL, shadow, material.shadingShift );\r\n\r\n  // toon shaded diffuse\r\n  reflectedLight.directDiffuse += getDiffuse( material, shading, directLight.color );\r\n}\r\n\r\nvoid RE_IndirectDiffuse_MToon( const in vec3 irradiance, const in GeometricContext geometry, const in MToonMaterial material, inout ReflectedLight reflectedLight ) {\r\n  // indirect diffuse will use diffuseColor, no shadeColor involved\r\n  reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );\r\n\r\n  // directSpecular will be used for rim lighting, not an actual specular\r\n  reflectedLight.directSpecular += irradiance;\r\n}\r\n\r\n#define RE_Direct RE_Direct_MToon\r\n#define RE_IndirectDiffuse RE_IndirectDiffuse_MToon\r\n#define Material_LightProbeLOD( material ) (0)\r\n\r\n#include <shadowmap_pars_fragment>\r\n// #include <bumpmap_pars_fragment>\r\n\r\n// #include <normalmap_pars_fragment>\r\n#ifdef USE_NORMALMAP\r\n\r\n  uniform sampler2D normalMap;\r\n  uniform mat3 normalMapUvTransform;\r\n  uniform vec2 normalScale;\r\n\r\n#endif\r\n\r\n#ifdef OBJECTSPACE_NORMALMAP\r\n\r\n  uniform mat3 normalMatrix;\r\n\r\n#endif\r\n\r\n#if ! defined ( USE_TANGENT ) && defined ( TANGENTSPACE_NORMALMAP )\r\n\r\n  // Per-Pixel Tangent Space Normal Mapping\r\n  // http://hacksoflife.blogspot.ch/2009/11/per-pixel-tangent-space-normal-mapping.html\r\n\r\n  // three-vrm specific change: it requires `uv` as an input in order to support uv scrolls\r\n\r\n  // Temporary compat against shader change @ Three.js r126\r\n  // See: #21205, #21307, #21299\r\n  #if THREE_VRM_THREE_REVISION >= 126\r\n\r\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {\r\n\r\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\r\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\r\n      vec2 st0 = dFdx( uv.st );\r\n      vec2 st1 = dFdy( uv.st );\r\n\r\n      vec3 N = normalize( surf_norm );\r\n\r\n      vec3 q1perp = cross( q1, N );\r\n      vec3 q0perp = cross( N, q0 );\r\n\r\n      vec3 T = q1perp * st0.x + q0perp * st1.x;\r\n      vec3 B = q1perp * st0.y + q0perp * st1.y;\r\n\r\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\r\n      // TODO: Is this still required? Or shall I make a PR about it?\r\n      if ( length( T ) == 0.0 || length( B ) == 0.0 ) {\r\n        return surf_norm;\r\n      }\r\n\r\n      float det = max( dot( T, T ), dot( B, B ) );\r\n      float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );\r\n\r\n      return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );\r\n\r\n    }\r\n\r\n  #else\r\n\r\n    vec3 perturbNormal2Arb( vec2 uv, vec3 eye_pos, vec3 surf_norm, vec3 mapN ) {\r\n\r\n      // Workaround for Adreno 3XX dFd*( vec3 ) bug. See #9988\r\n\r\n      vec3 q0 = vec3( dFdx( eye_pos.x ), dFdx( eye_pos.y ), dFdx( eye_pos.z ) );\r\n      vec3 q1 = vec3( dFdy( eye_pos.x ), dFdy( eye_pos.y ), dFdy( eye_pos.z ) );\r\n      vec2 st0 = dFdx( uv.st );\r\n      vec2 st1 = dFdy( uv.st );\r\n\r\n      float scale = sign( st1.t * st0.s - st0.t * st1.s ); // we do not care about the magnitude\r\n\r\n      vec3 S = ( q0 * st1.t - q1 * st0.t ) * scale;\r\n      vec3 T = ( - q0 * st1.s + q1 * st0.s ) * scale;\r\n\r\n      // three-vrm specific change: Workaround for the issue that happens when delta of uv = 0.0\r\n      // TODO: Is this still required? Or shall I make a PR about it?\r\n\r\n      if ( length( S ) == 0.0 || length( T ) == 0.0 ) {\r\n        return surf_norm;\r\n      }\r\n\r\n      S = normalize( S );\r\n      T = normalize( T );\r\n      vec3 N = normalize( surf_norm );\r\n\r\n      #ifdef DOUBLE_SIDED\r\n\r\n        // Workaround for Adreno GPUs gl_FrontFacing bug. See #15850 and #10331\r\n\r\n        bool frontFacing = dot( cross( S, T ), N ) > 0.0;\r\n\r\n        mapN.xy *= ( float( frontFacing ) * 2.0 - 1.0 );\r\n\r\n      #else\r\n\r\n        mapN.xy *= ( float( gl_FrontFacing ) * 2.0 - 1.0 );\r\n\r\n      #endif\r\n\r\n      mat3 tsn = mat3( S, T, N );\r\n      return normalize( tsn * mapN );\r\n\r\n    }\r\n\r\n  #endif\r\n\r\n#endif\r\n\r\n// #include <specularmap_pars_fragment>\r\n#include <logdepthbuf_pars_fragment>\r\n#include <clipping_planes_pars_fragment>\r\n\r\n// == post correction ==========================================================\r\nvoid postCorrection() {\r\n  #include <tonemapping_fragment>\r\n  #include <encodings_fragment>\r\n  #include <fog_fragment>\r\n  #include <premultiplied_alpha_fragment>\r\n  #include <dithering_fragment>\r\n}\r\n\r\n// == main procedure ===========================================================\r\nvoid main() {\r\n  #include <clipping_planes_fragment>\r\n\r\n  vec2 uv = vec2(0.5, 0.5);\r\n\r\n  #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\r\n    uv = vUv;\r\n\r\n    float uvAnimMask = 1.0;\r\n    #ifdef USE_UVANIMATIONMASKTEXTURE\r\n      vec2 uvAnimationMaskTextureUv = ( uvAnimationMaskTextureUvTransform * vec3( uv, 1 ) ).xy;\r\n      uvAnimMask = texture2D( uvAnimationMaskTexture, uvAnimationMaskTextureUv ).b;\r\n    #endif\r\n\r\n    uv = uv + vec2( uvAnimationScrollXOffset, uvAnimationScrollYOffset ) * uvAnimMask;\r\n    float uvRotCos = cos( uvAnimationRotationPhase * uvAnimMask );\r\n    float uvRotSin = sin( uvAnimationRotationPhase * uvAnimMask );\r\n    uv = mat2( uvRotCos, uvRotSin, -uvRotSin, uvRotCos ) * ( uv - 0.5 ) + 0.5;\r\n  #endif\r\n\r\n  #ifdef DEBUG_UV\r\n    gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );\r\n    #if ( defined( MTOON_USE_UV ) && !defined( MTOON_UVS_VERTEX_ONLY ) )\r\n      gl_FragColor = vec4( uv, 0.0, 1.0 );\r\n    #endif\r\n    return;\r\n  #endif\r\n\r\n  vec4 diffuseColor = vec4( litFactor, opacity );\r\n  ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );\r\n  vec3 totalEmissiveRadiance = emissive * emissiveIntensity;\r\n\r\n  #include <logdepthbuf_fragment>\r\n\r\n  // #include <map_fragment>\r\n  #ifdef USE_MAP\r\n    vec2 mapUv = ( mapUvTransform * vec3( uv, 1 ) ).xy;\r\n    #if THREE_VRM_THREE_REVISION >= 137\r\n      vec4 sampledDiffuseColor = texture2D( map, mapUv );\r\n      #ifdef DECODE_VIDEO_TEXTURE\r\n        sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );\r\n      #endif\r\n      diffuseColor *= sampledDiffuseColor;\r\n    #else\r\n      // COMPAT: pre-r137\r\n      vec4 texelColor = texture2D( map, mapUv );\r\n      texelColor = mapTexelToLinear( texelColor );\r\n      diffuseColor *= texelColor;\r\n    #endif\r\n  #endif\r\n\r\n  // #include <color_fragment>\r\n  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )\r\n    diffuseColor.rgb *= vColor;\r\n  #endif\r\n\r\n  // #include <alphamap_fragment>\r\n\r\n  #include <alphatest_fragment>\r\n\r\n  // #include <specularmap_fragment>\r\n  #include <normal_fragment_begin>\r\n\r\n  #ifdef OUTLINE\r\n    normal *= -1.0;\r\n  #endif\r\n\r\n  // #include <normal_fragment_maps>\r\n\r\n  #ifdef OBJECTSPACE_NORMALMAP\r\n\r\n    vec2 normalMapUv = ( normalMapUvTransform * vec3( uv, 1 ) ).xy;\r\n    normal = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals\r\n\r\n    #ifdef FLIP_SIDED\r\n\r\n      normal = - normal;\r\n\r\n    #endif\r\n\r\n    #ifdef DOUBLE_SIDED\r\n\r\n      // Temporary compat against shader change @ Three.js r126\r\n      // See: #21205, #21307, #21299\r\n      #if THREE_VRM_THREE_REVISION >= 126\r\n\r\n        normal = normal * faceDirection;\r\n\r\n      #else\r\n\r\n        normal = normal * ( float( gl_FrontFacing ) * 2.0 - 1.0 );\r\n\r\n      #endif\r\n\r\n    #endif\r\n\r\n    normal = normalize( normalMatrix * normal );\r\n\r\n  #elif defined( TANGENTSPACE_NORMALMAP )\r\n\r\n    vec2 normalMapUv = ( normalMapUvTransform * vec3( uv, 1 ) ).xy;\r\n    vec3 mapN = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0;\r\n    mapN.xy *= normalScale;\r\n\r\n    #ifdef USE_TANGENT\r\n\r\n      normal = normalize( vTBN * mapN );\r\n\r\n    #else\r\n\r\n      // Temporary compat against shader change @ Three.js r126\r\n      // See: #21205, #21307, #21299\r\n      #if THREE_VRM_THREE_REVISION >= 126\r\n\r\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN, faceDirection );\r\n\r\n      #else\r\n\r\n        normal = perturbNormal2Arb( uv, -vViewPosition, normal, mapN );\r\n\r\n      #endif\r\n\r\n    #endif\r\n\r\n  #endif\r\n\r\n  // #include <emissivemap_fragment>\r\n  #ifdef USE_EMISSIVEMAP\r\n    vec2 emissiveMapUv = ( emissiveMapUvTransform * vec3( uv, 1 ) ).xy;\r\n    #if THREE_VRM_THREE_REVISION >= 137\r\n      totalEmissiveRadiance *= texture2D( emissiveMap, emissiveMapUv ).rgb;\r\n    #else\r\n      // COMPAT: pre-r137\r\n      totalEmissiveRadiance *= emissiveMapTexelToLinear( texture2D( emissiveMap, emissiveMapUv ) ).rgb;\r\n    #endif\r\n  #endif\r\n\r\n  #ifdef DEBUG_NORMAL\r\n    gl_FragColor = vec4( 0.5 + 0.5 * normal, 1.0 );\r\n    return;\r\n  #endif\r\n\r\n  // -- MToon: lighting --------------------------------------------------------\r\n  // accumulation\r\n  // #include <lights_phong_fragment>\r\n  MToonMaterial material;\r\n\r\n  material.diffuseColor = diffuseColor.rgb;\r\n\r\n  material.shadeColor = shadeColorFactor;\r\n  #ifdef USE_SHADEMULTIPLYTEXTURE\r\n    vec2 shadeMultiplyTextureUv = ( shadeMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;\r\n    #if THREE_VRM_THREE_REVISION >= 137\r\n      material.shadeColor *= texture2D( shadeMultiplyTexture, shadeMultiplyTextureUv ).rgb;\r\n    #else\r\n      // COMPAT: pre-r137\r\n      material.shadeColor *= shadeMultiplyTextureTexelToLinear( texture2D( shadeMultiplyTexture, shadeMultiplyTextureUv) ).rgb;\r\n    #endif\r\n  #endif\r\n\r\n  #if ( defined( USE_COLOR ) && !defined( IGNORE_VERTEX_COLOR ) )\r\n    material.shadeColor.rgb *= vColor;\r\n  #endif\r\n\r\n  material.shadingShift = shadingShiftFactor;\r\n  #ifdef USE_SHADINGSHIFTTEXTURE\r\n    vec2 shadingShiftTextureUv = ( shadingShiftTextureUvTransform * vec3( uv, 1 ) ).xy;\r\n    material.shadingShift += texture2D( shadingShiftTexture, shadingShiftTextureUv ).r * shadingShiftTextureScale;\r\n  #endif\r\n\r\n  // #include <lights_fragment_begin>\r\n\r\n  // MToon Specific changes:\r\n  // Since we want to take shadows into account of shading instead of irradiance,\r\n  // we had to modify the codes that multiplies the results of shadowmap into color of direct lights.\r\n\r\n  GeometricContext geometry;\r\n\r\n  geometry.position = - vViewPosition;\r\n  geometry.normal = normal;\r\n  geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\r\n\r\n  #ifdef CLEARCOAT\r\n\r\n    geometry.clearcoatNormal = clearcoatNormal;\r\n\r\n  #endif\r\n\r\n  IncidentLight directLight;\r\n\r\n  // since these variables will be used in unrolled loop, we have to define in prior\r\n  float shadow;\r\n\r\n  #if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\r\n\r\n    PointLight pointLight;\r\n    #if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\r\n    PointLightShadow pointLightShadow;\r\n    #endif\r\n\r\n    #pragma unroll_loop_start\r\n    for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\r\n\r\n      pointLight = pointLights[ i ];\r\n\r\n      #if THREE_VRM_THREE_REVISION >= 132\r\n        getPointLightInfo( pointLight, geometry, directLight );\r\n      #else\r\n        getPointDirectLightIrradiance( pointLight, geometry, directLight );\r\n      #endif\r\n\r\n      shadow = 1.0;\r\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\r\n      pointLightShadow = pointLightShadows[ i ];\r\n      shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\r\n      #endif\r\n\r\n      RE_Direct( directLight, geometry, material, shadow, reflectedLight );\r\n\r\n    }\r\n    #pragma unroll_loop_end\r\n\r\n  #endif\r\n\r\n  #if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\r\n\r\n    SpotLight spotLight;\r\n    #if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\r\n    SpotLightShadow spotLightShadow;\r\n    #endif\r\n\r\n    #pragma unroll_loop_start\r\n    for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\r\n\r\n      spotLight = spotLights[ i ];\r\n\r\n      #if THREE_VRM_THREE_REVISION >= 132\r\n        getSpotLightInfo( spotLight, geometry, directLight );\r\n      #else\r\n        getSpotDirectLightIrradiance( spotLight, geometry, directLight );\r\n      #endif\r\n\r\n      shadow = 1.0;\r\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\r\n      spotLightShadow = spotLightShadows[ i ];\r\n      shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\r\n      #endif\r\n\r\n      RE_Direct( directLight, geometry, material, shadow, reflectedLight );\r\n\r\n    }\r\n    #pragma unroll_loop_end\r\n\r\n  #endif\r\n\r\n  #if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )\r\n\r\n    DirectionalLight directionalLight;\r\n    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\r\n    DirectionalLightShadow directionalLightShadow;\r\n    #endif\r\n\r\n    #pragma unroll_loop_start\r\n    for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\r\n\r\n      directionalLight = directionalLights[ i ];\r\n\r\n      #if THREE_VRM_THREE_REVISION >= 132\r\n        getDirectionalLightInfo( directionalLight, geometry, directLight );\r\n      #else\r\n        getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\r\n      #endif\r\n\r\n      shadow = 1.0;\r\n      #if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\r\n      directionalLightShadow = directionalLightShadows[ i ];\r\n      shadow = all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\r\n      #endif\r\n\r\n      RE_Direct( directLight, geometry, material, shadow, reflectedLight );\r\n\r\n    }\r\n    #pragma unroll_loop_end\r\n\r\n  #endif\r\n\r\n  // #if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\r\n\r\n  //   RectAreaLight rectAreaLight;\r\n\r\n  //   #pragma unroll_loop_start\r\n  //   for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\r\n\r\n  //     rectAreaLight = rectAreaLights[ i ];\r\n  //     RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );\r\n\r\n  //   }\r\n  //   #pragma unroll_loop_end\r\n\r\n  // #endif\r\n\r\n  #if defined( RE_IndirectDiffuse )\r\n\r\n    vec3 iblIrradiance = vec3( 0.0 );\r\n\r\n    vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\r\n\r\n    #if THREE_VRM_THREE_REVISION >= 133\r\n      irradiance += getLightProbeIrradiance( lightProbe, geometry.normal );\r\n    #else\r\n      irradiance += getLightProbeIrradiance( lightProbe, geometry );\r\n    #endif\r\n\r\n    #if ( NUM_HEMI_LIGHTS > 0 )\r\n\r\n      #pragma unroll_loop_start\r\n      for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\r\n\r\n        #if THREE_VRM_THREE_REVISION >= 133\r\n          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry.normal );\r\n        #else\r\n          irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\r\n        #endif\r\n\r\n      }\r\n      #pragma unroll_loop_end\r\n\r\n    #endif\r\n\r\n  #endif\r\n\r\n  // #if defined( RE_IndirectSpecular )\r\n\r\n  //   vec3 radiance = vec3( 0.0 );\r\n  //   vec3 clearcoatRadiance = vec3( 0.0 );\r\n\r\n  // #endif\r\n\r\n  #include <lights_fragment_maps>\r\n  #include <lights_fragment_end>\r\n\r\n  // modulation\r\n  #include <aomap_fragment>\r\n\r\n  vec3 col = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;\r\n\r\n  #ifdef DEBUG_LITSHADERATE\r\n    gl_FragColor = vec4( col, diffuseColor.a );\r\n    postCorrection();\r\n    return;\r\n  #endif\r\n\r\n  // -- MToon: rim lighting -----------------------------------------\r\n  vec3 viewDir = normalize( vViewPosition );\r\n\r\n  #ifndef PHYSICALLY_CORRECT_LIGHTS\r\n    reflectedLight.directSpecular /= PI;\r\n  #endif\r\n  vec3 rimMix = mix( vec3( 1.0 ), reflectedLight.directSpecular, 1.0 );\r\n\r\n  vec3 rim = parametricRimColorFactor * pow( saturate( 1.0 - dot( viewDir, normal ) + parametricRimLiftFactor ), parametricRimFresnelPowerFactor );\r\n\r\n  #ifdef USE_MATCAPTEXTURE\r\n    {\r\n      vec3 x = normalize( vec3( viewDir.z, 0.0, -viewDir.x ) );\r\n      vec3 y = cross( viewDir, x ); // guaranteed to be normalized\r\n      vec2 sphereUv = 0.5 + 0.5 * vec2( dot( x, normal ), -dot( y, normal ) );\r\n      sphereUv = ( matcapTextureUvTransform * vec3( sphereUv, 1 ) ).xy;\r\n      #if THREE_VRM_THREE_REVISION >= 137\r\n        vec3 matcap = texture2D( matcapTexture, sphereUv ).rgb;\r\n      #else\r\n        // COMPAT: pre-r137\r\n        vec3 matcap = matcapTextureTexelToLinear( texture2D( matcapTexture, sphereUv ) ).rgb;\r\n      #endif\r\n      rim += matcapFactor * matcap;\r\n    }\r\n  #endif\r\n\r\n  #ifdef USE_RIMMULTIPLYTEXTURE\r\n    vec2 rimMultiplyTextureUv = ( rimMultiplyTextureUvTransform * vec3( uv, 1 ) ).xy;\r\n    #if THREE_VRM_THREE_REVISION >= 137\r\n      rim *= texture2D( rimMultiplyTexture, rimMultiplyTextureUv ).rgb;\r\n    #else\r\n      // COMPAT: pre-r137\r\n      rim *= rimMultiplyTextureTexelToLinear( texture2D( rimMultiplyTexture, rimMultiplyTextureUv ) ).rgb;\r\n    #endif\r\n  #endif\r\n\r\n  col += rimMix * rim;\r\n\r\n  // -- MToon: Emission --------------------------------------------------------\r\n  col += totalEmissiveRadiance;\r\n\r\n  // #include <envmap_fragment>\r\n\r\n  // -- Almost done! -----------------------------------------------------------\r\n  #if defined( OUTLINE )\r\n    col = outlineColorFactor.rgb * mix( vec3( 1.0 ), col, outlineLightingMixFactor );\r\n  #endif\r\n\r\n  gl_FragColor = vec4( col, diffuseColor.a );\r\n  postCorrection();\r\n}\r\n";

    /* eslint-disable @typescript-eslint/naming-convention */
    /**
     * Specifiers of debug mode of {@link MToonMaterial}.
     *
     * See: {@link MToonMaterial.debugMode}
     */
    const MToonMaterialDebugMode = {
        /**
         * Render normally.
         */
        None: 'none',
        /**
         * Visualize normals of the surface.
         */
        Normal: 'normal',
        /**
         * Visualize lit/shade of the surface.
         */
        LitShadeRate: 'litShadeRate',
        /**
         * Visualize UV of the surface.
         */
        UV: 'uv',
    };

    /* eslint-disable @typescript-eslint/naming-convention */
    const MToonMaterialOutlineWidthMode = {
        None: 'none',
        WorldCoordinates: 'worldCoordinates',
        ScreenCoordinates: 'screenCoordinates',
    };

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
     *
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
     *
     * This function is no longer required beginning from r137
     *
     * https://github.com/mrdoob/three.js/blob/r136/src/renderers/webgl/WebGLProgram.js#L52
     */
    const getTexelDecodingFunction = (functionName, encoding) => {
        const components = getEncodingComponents(encoding);
        return 'vec4 ' + functionName + '( vec4 value ) { return ' + components[0] + 'ToLinear' + components[1] + '; }';
    };

    /**
     * COMPAT: pre-r137
     *
     * This function is no longer required beginning from r137
     *
     * Retrieved from https://github.com/mrdoob/three.js/blob/88b6328998d155fa0a7c1f1e5e3bd6bff75268c0/src/renderers/webgl/WebGLPrograms.js#L92
     *
     * Diff:
     *   - Remove WebGLRenderTarget handler because it increases code complexities on TypeScript
     *   - Add a boolean `isWebGL2` as a second argument.
     */
    function getTextureEncodingFromMap(map, isWebGL2) {
        let encoding;
        if (map && map.isTexture) {
            encoding = map.encoding;
            // } else if ( map && map.isWebGLRenderTarget ) {
            //   console.warn( 'THREE.WebGLPrograms.getTextureEncodingFromMap: don\'t use render targets as textures. Use their .texture property instead.' );
            //   encoding = map.texture.encoding;
        }
        else {
            encoding = THREE__namespace.LinearEncoding;
        }
        if (parseInt(THREE__namespace.REVISION, 10) >= 133) {
            if (isWebGL2 &&
                map &&
                map.isTexture &&
                map.format === THREE__namespace.RGBAFormat &&
                map.type === THREE__namespace.UnsignedByteType &&
                map.encoding === THREE__namespace.sRGBEncoding) {
                encoding = THREE__namespace.LinearEncoding; // disable inline decode for sRGB textures in WebGL 2
            }
        }
        return encoding;
    }

    /* tslint:disable:member-ordering */
    /**
     * MToon is a material specification that has various features.
     * The spec and implementation are originally founded for Unity engine and this is a port of the material.
     *
     * See: https://github.com/Santarh/MToon
     */
    class MToonMaterial extends THREE__namespace.ShaderMaterial {
        constructor(parameters = {}) {
            super({ vertexShader, fragmentShader });
            this.uvAnimationScrollXSpeedFactor = 0.0;
            this.uvAnimationScrollYSpeedFactor = 0.0;
            this.uvAnimationRotationSpeedFactor = 0.0;
            /**
             * Whether the material is affected by fog.
             * `true` by default.
             */
            this.fog = true;
            /**
             * Will be read in WebGLPrograms
             *
             * See: https://github.com/mrdoob/three.js/blob/4f5236ac3d6f41d904aa58401b40554e8fbdcb15/src/renderers/webgl/WebGLPrograms.js#L190-L191
             */
            this.normalMapType = THREE__namespace.TangentSpaceNormalMap;
            /**
             * When this is `true`, vertex colors will be ignored.
             * `true` by default.
             */
            this._ignoreVertexColor = true;
            this._v0CompatShade = false;
            this._debugMode = MToonMaterialDebugMode.None;
            this._outlineWidthMode = MToonMaterialOutlineWidthMode.None;
            this._isOutline = false;
            // override depthWrite with transparentWithZWrite
            if (parameters.transparentWithZWrite) {
                parameters.depthWrite = true;
            }
            delete parameters.transparentWithZWrite;
            // == enabling bunch of stuff ==================================================================
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
            // == uniforms =================================================================================
            this.uniforms = THREE__namespace.UniformsUtils.merge([
                THREE__namespace.UniformsLib.common,
                THREE__namespace.UniformsLib.normalmap,
                THREE__namespace.UniformsLib.emissivemap,
                THREE__namespace.UniformsLib.fog,
                THREE__namespace.UniformsLib.lights,
                {
                    litFactor: { value: new THREE__namespace.Color(1.0, 1.0, 1.0) },
                    mapUvTransform: { value: new THREE__namespace.Matrix3() },
                    colorAlpha: { value: 1.0 },
                    normalMapUvTransform: { value: new THREE__namespace.Matrix3() },
                    shadeColorFactor: { value: new THREE__namespace.Color(0.97, 0.81, 0.86) },
                    shadeMultiplyTexture: { value: null },
                    shadeMultiplyTextureUvTransform: { value: new THREE__namespace.Matrix3() },
                    shadingShiftFactor: { value: 0.0 },
                    shadingShiftTexture: { value: null },
                    shadingShiftTextureUvTransform: { value: new THREE__namespace.Matrix3() },
                    shadingShiftTextureScale: { value: null },
                    shadingToonyFactor: { value: 0.9 },
                    giEqualizationFactor: { value: 0.9 },
                    matcapFactor: { value: new THREE__namespace.Color(1.0, 1.0, 1.0) },
                    matcapTexture: { value: null },
                    matcapTextureUvTransform: { value: new THREE__namespace.Matrix3() },
                    parametricRimColorFactor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    rimMultiplyTexture: { value: null },
                    rimMultiplyTextureUvTransform: { value: new THREE__namespace.Matrix3() },
                    rimLightingMixFactor: { value: 0.0 },
                    parametricRimFresnelPowerFactor: { value: 1.0 },
                    parametricRimLiftFactor: { value: 0.0 },
                    emissive: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    emissiveIntensity: { value: 1.0 },
                    emissiveMapUvTransform: { value: new THREE__namespace.Matrix3() },
                    outlineWidthMultiplyTexture: { value: null },
                    outlineWidthMultiplyTextureUvTransform: { value: new THREE__namespace.Matrix3() },
                    outlineWidthFactor: { value: 0.5 },
                    outlineColorFactor: { value: new THREE__namespace.Color(0.0, 0.0, 0.0) },
                    outlineLightingMixFactor: { value: 1.0 },
                    uvAnimationMaskTexture: { value: null },
                    uvAnimationMaskTextureUvTransform: { value: new THREE__namespace.Matrix3() },
                    uvAnimationScrollXOffset: { value: 0.0 },
                    uvAnimationScrollYOffset: { value: 0.0 },
                    uvAnimationRotationPhase: { value: 0.0 },
                },
                parameters.uniforms,
            ]);
            // == finally compile the shader program =======================================================
            this.setValues(parameters);
            // == upload uniforms that need to upload ======================================================
            this._uploadUniformsWorkaround();
            // == update shader stuff ======================================================================
            this.customProgramCacheKey = () => [
                this._ignoreVertexColor ? 'ignoreVertexColor' : '',
                this._v0CompatShade ? 'v0CompatShade' : '',
                this._debugMode !== 'none' ? `debugMode:${this._debugMode}` : '',
                this._outlineWidthMode !== 'none' ? `outlineWidthMode:${this._outlineWidthMode}` : '',
                this._isOutline ? 'isOutline' : '',
                ...Object.entries(this._generateDefines()).map(([token, macro]) => `${token}:${macro}`),
                this.matcapTexture ? `matcapTextureEncoding:${this.matcapTexture.encoding}` : '',
                this.shadeMultiplyTexture ? `shadeMultiplyTextureEncoding:${this.shadeMultiplyTexture.encoding}` : '',
                this.rimMultiplyTexture ? `rimMultiplyTextureEncoding:${this.rimMultiplyTexture.encoding}` : '',
            ].join(',');
            this.onBeforeCompile = (shader, renderer) => {
                /**
                 * Will be needed to determine whether we should inline convert sRGB textures or not.
                 * See: https://github.com/mrdoob/three.js/pull/22551
                 */
                const isWebGL2 = renderer.capabilities.isWebGL2;
                const threeRevision = parseInt(THREE__namespace.REVISION, 10);
                const defines = Object.entries(Object.assign(Object.assign({}, this._generateDefines()), this.defines))
                    .filter(([token, macro]) => !!macro)
                    .map(([token, macro]) => `#define ${token} ${macro}`)
                    .join('\n') + '\n';
                // -- texture encodings ----------------------------------------------------------------------
                // COMPAT: pre-r137
                let encodings = '';
                if (parseInt(THREE__namespace.REVISION, 10) < 137) {
                    encodings =
                        (this.matcapTexture !== null
                            ? getTexelDecodingFunction('matcapTextureTexelToLinear', getTextureEncodingFromMap(this.matcapTexture, isWebGL2)) + '\n'
                            : '') +
                            (this.shadeMultiplyTexture !== null
                                ? getTexelDecodingFunction('shadeMultiplyTextureTexelToLinear', getTextureEncodingFromMap(this.shadeMultiplyTexture, isWebGL2)) + '\n'
                                : '') +
                            (this.rimMultiplyTexture !== null
                                ? getTexelDecodingFunction('rimMultiplyTextureTexelToLinear', getTextureEncodingFromMap(this.rimMultiplyTexture, isWebGL2)) + '\n'
                                : '');
                }
                // -- generate shader code -------------------------------------------------------------------
                shader.vertexShader = defines + shader.vertexShader;
                shader.fragmentShader = defines + encodings + shader.fragmentShader;
                // -- compat ---------------------------------------------------------------------------------
                // COMPAT: pre-r132
                // Three.js r132 introduces new shader chunks <normal_pars_fragment> and <alphatest_pars_fragment>
                if (threeRevision < 132) {
                    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_pars_fragment>', '');
                    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_pars_fragment>', '');
                }
            };
        }
        get color() {
            return this.uniforms.litFactor.value;
        }
        set color(value) {
            this.uniforms.litFactor.value = value;
        }
        get map() {
            return this.uniforms.map.value;
        }
        set map(value) {
            this.uniforms.map.value = value;
        }
        get normalMap() {
            return this.uniforms.normalMap.value;
        }
        set normalMap(value) {
            this.uniforms.normalMap.value = value;
        }
        get normalScale() {
            return this.uniforms.normalScale.value;
        }
        set normalScale(value) {
            this.uniforms.normalScale.value = value;
        }
        get emissive() {
            return this.uniforms.emissive.value;
        }
        set emissive(value) {
            this.uniforms.emissive.value = value;
        }
        get emissiveIntensity() {
            return this.uniforms.emissiveIntensity.value;
        }
        set emissiveIntensity(value) {
            this.uniforms.emissiveIntensity.value = value;
        }
        get emissiveMap() {
            return this.uniforms.emissiveMap.value;
        }
        set emissiveMap(value) {
            this.uniforms.emissiveMap.value = value;
        }
        get shadeColorFactor() {
            return this.uniforms.shadeColorFactor.value;
        }
        set shadeColorFactor(value) {
            this.uniforms.shadeColorFactor.value = value;
        }
        get shadeMultiplyTexture() {
            return this.uniforms.shadeMultiplyTexture.value;
        }
        set shadeMultiplyTexture(value) {
            this.uniforms.shadeMultiplyTexture.value = value;
        }
        get shadingShiftFactor() {
            return this.uniforms.shadingShiftFactor.value;
        }
        set shadingShiftFactor(value) {
            this.uniforms.shadingShiftFactor.value = value;
        }
        get shadingShiftTexture() {
            return this.uniforms.shadingShiftTexture.value;
        }
        set shadingShiftTexture(value) {
            this.uniforms.shadingShiftTexture.value = value;
        }
        get shadingShiftTextureScale() {
            return this.uniforms.shadingShiftTextureScale.value;
        }
        set shadingShiftTextureScale(value) {
            this.uniforms.shadingShiftTextureScale.value = value;
        }
        get shadingToonyFactor() {
            return this.uniforms.shadingToonyFactor.value;
        }
        set shadingToonyFactor(value) {
            this.uniforms.shadingToonyFactor.value = value;
        }
        get giEqualizationFactor() {
            return this.uniforms.giEqualizationFactor.value;
        }
        set giEqualizationFactor(value) {
            this.uniforms.giEqualizationFactor.value = value;
        }
        get matcapFactor() {
            return this.uniforms.matcapFactor.value;
        }
        set matcapFactor(value) {
            this.uniforms.matcapFactor.value = value;
        }
        get matcapTexture() {
            return this.uniforms.matcapTexture.value;
        }
        set matcapTexture(value) {
            this.uniforms.matcapTexture.value = value;
        }
        get parametricRimColorFactor() {
            return this.uniforms.parametricRimColorFactor.value;
        }
        set parametricRimColorFactor(value) {
            this.uniforms.parametricRimColorFactor.value = value;
        }
        get rimMultiplyTexture() {
            return this.uniforms.rimMultiplyTexture.value;
        }
        set rimMultiplyTexture(value) {
            this.uniforms.rimMultiplyTexture.value = value;
        }
        get rimLightingMixFactor() {
            return this.uniforms.rimLightingMixFactor.value;
        }
        set rimLightingMixFactor(value) {
            this.uniforms.rimLightingMixFactor.value = value;
        }
        get parametricRimFresnelPowerFactor() {
            return this.uniforms.parametricRimFresnelPowerFactor.value;
        }
        set parametricRimFresnelPowerFactor(value) {
            this.uniforms.parametricRimFresnelPowerFactor.value = value;
        }
        get parametricRimLiftFactor() {
            return this.uniforms.parametricRimLiftFactor.value;
        }
        set parametricRimLiftFactor(value) {
            this.uniforms.parametricRimLiftFactor.value = value;
        }
        get outlineWidthMultiplyTexture() {
            return this.uniforms.outlineWidthMultiplyTexture.value;
        }
        set outlineWidthMultiplyTexture(value) {
            this.uniforms.outlineWidthMultiplyTexture.value = value;
        }
        get outlineWidthFactor() {
            return this.uniforms.outlineWidthFactor.value;
        }
        set outlineWidthFactor(value) {
            this.uniforms.outlineWidthFactor.value = value;
        }
        get outlineColorFactor() {
            return this.uniforms.outlineColorFactor.value;
        }
        set outlineColorFactor(value) {
            this.uniforms.outlineColorFactor.value = value;
        }
        get outlineLightingMixFactor() {
            return this.uniforms.outlineLightingMixFactor.value;
        }
        set outlineLightingMixFactor(value) {
            this.uniforms.outlineLightingMixFactor.value = value;
        }
        get uvAnimationMaskTexture() {
            return this.uniforms.uvAnimationMaskTexture.value;
        }
        set uvAnimationMaskTexture(value) {
            this.uniforms.uvAnimationMaskTexture.value = value;
        }
        get uvAnimationScrollXOffset() {
            return this.uniforms.uvAnimationScrollXOffset.value;
        }
        set uvAnimationScrollXOffset(value) {
            this.uniforms.uvAnimationScrollXOffset.value = value;
        }
        get uvAnimationScrollYOffset() {
            return this.uniforms.uvAnimationScrollYOffset.value;
        }
        set uvAnimationScrollYOffset(value) {
            this.uniforms.uvAnimationScrollYOffset.value = value;
        }
        get uvAnimationRotationPhase() {
            return this.uniforms.uvAnimationRotationPhase.value;
        }
        set uvAnimationRotationPhase(value) {
            this.uniforms.uvAnimationRotationPhase.value = value;
        }
        /**
         * When this is `true`, vertex colors will be ignored.
         * `true` by default.
         */
        get ignoreVertexColor() {
            return this._ignoreVertexColor;
        }
        set ignoreVertexColor(value) {
            this._ignoreVertexColor = value;
            this.needsUpdate = true;
        }
        /**
         * There is a line of the shader called "comment out if you want to PBR absolutely" in VRM0.0 MToon.
         * When this is true, the material enables the line to make it compatible with the legacy rendering of VRM.
         * Usually not recommended to turn this on.
         * `false` by default.
         */
        get v0CompatShade() {
            return this._v0CompatShade;
        }
        /**
         * There is a line of the shader called "comment out if you want to PBR absolutely" in VRM0.0 MToon.
         * When this is true, the material enables the line to make it compatible with the legacy rendering of VRM.
         * Usually not recommended to turn this on.
         * `false` by default.
         */
        set v0CompatShade(v) {
            this._v0CompatShade = v;
            this.needsUpdate = true;
        }
        /**
         * Debug mode for the material.
         * You can visualize several components for diagnosis using debug mode.
         *
         * See: {@link MToonMaterialDebugMode}
         */
        get debugMode() {
            return this._debugMode;
        }
        /**
         * Debug mode for the material.
         * You can visualize several components for diagnosis using debug mode.
         *
         * See: {@link MToonMaterialDebugMode}
         */
        set debugMode(m) {
            this._debugMode = m;
            this.needsUpdate = true;
        }
        get outlineWidthMode() {
            return this._outlineWidthMode;
        }
        set outlineWidthMode(m) {
            this._outlineWidthMode = m;
            this.needsUpdate = true;
        }
        get isOutline() {
            return this._isOutline;
        }
        set isOutline(b) {
            this._isOutline = b;
            this.needsUpdate = true;
        }
        /**
         * Readonly boolean that indicates this is a [[MToonMaterial]].
         */
        get isMToonMaterial() {
            return true;
        }
        /**
         * Update this material.
         *
         * @param delta deltaTime since last update
         */
        update(delta) {
            this._uploadUniformsWorkaround();
            this._updateUVAnimation(delta);
        }
        copy(source) {
            super.copy(source);
            // uniforms are already copied at this moment
            // Beginning from r133, uniform textures will be cloned instead of reference
            // See: https://github.com/mrdoob/three.js/blob/a8813be04a849bd155f7cf6f1b23d8ee2e0fb48b/examples/jsm/loaders/GLTFLoader.js#L3047
            // See: https://github.com/mrdoob/three.js/blob/a8813be04a849bd155f7cf6f1b23d8ee2e0fb48b/src/renderers/shaders/UniformsUtils.js#L22
            // This will leave their `.version` to be `0`
            // and these textures won't be uploaded to GPU
            // We are going to workaround this in here
            // I've opened an issue for this: https://github.com/mrdoob/three.js/issues/22718
            this.map = source.map;
            this.normalMap = source.normalMap;
            this.emissiveMap = source.emissiveMap;
            this.shadeMultiplyTexture = source.shadeMultiplyTexture;
            this.shadingShiftTexture = source.shadingShiftTexture;
            this.matcapTexture = source.matcapTexture;
            this.rimMultiplyTexture = source.rimMultiplyTexture;
            this.outlineWidthMultiplyTexture = source.outlineWidthMultiplyTexture;
            this.uvAnimationMaskTexture = source.uvAnimationMaskTexture;
            // == copy members =============================================================================
            this.normalMapType = source.normalMapType;
            this.uvAnimationScrollXSpeedFactor = source.uvAnimationScrollXSpeedFactor;
            this.uvAnimationScrollYSpeedFactor = source.uvAnimationScrollYSpeedFactor;
            this.uvAnimationRotationSpeedFactor = source.uvAnimationRotationSpeedFactor;
            this.ignoreVertexColor = source.ignoreVertexColor;
            this.v0CompatShade = source.v0CompatShade;
            this.debugMode = source.debugMode;
            this.outlineWidthMode = source.outlineWidthMode;
            this.isOutline = source.isOutline;
            // == update shader stuff ======================================================================
            this.needsUpdate = true;
            return this;
        }
        /**
         * Update UV animation state.
         * Intended to be called via {@link update}.
         * @param delta deltaTime
         */
        _updateUVAnimation(delta) {
            this.uniforms.uvAnimationScrollXOffset.value += delta * this.uvAnimationScrollXSpeedFactor;
            this.uniforms.uvAnimationScrollYOffset.value += delta * this.uvAnimationScrollYSpeedFactor;
            this.uniforms.uvAnimationRotationPhase.value += delta * this.uvAnimationRotationSpeedFactor;
            this.uniformsNeedUpdate = true;
        }
        /**
         * Upload uniforms that need to upload but doesn't automatically because of reasons.
         * Intended to be called via {@link constructor} and {@link update}.
         */
        _uploadUniformsWorkaround() {
            // workaround: since opacity is defined as a property in THREE.Material
            // and cannot be overridden as an accessor,
            // We are going to update opacity here
            this.uniforms.opacity.value = this.opacity;
            // workaround: texture transforms are not updated automatically
            this._updateTextureMatrix(this.uniforms.map, this.uniforms.mapUvTransform);
            this._updateTextureMatrix(this.uniforms.normalMap, this.uniforms.normalMapUvTransform);
            this._updateTextureMatrix(this.uniforms.emissiveMap, this.uniforms.emissiveMapUvTransform);
            this._updateTextureMatrix(this.uniforms.shadeMultiplyTexture, this.uniforms.shadeMultiplyTextureUvTransform);
            this._updateTextureMatrix(this.uniforms.shadingShiftTexture, this.uniforms.shadingShiftTextureUvTransform);
            this._updateTextureMatrix(this.uniforms.matcapTexture, this.uniforms.matcapTextureUvTransform);
            this._updateTextureMatrix(this.uniforms.rimMultiplyTexture, this.uniforms.rimMultiplyTextureUvTransform);
            this._updateTextureMatrix(this.uniforms.outlineWidthMultiplyTexture, this.uniforms.outlineWidthMultiplyTextureUvTransform);
            this._updateTextureMatrix(this.uniforms.uvAnimationMaskTexture, this.uniforms.uvAnimationMaskTextureUvTransform);
            // COMPAT workaround: starting from r132, alphaTest becomes a uniform instead of preprocessor value
            const threeRevision = parseInt(THREE__namespace.REVISION, 10);
            if (threeRevision >= 132) {
                this.uniforms.alphaTest.value = this.alphaTest;
            }
            this.uniformsNeedUpdate = true;
        }
        /**
         * Returns a map object of preprocessor token and macro of the shader program.
         */
        _generateDefines() {
            const threeRevision = parseInt(THREE__namespace.REVISION, 10);
            const useUvInVert = this.outlineWidthMultiplyTexture !== null;
            const useUvInFrag = this.map !== null ||
                this.emissiveMap !== null ||
                this.shadeMultiplyTexture !== null ||
                this.shadingShiftTexture !== null ||
                this.rimMultiplyTexture !== null ||
                this.uvAnimationMaskTexture !== null;
            return {
                // Temporary compat against shader change @ Three.js r126
                // See: #21205, #21307, #21299
                THREE_VRM_THREE_REVISION: threeRevision,
                OUTLINE: this._isOutline,
                MTOON_USE_UV: useUvInVert || useUvInFrag,
                MTOON_UVS_VERTEX_ONLY: useUvInVert && !useUvInFrag,
                V0_COMPAT_SHADE: this._v0CompatShade,
                USE_SHADEMULTIPLYTEXTURE: this.shadeMultiplyTexture !== null,
                USE_SHADINGSHIFTTEXTURE: this.shadingShiftTexture !== null,
                USE_MATCAPTEXTURE: this.matcapTexture !== null,
                USE_RIMMULTIPLYTEXTURE: this.rimMultiplyTexture !== null,
                USE_OUTLINEWIDTHMULTIPLYTEXTURE: this.outlineWidthMultiplyTexture !== null,
                USE_UVANIMATIONMASKTEXTURE: this.uvAnimationMaskTexture !== null,
                IGNORE_VERTEX_COLOR: this._ignoreVertexColor === true,
                DEBUG_NORMAL: this._debugMode === 'normal',
                DEBUG_LITSHADERATE: this._debugMode === 'litShadeRate',
                DEBUG_UV: this._debugMode === 'uv',
                OUTLINE_WIDTH_WORLD: this._outlineWidthMode === MToonMaterialOutlineWidthMode.WorldCoordinates,
                OUTLINE_WIDTH_SCREEN: this._outlineWidthMode === MToonMaterialOutlineWidthMode.ScreenCoordinates,
            };
        }
        _updateTextureMatrix(src, dst) {
            if (src.value) {
                if (src.value.matrixAutoUpdate) {
                    src.value.updateMatrix();
                }
                dst.value.copy(src.value.matrix);
            }
        }
    }

    /**
     * MaterialParameters hates `undefined`. This helper automatically rejects assign of these `undefined`.
     * It also handles asynchronous process of textures.
     * Make sure await for {@link GLTFMToonMaterialParamsAssignHelper.pending}.
     */
    class GLTFMToonMaterialParamsAssignHelper {
        constructor(parser, materialParams) {
            this._parser = parser;
            this._materialParams = materialParams;
            this._pendings = [];
        }
        get pending() {
            return Promise.all(this._pendings);
        }
        assignPrimitive(key, value) {
            if (value != null) {
                this._materialParams[key] = value;
            }
        }
        assignColor(key, value, convertSRGBToLinear) {
            if (value != null) {
                this._materialParams[key] = new THREE__namespace.Color().fromArray(value);
                if (convertSRGBToLinear) {
                    this._materialParams[key].convertSRGBToLinear();
                }
            }
        }
        assignTexture(key, texture, isColorTexture) {
            return __awaiter(this, void 0, void 0, function* () {
                const promise = (() => __awaiter(this, void 0, void 0, function* () {
                    if (texture != null) {
                        yield this._parser.assignTexture(this._materialParams, key, texture);
                        if (isColorTexture) {
                            this._materialParams[key].encoding = THREE__namespace.sRGBEncoding;
                        }
                    }
                }))();
                this._pendings.push(promise);
                return promise;
            });
        }
        assignTextureByIndex(key, textureIndex, isColorTexture) {
            return __awaiter(this, void 0, void 0, function* () {
                return this.assignTexture(key, textureIndex != null ? { index: textureIndex } : undefined, isColorTexture);
            });
        }
    }

    class MToonMaterialLoaderPlugin {
        constructor(parser, options = {}) {
            var _a, _b, _c;
            this.parser = parser;
            this.renderOrderOffset = (_a = options.renderOrderOffset) !== null && _a !== void 0 ? _a : 0;
            this.v0CompatShade = (_b = options.v0CompatShade) !== null && _b !== void 0 ? _b : false;
            this.debugMode = (_c = options.debugMode) !== null && _c !== void 0 ? _c : 'none';
            this._mToonMaterialSet = new Set();
        }
        get name() {
            return MToonMaterialLoaderPlugin.EXTENSION_NAME;
        }
        beforeRoot() {
            return __awaiter(this, void 0, void 0, function* () {
                this._removeUnlitExtensionIfMToonExists();
            });
        }
        afterRoot(gltf) {
            return __awaiter(this, void 0, void 0, function* () {
                gltf.userData.vrmMToonMaterials = Array.from(this._mToonMaterialSet);
            });
        }
        getMaterialType(materialIndex) {
            const v1Extension = this._getMToonExtension(materialIndex);
            if (v1Extension) {
                return MToonMaterial;
            }
            return null;
        }
        extendMaterialParams(materialIndex, materialParams) {
            const extension = this._getMToonExtension(materialIndex);
            if (extension) {
                return this._extendMaterialParams(extension, materialParams);
            }
            return null;
        }
        loadMesh(meshIndex) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                const parser = this.parser;
                const json = parser.json;
                const meshDef = (_a = json.meshes) === null || _a === void 0 ? void 0 : _a[meshIndex];
                if (meshDef == null) {
                    throw new Error(`MToonMaterialLoaderPlugin: Attempt to use meshes[${meshIndex}] of glTF but the mesh doesn't exist`);
                }
                const primitivesDef = meshDef.primitives;
                const meshOrGroup = yield parser.loadMesh(meshIndex);
                if (primitivesDef.length === 1) {
                    const mesh = meshOrGroup;
                    const materialIndex = primitivesDef[0].material;
                    if (materialIndex != null) {
                        this._setupPrimitive(mesh, materialIndex);
                    }
                }
                else {
                    const group = meshOrGroup;
                    for (let i = 0; i < primitivesDef.length; i++) {
                        const mesh = group.children[i];
                        const materialIndex = primitivesDef[i].material;
                        if (materialIndex != null) {
                            this._setupPrimitive(mesh, materialIndex);
                        }
                    }
                }
                return meshOrGroup;
            });
        }
        /**
         * Delete use of `KHR_materials_unlit` from its `materials` if the material is using MToon.
         *
         * Since GLTFLoader have so many hardcoded procedure related to `KHR_materials_unlit`
         * we have to delete the extension before we start to parse the glTF.
         */
        _removeUnlitExtensionIfMToonExists() {
            const parser = this.parser;
            const json = parser.json;
            const materialDefs = json.materials;
            materialDefs === null || materialDefs === void 0 ? void 0 : materialDefs.map((materialDef, iMaterial) => {
                var _a;
                const extension = this._getMToonExtension(iMaterial);
                if (extension && ((_a = materialDef.extensions) === null || _a === void 0 ? void 0 : _a['KHR_materials_unlit'])) {
                    delete materialDef.extensions['KHR_materials_unlit'];
                }
            });
        }
        _getMToonExtension(materialIndex) {
            var _a, _b;
            const parser = this.parser;
            const json = parser.json;
            const materialDef = (_a = json.materials) === null || _a === void 0 ? void 0 : _a[materialIndex];
            if (materialDef == null) {
                console.warn(`MToonMaterialLoaderPlugin: Attempt to use materials[${materialIndex}] of glTF but the material doesn't exist`);
                return undefined;
            }
            const extension = (_b = materialDef.extensions) === null || _b === void 0 ? void 0 : _b[MToonMaterialLoaderPlugin.EXTENSION_NAME];
            if (extension == null) {
                return undefined;
            }
            const specVersion = extension.specVersion;
            if (specVersion !== '1.0-beta') {
                return undefined;
            }
            return extension;
        }
        _extendMaterialParams(extension, materialParams) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                // Removing material params that is not required to supress warnings.
                delete materialParams.metalness;
                delete materialParams.roughness;
                const assignHelper = new GLTFMToonMaterialParamsAssignHelper(this.parser, materialParams);
                assignHelper.assignPrimitive('transparentWithZWrite', extension.transparentWithZWrite);
                assignHelper.assignColor('shadeColorFactor', extension.shadeColorFactor);
                assignHelper.assignTexture('shadeMultiplyTexture', extension.shadeMultiplyTexture, true);
                assignHelper.assignPrimitive('shadingShiftFactor', extension.shadingShiftFactor);
                assignHelper.assignTexture('shadingShiftTexture', extension.shadingShiftTexture, true);
                assignHelper.assignPrimitive('shadingShiftTextureScale', (_a = extension.shadingShiftTexture) === null || _a === void 0 ? void 0 : _a.scale);
                assignHelper.assignPrimitive('shadingToonyFactor', extension.shadingToonyFactor);
                assignHelper.assignPrimitive('giEqualizationFactor', extension.giEqualizationFactor);
                assignHelper.assignColor('matcapFactor', extension.matcapFactor);
                assignHelper.assignTexture('matcapTexture', extension.matcapTexture, true);
                assignHelper.assignColor('parametricRimColorFactor', extension.parametricRimColorFactor);
                assignHelper.assignTexture('rimMultiplyTexture', extension.rimMultiplyTexture, true);
                assignHelper.assignPrimitive('rimLightingMixFactor', extension.rimLightingMixFactor);
                assignHelper.assignPrimitive('parametricRimFresnelPowerFactor', extension.parametricRimFresnelPowerFactor);
                assignHelper.assignPrimitive('parametricRimLiftFactor', extension.parametricRimLiftFactor);
                assignHelper.assignPrimitive('outlineWidthMode', extension.outlineWidthMode);
                assignHelper.assignPrimitive('outlineWidthFactor', extension.outlineWidthFactor);
                assignHelper.assignTexture('outlineWidthMultiplyTexture', extension.outlineWidthMultiplyTexture, false);
                assignHelper.assignColor('outlineColorFactor', extension.outlineColorFactor);
                assignHelper.assignPrimitive('outlineLightingMixFactor', extension.outlineLightingMixFactor);
                assignHelper.assignTexture('uvAnimationMaskTexture', extension.uvAnimationMaskTexture, false);
                assignHelper.assignPrimitive('uvAnimationScrollXSpeedFactor', extension.uvAnimationScrollXSpeedFactor);
                assignHelper.assignPrimitive('uvAnimationScrollYSpeedFactor', extension.uvAnimationScrollYSpeedFactor);
                assignHelper.assignPrimitive('uvAnimationRotationSpeedFactor', extension.uvAnimationRotationSpeedFactor);
                assignHelper.assignPrimitive('v0CompatShade', this.v0CompatShade);
                assignHelper.assignPrimitive('debugMode', this.debugMode);
                yield assignHelper.pending;
            });
        }
        /**
         * This will do two processes that is required to render MToon properly.
         *
         * - Set render order
         * - Generate outline
         *
         * @param mesh A target GLTF primitive
         * @param materialIndex The material index of the primitive
         */
        _setupPrimitive(mesh, materialIndex) {
            const extension = this._getMToonExtension(materialIndex);
            if (extension) {
                const renderOrder = this._parseRenderOrder(extension);
                mesh.renderOrder = renderOrder + this.renderOrderOffset;
                this._generateOutline(mesh);
                this._addToMaterialSet(mesh);
                return;
            }
        }
        /**
         * Generate outline for the given mesh, if it needs.
         *
         * @param mesh The target mesh
         */
        _generateOutline(mesh) {
            // OK, it's the hacky part.
            // We are going to duplicate the MToonMaterial for outline use.
            // Then we are going to create two geometry groups and refer same buffer but different material.
            // It's how we draw two materials at once using a single mesh.
            // make sure the material is mtoon
            const surfaceMaterial = mesh.material;
            if (!(surfaceMaterial instanceof MToonMaterial)) {
                return;
            }
            // check whether we really have to prepare outline or not
            if (surfaceMaterial.outlineWidthMode === 'none' || surfaceMaterial.outlineWidthFactor <= 0.0) {
                return;
            }
            // make its material an array
            mesh.material = [surfaceMaterial]; // mesh.material is guaranteed to be a Material in GLTFLoader
            // duplicate the material for outline use
            const outlineMaterial = surfaceMaterial.clone();
            outlineMaterial.name += ' (Outline)';
            outlineMaterial.isOutline = true;
            outlineMaterial.side = THREE__namespace.BackSide;
            mesh.material.push(outlineMaterial);
            // make two geometry groups out of a same buffer
            const geometry = mesh.geometry; // mesh.geometry is guaranteed to be a BufferGeometry in GLTFLoader
            const primitiveVertices = geometry.index ? geometry.index.count : geometry.attributes.position.count / 3;
            geometry.addGroup(0, primitiveVertices, 0);
            geometry.addGroup(0, primitiveVertices, 1);
        }
        _addToMaterialSet(mesh) {
            const materialOrMaterials = mesh.material;
            const materialSet = new Set();
            if (Array.isArray(materialOrMaterials)) {
                materialOrMaterials.forEach((material) => materialSet.add(material));
            }
            else {
                materialSet.add(materialOrMaterials);
            }
            for (const material of materialSet) {
                if (material instanceof MToonMaterial) {
                    this._mToonMaterialSet.add(material);
                }
            }
        }
        _parseRenderOrder(extension) {
            var _a;
            // transparentWithZWrite ranges from 0 to +9
            // mere transparent ranges from -9 to 0
            const enabledZWrite = extension.transparentWithZWrite;
            return (enabledZWrite ? 0 : 19) + ((_a = extension.renderQueueOffsetNumber) !== null && _a !== void 0 ? _a : 0);
        }
    }
    MToonMaterialLoaderPlugin.EXTENSION_NAME = 'VRMC_materials_mtoon';

    exports.MToonMaterial = MToonMaterial;
    exports.MToonMaterialDebugMode = MToonMaterialDebugMode;
    exports.MToonMaterialLoaderPlugin = MToonMaterialLoaderPlugin;
    exports.MToonMaterialOutlineWidthMode = MToonMaterialOutlineWidthMode;

    Object.defineProperty(exports, '__esModule', { value: true });

    Object.assign(THREE, exports);

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLW1hdGVyaWFscy1tdG9vbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uL3NyYy9NVG9vbk1hdGVyaWFsRGVidWdNb2RlLnRzIiwiLi4vc3JjL01Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLnRzIiwiLi4vc3JjL3V0aWxzL2dldFRleGVsRGVjb2RpbmdGdW5jdGlvbi50cyIsIi4uL3NyYy91dGlscy9nZXRUZXh0dXJlRW5jb2RpbmdGcm9tTWFwLnRzIiwiLi4vc3JjL01Ub29uTWF0ZXJpYWwudHMiLCIuLi9zcmMvR0xURk1Ub29uTWF0ZXJpYWxQYXJhbXNBc3NpZ25IZWxwZXIudHMiLCIuLi9zcmMvTVRvb25NYXRlcmlhbExvYWRlclBsdWdpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcclxuQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uXHJcblxyXG5QZXJtaXNzaW9uIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBhbmQvb3IgZGlzdHJpYnV0ZSB0aGlzIHNvZnR3YXJlIGZvciBhbnlcclxucHVycG9zZSB3aXRoIG9yIHdpdGhvdXQgZmVlIGlzIGhlcmVieSBncmFudGVkLlxyXG5cclxuVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiBBTkQgVEhFIEFVVEhPUiBESVNDTEFJTVMgQUxMIFdBUlJBTlRJRVMgV0lUSFxyXG5SRUdBUkQgVE8gVEhJUyBTT0ZUV0FSRSBJTkNMVURJTkcgQUxMIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFlcclxuQU5EIEZJVE5FU1MuIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1IgQkUgTElBQkxFIEZPUiBBTlkgU1BFQ0lBTCwgRElSRUNULFxyXG5JTkRJUkVDVCwgT1IgQ09OU0VRVUVOVElBTCBEQU1BR0VTIE9SIEFOWSBEQU1BR0VTIFdIQVRTT0VWRVIgUkVTVUxUSU5HIEZST01cclxuTE9TUyBPRiBVU0UsIERBVEEgT1IgUFJPRklUUywgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIE5FR0xJR0VOQ0UgT1JcclxuT1RIRVIgVE9SVElPVVMgQUNUSU9OLCBBUklTSU5HIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFVTRSBPUlxyXG5QRVJGT1JNQU5DRSBPRiBUSElTIFNPRlRXQVJFLlxyXG4qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiAqL1xyXG4vKiBnbG9iYWwgUmVmbGVjdCwgUHJvbWlzZSAqL1xyXG5cclxudmFyIGV4dGVuZFN0YXRpY3MgPSBmdW5jdGlvbihkLCBiKSB7XHJcbiAgICBleHRlbmRTdGF0aWNzID0gT2JqZWN0LnNldFByb3RvdHlwZU9mIHx8XHJcbiAgICAgICAgKHsgX19wcm90b19fOiBbXSB9IGluc3RhbmNlb2YgQXJyYXkgJiYgZnVuY3Rpb24gKGQsIGIpIHsgZC5fX3Byb3RvX18gPSBiOyB9KSB8fFxyXG4gICAgICAgIGZ1bmN0aW9uIChkLCBiKSB7IGZvciAodmFyIHAgaW4gYikgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChiLCBwKSkgZFtwXSA9IGJbcF07IH07XHJcbiAgICByZXR1cm4gZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2V4dGVuZHMoZCwgYikge1xyXG4gICAgaWYgKHR5cGVvZiBiICE9PSBcImZ1bmN0aW9uXCIgJiYgYiAhPT0gbnVsbClcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2xhc3MgZXh0ZW5kcyB2YWx1ZSBcIiArIFN0cmluZyhiKSArIFwiIGlzIG5vdCBhIGNvbnN0cnVjdG9yIG9yIG51bGxcIik7XHJcbiAgICBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG4gICAgZnVuY3Rpb24gX18oKSB7IHRoaXMuY29uc3RydWN0b3IgPSBkOyB9XHJcbiAgICBkLnByb3RvdHlwZSA9IGIgPT09IG51bGwgPyBPYmplY3QuY3JlYXRlKGIpIDogKF9fLnByb3RvdHlwZSA9IGIucHJvdG90eXBlLCBuZXcgX18oKSk7XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19hc3NpZ24gPSBmdW5jdGlvbigpIHtcclxuICAgIF9fYXNzaWduID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiBfX2Fzc2lnbih0KSB7XHJcbiAgICAgICAgZm9yICh2YXIgcywgaSA9IDEsIG4gPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgbjsgaSsrKSB7XHJcbiAgICAgICAgICAgIHMgPSBhcmd1bWVudHNbaV07XHJcbiAgICAgICAgICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSkgdFtwXSA9IHNbcF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIF9fYXNzaWduLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Jlc3QocywgZSkge1xyXG4gICAgdmFyIHQgPSB7fTtcclxuICAgIGZvciAodmFyIHAgaW4gcykgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzLCBwKSAmJiBlLmluZGV4T2YocCkgPCAwKVxyXG4gICAgICAgIHRbcF0gPSBzW3BdO1xyXG4gICAgaWYgKHMgIT0gbnVsbCAmJiB0eXBlb2YgT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyA9PT0gXCJmdW5jdGlvblwiKVxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBwID0gT2JqZWN0LmdldE93blByb3BlcnR5U3ltYm9scyhzKTsgaSA8IHAubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgaWYgKGUuaW5kZXhPZihwW2ldKSA8IDAgJiYgT2JqZWN0LnByb3RvdHlwZS5wcm9wZXJ0eUlzRW51bWVyYWJsZS5jYWxsKHMsIHBbaV0pKVxyXG4gICAgICAgICAgICAgICAgdFtwW2ldXSA9IHNbcFtpXV07XHJcbiAgICAgICAgfVxyXG4gICAgcmV0dXJuIHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2RlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKSB7XHJcbiAgICB2YXIgYyA9IGFyZ3VtZW50cy5sZW5ndGgsIHIgPSBjIDwgMyA/IHRhcmdldCA6IGRlc2MgPT09IG51bGwgPyBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih0YXJnZXQsIGtleSkgOiBkZXNjLCBkO1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0LmRlY29yYXRlID09PSBcImZ1bmN0aW9uXCIpIHIgPSBSZWZsZWN0LmRlY29yYXRlKGRlY29yYXRvcnMsIHRhcmdldCwga2V5LCBkZXNjKTtcclxuICAgIGVsc2UgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIGlmIChkID0gZGVjb3JhdG9yc1tpXSkgciA9IChjIDwgMyA/IGQocikgOiBjID4gMyA/IGQodGFyZ2V0LCBrZXksIHIpIDogZCh0YXJnZXQsIGtleSkpIHx8IHI7XHJcbiAgICByZXR1cm4gYyA+IDMgJiYgciAmJiBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBrZXksIHIpLCByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19wYXJhbShwYXJhbUluZGV4LCBkZWNvcmF0b3IpIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0LCBrZXkpIHsgZGVjb3JhdG9yKHRhcmdldCwga2V5LCBwYXJhbUluZGV4KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKF8pIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChmID0gMSwgeSAmJiAodCA9IG9wWzBdICYgMiA/IHlbXCJyZXR1cm5cIl0gOiBvcFswXSA/IHlbXCJ0aHJvd1wiXSB8fCAoKHQgPSB5W1wicmV0dXJuXCJdKSAmJiB0LmNhbGwoeSksIDApIDogeS5uZXh0KSAmJiAhKHQgPSB0LmNhbGwoeSwgb3BbMV0pKS5kb25lKSByZXR1cm4gdDtcclxuICAgICAgICAgICAgaWYgKHkgPSAwLCB0KSBvcCA9IFtvcFswXSAmIDIsIHQudmFsdWVdO1xyXG4gICAgICAgICAgICBzd2l0Y2ggKG9wWzBdKSB7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDA6IGNhc2UgMTogdCA9IG9wOyBicmVhaztcclxuICAgICAgICAgICAgICAgIGNhc2UgNDogXy5sYWJlbCsrOyByZXR1cm4geyB2YWx1ZTogb3BbMV0sIGRvbmU6IGZhbHNlIH07XHJcbiAgICAgICAgICAgICAgICBjYXNlIDU6IF8ubGFiZWwrKzsgeSA9IG9wWzFdOyBvcCA9IFswXTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDc6IG9wID0gXy5vcHMucG9wKCk7IF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHQgPSBfLnRyeXMsIHQgPSB0Lmxlbmd0aCA+IDAgJiYgdFt0Lmxlbmd0aCAtIDFdKSAmJiAob3BbMF0gPT09IDYgfHwgb3BbMF0gPT09IDIpKSB7IF8gPSAwOyBjb250aW51ZTsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gMyAmJiAoIXQgfHwgKG9wWzFdID4gdFswXSAmJiBvcFsxXSA8IHRbM10pKSkgeyBfLmxhYmVsID0gb3BbMV07IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSA2ICYmIF8ubGFiZWwgPCB0WzFdKSB7IF8ubGFiZWwgPSB0WzFdOyB0ID0gb3A7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHQgJiYgXy5sYWJlbCA8IHRbMl0pIHsgXy5sYWJlbCA9IHRbMl07IF8ub3BzLnB1c2gob3ApOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0WzJdKSBfLm9wcy5wb3AoKTtcclxuICAgICAgICAgICAgICAgICAgICBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIG9wID0gYm9keS5jYWxsKHRoaXNBcmcsIF8pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHsgb3AgPSBbNiwgZV07IHkgPSAwOyB9IGZpbmFsbHkgeyBmID0gdCA9IDA7IH1cclxuICAgICAgICBpZiAob3BbMF0gJiA1KSB0aHJvdyBvcFsxXTsgcmV0dXJuIHsgdmFsdWU6IG9wWzBdID8gb3BbMV0gOiB2b2lkIDAsIGRvbmU6IHRydWUgfTtcclxuICAgIH1cclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2NyZWF0ZUJpbmRpbmcgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIG0sIGssIGsyKSB7XHJcbiAgICBpZiAoazIgPT09IHVuZGVmaW5lZCkgazIgPSBrO1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIGsyLCB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH0pO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSkge1xyXG4gICAgZm9yICh2YXIgaSA9IDAsIGlsID0gZnJvbS5sZW5ndGgsIGogPSB0by5sZW5ndGg7IGkgPCBpbDsgaSsrLCBqKyspXHJcbiAgICAgICAgdG9bal0gPSBmcm9tW2ldO1xyXG4gICAgcmV0dXJuIHRvO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hd2FpdCh2KSB7XHJcbiAgICByZXR1cm4gdGhpcyBpbnN0YW5jZW9mIF9fYXdhaXQgPyAodGhpcy52ID0gdiwgdGhpcykgOiBuZXcgX19hd2FpdCh2KTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNHZW5lcmF0b3IodGhpc0FyZywgX2FyZ3VtZW50cywgZ2VuZXJhdG9yKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIGcgPSBnZW5lcmF0b3IuYXBwbHkodGhpc0FyZywgX2FyZ3VtZW50cyB8fCBbXSksIGksIHEgPSBbXTtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpZiAoZ1tuXSkgaVtuXSA9IGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAoYSwgYikgeyBxLnB1c2goW24sIHYsIGEsIGJdKSA+IDEgfHwgcmVzdW1lKG4sIHYpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gcmVzdW1lKG4sIHYpIHsgdHJ5IHsgc3RlcChnW25dKHYpKTsgfSBjYXRjaCAoZSkgeyBzZXR0bGUocVswXVszXSwgZSk7IH0gfVxyXG4gICAgZnVuY3Rpb24gc3RlcChyKSB7IHIudmFsdWUgaW5zdGFuY2VvZiBfX2F3YWl0ID8gUHJvbWlzZS5yZXNvbHZlKHIudmFsdWUudikudGhlbihmdWxmaWxsLCByZWplY3QpIDogc2V0dGxlKHFbMF1bMl0sIHIpOyB9XHJcbiAgICBmdW5jdGlvbiBmdWxmaWxsKHZhbHVlKSB7IHJlc3VtZShcIm5leHRcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiByZWplY3QodmFsdWUpIHsgcmVzdW1lKFwidGhyb3dcIiwgdmFsdWUpOyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUoZiwgdikgeyBpZiAoZih2KSwgcS5zaGlmdCgpLCBxLmxlbmd0aCkgcmVzdW1lKHFbMF1bMF0sIHFbMF1bMV0pOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jRGVsZWdhdG9yKG8pIHtcclxuICAgIHZhciBpLCBwO1xyXG4gICAgcmV0dXJuIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiLCBmdW5jdGlvbiAoZSkgeyB0aHJvdyBlOyB9KSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuaXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobiwgZikgeyBpW25dID0gb1tuXSA/IGZ1bmN0aW9uICh2KSB7IHJldHVybiAocCA9ICFwKSA/IHsgdmFsdWU6IF9fYXdhaXQob1tuXSh2KSksIGRvbmU6IG4gPT09IFwicmV0dXJuXCIgfSA6IGYgPyBmKHYpIDogdjsgfSA6IGY7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXN5bmNWYWx1ZXMobykge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBtID0gb1tTeW1ib2wuYXN5bmNJdGVyYXRvcl0sIGk7XHJcbiAgICByZXR1cm4gbSA/IG0uY2FsbChvKSA6IChvID0gdHlwZW9mIF9fdmFsdWVzID09PSBcImZ1bmN0aW9uXCIgPyBfX3ZhbHVlcyhvKSA6IG9bU3ltYm9sLml0ZXJhdG9yXSgpLCBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLmFzeW5jSXRlcmF0b3JdID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gdGhpczsgfSwgaSk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaVtuXSA9IG9bbl0gJiYgZnVuY3Rpb24gKHYpIHsgcmV0dXJuIG5ldyBQcm9taXNlKGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHsgdiA9IG9bbl0odiksIHNldHRsZShyZXNvbHZlLCByZWplY3QsIHYuZG9uZSwgdi52YWx1ZSk7IH0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCBkLCB2KSB7IFByb21pc2UucmVzb2x2ZSh2KS50aGVuKGZ1bmN0aW9uKHYpIHsgcmVzb2x2ZSh7IHZhbHVlOiB2LCBkb25lOiBkIH0pOyB9LCByZWplY3QpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWQsIHJhdykge1xyXG4gICAgaWYgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSkgeyBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29va2VkLCBcInJhd1wiLCB7IHZhbHVlOiByYXcgfSk7IH0gZWxzZSB7IGNvb2tlZC5yYXcgPSByYXc7IH1cclxuICAgIHJldHVybiBjb29rZWQ7XHJcbn07XHJcblxyXG52YXIgX19zZXRNb2R1bGVEZWZhdWx0ID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgXCJkZWZhdWx0XCIsIHsgZW51bWVyYWJsZTogdHJ1ZSwgdmFsdWU6IHYgfSk7XHJcbn0pIDogZnVuY3Rpb24obywgdikge1xyXG4gICAgb1tcImRlZmF1bHRcIl0gPSB2O1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0U3Rhcihtb2QpIHtcclxuICAgIGlmIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpIHJldHVybiBtb2Q7XHJcbiAgICB2YXIgcmVzdWx0ID0ge307XHJcbiAgICBpZiAobW9kICE9IG51bGwpIGZvciAodmFyIGsgaW4gbW9kKSBpZiAoayAhPT0gXCJkZWZhdWx0XCIgJiYgT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG1vZCwgaykpIF9fY3JlYXRlQmluZGluZyhyZXN1bHQsIG1vZCwgayk7XHJcbiAgICBfX3NldE1vZHVsZURlZmF1bHQocmVzdWx0LCBtb2QpO1xyXG4gICAgcmV0dXJuIHJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9faW1wb3J0RGVmYXVsdChtb2QpIHtcclxuICAgIHJldHVybiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSA/IG1vZCA6IHsgZGVmYXVsdDogbW9kIH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkR2V0KHJlY2VpdmVyLCBwcml2YXRlTWFwKSB7XHJcbiAgICBpZiAoIXByaXZhdGVNYXAuaGFzKHJlY2VpdmVyKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhdHRlbXB0ZWQgdG8gZ2V0IHByaXZhdGUgZmllbGQgb24gbm9uLWluc3RhbmNlXCIpO1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIHByaXZhdGVNYXAuZ2V0KHJlY2VpdmVyKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRTZXQocmVjZWl2ZXIsIHByaXZhdGVNYXAsIHZhbHVlKSB7XHJcbiAgICBpZiAoIXByaXZhdGVNYXAuaGFzKHJlY2VpdmVyKSkge1xyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJhdHRlbXB0ZWQgdG8gc2V0IHByaXZhdGUgZmllbGQgb24gbm9uLWluc3RhbmNlXCIpO1xyXG4gICAgfVxyXG4gICAgcHJpdmF0ZU1hcC5zZXQocmVjZWl2ZXIsIHZhbHVlKTtcclxuICAgIHJldHVybiB2YWx1ZTtcclxufVxyXG4iLCIvKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cclxuXHJcbi8qKlxyXG4gKiBTcGVjaWZpZXJzIG9mIGRlYnVnIG1vZGUgb2Yge0BsaW5rIE1Ub29uTWF0ZXJpYWx9LlxyXG4gKlxyXG4gKiBTZWU6IHtAbGluayBNVG9vbk1hdGVyaWFsLmRlYnVnTW9kZX1cclxuICovXHJcbmV4cG9ydCBjb25zdCBNVG9vbk1hdGVyaWFsRGVidWdNb2RlID0ge1xyXG4gIC8qKlxyXG4gICAqIFJlbmRlciBub3JtYWxseS5cclxuICAgKi9cclxuICBOb25lOiAnbm9uZScsXHJcblxyXG4gIC8qKlxyXG4gICAqIFZpc3VhbGl6ZSBub3JtYWxzIG9mIHRoZSBzdXJmYWNlLlxyXG4gICAqL1xyXG4gIE5vcm1hbDogJ25vcm1hbCcsXHJcblxyXG4gIC8qKlxyXG4gICAqIFZpc3VhbGl6ZSBsaXQvc2hhZGUgb2YgdGhlIHN1cmZhY2UuXHJcbiAgICovXHJcbiAgTGl0U2hhZGVSYXRlOiAnbGl0U2hhZGVSYXRlJyxcclxuXHJcbiAgLyoqXHJcbiAgICogVmlzdWFsaXplIFVWIG9mIHRoZSBzdXJmYWNlLlxyXG4gICAqL1xyXG4gIFVWOiAndXYnLFxyXG59IGFzIGNvbnN0O1xyXG5cclxuZXhwb3J0IHR5cGUgTVRvb25NYXRlcmlhbERlYnVnTW9kZSA9IHR5cGVvZiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlW2tleW9mIHR5cGVvZiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlXTtcclxuIiwiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcblxyXG5leHBvcnQgY29uc3QgTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUgPSB7XHJcbiAgTm9uZTogJ25vbmUnLFxyXG4gIFdvcmxkQ29vcmRpbmF0ZXM6ICd3b3JsZENvb3JkaW5hdGVzJyxcclxuICBTY3JlZW5Db29yZGluYXRlczogJ3NjcmVlbkNvb3JkaW5hdGVzJyxcclxufSBhcyBjb25zdDtcclxuXHJcbmV4cG9ydCB0eXBlIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlID0gdHlwZW9mIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlW2tleW9mIHR5cGVvZiBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZV07XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuXHJcbi8vIFNpbmNlIHRoZXNlIGNvbnN0YW50cyBhcmUgZGVsZXRlZCBpbiByMTM2IHdlIGhhdmUgdG8gZGVmaW5lIGJ5IG91cnNlbHZlc1xyXG4vKiBlc2xpbnQtZGlzYWJsZSBAdHlwZXNjcmlwdC1lc2xpbnQvbmFtaW5nLWNvbnZlbnRpb24gKi9cclxuY29uc3QgUkdCRUVuY29kaW5nID0gMzAwMjtcclxuY29uc3QgUkdCTTdFbmNvZGluZyA9IDMwMDQ7XHJcbmNvbnN0IFJHQk0xNkVuY29kaW5nID0gMzAwNTtcclxuY29uc3QgUkdCREVuY29kaW5nID0gMzAwNjtcclxuY29uc3QgR2FtbWFFbmNvZGluZyA9IDMwMDc7XHJcbi8qIGVzbGludC1lbmFibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcblxyXG4vKipcclxuICogQ09NUEFUOiBwcmUtcjEzN1xyXG4gKlxyXG4gKiBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9yMTM2L3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtLmpzI0wyMlxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IGdldEVuY29kaW5nQ29tcG9uZW50cyA9IChlbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nKTogW3N0cmluZywgc3RyaW5nXSA9PiB7XHJcbiAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPj0gMTM2KSB7XHJcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XHJcbiAgICAgIGNhc2UgVEhSRUUuTGluZWFyRW5jb2Rpbmc6XHJcbiAgICAgICAgcmV0dXJuIFsnTGluZWFyJywgJyggdmFsdWUgKSddO1xyXG4gICAgICBjYXNlIFRIUkVFLnNSR0JFbmNvZGluZzpcclxuICAgICAgICByZXR1cm4gWydzUkdCJywgJyggdmFsdWUgKSddO1xyXG4gICAgICBkZWZhdWx0OlxyXG4gICAgICAgIGNvbnNvbGUud2FybignVEhSRUUuV2ViR0xQcm9ncmFtOiBVbnN1cHBvcnRlZCBlbmNvZGluZzonLCBlbmNvZGluZyk7XHJcbiAgICAgICAgcmV0dXJuIFsnTGluZWFyJywgJyggdmFsdWUgKSddO1xyXG4gICAgfVxyXG4gIH0gZWxzZSB7XHJcbiAgICAvLyBDT01QQVQ6IHByZS1yMTM2XHJcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XHJcbiAgICAgIGNhc2UgVEhSRUUuTGluZWFyRW5jb2Rpbmc6XHJcbiAgICAgICAgcmV0dXJuIFsnTGluZWFyJywgJyggdmFsdWUgKSddO1xyXG4gICAgICBjYXNlIFRIUkVFLnNSR0JFbmNvZGluZzpcclxuICAgICAgICByZXR1cm4gWydzUkdCJywgJyggdmFsdWUgKSddO1xyXG4gICAgICBjYXNlIFJHQkVFbmNvZGluZzpcclxuICAgICAgICByZXR1cm4gWydSR0JFJywgJyggdmFsdWUgKSddO1xyXG4gICAgICBjYXNlIFJHQk03RW5jb2Rpbmc6XHJcbiAgICAgICAgcmV0dXJuIFsnUkdCTScsICcoIHZhbHVlLCA3LjAgKSddO1xyXG4gICAgICBjYXNlIFJHQk0xNkVuY29kaW5nOlxyXG4gICAgICAgIHJldHVybiBbJ1JHQk0nLCAnKCB2YWx1ZSwgMTYuMCApJ107XHJcbiAgICAgIGNhc2UgUkdCREVuY29kaW5nOlxyXG4gICAgICAgIHJldHVybiBbJ1JHQkQnLCAnKCB2YWx1ZSwgMjU2LjAgKSddO1xyXG4gICAgICBjYXNlIEdhbW1hRW5jb2Rpbmc6XHJcbiAgICAgICAgcmV0dXJuIFsnR2FtbWEnLCAnKCB2YWx1ZSwgZmxvYXQoIEdBTU1BX0ZBQ1RPUiApICknXTtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ3Vuc3VwcG9ydGVkIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpO1xyXG4gICAgfVxyXG4gIH1cclxufTtcclxuXHJcbi8qKlxyXG4gKiBDT01QQVQ6IHByZS1yMTM3XHJcbiAqXHJcbiAqIFRoaXMgZnVuY3Rpb24gaXMgbm8gbG9uZ2VyIHJlcXVpcmVkIGJlZ2lubmluZyBmcm9tIHIxMzdcclxuICpcclxuICogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9ibG9iL3IxMzYvc3JjL3JlbmRlcmVycy93ZWJnbC9XZWJHTFByb2dyYW0uanMjTDUyXHJcbiAqL1xyXG5leHBvcnQgY29uc3QgZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uID0gKGZ1bmN0aW9uTmFtZTogc3RyaW5nLCBlbmNvZGluZzogVEhSRUUuVGV4dHVyZUVuY29kaW5nKTogc3RyaW5nID0+IHtcclxuICBjb25zdCBjb21wb25lbnRzID0gZ2V0RW5jb2RpbmdDb21wb25lbnRzKGVuY29kaW5nKTtcclxuICByZXR1cm4gJ3ZlYzQgJyArIGZ1bmN0aW9uTmFtZSArICcoIHZlYzQgdmFsdWUgKSB7IHJldHVybiAnICsgY29tcG9uZW50c1swXSArICdUb0xpbmVhcicgKyBjb21wb25lbnRzWzFdICsgJzsgfSc7XHJcbn07XHJcbiIsImltcG9ydCAqIGFzIFRIUkVFIGZyb20gJ3RocmVlJztcclxuXHJcbi8qKlxyXG4gKiBDT01QQVQ6IHByZS1yMTM3XHJcbiAqXHJcbiAqIFRoaXMgZnVuY3Rpb24gaXMgbm8gbG9uZ2VyIHJlcXVpcmVkIGJlZ2lubmluZyBmcm9tIHIxMzdcclxuICpcclxuICogUmV0cmlldmVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9ibG9iLzg4YjYzMjg5OThkMTU1ZmEwYTdjMWYxZTVlM2JkNmJmZjc1MjY4YzAvc3JjL3JlbmRlcmVycy93ZWJnbC9XZWJHTFByb2dyYW1zLmpzI0w5MlxyXG4gKlxyXG4gKiBEaWZmOlxyXG4gKiAgIC0gUmVtb3ZlIFdlYkdMUmVuZGVyVGFyZ2V0IGhhbmRsZXIgYmVjYXVzZSBpdCBpbmNyZWFzZXMgY29kZSBjb21wbGV4aXRpZXMgb24gVHlwZVNjcmlwdFxyXG4gKiAgIC0gQWRkIGEgYm9vbGVhbiBgaXNXZWJHTDJgIGFzIGEgc2Vjb25kIGFyZ3VtZW50LlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGdldFRleHR1cmVFbmNvZGluZ0Zyb21NYXAobWFwOiBUSFJFRS5UZXh0dXJlLCBpc1dlYkdMMjogYm9vbGVhbik6IFRIUkVFLlRleHR1cmVFbmNvZGluZyB7XHJcbiAgbGV0IGVuY29kaW5nO1xyXG5cclxuICBpZiAobWFwICYmIG1hcC5pc1RleHR1cmUpIHtcclxuICAgIGVuY29kaW5nID0gbWFwLmVuY29kaW5nO1xyXG4gICAgLy8gfSBlbHNlIGlmICggbWFwICYmIG1hcC5pc1dlYkdMUmVuZGVyVGFyZ2V0ICkge1xyXG4gICAgLy8gICBjb25zb2xlLndhcm4oICdUSFJFRS5XZWJHTFByb2dyYW1zLmdldFRleHR1cmVFbmNvZGluZ0Zyb21NYXA6IGRvblxcJ3QgdXNlIHJlbmRlciB0YXJnZXRzIGFzIHRleHR1cmVzLiBVc2UgdGhlaXIgLnRleHR1cmUgcHJvcGVydHkgaW5zdGVhZC4nICk7XHJcbiAgICAvLyAgIGVuY29kaW5nID0gbWFwLnRleHR1cmUuZW5jb2Rpbmc7XHJcbiAgfSBlbHNlIHtcclxuICAgIGVuY29kaW5nID0gVEhSRUUuTGluZWFyRW5jb2Rpbmc7XHJcbiAgfVxyXG5cclxuICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA+PSAxMzMpIHtcclxuICAgIGlmIChcclxuICAgICAgaXNXZWJHTDIgJiZcclxuICAgICAgbWFwICYmXHJcbiAgICAgIG1hcC5pc1RleHR1cmUgJiZcclxuICAgICAgbWFwLmZvcm1hdCA9PT0gVEhSRUUuUkdCQUZvcm1hdCAmJlxyXG4gICAgICBtYXAudHlwZSA9PT0gVEhSRUUuVW5zaWduZWRCeXRlVHlwZSAmJlxyXG4gICAgICBtYXAuZW5jb2RpbmcgPT09IFRIUkVFLnNSR0JFbmNvZGluZ1xyXG4gICAgKSB7XHJcbiAgICAgIGVuY29kaW5nID0gVEhSRUUuTGluZWFyRW5jb2Rpbmc7IC8vIGRpc2FibGUgaW5saW5lIGRlY29kZSBmb3Igc1JHQiB0ZXh0dXJlcyBpbiBXZWJHTCAyXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZW5jb2Rpbmc7XHJcbn1cclxuIiwiLyogdHNsaW50OmRpc2FibGU6bWVtYmVyLW9yZGVyaW5nICovXHJcblxyXG5pbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB2ZXJ0ZXhTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL210b29uLnZlcnQnO1xyXG5pbXBvcnQgZnJhZ21lbnRTaGFkZXIgZnJvbSAnLi9zaGFkZXJzL210b29uLmZyYWcnO1xyXG5pbXBvcnQgeyBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIH0gZnJvbSAnLi9NVG9vbk1hdGVyaWFsRGVidWdNb2RlJztcclxuaW1wb3J0IHsgTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlJztcclxuaW1wb3J0IHR5cGUgeyBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycyB9IGZyb20gJy4vTVRvb25NYXRlcmlhbFBhcmFtZXRlcnMnO1xyXG5pbXBvcnQgeyBnZXRUZXhlbERlY29kaW5nRnVuY3Rpb24gfSBmcm9tICcuL3V0aWxzL2dldFRleGVsRGVjb2RpbmdGdW5jdGlvbic7XHJcbmltcG9ydCB7IGdldFRleHR1cmVFbmNvZGluZ0Zyb21NYXAgfSBmcm9tICcuL3V0aWxzL2dldFRleHR1cmVFbmNvZGluZ0Zyb21NYXAnO1xyXG5cclxuLyoqXHJcbiAqIE1Ub29uIGlzIGEgbWF0ZXJpYWwgc3BlY2lmaWNhdGlvbiB0aGF0IGhhcyB2YXJpb3VzIGZlYXR1cmVzLlxyXG4gKiBUaGUgc3BlYyBhbmQgaW1wbGVtZW50YXRpb24gYXJlIG9yaWdpbmFsbHkgZm91bmRlZCBmb3IgVW5pdHkgZW5naW5lIGFuZCB0aGlzIGlzIGEgcG9ydCBvZiB0aGUgbWF0ZXJpYWwuXHJcbiAqXHJcbiAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL1NhbnRhcmgvTVRvb25cclxuICovXHJcbmV4cG9ydCBjbGFzcyBNVG9vbk1hdGVyaWFsIGV4dGVuZHMgVEhSRUUuU2hhZGVyTWF0ZXJpYWwge1xyXG4gIHB1YmxpYyB1bmlmb3Jtczoge1xyXG4gICAgbGl0RmFjdG9yOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5Db2xvcj47XHJcbiAgICBhbHBoYVRlc3Q6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBvcGFjaXR5OiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgbWFwOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XHJcbiAgICBtYXBVdlRyYW5zZm9ybTogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz47XHJcbiAgICBub3JtYWxNYXA6IFRIUkVFLklVbmlmb3JtPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcclxuICAgIG5vcm1hbE1hcFV2VHJhbnNmb3JtOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5NYXRyaXgzPjtcclxuICAgIG5vcm1hbFNjYWxlOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5WZWN0b3IyPjtcclxuICAgIGVtaXNzaXZlOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5Db2xvcj47XHJcbiAgICBlbWlzc2l2ZUludGVuc2l0eTogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIGVtaXNzaXZlTWFwOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XHJcbiAgICBlbWlzc2l2ZU1hcFV2VHJhbnNmb3JtOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5NYXRyaXgzPjtcclxuICAgIHNoYWRlQ29sb3JGYWN0b3I6IFRIUkVFLklVbmlmb3JtPFRIUkVFLkNvbG9yPjtcclxuICAgIHNoYWRlTXVsdGlwbHlUZXh0dXJlOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XHJcbiAgICBzaGFkZU11bHRpcGx5VGV4dHVyZVV2VHJhbnNmb3JtOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5NYXRyaXgzPjtcclxuICAgIHNoYWRpbmdTaGlmdEZhY3RvcjogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIHNoYWRpbmdTaGlmdFRleHR1cmU6IFRIUkVFLklVbmlmb3JtPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcclxuICAgIHNoYWRpbmdTaGlmdFRleHR1cmVVdlRyYW5zZm9ybTogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz47XHJcbiAgICBzaGFkaW5nU2hpZnRUZXh0dXJlU2NhbGU6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBzaGFkaW5nVG9vbnlGYWN0b3I6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBnaUVxdWFsaXphdGlvbkZhY3RvcjogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIG1hdGNhcEZhY3RvcjogVEhSRUUuSVVuaWZvcm08VEhSRUUuQ29sb3I+O1xyXG4gICAgbWF0Y2FwVGV4dHVyZTogVEhSRUUuSVVuaWZvcm08VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xyXG4gICAgbWF0Y2FwVGV4dHVyZVV2VHJhbnNmb3JtOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5NYXRyaXgzPjtcclxuICAgIHBhcmFtZXRyaWNSaW1Db2xvckZhY3RvcjogVEhSRUUuSVVuaWZvcm08VEhSRUUuQ29sb3I+O1xyXG4gICAgcmltTXVsdGlwbHlUZXh0dXJlOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XHJcbiAgICByaW1NdWx0aXBseVRleHR1cmVVdlRyYW5zZm9ybTogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz47XHJcbiAgICByaW1MaWdodGluZ01peEZhY3RvcjogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIHBhcmFtZXRyaWNSaW1GcmVzbmVsUG93ZXJGYWN0b3I6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBwYXJhbWV0cmljUmltTGlmdEZhY3RvcjogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIG91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZTogVEhSRUUuSVVuaWZvcm08VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xyXG4gICAgb3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlVXZUcmFuc2Zvcm06IFRIUkVFLklVbmlmb3JtPFRIUkVFLk1hdHJpeDM+O1xyXG4gICAgb3V0bGluZVdpZHRoRmFjdG9yOiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgb3V0bGluZUNvbG9yRmFjdG9yOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5Db2xvcj47XHJcbiAgICBvdXRsaW5lTGlnaHRpbmdNaXhGYWN0b3I6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICB1dkFuaW1hdGlvbk1hc2tUZXh0dXJlOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XHJcbiAgICB1dkFuaW1hdGlvbk1hc2tUZXh0dXJlVXZUcmFuc2Zvcm06IFRIUkVFLklVbmlmb3JtPFRIUkVFLk1hdHJpeDM+O1xyXG4gICAgdXZBbmltYXRpb25TY3JvbGxYT2Zmc2V0OiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgdXZBbmltYXRpb25TY3JvbGxZT2Zmc2V0OiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgdXZBbmltYXRpb25Sb3RhdGlvblBoYXNlOiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gIH07XHJcblxyXG4gIHB1YmxpYyBnZXQgY29sb3IoKTogVEhSRUUuQ29sb3Ige1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMubGl0RmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IGNvbG9yKHZhbHVlOiBUSFJFRS5Db2xvcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5saXRGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgbWFwKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm1hcC52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBtYXAodmFsdWU6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm1hcC52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBub3JtYWxNYXAoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMubm9ybWFsTWFwLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IG5vcm1hbE1hcCh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMubm9ybWFsTWFwLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IG5vcm1hbFNjYWxlKCk6IFRIUkVFLlZlY3RvcjIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMubm9ybWFsU2NhbGUudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgbm9ybWFsU2NhbGUodmFsdWU6IFRIUkVFLlZlY3RvcjIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMubm9ybWFsU2NhbGUudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgZW1pc3NpdmUoKTogVEhSRUUuQ29sb3Ige1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuZW1pc3NpdmUudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgZW1pc3NpdmUodmFsdWU6IFRIUkVFLkNvbG9yKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLmVtaXNzaXZlLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IGVtaXNzaXZlSW50ZW5zaXR5KCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZUludGVuc2l0eS52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBlbWlzc2l2ZUludGVuc2l0eSh2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLmVtaXNzaXZlSW50ZW5zaXR5LnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IGVtaXNzaXZlTWFwKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmVtaXNzaXZlTWFwLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IGVtaXNzaXZlTWFwKHZhbHVlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZU1hcC52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzaGFkZUNvbG9yRmFjdG9yKCk6IFRIUkVFLkNvbG9yIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnNoYWRlQ29sb3JGYWN0b3IudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgc2hhZGVDb2xvckZhY3Rvcih2YWx1ZTogVEhSRUUuQ29sb3IpIHtcclxuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVDb2xvckZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzaGFkZU11bHRpcGx5VGV4dHVyZSgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5zaGFkZU11bHRpcGx5VGV4dHVyZS52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBzaGFkZU11bHRpcGx5VGV4dHVyZSh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMuc2hhZGVNdWx0aXBseVRleHR1cmUudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgc2hhZGluZ1NoaWZ0RmFjdG9yKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5zaGFkaW5nU2hpZnRGYWN0b3IudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgc2hhZGluZ1NoaWZ0RmFjdG9yKHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMuc2hhZGluZ1NoaWZ0RmFjdG9yLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHNoYWRpbmdTaGlmdFRleHR1cmUoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuc2hhZGluZ1NoaWZ0VGV4dHVyZS52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBzaGFkaW5nU2hpZnRUZXh0dXJlKHZhbHVlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkaW5nU2hpZnRUZXh0dXJlLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHNoYWRpbmdTaGlmdFRleHR1cmVTY2FsZSgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuc2hhZGluZ1NoaWZ0VGV4dHVyZVNjYWxlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHNoYWRpbmdTaGlmdFRleHR1cmVTY2FsZSh2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRpbmdTaGlmdFRleHR1cmVTY2FsZS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzaGFkaW5nVG9vbnlGYWN0b3IoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnNoYWRpbmdUb29ueUZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBzaGFkaW5nVG9vbnlGYWN0b3IodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkaW5nVG9vbnlGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgZ2lFcXVhbGl6YXRpb25GYWN0b3IoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmdpRXF1YWxpemF0aW9uRmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IGdpRXF1YWxpemF0aW9uRmFjdG9yKHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMuZ2lFcXVhbGl6YXRpb25GYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgbWF0Y2FwRmFjdG9yKCk6IFRIUkVFLkNvbG9yIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm1hdGNhcEZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBtYXRjYXBGYWN0b3IodmFsdWU6IFRIUkVFLkNvbG9yKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm1hdGNhcEZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBtYXRjYXBUZXh0dXJlKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm1hdGNhcFRleHR1cmUudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgbWF0Y2FwVGV4dHVyZSh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMubWF0Y2FwVGV4dHVyZS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBwYXJhbWV0cmljUmltQ29sb3JGYWN0b3IoKTogVEhSRUUuQ29sb3Ige1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMucGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHBhcmFtZXRyaWNSaW1Db2xvckZhY3Rvcih2YWx1ZTogVEhSRUUuQ29sb3IpIHtcclxuICAgIHRoaXMudW5pZm9ybXMucGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHJpbU11bHRpcGx5VGV4dHVyZSgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5yaW1NdWx0aXBseVRleHR1cmUudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgcmltTXVsdGlwbHlUZXh0dXJlKHZhbHVlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5yaW1NdWx0aXBseVRleHR1cmUudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgcmltTGlnaHRpbmdNaXhGYWN0b3IoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnJpbUxpZ2h0aW5nTWl4RmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHJpbUxpZ2h0aW5nTWl4RmFjdG9yKHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMucmltTGlnaHRpbmdNaXhGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgcGFyYW1ldHJpY1JpbUZyZXNuZWxQb3dlckZhY3RvcigpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMucGFyYW1ldHJpY1JpbUZyZXNuZWxQb3dlckZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBwYXJhbWV0cmljUmltRnJlc25lbFBvd2VyRmFjdG9yKHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMucGFyYW1ldHJpY1JpbUZyZXNuZWxQb3dlckZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBwYXJhbWV0cmljUmltTGlmdEZhY3RvcigpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMucGFyYW1ldHJpY1JpbUxpZnRGYWN0b3IudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgcGFyYW1ldHJpY1JpbUxpZnRGYWN0b3IodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5wYXJhbWV0cmljUmltTGlmdEZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBvdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmUoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMub3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IG91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZSh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMub3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IG91dGxpbmVXaWR0aEZhY3RvcigpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMub3V0bGluZVdpZHRoRmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IG91dGxpbmVXaWR0aEZhY3Rvcih2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVXaWR0aEZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBvdXRsaW5lQ29sb3JGYWN0b3IoKTogVEhSRUUuQ29sb3Ige1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMub3V0bGluZUNvbG9yRmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IG91dGxpbmVDb2xvckZhY3Rvcih2YWx1ZTogVEhSRUUuQ29sb3IpIHtcclxuICAgIHRoaXMudW5pZm9ybXMub3V0bGluZUNvbG9yRmFjdG9yLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IG91dGxpbmVMaWdodGluZ01peEZhY3RvcigpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMub3V0bGluZUxpZ2h0aW5nTWl4RmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IG91dGxpbmVMaWdodGluZ01peEZhY3Rvcih2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVMaWdodGluZ01peEZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCB1dkFuaW1hdGlvbk1hc2tUZXh0dXJlKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnV2QW5pbWF0aW9uTWFza1RleHR1cmUudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgdXZBbmltYXRpb25NYXNrVGV4dHVyZSh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25NYXNrVGV4dHVyZS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCB1dkFuaW1hdGlvblNjcm9sbFhPZmZzZXQoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnV2QW5pbWF0aW9uU2Nyb2xsWE9mZnNldC52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCB1dkFuaW1hdGlvblNjcm9sbFhPZmZzZXQodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvblNjcm9sbFhPZmZzZXQudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgdXZBbmltYXRpb25TY3JvbGxZT2Zmc2V0KCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvblNjcm9sbFlPZmZzZXQudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgdXZBbmltYXRpb25TY3JvbGxZT2Zmc2V0KHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25TY3JvbGxZT2Zmc2V0LnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHV2QW5pbWF0aW9uUm90YXRpb25QaGFzZSgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25Sb3RhdGlvblBoYXNlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHV2QW5pbWF0aW9uUm90YXRpb25QaGFzZSh2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbWF0aW9uUm90YXRpb25QaGFzZS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHV2QW5pbWF0aW9uU2Nyb2xsWFNwZWVkRmFjdG9yID0gMC4wO1xyXG4gIHB1YmxpYyB1dkFuaW1hdGlvblNjcm9sbFlTcGVlZEZhY3RvciA9IDAuMDtcclxuICBwdWJsaWMgdXZBbmltYXRpb25Sb3RhdGlvblNwZWVkRmFjdG9yID0gMC4wO1xyXG5cclxuICAvKipcclxuICAgKiBXaGV0aGVyIHRoZSBtYXRlcmlhbCBpcyBhZmZlY3RlZCBieSBmb2cuXHJcbiAgICogYHRydWVgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgcHVibGljIGZvZyA9IHRydWU7XHJcblxyXG4gIC8qKlxyXG4gICAqIFdpbGwgYmUgcmVhZCBpbiBXZWJHTFByb2dyYW1zXHJcbiAgICpcclxuICAgKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi80ZjUyMzZhYzNkNmY0MWQ5MDRhYTU4NDAxYjQwNTU0ZThmYmRjYjE1L3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtcy5qcyNMMTkwLUwxOTFcclxuICAgKi9cclxuICBwdWJsaWMgbm9ybWFsTWFwVHlwZSA9IFRIUkVFLlRhbmdlbnRTcGFjZU5vcm1hbE1hcDtcclxuXHJcbiAgLyoqXHJcbiAgICogV2hlbiB0aGlzIGlzIGB0cnVlYCwgdmVydGV4IGNvbG9ycyB3aWxsIGJlIGlnbm9yZWQuXHJcbiAgICogYHRydWVgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfaWdub3JlVmVydGV4Q29sb3IgPSB0cnVlO1xyXG5cclxuICAvKipcclxuICAgKiBXaGVuIHRoaXMgaXMgYHRydWVgLCB2ZXJ0ZXggY29sb3JzIHdpbGwgYmUgaWdub3JlZC5cclxuICAgKiBgdHJ1ZWAgYnkgZGVmYXVsdC5cclxuICAgKi9cclxuICBwdWJsaWMgZ2V0IGlnbm9yZVZlcnRleENvbG9yKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuX2lnbm9yZVZlcnRleENvbG9yO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IGlnbm9yZVZlcnRleENvbG9yKHZhbHVlOiBib29sZWFuKSB7XHJcbiAgICB0aGlzLl9pZ25vcmVWZXJ0ZXhDb2xvciA9IHZhbHVlO1xyXG5cclxuICAgIHRoaXMubmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfdjBDb21wYXRTaGFkZSA9IGZhbHNlO1xyXG5cclxuICAvKipcclxuICAgKiBUaGVyZSBpcyBhIGxpbmUgb2YgdGhlIHNoYWRlciBjYWxsZWQgXCJjb21tZW50IG91dCBpZiB5b3Ugd2FudCB0byBQQlIgYWJzb2x1dGVseVwiIGluIFZSTTAuMCBNVG9vbi5cclxuICAgKiBXaGVuIHRoaXMgaXMgdHJ1ZSwgdGhlIG1hdGVyaWFsIGVuYWJsZXMgdGhlIGxpbmUgdG8gbWFrZSBpdCBjb21wYXRpYmxlIHdpdGggdGhlIGxlZ2FjeSByZW5kZXJpbmcgb2YgVlJNLlxyXG4gICAqIFVzdWFsbHkgbm90IHJlY29tbWVuZGVkIHRvIHR1cm4gdGhpcyBvbi5cclxuICAgKiBgZmFsc2VgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgZ2V0IHYwQ29tcGF0U2hhZGUoKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gdGhpcy5fdjBDb21wYXRTaGFkZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZXJlIGlzIGEgbGluZSBvZiB0aGUgc2hhZGVyIGNhbGxlZCBcImNvbW1lbnQgb3V0IGlmIHlvdSB3YW50IHRvIFBCUiBhYnNvbHV0ZWx5XCIgaW4gVlJNMC4wIE1Ub29uLlxyXG4gICAqIFdoZW4gdGhpcyBpcyB0cnVlLCB0aGUgbWF0ZXJpYWwgZW5hYmxlcyB0aGUgbGluZSB0byBtYWtlIGl0IGNvbXBhdGlibGUgd2l0aCB0aGUgbGVnYWN5IHJlbmRlcmluZyBvZiBWUk0uXHJcbiAgICogVXN1YWxseSBub3QgcmVjb21tZW5kZWQgdG8gdHVybiB0aGlzIG9uLlxyXG4gICAqIGBmYWxzZWAgYnkgZGVmYXVsdC5cclxuICAgKi9cclxuICBzZXQgdjBDb21wYXRTaGFkZSh2OiBib29sZWFuKSB7XHJcbiAgICB0aGlzLl92MENvbXBhdFNoYWRlID0gdjtcclxuXHJcbiAgICB0aGlzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2RlYnVnTW9kZTogTVRvb25NYXRlcmlhbERlYnVnTW9kZSA9IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUuTm9uZTtcclxuXHJcbiAgLyoqXHJcbiAgICogRGVidWcgbW9kZSBmb3IgdGhlIG1hdGVyaWFsLlxyXG4gICAqIFlvdSBjYW4gdmlzdWFsaXplIHNldmVyYWwgY29tcG9uZW50cyBmb3IgZGlhZ25vc2lzIHVzaW5nIGRlYnVnIG1vZGUuXHJcbiAgICpcclxuICAgKiBTZWU6IHtAbGluayBNVG9vbk1hdGVyaWFsRGVidWdNb2RlfVxyXG4gICAqL1xyXG4gIGdldCBkZWJ1Z01vZGUoKTogTVRvb25NYXRlcmlhbERlYnVnTW9kZSB7XHJcbiAgICByZXR1cm4gdGhpcy5fZGVidWdNb2RlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVidWcgbW9kZSBmb3IgdGhlIG1hdGVyaWFsLlxyXG4gICAqIFlvdSBjYW4gdmlzdWFsaXplIHNldmVyYWwgY29tcG9uZW50cyBmb3IgZGlhZ25vc2lzIHVzaW5nIGRlYnVnIG1vZGUuXHJcbiAgICpcclxuICAgKiBTZWU6IHtAbGluayBNVG9vbk1hdGVyaWFsRGVidWdNb2RlfVxyXG4gICAqL1xyXG4gIHNldCBkZWJ1Z01vZGUobTogTVRvb25NYXRlcmlhbERlYnVnTW9kZSkge1xyXG4gICAgdGhpcy5fZGVidWdNb2RlID0gbTtcclxuXHJcbiAgICB0aGlzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX291dGxpbmVXaWR0aE1vZGU6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlID0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuTm9uZTtcclxuXHJcbiAgZ2V0IG91dGxpbmVXaWR0aE1vZGUoKTogTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUge1xyXG4gICAgcmV0dXJuIHRoaXMuX291dGxpbmVXaWR0aE1vZGU7XHJcbiAgfVxyXG4gIHNldCBvdXRsaW5lV2lkdGhNb2RlKG06IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlKSB7XHJcbiAgICB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlID0gbTtcclxuXHJcbiAgICB0aGlzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2lzT3V0bGluZSA9IGZhbHNlO1xyXG5cclxuICBnZXQgaXNPdXRsaW5lKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuX2lzT3V0bGluZTtcclxuICB9XHJcbiAgc2V0IGlzT3V0bGluZShiOiBib29sZWFuKSB7XHJcbiAgICB0aGlzLl9pc091dGxpbmUgPSBiO1xyXG5cclxuICAgIHRoaXMubmVlZHNVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmVhZG9ubHkgYm9vbGVhbiB0aGF0IGluZGljYXRlcyB0aGlzIGlzIGEgW1tNVG9vbk1hdGVyaWFsXV0uXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBpc01Ub29uTWF0ZXJpYWwoKTogdHJ1ZSB7XHJcbiAgICByZXR1cm4gdHJ1ZTtcclxuICB9XHJcblxyXG4gIGNvbnN0cnVjdG9yKHBhcmFtZXRlcnM6IE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzID0ge30pIHtcclxuICAgIHN1cGVyKHsgdmVydGV4U2hhZGVyLCBmcmFnbWVudFNoYWRlciB9KTtcclxuXHJcbiAgICAvLyBvdmVycmlkZSBkZXB0aFdyaXRlIHdpdGggdHJhbnNwYXJlbnRXaXRoWldyaXRlXHJcbiAgICBpZiAocGFyYW1ldGVycy50cmFuc3BhcmVudFdpdGhaV3JpdGUpIHtcclxuICAgICAgcGFyYW1ldGVycy5kZXB0aFdyaXRlID0gdHJ1ZTtcclxuICAgIH1cclxuICAgIGRlbGV0ZSBwYXJhbWV0ZXJzLnRyYW5zcGFyZW50V2l0aFpXcml0ZTtcclxuXHJcbiAgICAvLyA9PSBlbmFibGluZyBidW5jaCBvZiBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHBhcmFtZXRlcnMuZm9nID0gdHJ1ZTtcclxuICAgIHBhcmFtZXRlcnMubGlnaHRzID0gdHJ1ZTtcclxuICAgIHBhcmFtZXRlcnMuY2xpcHBpbmcgPSB0cnVlO1xyXG5cclxuICAgIC8vIENPTVBBVDogcHJlLXIxMjlcclxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIxNzg4XHJcbiAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEyOSkge1xyXG4gICAgICAocGFyYW1ldGVycyBhcyBhbnkpLnNraW5uaW5nID0gKHBhcmFtZXRlcnMgYXMgYW55KS5za2lubmluZyB8fCBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDT01QQVQ6IHByZS1yMTMxXHJcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMjE2OVxyXG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMzEpIHtcclxuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaFRhcmdldHMgPSAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoVGFyZ2V0cyB8fCBmYWxzZTtcclxuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaE5vcm1hbHMgPSAocGFyYW1ldGVycyBhcyBhbnkpLm1vcnBoTm9ybWFscyB8fCBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICAvLyA9PSB1bmlmb3JtcyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMudW5pZm9ybXMgPSBUSFJFRS5Vbmlmb3Jtc1V0aWxzLm1lcmdlKFtcclxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuY29tbW9uLCAvLyBtYXBcclxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIubm9ybWFsbWFwLCAvLyBub3JtYWxNYXBcclxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIuZW1pc3NpdmVtYXAsIC8vIGVtaXNzaXZlTWFwXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmZvZyxcclxuICAgICAgVEhSRUUuVW5pZm9ybXNMaWIubGlnaHRzLFxyXG4gICAgICB7XHJcbiAgICAgICAgbGl0RmFjdG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMS4wLCAxLjAsIDEuMCkgfSxcclxuICAgICAgICBtYXBVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIGNvbG9yQWxwaGE6IHsgdmFsdWU6IDEuMCB9LFxyXG4gICAgICAgIG5vcm1hbE1hcFV2VHJhbnNmb3JtOiB7IHZhbHVlOiBuZXcgVEhSRUUuTWF0cml4MygpIH0sXHJcbiAgICAgICAgc2hhZGVDb2xvckZhY3RvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuOTcsIDAuODEsIDAuODYpIH0sXHJcbiAgICAgICAgc2hhZGVNdWx0aXBseVRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcclxuICAgICAgICBzaGFkZU11bHRpcGx5VGV4dHVyZVV2VHJhbnNmb3JtOiB7IHZhbHVlOiBuZXcgVEhSRUUuTWF0cml4MygpIH0sXHJcbiAgICAgICAgc2hhZGluZ1NoaWZ0RmFjdG9yOiB7IHZhbHVlOiAwLjAgfSxcclxuICAgICAgICBzaGFkaW5nU2hpZnRUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgc2hhZGluZ1NoaWZ0VGV4dHVyZVV2VHJhbnNmb3JtOiB7IHZhbHVlOiBuZXcgVEhSRUUuTWF0cml4MygpIH0sXHJcbiAgICAgICAgc2hhZGluZ1NoaWZ0VGV4dHVyZVNjYWxlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgc2hhZGluZ1Rvb255RmFjdG9yOiB7IHZhbHVlOiAwLjkgfSxcclxuICAgICAgICBnaUVxdWFsaXphdGlvbkZhY3RvcjogeyB2YWx1ZTogMC45IH0sXHJcbiAgICAgICAgbWF0Y2FwRmFjdG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMS4wLCAxLjAsIDEuMCkgfSxcclxuICAgICAgICBtYXRjYXBUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgbWF0Y2FwVGV4dHVyZVV2VHJhbnNmb3JtOiB7IHZhbHVlOiBuZXcgVEhSRUUuTWF0cml4MygpIH0sXHJcbiAgICAgICAgcGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcclxuICAgICAgICByaW1NdWx0aXBseVRleHR1cmU6IHsgdmFsdWU6IG51bGwgfSxcclxuICAgICAgICByaW1NdWx0aXBseVRleHR1cmVVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIHJpbUxpZ2h0aW5nTWl4RmFjdG9yOiB7IHZhbHVlOiAwLjAgfSxcclxuICAgICAgICBwYXJhbWV0cmljUmltRnJlc25lbFBvd2VyRmFjdG9yOiB7IHZhbHVlOiAxLjAgfSxcclxuICAgICAgICBwYXJhbWV0cmljUmltTGlmdEZhY3RvcjogeyB2YWx1ZTogMC4wIH0sXHJcbiAgICAgICAgZW1pc3NpdmU6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjAsIDAuMCwgMC4wKSB9LFxyXG4gICAgICAgIGVtaXNzaXZlSW50ZW5zaXR5OiB7IHZhbHVlOiAxLjAgfSxcclxuICAgICAgICBlbWlzc2l2ZU1hcFV2VHJhbnNmb3JtOiB7IHZhbHVlOiBuZXcgVEhSRUUuTWF0cml4MygpIH0sXHJcbiAgICAgICAgb3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgb3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlVXZUcmFuc2Zvcm06IHsgdmFsdWU6IG5ldyBUSFJFRS5NYXRyaXgzKCkgfSxcclxuICAgICAgICBvdXRsaW5lV2lkdGhGYWN0b3I6IHsgdmFsdWU6IDAuNSB9LFxyXG4gICAgICAgIG91dGxpbmVDb2xvckZhY3RvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuMCwgMC4wLCAwLjApIH0sXHJcbiAgICAgICAgb3V0bGluZUxpZ2h0aW5nTWl4RmFjdG9yOiB7IHZhbHVlOiAxLjAgfSxcclxuICAgICAgICB1dkFuaW1hdGlvbk1hc2tUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgdXZBbmltYXRpb25NYXNrVGV4dHVyZVV2VHJhbnNmb3JtOiB7IHZhbHVlOiBuZXcgVEhSRUUuTWF0cml4MygpIH0sXHJcbiAgICAgICAgdXZBbmltYXRpb25TY3JvbGxYT2Zmc2V0OiB7IHZhbHVlOiAwLjAgfSxcclxuICAgICAgICB1dkFuaW1hdGlvblNjcm9sbFlPZmZzZXQ6IHsgdmFsdWU6IDAuMCB9LFxyXG4gICAgICAgIHV2QW5pbWF0aW9uUm90YXRpb25QaGFzZTogeyB2YWx1ZTogMC4wIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIHBhcmFtZXRlcnMudW5pZm9ybXMsXHJcbiAgICBdKTtcclxuXHJcbiAgICAvLyA9PSBmaW5hbGx5IGNvbXBpbGUgdGhlIHNoYWRlciBwcm9ncmFtID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMuc2V0VmFsdWVzKHBhcmFtZXRlcnMpO1xyXG5cclxuICAgIC8vID09IHVwbG9hZCB1bmlmb3JtcyB0aGF0IG5lZWQgdG8gdXBsb2FkID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgdGhpcy5fdXBsb2FkVW5pZm9ybXNXb3JrYXJvdW5kKCk7XHJcblxyXG4gICAgLy8gPT0gdXBkYXRlIHNoYWRlciBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLmN1c3RvbVByb2dyYW1DYWNoZUtleSA9ICgpID0+XHJcbiAgICAgIFtcclxuICAgICAgICB0aGlzLl9pZ25vcmVWZXJ0ZXhDb2xvciA/ICdpZ25vcmVWZXJ0ZXhDb2xvcicgOiAnJyxcclxuICAgICAgICB0aGlzLl92MENvbXBhdFNoYWRlID8gJ3YwQ29tcGF0U2hhZGUnIDogJycsXHJcbiAgICAgICAgdGhpcy5fZGVidWdNb2RlICE9PSAnbm9uZScgPyBgZGVidWdNb2RlOiR7dGhpcy5fZGVidWdNb2RlfWAgOiAnJyxcclxuICAgICAgICB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlICE9PSAnbm9uZScgPyBgb3V0bGluZVdpZHRoTW9kZToke3RoaXMuX291dGxpbmVXaWR0aE1vZGV9YCA6ICcnLFxyXG4gICAgICAgIHRoaXMuX2lzT3V0bGluZSA/ICdpc091dGxpbmUnIDogJycsXHJcbiAgICAgICAgLi4uT2JqZWN0LmVudHJpZXModGhpcy5fZ2VuZXJhdGVEZWZpbmVzKCkpLm1hcCgoW3Rva2VuLCBtYWNyb10pID0+IGAke3Rva2VufToke21hY3JvfWApLFxyXG4gICAgICAgIHRoaXMubWF0Y2FwVGV4dHVyZSA/IGBtYXRjYXBUZXh0dXJlRW5jb2Rpbmc6JHt0aGlzLm1hdGNhcFRleHR1cmUuZW5jb2Rpbmd9YCA6ICcnLFxyXG4gICAgICAgIHRoaXMuc2hhZGVNdWx0aXBseVRleHR1cmUgPyBgc2hhZGVNdWx0aXBseVRleHR1cmVFbmNvZGluZzoke3RoaXMuc2hhZGVNdWx0aXBseVRleHR1cmUuZW5jb2Rpbmd9YCA6ICcnLFxyXG4gICAgICAgIHRoaXMucmltTXVsdGlwbHlUZXh0dXJlID8gYHJpbU11bHRpcGx5VGV4dHVyZUVuY29kaW5nOiR7dGhpcy5yaW1NdWx0aXBseVRleHR1cmUuZW5jb2Rpbmd9YCA6ICcnLFxyXG4gICAgICBdLmpvaW4oJywnKTtcclxuXHJcbiAgICB0aGlzLm9uQmVmb3JlQ29tcGlsZSA9IChzaGFkZXIsIHJlbmRlcmVyKSA9PiB7XHJcbiAgICAgIC8qKlxyXG4gICAgICAgKiBXaWxsIGJlIG5lZWRlZCB0byBkZXRlcm1pbmUgd2hldGhlciB3ZSBzaG91bGQgaW5saW5lIGNvbnZlcnQgc1JHQiB0ZXh0dXJlcyBvciBub3QuXHJcbiAgICAgICAqIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9wdWxsLzIyNTUxXHJcbiAgICAgICAqL1xyXG4gICAgICBjb25zdCBpc1dlYkdMMiA9IHJlbmRlcmVyLmNhcGFiaWxpdGllcy5pc1dlYkdMMjtcclxuXHJcbiAgICAgIGNvbnN0IHRocmVlUmV2aXNpb24gPSBwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApO1xyXG5cclxuICAgICAgY29uc3QgZGVmaW5lcyA9XHJcbiAgICAgICAgT2JqZWN0LmVudHJpZXMoeyAuLi50aGlzLl9nZW5lcmF0ZURlZmluZXMoKSwgLi4udGhpcy5kZWZpbmVzIH0pXHJcbiAgICAgICAgICAuZmlsdGVyKChbdG9rZW4sIG1hY3JvXSkgPT4gISFtYWNybylcclxuICAgICAgICAgIC5tYXAoKFt0b2tlbiwgbWFjcm9dKSA9PiBgI2RlZmluZSAke3Rva2VufSAke21hY3JvfWApXHJcbiAgICAgICAgICAuam9pbignXFxuJykgKyAnXFxuJztcclxuXHJcbiAgICAgIC8vIC0tIHRleHR1cmUgZW5jb2RpbmdzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgICAgLy8gQ09NUEFUOiBwcmUtcjEzN1xyXG4gICAgICBsZXQgZW5jb2RpbmdzID0gJyc7XHJcblxyXG4gICAgICBpZiAocGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKSA8IDEzNykge1xyXG4gICAgICAgIGVuY29kaW5ncyA9XHJcbiAgICAgICAgICAodGhpcy5tYXRjYXBUZXh0dXJlICE9PSBudWxsXHJcbiAgICAgICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ21hdGNhcFRleHR1cmVUZXhlbFRvTGluZWFyJyxcclxuICAgICAgICAgICAgICAgIGdldFRleHR1cmVFbmNvZGluZ0Zyb21NYXAodGhpcy5tYXRjYXBUZXh0dXJlLCBpc1dlYkdMMiksXHJcbiAgICAgICAgICAgICAgKSArICdcXG4nXHJcbiAgICAgICAgICAgIDogJycpICtcclxuICAgICAgICAgICh0aGlzLnNoYWRlTXVsdGlwbHlUZXh0dXJlICE9PSBudWxsXHJcbiAgICAgICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ3NoYWRlTXVsdGlwbHlUZXh0dXJlVGV4ZWxUb0xpbmVhcicsXHJcbiAgICAgICAgICAgICAgICBnZXRUZXh0dXJlRW5jb2RpbmdGcm9tTWFwKHRoaXMuc2hhZGVNdWx0aXBseVRleHR1cmUsIGlzV2ViR0wyKSxcclxuICAgICAgICAgICAgICApICsgJ1xcbidcclxuICAgICAgICAgICAgOiAnJykgK1xyXG4gICAgICAgICAgKHRoaXMucmltTXVsdGlwbHlUZXh0dXJlICE9PSBudWxsXHJcbiAgICAgICAgICAgID8gZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uKFxyXG4gICAgICAgICAgICAgICAgJ3JpbU11bHRpcGx5VGV4dHVyZVRleGVsVG9MaW5lYXInLFxyXG4gICAgICAgICAgICAgICAgZ2V0VGV4dHVyZUVuY29kaW5nRnJvbU1hcCh0aGlzLnJpbU11bHRpcGx5VGV4dHVyZSwgaXNXZWJHTDIpLFxyXG4gICAgICAgICAgICAgICkgKyAnXFxuJ1xyXG4gICAgICAgICAgICA6ICcnKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgLy8gLS0gZ2VuZXJhdGUgc2hhZGVyIGNvZGUgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG4gICAgICBzaGFkZXIudmVydGV4U2hhZGVyID0gZGVmaW5lcyArIHNoYWRlci52ZXJ0ZXhTaGFkZXI7XHJcbiAgICAgIHNoYWRlci5mcmFnbWVudFNoYWRlciA9IGRlZmluZXMgKyBlbmNvZGluZ3MgKyBzaGFkZXIuZnJhZ21lbnRTaGFkZXI7XHJcblxyXG4gICAgICAvLyAtLSBjb21wYXQgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcblxyXG4gICAgICAvLyBDT01QQVQ6IHByZS1yMTMyXHJcbiAgICAgIC8vIFRocmVlLmpzIHIxMzIgaW50cm9kdWNlcyBuZXcgc2hhZGVyIGNodW5rcyA8bm9ybWFsX3BhcnNfZnJhZ21lbnQ+IGFuZCA8YWxwaGF0ZXN0X3BhcnNfZnJhZ21lbnQ+XHJcbiAgICAgIGlmICh0aHJlZVJldmlzaW9uIDwgMTMyKSB7XHJcbiAgICAgICAgc2hhZGVyLmZyYWdtZW50U2hhZGVyID0gc2hhZGVyLmZyYWdtZW50U2hhZGVyLnJlcGxhY2UoJyNpbmNsdWRlIDxub3JtYWxfcGFyc19mcmFnbWVudD4nLCAnJyk7XHJcbiAgICAgICAgc2hhZGVyLmZyYWdtZW50U2hhZGVyID0gc2hhZGVyLmZyYWdtZW50U2hhZGVyLnJlcGxhY2UoJyNpbmNsdWRlIDxhbHBoYXRlc3RfcGFyc19mcmFnbWVudD4nLCAnJyk7XHJcbiAgICAgIH1cclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgdGhpcyBtYXRlcmlhbC5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBkZWx0YSBkZWx0YVRpbWUgc2luY2UgbGFzdCB1cGRhdGVcclxuICAgKi9cclxuICBwdWJsaWMgdXBkYXRlKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMuX3VwbG9hZFVuaWZvcm1zV29ya2Fyb3VuZCgpO1xyXG4gICAgdGhpcy5fdXBkYXRlVVZBbmltYXRpb24oZGVsdGEpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNvcHkoc291cmNlOiB0aGlzKTogdGhpcyB7XHJcbiAgICBzdXBlci5jb3B5KHNvdXJjZSk7XHJcbiAgICAvLyB1bmlmb3JtcyBhcmUgYWxyZWFkeSBjb3BpZWQgYXQgdGhpcyBtb21lbnRcclxuXHJcbiAgICAvLyBCZWdpbm5pbmcgZnJvbSByMTMzLCB1bmlmb3JtIHRleHR1cmVzIHdpbGwgYmUgY2xvbmVkIGluc3RlYWQgb2YgcmVmZXJlbmNlXHJcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9hODgxM2JlMDRhODQ5YmQxNTVmN2NmNmYxYjIzZDhlZTJlMGZiNDhiL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMjTDMwNDdcclxuICAgIC8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL21yZG9vYi90aHJlZS5qcy9ibG9iL2E4ODEzYmUwNGE4NDliZDE1NWY3Y2Y2ZjFiMjNkOGVlMmUwZmI0OGIvc3JjL3JlbmRlcmVycy9zaGFkZXJzL1VuaWZvcm1zVXRpbHMuanMjTDIyXHJcbiAgICAvLyBUaGlzIHdpbGwgbGVhdmUgdGhlaXIgYC52ZXJzaW9uYCB0byBiZSBgMGBcclxuICAgIC8vIGFuZCB0aGVzZSB0ZXh0dXJlcyB3b24ndCBiZSB1cGxvYWRlZCB0byBHUFVcclxuICAgIC8vIFdlIGFyZSBnb2luZyB0byB3b3JrYXJvdW5kIHRoaXMgaW4gaGVyZVxyXG4gICAgLy8gSSd2ZSBvcGVuZWQgYW4gaXNzdWUgZm9yIHRoaXM6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvaXNzdWVzLzIyNzE4XHJcbiAgICB0aGlzLm1hcCA9IHNvdXJjZS5tYXA7XHJcbiAgICB0aGlzLm5vcm1hbE1hcCA9IHNvdXJjZS5ub3JtYWxNYXA7XHJcbiAgICB0aGlzLmVtaXNzaXZlTWFwID0gc291cmNlLmVtaXNzaXZlTWFwO1xyXG4gICAgdGhpcy5zaGFkZU11bHRpcGx5VGV4dHVyZSA9IHNvdXJjZS5zaGFkZU11bHRpcGx5VGV4dHVyZTtcclxuICAgIHRoaXMuc2hhZGluZ1NoaWZ0VGV4dHVyZSA9IHNvdXJjZS5zaGFkaW5nU2hpZnRUZXh0dXJlO1xyXG4gICAgdGhpcy5tYXRjYXBUZXh0dXJlID0gc291cmNlLm1hdGNhcFRleHR1cmU7XHJcbiAgICB0aGlzLnJpbU11bHRpcGx5VGV4dHVyZSA9IHNvdXJjZS5yaW1NdWx0aXBseVRleHR1cmU7XHJcbiAgICB0aGlzLm91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZSA9IHNvdXJjZS5vdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmU7XHJcbiAgICB0aGlzLnV2QW5pbWF0aW9uTWFza1RleHR1cmUgPSBzb3VyY2UudXZBbmltYXRpb25NYXNrVGV4dHVyZTtcclxuXHJcbiAgICAvLyA9PSBjb3B5IG1lbWJlcnMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMubm9ybWFsTWFwVHlwZSA9IHNvdXJjZS5ub3JtYWxNYXBUeXBlO1xyXG5cclxuICAgIHRoaXMudXZBbmltYXRpb25TY3JvbGxYU3BlZWRGYWN0b3IgPSBzb3VyY2UudXZBbmltYXRpb25TY3JvbGxYU3BlZWRGYWN0b3I7XHJcbiAgICB0aGlzLnV2QW5pbWF0aW9uU2Nyb2xsWVNwZWVkRmFjdG9yID0gc291cmNlLnV2QW5pbWF0aW9uU2Nyb2xsWVNwZWVkRmFjdG9yO1xyXG4gICAgdGhpcy51dkFuaW1hdGlvblJvdGF0aW9uU3BlZWRGYWN0b3IgPSBzb3VyY2UudXZBbmltYXRpb25Sb3RhdGlvblNwZWVkRmFjdG9yO1xyXG5cclxuICAgIHRoaXMuaWdub3JlVmVydGV4Q29sb3IgPSBzb3VyY2UuaWdub3JlVmVydGV4Q29sb3I7XHJcblxyXG4gICAgdGhpcy52MENvbXBhdFNoYWRlID0gc291cmNlLnYwQ29tcGF0U2hhZGU7XHJcbiAgICB0aGlzLmRlYnVnTW9kZSA9IHNvdXJjZS5kZWJ1Z01vZGU7XHJcbiAgICB0aGlzLm91dGxpbmVXaWR0aE1vZGUgPSBzb3VyY2Uub3V0bGluZVdpZHRoTW9kZTtcclxuXHJcbiAgICB0aGlzLmlzT3V0bGluZSA9IHNvdXJjZS5pc091dGxpbmU7XHJcblxyXG4gICAgLy8gPT0gdXBkYXRlIHNoYWRlciBzdHVmZiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFVwZGF0ZSBVViBhbmltYXRpb24gc3RhdGUuXHJcbiAgICogSW50ZW5kZWQgdG8gYmUgY2FsbGVkIHZpYSB7QGxpbmsgdXBkYXRlfS5cclxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfdXBkYXRlVVZBbmltYXRpb24oZGVsdGE6IG51bWJlcik6IHZvaWQge1xyXG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvblNjcm9sbFhPZmZzZXQudmFsdWUgKz0gZGVsdGEgKiB0aGlzLnV2QW5pbWF0aW9uU2Nyb2xsWFNwZWVkRmFjdG9yO1xyXG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvblNjcm9sbFlPZmZzZXQudmFsdWUgKz0gZGVsdGEgKiB0aGlzLnV2QW5pbWF0aW9uU2Nyb2xsWVNwZWVkRmFjdG9yO1xyXG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvblJvdGF0aW9uUGhhc2UudmFsdWUgKz0gZGVsdGEgKiB0aGlzLnV2QW5pbWF0aW9uUm90YXRpb25TcGVlZEZhY3RvcjtcclxuXHJcbiAgICB0aGlzLnVuaWZvcm1zTmVlZFVwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGxvYWQgdW5pZm9ybXMgdGhhdCBuZWVkIHRvIHVwbG9hZCBidXQgZG9lc24ndCBhdXRvbWF0aWNhbGx5IGJlY2F1c2Ugb2YgcmVhc29ucy5cclxuICAgKiBJbnRlbmRlZCB0byBiZSBjYWxsZWQgdmlhIHtAbGluayBjb25zdHJ1Y3Rvcn0gYW5kIHtAbGluayB1cGRhdGV9LlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3VwbG9hZFVuaWZvcm1zV29ya2Fyb3VuZCgpOiB2b2lkIHtcclxuICAgIC8vIHdvcmthcm91bmQ6IHNpbmNlIG9wYWNpdHkgaXMgZGVmaW5lZCBhcyBhIHByb3BlcnR5IGluIFRIUkVFLk1hdGVyaWFsXHJcbiAgICAvLyBhbmQgY2Fubm90IGJlIG92ZXJyaWRkZW4gYXMgYW4gYWNjZXNzb3IsXHJcbiAgICAvLyBXZSBhcmUgZ29pbmcgdG8gdXBkYXRlIG9wYWNpdHkgaGVyZVxyXG4gICAgdGhpcy51bmlmb3Jtcy5vcGFjaXR5LnZhbHVlID0gdGhpcy5vcGFjaXR5O1xyXG5cclxuICAgIC8vIHdvcmthcm91bmQ6IHRleHR1cmUgdHJhbnNmb3JtcyBhcmUgbm90IHVwZGF0ZWQgYXV0b21hdGljYWxseVxyXG4gICAgdGhpcy5fdXBkYXRlVGV4dHVyZU1hdHJpeCh0aGlzLnVuaWZvcm1zLm1hcCwgdGhpcy51bmlmb3Jtcy5tYXBVdlRyYW5zZm9ybSk7XHJcbiAgICB0aGlzLl91cGRhdGVUZXh0dXJlTWF0cml4KHRoaXMudW5pZm9ybXMubm9ybWFsTWFwLCB0aGlzLnVuaWZvcm1zLm5vcm1hbE1hcFV2VHJhbnNmb3JtKTtcclxuICAgIHRoaXMuX3VwZGF0ZVRleHR1cmVNYXRyaXgodGhpcy51bmlmb3Jtcy5lbWlzc2l2ZU1hcCwgdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZU1hcFV2VHJhbnNmb3JtKTtcclxuICAgIHRoaXMuX3VwZGF0ZVRleHR1cmVNYXRyaXgodGhpcy51bmlmb3Jtcy5zaGFkZU11bHRpcGx5VGV4dHVyZSwgdGhpcy51bmlmb3Jtcy5zaGFkZU11bHRpcGx5VGV4dHVyZVV2VHJhbnNmb3JtKTtcclxuICAgIHRoaXMuX3VwZGF0ZVRleHR1cmVNYXRyaXgodGhpcy51bmlmb3Jtcy5zaGFkaW5nU2hpZnRUZXh0dXJlLCB0aGlzLnVuaWZvcm1zLnNoYWRpbmdTaGlmdFRleHR1cmVVdlRyYW5zZm9ybSk7XHJcbiAgICB0aGlzLl91cGRhdGVUZXh0dXJlTWF0cml4KHRoaXMudW5pZm9ybXMubWF0Y2FwVGV4dHVyZSwgdGhpcy51bmlmb3Jtcy5tYXRjYXBUZXh0dXJlVXZUcmFuc2Zvcm0pO1xyXG4gICAgdGhpcy5fdXBkYXRlVGV4dHVyZU1hdHJpeCh0aGlzLnVuaWZvcm1zLnJpbU11bHRpcGx5VGV4dHVyZSwgdGhpcy51bmlmb3Jtcy5yaW1NdWx0aXBseVRleHR1cmVVdlRyYW5zZm9ybSk7XHJcbiAgICB0aGlzLl91cGRhdGVUZXh0dXJlTWF0cml4KFxyXG4gICAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZSxcclxuICAgICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmVVdlRyYW5zZm9ybSxcclxuICAgICk7XHJcbiAgICB0aGlzLl91cGRhdGVUZXh0dXJlTWF0cml4KHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25NYXNrVGV4dHVyZSwgdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvbk1hc2tUZXh0dXJlVXZUcmFuc2Zvcm0pO1xyXG5cclxuICAgIC8vIENPTVBBVCB3b3JrYXJvdW5kOiBzdGFydGluZyBmcm9tIHIxMzIsIGFscGhhVGVzdCBiZWNvbWVzIGEgdW5pZm9ybSBpbnN0ZWFkIG9mIHByZXByb2Nlc3NvciB2YWx1ZVxyXG4gICAgY29uc3QgdGhyZWVSZXZpc2lvbiA9IHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCk7XHJcblxyXG4gICAgaWYgKHRocmVlUmV2aXNpb24gPj0gMTMyKSB7XHJcbiAgICAgIHRoaXMudW5pZm9ybXMuYWxwaGFUZXN0LnZhbHVlID0gdGhpcy5hbHBoYVRlc3Q7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy51bmlmb3Jtc05lZWRVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogUmV0dXJucyBhIG1hcCBvYmplY3Qgb2YgcHJlcHJvY2Vzc29yIHRva2VuIGFuZCBtYWNybyBvZiB0aGUgc2hhZGVyIHByb2dyYW0uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBfZ2VuZXJhdGVEZWZpbmVzKCk6IHsgW3Rva2VuOiBzdHJpbmddOiBib29sZWFuIHwgbnVtYmVyIHwgc3RyaW5nIH0ge1xyXG4gICAgY29uc3QgdGhyZWVSZXZpc2lvbiA9IHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCk7XHJcblxyXG4gICAgY29uc3QgdXNlVXZJblZlcnQgPSB0aGlzLm91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZSAhPT0gbnVsbDtcclxuICAgIGNvbnN0IHVzZVV2SW5GcmFnID1cclxuICAgICAgdGhpcy5tYXAgIT09IG51bGwgfHxcclxuICAgICAgdGhpcy5lbWlzc2l2ZU1hcCAhPT0gbnVsbCB8fFxyXG4gICAgICB0aGlzLnNoYWRlTXVsdGlwbHlUZXh0dXJlICE9PSBudWxsIHx8XHJcbiAgICAgIHRoaXMuc2hhZGluZ1NoaWZ0VGV4dHVyZSAhPT0gbnVsbCB8fFxyXG4gICAgICB0aGlzLnJpbU11bHRpcGx5VGV4dHVyZSAhPT0gbnVsbCB8fFxyXG4gICAgICB0aGlzLnV2QW5pbWF0aW9uTWFza1RleHR1cmUgIT09IG51bGw7XHJcblxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgLy8gVGVtcG9yYXJ5IGNvbXBhdCBhZ2FpbnN0IHNoYWRlciBjaGFuZ2UgQCBUaHJlZS5qcyByMTI2XHJcbiAgICAgIC8vIFNlZTogIzIxMjA1LCAjMjEzMDcsICMyMTI5OVxyXG4gICAgICBUSFJFRV9WUk1fVEhSRUVfUkVWSVNJT046IHRocmVlUmV2aXNpb24sXHJcblxyXG4gICAgICBPVVRMSU5FOiB0aGlzLl9pc091dGxpbmUsXHJcbiAgICAgIE1UT09OX1VTRV9VVjogdXNlVXZJblZlcnQgfHwgdXNlVXZJbkZyYWcsIC8vIHdlIGNhbid0IHVzZSBgVVNFX1VWYCAsIGl0IHdpbGwgYmUgcmVkZWZpbmVkIGluIFdlYkdMUHJvZ3JhbS5qc1xyXG4gICAgICBNVE9PTl9VVlNfVkVSVEVYX09OTFk6IHVzZVV2SW5WZXJ0ICYmICF1c2VVdkluRnJhZyxcclxuICAgICAgVjBfQ09NUEFUX1NIQURFOiB0aGlzLl92MENvbXBhdFNoYWRlLFxyXG4gICAgICBVU0VfU0hBREVNVUxUSVBMWVRFWFRVUkU6IHRoaXMuc2hhZGVNdWx0aXBseVRleHR1cmUgIT09IG51bGwsXHJcbiAgICAgIFVTRV9TSEFESU5HU0hJRlRURVhUVVJFOiB0aGlzLnNoYWRpbmdTaGlmdFRleHR1cmUgIT09IG51bGwsXHJcbiAgICAgIFVTRV9NQVRDQVBURVhUVVJFOiB0aGlzLm1hdGNhcFRleHR1cmUgIT09IG51bGwsXHJcbiAgICAgIFVTRV9SSU1NVUxUSVBMWVRFWFRVUkU6IHRoaXMucmltTXVsdGlwbHlUZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBVU0VfT1VUTElORVdJRFRITVVMVElQTFlURVhUVVJFOiB0aGlzLm91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZSAhPT0gbnVsbCxcclxuICAgICAgVVNFX1VWQU5JTUFUSU9OTUFTS1RFWFRVUkU6IHRoaXMudXZBbmltYXRpb25NYXNrVGV4dHVyZSAhPT0gbnVsbCxcclxuICAgICAgSUdOT1JFX1ZFUlRFWF9DT0xPUjogdGhpcy5faWdub3JlVmVydGV4Q29sb3IgPT09IHRydWUsXHJcbiAgICAgIERFQlVHX05PUk1BTDogdGhpcy5fZGVidWdNb2RlID09PSAnbm9ybWFsJyxcclxuICAgICAgREVCVUdfTElUU0hBREVSQVRFOiB0aGlzLl9kZWJ1Z01vZGUgPT09ICdsaXRTaGFkZVJhdGUnLFxyXG4gICAgICBERUJVR19VVjogdGhpcy5fZGVidWdNb2RlID09PSAndXYnLFxyXG4gICAgICBPVVRMSU5FX1dJRFRIX1dPUkxEOiB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlID09PSBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZS5Xb3JsZENvb3JkaW5hdGVzLFxyXG4gICAgICBPVVRMSU5FX1dJRFRIX1NDUkVFTjogdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuU2NyZWVuQ29vcmRpbmF0ZXMsXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfdXBkYXRlVGV4dHVyZU1hdHJpeChzcmM6IFRIUkVFLklVbmlmb3JtPFRIUkVFLlRleHR1cmUgfCBudWxsPiwgZHN0OiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5NYXRyaXgzPik6IHZvaWQge1xyXG4gICAgaWYgKHNyYy52YWx1ZSkge1xyXG4gICAgICBpZiAoc3JjLnZhbHVlLm1hdHJpeEF1dG9VcGRhdGUpIHtcclxuICAgICAgICBzcmMudmFsdWUudXBkYXRlTWF0cml4KCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGRzdC52YWx1ZS5jb3B5KHNyYy52YWx1ZS5tYXRyaXgpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCB7IEdMVEZQYXJzZXIgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcclxuaW1wb3J0IHsgTVRvb25NYXRlcmlhbFBhcmFtZXRlcnMgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzJztcclxuXHJcbi8qKlxyXG4gKiBNYXRlcmlhbFBhcmFtZXRlcnMgaGF0ZXMgYHVuZGVmaW5lZGAuIFRoaXMgaGVscGVyIGF1dG9tYXRpY2FsbHkgcmVqZWN0cyBhc3NpZ24gb2YgdGhlc2UgYHVuZGVmaW5lZGAuXHJcbiAqIEl0IGFsc28gaGFuZGxlcyBhc3luY2hyb25vdXMgcHJvY2VzcyBvZiB0ZXh0dXJlcy5cclxuICogTWFrZSBzdXJlIGF3YWl0IGZvciB7QGxpbmsgR0xURk1Ub29uTWF0ZXJpYWxQYXJhbXNBc3NpZ25IZWxwZXIucGVuZGluZ30uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgR0xURk1Ub29uTWF0ZXJpYWxQYXJhbXNBc3NpZ25IZWxwZXIge1xyXG4gIHByaXZhdGUgcmVhZG9ubHkgX3BhcnNlcjogR0xURlBhcnNlcjtcclxuICBwcml2YXRlIF9tYXRlcmlhbFBhcmFtczogTVRvb25NYXRlcmlhbFBhcmFtZXRlcnM7XHJcbiAgcHJpdmF0ZSBfcGVuZGluZ3M6IFByb21pc2U8YW55PltdO1xyXG5cclxuICBwdWJsaWMgZ2V0IHBlbmRpbmcoKTogUHJvbWlzZTx1bmtub3duPiB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwodGhpcy5fcGVuZGluZ3MpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHBhcnNlcjogR0xURlBhcnNlciwgbWF0ZXJpYWxQYXJhbXM6IE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzKSB7XHJcbiAgICB0aGlzLl9wYXJzZXIgPSBwYXJzZXI7XHJcbiAgICB0aGlzLl9tYXRlcmlhbFBhcmFtcyA9IG1hdGVyaWFsUGFyYW1zO1xyXG4gICAgdGhpcy5fcGVuZGluZ3MgPSBbXTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3NpZ25QcmltaXRpdmU8VCBleHRlbmRzIGtleW9mIE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzPihrZXk6IFQsIHZhbHVlOiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVyc1tUXSk6IHZvaWQge1xyXG4gICAgaWYgKHZhbHVlICE9IG51bGwpIHtcclxuICAgICAgdGhpcy5fbWF0ZXJpYWxQYXJhbXNba2V5XSA9IHZhbHVlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzc2lnbkNvbG9yPFQgZXh0ZW5kcyBrZXlvZiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycz4oXHJcbiAgICBrZXk6IFQsXHJcbiAgICB2YWx1ZTogbnVtYmVyW10gfCB1bmRlZmluZWQsXHJcbiAgICBjb252ZXJ0U1JHQlRvTGluZWFyPzogYm9vbGVhbixcclxuICApOiB2b2lkIHtcclxuICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XHJcbiAgICAgIHRoaXMuX21hdGVyaWFsUGFyYW1zW2tleV0gPSBuZXcgVEhSRUUuQ29sb3IoKS5mcm9tQXJyYXkodmFsdWUpO1xyXG5cclxuICAgICAgaWYgKGNvbnZlcnRTUkdCVG9MaW5lYXIpIHtcclxuICAgICAgICB0aGlzLl9tYXRlcmlhbFBhcmFtc1trZXldLmNvbnZlcnRTUkdCVG9MaW5lYXIoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGFzc2lnblRleHR1cmU8VCBleHRlbmRzIGtleW9mIE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzPihcclxuICAgIGtleTogVCxcclxuICAgIHRleHR1cmU6IHsgaW5kZXg6IG51bWJlciB9IHwgdW5kZWZpbmVkLFxyXG4gICAgaXNDb2xvclRleHR1cmU6IGJvb2xlYW4sXHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBjb25zdCBwcm9taXNlID0gKGFzeW5jICgpID0+IHtcclxuICAgICAgaWYgKHRleHR1cmUgIT0gbnVsbCkge1xyXG4gICAgICAgIGF3YWl0IHRoaXMuX3BhcnNlci5hc3NpZ25UZXh0dXJlKHRoaXMuX21hdGVyaWFsUGFyYW1zLCBrZXksIHRleHR1cmUpO1xyXG5cclxuICAgICAgICBpZiAoaXNDb2xvclRleHR1cmUpIHtcclxuICAgICAgICAgIHRoaXMuX21hdGVyaWFsUGFyYW1zW2tleV0uZW5jb2RpbmcgPSBUSFJFRS5zUkdCRW5jb2Rpbmc7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KSgpO1xyXG5cclxuICAgIHRoaXMuX3BlbmRpbmdzLnB1c2gocHJvbWlzZSk7XHJcblxyXG4gICAgcmV0dXJuIHByb21pc2U7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgYXNzaWduVGV4dHVyZUJ5SW5kZXg8VCBleHRlbmRzIGtleW9mIE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzPihcclxuICAgIGtleTogVCxcclxuICAgIHRleHR1cmVJbmRleDogbnVtYmVyIHwgdW5kZWZpbmVkLFxyXG4gICAgaXNDb2xvclRleHR1cmU6IGJvb2xlYW4sXHJcbiAgKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICByZXR1cm4gdGhpcy5hc3NpZ25UZXh0dXJlKGtleSwgdGV4dHVyZUluZGV4ICE9IG51bGwgPyB7IGluZGV4OiB0ZXh0dXJlSW5kZXggfSA6IHVuZGVmaW5lZCwgaXNDb2xvclRleHR1cmUpO1xyXG4gIH1cclxufVxyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcbmltcG9ydCAqIGFzIFYxTVRvb25TY2hlbWEgZnJvbSAnQHBpeGl2L3R5cGVzLXZybWMtbWF0ZXJpYWxzLW10b29uLTEuMCc7XHJcbmltcG9ydCB0eXBlIHsgR0xURiwgR0xURkxvYWRlclBsdWdpbiwgR0xURlBhcnNlciB9IGZyb20gJ3RocmVlL2V4YW1wbGVzL2pzbS9sb2FkZXJzL0dMVEZMb2FkZXIuanMnO1xyXG5pbXBvcnQgeyBNVG9vbk1hdGVyaWFsIH0gZnJvbSAnLi9NVG9vbk1hdGVyaWFsJztcclxuaW1wb3J0IHR5cGUgeyBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycyB9IGZyb20gJy4vTVRvb25NYXRlcmlhbFBhcmFtZXRlcnMnO1xyXG5pbXBvcnQgeyBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSB9IGZyb20gJy4vTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUnO1xyXG5pbXBvcnQgeyBHTFRGTVRvb25NYXRlcmlhbFBhcmFtc0Fzc2lnbkhlbHBlciB9IGZyb20gJy4vR0xURk1Ub29uTWF0ZXJpYWxQYXJhbXNBc3NpZ25IZWxwZXInO1xyXG5pbXBvcnQgeyBNVG9vbk1hdGVyaWFsTG9hZGVyUGx1Z2luT3B0aW9ucyB9IGZyb20gJy4vTVRvb25NYXRlcmlhbExvYWRlclBsdWdpbk9wdGlvbnMnO1xyXG5pbXBvcnQgdHlwZSB7IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUnO1xyXG5pbXBvcnQgeyBHTFRGIGFzIEdMVEZTY2hlbWEgfSBmcm9tICdAZ2x0Zi10cmFuc2Zvcm0vY29yZSc7XHJcblxyXG5leHBvcnQgY2xhc3MgTVRvb25NYXRlcmlhbExvYWRlclBsdWdpbiBpbXBsZW1lbnRzIEdMVEZMb2FkZXJQbHVnaW4ge1xyXG4gIHB1YmxpYyBzdGF0aWMgRVhURU5TSU9OX05BTUUgPSAnVlJNQ19tYXRlcmlhbHNfbXRvb24nO1xyXG5cclxuICAvKipcclxuICAgKiBUaGlzIHZhbHVlIHdpbGwgYmUgYWRkZWQgdG8gYHJlbmRlck9yZGVyYCBvZiBldmVyeSBtZXNoZXMgd2hvIGhhdmUgTWF0ZXJpYWxzTVRvb24uXHJcbiAgICogVGhlIGZpbmFsIHJlbmRlck9yZGVyIHdpbGwgYmUgc3VtIG9mIHRoaXMgYHJlbmRlck9yZGVyT2Zmc2V0YCBhbmQgYHJlbmRlclF1ZXVlT2Zmc2V0TnVtYmVyYCBmb3IgZWFjaCBtYXRlcmlhbHMuXHJcbiAgICogYDBgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgcHVibGljIHJlbmRlck9yZGVyT2Zmc2V0OiBudW1iZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIFRoZXJlIGlzIGEgbGluZSBvZiB0aGUgc2hhZGVyIGNhbGxlZCBcImNvbW1lbnQgb3V0IGlmIHlvdSB3YW50IHRvIFBCUiBhYnNvbHV0ZWx5XCIgaW4gVlJNMC4wIE1Ub29uLlxyXG4gICAqIFdoZW4gdGhpcyBpcyB0cnVlLCB0aGUgbWF0ZXJpYWwgZW5hYmxlcyB0aGUgbGluZSB0byBtYWtlIGl0IGNvbXBhdGlibGUgd2l0aCB0aGUgbGVnYWN5IHJlbmRlcmluZyBvZiBWUk0uXHJcbiAgICogVXN1YWxseSBub3QgcmVjb21tZW5kZWQgdG8gdHVybiB0aGlzIG9uLlxyXG4gICAqIGBmYWxzZWAgYnkgZGVmYXVsdC5cclxuICAgKi9cclxuICBwdWJsaWMgdjBDb21wYXRTaGFkZTogYm9vbGVhbjtcclxuXHJcbiAgLyoqXHJcbiAgICogRGVidWcgbW9kZSBmb3IgdGhlIG1hdGVyaWFsLlxyXG4gICAqIFlvdSBjYW4gdmlzdWFsaXplIHNldmVyYWwgY29tcG9uZW50cyBmb3IgZGlhZ25vc2lzIHVzaW5nIGRlYnVnIG1vZGUuXHJcbiAgICpcclxuICAgKiBTZWU6IHtAbGluayBNVG9vbk1hdGVyaWFsRGVidWdNb2RlfVxyXG4gICAqL1xyXG4gIHB1YmxpYyBkZWJ1Z01vZGU6IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGU7XHJcblxyXG4gIHB1YmxpYyByZWFkb25seSBwYXJzZXI6IEdMVEZQYXJzZXI7XHJcblxyXG4gIC8qKlxyXG4gICAqIExvYWRlZCBtYXRlcmlhbHMgd2lsbCBiZSBzdG9yZWQgaW4gdGhpcyBzZXQuXHJcbiAgICogV2lsbCBiZSB0cmFuc2ZlcnJlZCBpbnRvIGBnbHRmLnVzZXJEYXRhLnZybU1Ub29uTWF0ZXJpYWxzYCBpbiB7QGxpbmsgYWZ0ZXJSb290fS5cclxuICAgKi9cclxuICBwcml2YXRlIHJlYWRvbmx5IF9tVG9vbk1hdGVyaWFsU2V0OiBTZXQ8TVRvb25NYXRlcmlhbD47XHJcblxyXG4gIHB1YmxpYyBnZXQgbmFtZSgpOiBzdHJpbmcge1xyXG4gICAgcmV0dXJuIE1Ub29uTWF0ZXJpYWxMb2FkZXJQbHVnaW4uRVhURU5TSU9OX05BTUU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY29uc3RydWN0b3IocGFyc2VyOiBHTFRGUGFyc2VyLCBvcHRpb25zOiBNVG9vbk1hdGVyaWFsTG9hZGVyUGx1Z2luT3B0aW9ucyA9IHt9KSB7XHJcbiAgICB0aGlzLnBhcnNlciA9IHBhcnNlcjtcclxuXHJcbiAgICB0aGlzLnJlbmRlck9yZGVyT2Zmc2V0ID0gb3B0aW9ucy5yZW5kZXJPcmRlck9mZnNldCA/PyAwO1xyXG4gICAgdGhpcy52MENvbXBhdFNoYWRlID0gb3B0aW9ucy52MENvbXBhdFNoYWRlID8/IGZhbHNlO1xyXG4gICAgdGhpcy5kZWJ1Z01vZGUgPSBvcHRpb25zLmRlYnVnTW9kZSA/PyAnbm9uZSc7XHJcblxyXG4gICAgdGhpcy5fbVRvb25NYXRlcmlhbFNldCA9IG5ldyBTZXQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBiZWZvcmVSb290KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdGhpcy5fcmVtb3ZlVW5saXRFeHRlbnNpb25JZk1Ub29uRXhpc3RzKCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgYWZ0ZXJSb290KGdsdGY6IEdMVEYpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIGdsdGYudXNlckRhdGEudnJtTVRvb25NYXRlcmlhbHMgPSBBcnJheS5mcm9tKHRoaXMuX21Ub29uTWF0ZXJpYWxTZXQpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldE1hdGVyaWFsVHlwZShtYXRlcmlhbEluZGV4OiBudW1iZXIpOiB0eXBlb2YgVEhSRUUuTWF0ZXJpYWwgfCBudWxsIHtcclxuICAgIGNvbnN0IHYxRXh0ZW5zaW9uID0gdGhpcy5fZ2V0TVRvb25FeHRlbnNpb24obWF0ZXJpYWxJbmRleCk7XHJcbiAgICBpZiAodjFFeHRlbnNpb24pIHtcclxuICAgICAgcmV0dXJuIE1Ub29uTWF0ZXJpYWw7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZXh0ZW5kTWF0ZXJpYWxQYXJhbXMobWF0ZXJpYWxJbmRleDogbnVtYmVyLCBtYXRlcmlhbFBhcmFtczogTVRvb25NYXRlcmlhbFBhcmFtZXRlcnMpOiBQcm9taXNlPGFueT4gfCBudWxsIHtcclxuICAgIGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuX2dldE1Ub29uRXh0ZW5zaW9uKG1hdGVyaWFsSW5kZXgpO1xyXG4gICAgaWYgKGV4dGVuc2lvbikge1xyXG4gICAgICByZXR1cm4gdGhpcy5fZXh0ZW5kTWF0ZXJpYWxQYXJhbXMoZXh0ZW5zaW9uLCBtYXRlcmlhbFBhcmFtcyk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG51bGw7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgbG9hZE1lc2gobWVzaEluZGV4OiBudW1iZXIpOiBQcm9taXNlPFRIUkVFLkdyb3VwIHwgVEhSRUUuTWVzaCB8IFRIUkVFLlNraW5uZWRNZXNoPiB7XHJcbiAgICBjb25zdCBwYXJzZXIgPSB0aGlzLnBhcnNlcjtcclxuICAgIGNvbnN0IGpzb24gPSBwYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIGNvbnN0IG1lc2hEZWYgPSBqc29uLm1lc2hlcz8uW21lc2hJbmRleF07XHJcblxyXG4gICAgaWYgKG1lc2hEZWYgPT0gbnVsbCkge1xyXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXHJcbiAgICAgICAgYE1Ub29uTWF0ZXJpYWxMb2FkZXJQbHVnaW46IEF0dGVtcHQgdG8gdXNlIG1lc2hlc1ske21lc2hJbmRleH1dIG9mIGdsVEYgYnV0IHRoZSBtZXNoIGRvZXNuJ3QgZXhpc3RgLFxyXG4gICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHByaW1pdGl2ZXNEZWYgPSBtZXNoRGVmLnByaW1pdGl2ZXM7XHJcblxyXG4gICAgY29uc3QgbWVzaE9yR3JvdXAgPSBhd2FpdCBwYXJzZXIubG9hZE1lc2gobWVzaEluZGV4KTtcclxuXHJcbiAgICBpZiAocHJpbWl0aXZlc0RlZi5sZW5ndGggPT09IDEpIHtcclxuICAgICAgY29uc3QgbWVzaCA9IG1lc2hPckdyb3VwIGFzIFRIUkVFLk1lc2g7XHJcbiAgICAgIGNvbnN0IG1hdGVyaWFsSW5kZXggPSBwcmltaXRpdmVzRGVmWzBdLm1hdGVyaWFsO1xyXG5cclxuICAgICAgaWYgKG1hdGVyaWFsSW5kZXggIT0gbnVsbCkge1xyXG4gICAgICAgIHRoaXMuX3NldHVwUHJpbWl0aXZlKG1lc2gsIG1hdGVyaWFsSW5kZXgpO1xyXG4gICAgICB9XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBjb25zdCBncm91cCA9IG1lc2hPckdyb3VwIGFzIFRIUkVFLkdyb3VwO1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByaW1pdGl2ZXNEZWYubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICBjb25zdCBtZXNoID0gZ3JvdXAuY2hpbGRyZW5baV0gYXMgVEhSRUUuTWVzaDtcclxuICAgICAgICBjb25zdCBtYXRlcmlhbEluZGV4ID0gcHJpbWl0aXZlc0RlZltpXS5tYXRlcmlhbDtcclxuXHJcbiAgICAgICAgaWYgKG1hdGVyaWFsSW5kZXggIT0gbnVsbCkge1xyXG4gICAgICAgICAgdGhpcy5fc2V0dXBQcmltaXRpdmUobWVzaCwgbWF0ZXJpYWxJbmRleCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIG1lc2hPckdyb3VwO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogRGVsZXRlIHVzZSBvZiBgS0hSX21hdGVyaWFsc191bmxpdGAgZnJvbSBpdHMgYG1hdGVyaWFsc2AgaWYgdGhlIG1hdGVyaWFsIGlzIHVzaW5nIE1Ub29uLlxyXG4gICAqXHJcbiAgICogU2luY2UgR0xURkxvYWRlciBoYXZlIHNvIG1hbnkgaGFyZGNvZGVkIHByb2NlZHVyZSByZWxhdGVkIHRvIGBLSFJfbWF0ZXJpYWxzX3VubGl0YFxyXG4gICAqIHdlIGhhdmUgdG8gZGVsZXRlIHRoZSBleHRlbnNpb24gYmVmb3JlIHdlIHN0YXJ0IHRvIHBhcnNlIHRoZSBnbFRGLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3JlbW92ZVVubGl0RXh0ZW5zaW9uSWZNVG9vbkV4aXN0cygpOiB2b2lkIHtcclxuICAgIGNvbnN0IHBhcnNlciA9IHRoaXMucGFyc2VyO1xyXG4gICAgY29uc3QganNvbiA9IHBhcnNlci5qc29uIGFzIEdMVEZTY2hlbWEuSUdMVEY7XHJcblxyXG4gICAgY29uc3QgbWF0ZXJpYWxEZWZzID0ganNvbi5tYXRlcmlhbHM7XHJcbiAgICBtYXRlcmlhbERlZnM/Lm1hcCgobWF0ZXJpYWxEZWYsIGlNYXRlcmlhbCkgPT4ge1xyXG4gICAgICBjb25zdCBleHRlbnNpb24gPSB0aGlzLl9nZXRNVG9vbkV4dGVuc2lvbihpTWF0ZXJpYWwpO1xyXG5cclxuICAgICAgaWYgKGV4dGVuc2lvbiAmJiBtYXRlcmlhbERlZi5leHRlbnNpb25zPy5bJ0tIUl9tYXRlcmlhbHNfdW5saXQnXSkge1xyXG4gICAgICAgIGRlbGV0ZSBtYXRlcmlhbERlZi5leHRlbnNpb25zWydLSFJfbWF0ZXJpYWxzX3VubGl0J107XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfZ2V0TVRvb25FeHRlbnNpb24obWF0ZXJpYWxJbmRleDogbnVtYmVyKTogVjFNVG9vblNjaGVtYS5WUk1DTWF0ZXJpYWxzTVRvb24gfCB1bmRlZmluZWQge1xyXG4gICAgY29uc3QgcGFyc2VyID0gdGhpcy5wYXJzZXI7XHJcbiAgICBjb25zdCBqc29uID0gcGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcclxuXHJcbiAgICBjb25zdCBtYXRlcmlhbERlZiA9IGpzb24ubWF0ZXJpYWxzPy5bbWF0ZXJpYWxJbmRleF07XHJcblxyXG4gICAgaWYgKG1hdGVyaWFsRGVmID09IG51bGwpIHtcclxuICAgICAgY29uc29sZS53YXJuKFxyXG4gICAgICAgIGBNVG9vbk1hdGVyaWFsTG9hZGVyUGx1Z2luOiBBdHRlbXB0IHRvIHVzZSBtYXRlcmlhbHNbJHttYXRlcmlhbEluZGV4fV0gb2YgZ2xURiBidXQgdGhlIG1hdGVyaWFsIGRvZXNuJ3QgZXhpc3RgLFxyXG4gICAgICApO1xyXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IGV4dGVuc2lvbiA9IG1hdGVyaWFsRGVmLmV4dGVuc2lvbnM/LltNVG9vbk1hdGVyaWFsTG9hZGVyUGx1Z2luLkVYVEVOU0lPTl9OQU1FXSBhc1xyXG4gICAgICB8IFYxTVRvb25TY2hlbWEuVlJNQ01hdGVyaWFsc01Ub29uXHJcbiAgICAgIHwgdW5kZWZpbmVkO1xyXG4gICAgaWYgKGV4dGVuc2lvbiA9PSBudWxsKSB7XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3Qgc3BlY1ZlcnNpb24gPSBleHRlbnNpb24uc3BlY1ZlcnNpb247XHJcbiAgICBpZiAoc3BlY1ZlcnNpb24gIT09ICcxLjAtYmV0YScpIHtcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICByZXR1cm4gZXh0ZW5zaW9uO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBhc3luYyBfZXh0ZW5kTWF0ZXJpYWxQYXJhbXMoXHJcbiAgICBleHRlbnNpb246IFYxTVRvb25TY2hlbWEuVlJNQ01hdGVyaWFsc01Ub29uLFxyXG4gICAgbWF0ZXJpYWxQYXJhbXM6IE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzLFxyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgLy8gUmVtb3ZpbmcgbWF0ZXJpYWwgcGFyYW1zIHRoYXQgaXMgbm90IHJlcXVpcmVkIHRvIHN1cHJlc3Mgd2FybmluZ3MuXHJcbiAgICBkZWxldGUgKG1hdGVyaWFsUGFyYW1zIGFzIFRIUkVFLk1lc2hTdGFuZGFyZE1hdGVyaWFsUGFyYW1ldGVycykubWV0YWxuZXNzO1xyXG4gICAgZGVsZXRlIChtYXRlcmlhbFBhcmFtcyBhcyBUSFJFRS5NZXNoU3RhbmRhcmRNYXRlcmlhbFBhcmFtZXRlcnMpLnJvdWdobmVzcztcclxuXHJcbiAgICBjb25zdCBhc3NpZ25IZWxwZXIgPSBuZXcgR0xURk1Ub29uTWF0ZXJpYWxQYXJhbXNBc3NpZ25IZWxwZXIodGhpcy5wYXJzZXIsIG1hdGVyaWFsUGFyYW1zKTtcclxuXHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCd0cmFuc3BhcmVudFdpdGhaV3JpdGUnLCBleHRlbnNpb24udHJhbnNwYXJlbnRXaXRoWldyaXRlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25Db2xvcignc2hhZGVDb2xvckZhY3RvcicsIGV4dGVuc2lvbi5zaGFkZUNvbG9yRmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25UZXh0dXJlKCdzaGFkZU11bHRpcGx5VGV4dHVyZScsIGV4dGVuc2lvbi5zaGFkZU11bHRpcGx5VGV4dHVyZSwgdHJ1ZSk7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdzaGFkaW5nU2hpZnRGYWN0b3InLCBleHRlbnNpb24uc2hhZGluZ1NoaWZ0RmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25UZXh0dXJlKCdzaGFkaW5nU2hpZnRUZXh0dXJlJywgZXh0ZW5zaW9uLnNoYWRpbmdTaGlmdFRleHR1cmUsIHRydWUpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgnc2hhZGluZ1NoaWZ0VGV4dHVyZVNjYWxlJywgZXh0ZW5zaW9uLnNoYWRpbmdTaGlmdFRleHR1cmU/LnNjYWxlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3NoYWRpbmdUb29ueUZhY3RvcicsIGV4dGVuc2lvbi5zaGFkaW5nVG9vbnlGYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgnZ2lFcXVhbGl6YXRpb25GYWN0b3InLCBleHRlbnNpb24uZ2lFcXVhbGl6YXRpb25GYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnbkNvbG9yKCdtYXRjYXBGYWN0b3InLCBleHRlbnNpb24ubWF0Y2FwRmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25UZXh0dXJlKCdtYXRjYXBUZXh0dXJlJywgZXh0ZW5zaW9uLm1hdGNhcFRleHR1cmUsIHRydWUpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnbkNvbG9yKCdwYXJhbWV0cmljUmltQ29sb3JGYWN0b3InLCBleHRlbnNpb24ucGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25UZXh0dXJlKCdyaW1NdWx0aXBseVRleHR1cmUnLCBleHRlbnNpb24ucmltTXVsdGlwbHlUZXh0dXJlLCB0cnVlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3JpbUxpZ2h0aW5nTWl4RmFjdG9yJywgZXh0ZW5zaW9uLnJpbUxpZ2h0aW5nTWl4RmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3BhcmFtZXRyaWNSaW1GcmVzbmVsUG93ZXJGYWN0b3InLCBleHRlbnNpb24ucGFyYW1ldHJpY1JpbUZyZXNuZWxQb3dlckZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdwYXJhbWV0cmljUmltTGlmdEZhY3RvcicsIGV4dGVuc2lvbi5wYXJhbWV0cmljUmltTGlmdEZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdvdXRsaW5lV2lkdGhNb2RlJywgZXh0ZW5zaW9uLm91dGxpbmVXaWR0aE1vZGUgYXMgTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgnb3V0bGluZVdpZHRoRmFjdG9yJywgZXh0ZW5zaW9uLm91dGxpbmVXaWR0aEZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduVGV4dHVyZSgnb3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlJywgZXh0ZW5zaW9uLm91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZSwgZmFsc2UpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnbkNvbG9yKCdvdXRsaW5lQ29sb3JGYWN0b3InLCBleHRlbnNpb24ub3V0bGluZUNvbG9yRmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ291dGxpbmVMaWdodGluZ01peEZhY3RvcicsIGV4dGVuc2lvbi5vdXRsaW5lTGlnaHRpbmdNaXhGYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblRleHR1cmUoJ3V2QW5pbWF0aW9uTWFza1RleHR1cmUnLCBleHRlbnNpb24udXZBbmltYXRpb25NYXNrVGV4dHVyZSwgZmFsc2UpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgndXZBbmltYXRpb25TY3JvbGxYU3BlZWRGYWN0b3InLCBleHRlbnNpb24udXZBbmltYXRpb25TY3JvbGxYU3BlZWRGYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgndXZBbmltYXRpb25TY3JvbGxZU3BlZWRGYWN0b3InLCBleHRlbnNpb24udXZBbmltYXRpb25TY3JvbGxZU3BlZWRGYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgndXZBbmltYXRpb25Sb3RhdGlvblNwZWVkRmFjdG9yJywgZXh0ZW5zaW9uLnV2QW5pbWF0aW9uUm90YXRpb25TcGVlZEZhY3Rvcik7XHJcblxyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgndjBDb21wYXRTaGFkZScsIHRoaXMudjBDb21wYXRTaGFkZSk7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdkZWJ1Z01vZGUnLCB0aGlzLmRlYnVnTW9kZSk7XHJcblxyXG4gICAgYXdhaXQgYXNzaWduSGVscGVyLnBlbmRpbmc7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaGlzIHdpbGwgZG8gdHdvIHByb2Nlc3NlcyB0aGF0IGlzIHJlcXVpcmVkIHRvIHJlbmRlciBNVG9vbiBwcm9wZXJseS5cclxuICAgKlxyXG4gICAqIC0gU2V0IHJlbmRlciBvcmRlclxyXG4gICAqIC0gR2VuZXJhdGUgb3V0bGluZVxyXG4gICAqXHJcbiAgICogQHBhcmFtIG1lc2ggQSB0YXJnZXQgR0xURiBwcmltaXRpdmVcclxuICAgKiBAcGFyYW0gbWF0ZXJpYWxJbmRleCBUaGUgbWF0ZXJpYWwgaW5kZXggb2YgdGhlIHByaW1pdGl2ZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3NldHVwUHJpbWl0aXZlKG1lc2g6IFRIUkVFLk1lc2gsIG1hdGVyaWFsSW5kZXg6IG51bWJlcik6IHZvaWQge1xyXG4gICAgY29uc3QgZXh0ZW5zaW9uID0gdGhpcy5fZ2V0TVRvb25FeHRlbnNpb24obWF0ZXJpYWxJbmRleCk7XHJcbiAgICBpZiAoZXh0ZW5zaW9uKSB7XHJcbiAgICAgIGNvbnN0IHJlbmRlck9yZGVyID0gdGhpcy5fcGFyc2VSZW5kZXJPcmRlcihleHRlbnNpb24pO1xyXG4gICAgICBtZXNoLnJlbmRlck9yZGVyID0gcmVuZGVyT3JkZXIgKyB0aGlzLnJlbmRlck9yZGVyT2Zmc2V0O1xyXG5cclxuICAgICAgdGhpcy5fZ2VuZXJhdGVPdXRsaW5lKG1lc2gpO1xyXG5cclxuICAgICAgdGhpcy5fYWRkVG9NYXRlcmlhbFNldChtZXNoKTtcclxuXHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIEdlbmVyYXRlIG91dGxpbmUgZm9yIHRoZSBnaXZlbiBtZXNoLCBpZiBpdCBuZWVkcy5cclxuICAgKlxyXG4gICAqIEBwYXJhbSBtZXNoIFRoZSB0YXJnZXQgbWVzaFxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dlbmVyYXRlT3V0bGluZShtZXNoOiBUSFJFRS5NZXNoKTogdm9pZCB7XHJcbiAgICAvLyBPSywgaXQncyB0aGUgaGFja3kgcGFydC5cclxuICAgIC8vIFdlIGFyZSBnb2luZyB0byBkdXBsaWNhdGUgdGhlIE1Ub29uTWF0ZXJpYWwgZm9yIG91dGxpbmUgdXNlLlxyXG4gICAgLy8gVGhlbiB3ZSBhcmUgZ29pbmcgdG8gY3JlYXRlIHR3byBnZW9tZXRyeSBncm91cHMgYW5kIHJlZmVyIHNhbWUgYnVmZmVyIGJ1dCBkaWZmZXJlbnQgbWF0ZXJpYWwuXHJcbiAgICAvLyBJdCdzIGhvdyB3ZSBkcmF3IHR3byBtYXRlcmlhbHMgYXQgb25jZSB1c2luZyBhIHNpbmdsZSBtZXNoLlxyXG5cclxuICAgIC8vIG1ha2Ugc3VyZSB0aGUgbWF0ZXJpYWwgaXMgbXRvb25cclxuICAgIGNvbnN0IHN1cmZhY2VNYXRlcmlhbCA9IG1lc2gubWF0ZXJpYWw7XHJcbiAgICBpZiAoIShzdXJmYWNlTWF0ZXJpYWwgaW5zdGFuY2VvZiBNVG9vbk1hdGVyaWFsKSkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gY2hlY2sgd2hldGhlciB3ZSByZWFsbHkgaGF2ZSB0byBwcmVwYXJlIG91dGxpbmUgb3Igbm90XHJcbiAgICBpZiAoc3VyZmFjZU1hdGVyaWFsLm91dGxpbmVXaWR0aE1vZGUgPT09ICdub25lJyB8fCBzdXJmYWNlTWF0ZXJpYWwub3V0bGluZVdpZHRoRmFjdG9yIDw9IDAuMCkge1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcblxyXG4gICAgLy8gbWFrZSBpdHMgbWF0ZXJpYWwgYW4gYXJyYXlcclxuICAgIG1lc2gubWF0ZXJpYWwgPSBbc3VyZmFjZU1hdGVyaWFsXTsgLy8gbWVzaC5tYXRlcmlhbCBpcyBndWFyYW50ZWVkIHRvIGJlIGEgTWF0ZXJpYWwgaW4gR0xURkxvYWRlclxyXG5cclxuICAgIC8vIGR1cGxpY2F0ZSB0aGUgbWF0ZXJpYWwgZm9yIG91dGxpbmUgdXNlXHJcbiAgICBjb25zdCBvdXRsaW5lTWF0ZXJpYWwgPSBzdXJmYWNlTWF0ZXJpYWwuY2xvbmUoKSBhcyBNVG9vbk1hdGVyaWFsO1xyXG4gICAgb3V0bGluZU1hdGVyaWFsLm5hbWUgKz0gJyAoT3V0bGluZSknO1xyXG4gICAgb3V0bGluZU1hdGVyaWFsLmlzT3V0bGluZSA9IHRydWU7XHJcbiAgICBvdXRsaW5lTWF0ZXJpYWwuc2lkZSA9IFRIUkVFLkJhY2tTaWRlO1xyXG4gICAgbWVzaC5tYXRlcmlhbC5wdXNoKG91dGxpbmVNYXRlcmlhbCk7XHJcblxyXG4gICAgLy8gbWFrZSB0d28gZ2VvbWV0cnkgZ3JvdXBzIG91dCBvZiBhIHNhbWUgYnVmZmVyXHJcbiAgICBjb25zdCBnZW9tZXRyeSA9IG1lc2guZ2VvbWV0cnk7IC8vIG1lc2guZ2VvbWV0cnkgaXMgZ3VhcmFudGVlZCB0byBiZSBhIEJ1ZmZlckdlb21ldHJ5IGluIEdMVEZMb2FkZXJcclxuICAgIGNvbnN0IHByaW1pdGl2ZVZlcnRpY2VzID0gZ2VvbWV0cnkuaW5kZXggPyBnZW9tZXRyeS5pbmRleC5jb3VudCA6IGdlb21ldHJ5LmF0dHJpYnV0ZXMucG9zaXRpb24uY291bnQgLyAzO1xyXG4gICAgZ2VvbWV0cnkuYWRkR3JvdXAoMCwgcHJpbWl0aXZlVmVydGljZXMsIDApO1xyXG4gICAgZ2VvbWV0cnkuYWRkR3JvdXAoMCwgcHJpbWl0aXZlVmVydGljZXMsIDEpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBfYWRkVG9NYXRlcmlhbFNldChtZXNoOiBUSFJFRS5NZXNoKTogdm9pZCB7XHJcbiAgICBjb25zdCBtYXRlcmlhbE9yTWF0ZXJpYWxzID0gbWVzaC5tYXRlcmlhbDtcclxuICAgIGNvbnN0IG1hdGVyaWFsU2V0ID0gbmV3IFNldDxUSFJFRS5NYXRlcmlhbD4oKTtcclxuXHJcbiAgICBpZiAoQXJyYXkuaXNBcnJheShtYXRlcmlhbE9yTWF0ZXJpYWxzKSkge1xyXG4gICAgICBtYXRlcmlhbE9yTWF0ZXJpYWxzLmZvckVhY2goKG1hdGVyaWFsKSA9PiBtYXRlcmlhbFNldC5hZGQobWF0ZXJpYWwpKTtcclxuICAgIH0gZWxzZSB7XHJcbiAgICAgIG1hdGVyaWFsU2V0LmFkZChtYXRlcmlhbE9yTWF0ZXJpYWxzKTtcclxuICAgIH1cclxuXHJcbiAgICBmb3IgKGNvbnN0IG1hdGVyaWFsIG9mIG1hdGVyaWFsU2V0KSB7XHJcbiAgICAgIGlmIChtYXRlcmlhbCBpbnN0YW5jZW9mIE1Ub29uTWF0ZXJpYWwpIHtcclxuICAgICAgICB0aGlzLl9tVG9vbk1hdGVyaWFsU2V0LmFkZChtYXRlcmlhbCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3BhcnNlUmVuZGVyT3JkZXIoZXh0ZW5zaW9uOiBWMU1Ub29uU2NoZW1hLlZSTUNNYXRlcmlhbHNNVG9vbik6IG51bWJlciB7XHJcbiAgICAvLyB0cmFuc3BhcmVudFdpdGhaV3JpdGUgcmFuZ2VzIGZyb20gMCB0byArOVxyXG4gICAgLy8gbWVyZSB0cmFuc3BhcmVudCByYW5nZXMgZnJvbSAtOSB0byAwXHJcbiAgICBjb25zdCBlbmFibGVkWldyaXRlID0gZXh0ZW5zaW9uLnRyYW5zcGFyZW50V2l0aFpXcml0ZTtcclxuICAgIHJldHVybiAoZW5hYmxlZFpXcml0ZSA/IDAgOiAxOSkgKyAoZXh0ZW5zaW9uLnJlbmRlclF1ZXVlT2Zmc2V0TnVtYmVyID8/IDApO1xyXG4gIH1cclxufVxyXG4iXSwibmFtZXMiOlsiVEhSRUUiXSwibWFwcGlu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
