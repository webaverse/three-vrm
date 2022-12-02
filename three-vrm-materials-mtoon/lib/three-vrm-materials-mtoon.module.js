/*!
 * @pixiv/three-vrm-materials-mtoon v1.0.0-beta.19
 * MToon (toon material) module for @pixiv/three-vrm
 *
 * Copyright (c) 2020-2021 pixiv Inc.
 * @pixiv/three-vrm-materials-mtoon is distributed under MIT License
 * https://github.com/pixiv/three-vrm/blob/release/LICENSE
 */
import * as THREE from 'three';

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
        encoding = THREE.LinearEncoding;
    }
    if (parseInt(THREE.REVISION, 10) >= 133) {
        if (isWebGL2 &&
            map &&
            map.isTexture &&
            map.format === THREE.RGBAFormat &&
            map.type === THREE.UnsignedByteType &&
            map.encoding === THREE.sRGBEncoding) {
            encoding = THREE.LinearEncoding; // disable inline decode for sRGB textures in WebGL 2
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
class MToonMaterial extends THREE.ShaderMaterial {
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
        this.normalMapType = THREE.TangentSpaceNormalMap;
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
        if (parseInt(THREE.REVISION, 10) < 129) {
            parameters.skinning = parameters.skinning || false;
        }
        // COMPAT: pre-r131
        // See: https://github.com/mrdoob/three.js/pull/22169
        if (parseInt(THREE.REVISION, 10) < 131) {
            parameters.morphTargets = parameters.morphTargets || false;
            parameters.morphNormals = parameters.morphNormals || false;
        }
        // == uniforms =================================================================================
        this.uniforms = THREE.UniformsUtils.merge([
            THREE.UniformsLib.common,
            THREE.UniformsLib.normalmap,
            THREE.UniformsLib.emissivemap,
            THREE.UniformsLib.fog,
            THREE.UniformsLib.lights,
            {
                litFactor: { value: new THREE.Color(1.0, 1.0, 1.0) },
                mapUvTransform: { value: new THREE.Matrix3() },
                colorAlpha: { value: 1.0 },
                normalMapUvTransform: { value: new THREE.Matrix3() },
                shadeColorFactor: { value: new THREE.Color(0.97, 0.81, 0.86) },
                shadeMultiplyTexture: { value: null },
                shadeMultiplyTextureUvTransform: { value: new THREE.Matrix3() },
                shadingShiftFactor: { value: 0.0 },
                shadingShiftTexture: { value: null },
                shadingShiftTextureUvTransform: { value: new THREE.Matrix3() },
                shadingShiftTextureScale: { value: null },
                shadingToonyFactor: { value: 0.9 },
                giEqualizationFactor: { value: 0.9 },
                matcapFactor: { value: new THREE.Color(1.0, 1.0, 1.0) },
                matcapTexture: { value: null },
                matcapTextureUvTransform: { value: new THREE.Matrix3() },
                parametricRimColorFactor: { value: new THREE.Color(0.0, 0.0, 0.0) },
                rimMultiplyTexture: { value: null },
                rimMultiplyTextureUvTransform: { value: new THREE.Matrix3() },
                rimLightingMixFactor: { value: 0.0 },
                parametricRimFresnelPowerFactor: { value: 1.0 },
                parametricRimLiftFactor: { value: 0.0 },
                emissive: { value: new THREE.Color(0.0, 0.0, 0.0) },
                emissiveIntensity: { value: 1.0 },
                emissiveMapUvTransform: { value: new THREE.Matrix3() },
                outlineWidthMultiplyTexture: { value: null },
                outlineWidthMultiplyTextureUvTransform: { value: new THREE.Matrix3() },
                outlineWidthFactor: { value: 0.5 },
                outlineColorFactor: { value: new THREE.Color(0.0, 0.0, 0.0) },
                outlineLightingMixFactor: { value: 1.0 },
                uvAnimationMaskTexture: { value: null },
                uvAnimationMaskTextureUvTransform: { value: new THREE.Matrix3() },
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
            const threeRevision = parseInt(THREE.REVISION, 10);
            const defines = Object.entries(Object.assign(Object.assign({}, this._generateDefines()), this.defines))
                .filter(([token, macro]) => !!macro)
                .map(([token, macro]) => `#define ${token} ${macro}`)
                .join('\n') + '\n';
            // -- texture encodings ----------------------------------------------------------------------
            // COMPAT: pre-r137
            let encodings = '';
            if (parseInt(THREE.REVISION, 10) < 137) {
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
        const threeRevision = parseInt(THREE.REVISION, 10);
        if (threeRevision >= 132) {
            this.uniforms.alphaTest.value = this.alphaTest;
        }
        this.uniformsNeedUpdate = true;
    }
    /**
     * Returns a map object of preprocessor token and macro of the shader program.
     */
    _generateDefines() {
        const threeRevision = parseInt(THREE.REVISION, 10);
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
            this._materialParams[key] = new THREE.Color().fromArray(value);
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
                        this._materialParams[key].encoding = THREE.sRGBEncoding;
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
        outlineMaterial.side = THREE.BackSide;
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

export { MToonMaterial, MToonMaterialDebugMode, MToonMaterialLoaderPlugin, MToonMaterialOutlineWidthMode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGhyZWUtdnJtLW1hdGVyaWFscy1tdG9vbi5tb2R1bGUuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL25vZGVfbW9kdWxlcy90c2xpYi90c2xpYi5lczYuanMiLCIuLi9zcmMvTVRvb25NYXRlcmlhbERlYnVnTW9kZS50cyIsIi4uL3NyYy9NVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZS50cyIsIi4uL3NyYy91dGlscy9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24udHMiLCIuLi9zcmMvdXRpbHMvZ2V0VGV4dHVyZUVuY29kaW5nRnJvbU1hcC50cyIsIi4uL3NyYy9NVG9vbk1hdGVyaWFsLnRzIiwiLi4vc3JjL0dMVEZNVG9vbk1hdGVyaWFsUGFyYW1zQXNzaWduSGVscGVyLnRzIiwiLi4vc3JjL01Ub29uTWF0ZXJpYWxMb2FkZXJQbHVnaW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyohICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXHJcbkNvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLlxyXG5cclxuUGVybWlzc2lvbiB0byB1c2UsIGNvcHksIG1vZGlmeSwgYW5kL29yIGRpc3RyaWJ1dGUgdGhpcyBzb2Z0d2FyZSBmb3IgYW55XHJcbnB1cnBvc2Ugd2l0aCBvciB3aXRob3V0IGZlZSBpcyBoZXJlYnkgZ3JhbnRlZC5cclxuXHJcblRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIgQU5EIFRIRSBBVVRIT1IgRElTQ0xBSU1TIEFMTCBXQVJSQU5USUVTIFdJVEhcclxuUkVHQVJEIFRPIFRISVMgU09GVFdBUkUgSU5DTFVESU5HIEFMTCBJTVBMSUVEIFdBUlJBTlRJRVMgT0YgTUVSQ0hBTlRBQklMSVRZXHJcbkFORCBGSVRORVNTLiBJTiBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SIEJFIExJQUJMRSBGT1IgQU5ZIFNQRUNJQUwsIERJUkVDVCxcclxuSU5ESVJFQ1QsIE9SIENPTlNFUVVFTlRJQUwgREFNQUdFUyBPUiBBTlkgREFNQUdFUyBXSEFUU09FVkVSIFJFU1VMVElORyBGUk9NXHJcbkxPU1MgT0YgVVNFLCBEQVRBIE9SIFBST0ZJVFMsIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBORUdMSUdFTkNFIE9SXHJcbk9USEVSIFRPUlRJT1VTIEFDVElPTiwgQVJJU0lORyBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBVU0UgT1JcclxuUEVSRk9STUFOQ0UgT0YgVEhJUyBTT0ZUV0FSRS5cclxuKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiogKi9cclxuLyogZ2xvYmFsIFJlZmxlY3QsIFByb21pc2UgKi9cclxuXHJcbnZhciBleHRlbmRTdGF0aWNzID0gZnVuY3Rpb24oZCwgYikge1xyXG4gICAgZXh0ZW5kU3RhdGljcyA9IE9iamVjdC5zZXRQcm90b3R5cGVPZiB8fFxyXG4gICAgICAgICh7IF9fcHJvdG9fXzogW10gfSBpbnN0YW5jZW9mIEFycmF5ICYmIGZ1bmN0aW9uIChkLCBiKSB7IGQuX19wcm90b19fID0gYjsgfSkgfHxcclxuICAgICAgICBmdW5jdGlvbiAoZCwgYikgeyBmb3IgKHZhciBwIGluIGIpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoYiwgcCkpIGRbcF0gPSBiW3BdOyB9O1xyXG4gICAgcmV0dXJuIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHRlbmRzKGQsIGIpIHtcclxuICAgIGlmICh0eXBlb2YgYiAhPT0gXCJmdW5jdGlvblwiICYmIGIgIT09IG51bGwpXHJcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNsYXNzIGV4dGVuZHMgdmFsdWUgXCIgKyBTdHJpbmcoYikgKyBcIiBpcyBub3QgYSBjb25zdHJ1Y3RvciBvciBudWxsXCIpO1xyXG4gICAgZXh0ZW5kU3RhdGljcyhkLCBiKTtcclxuICAgIGZ1bmN0aW9uIF9fKCkgeyB0aGlzLmNvbnN0cnVjdG9yID0gZDsgfVxyXG4gICAgZC5wcm90b3R5cGUgPSBiID09PSBudWxsID8gT2JqZWN0LmNyZWF0ZShiKSA6IChfXy5wcm90b3R5cGUgPSBiLnByb3RvdHlwZSwgbmV3IF9fKCkpO1xyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fYXNzaWduID0gZnVuY3Rpb24oKSB7XHJcbiAgICBfX2Fzc2lnbiA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gX19hc3NpZ24odCkge1xyXG4gICAgICAgIGZvciAodmFyIHMsIGkgPSAxLCBuID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IG47IGkrKykge1xyXG4gICAgICAgICAgICBzID0gYXJndW1lbnRzW2ldO1xyXG4gICAgICAgICAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkpIHRbcF0gPSBzW3BdO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdDtcclxuICAgIH1cclxuICAgIHJldHVybiBfX2Fzc2lnbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZXN0KHMsIGUpIHtcclxuICAgIHZhciB0ID0ge307XHJcbiAgICBmb3IgKHZhciBwIGluIHMpIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocywgcCkgJiYgZS5pbmRleE9mKHApIDwgMClcclxuICAgICAgICB0W3BdID0gc1twXTtcclxuICAgIGlmIChzICE9IG51bGwgJiYgdHlwZW9mIE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMgPT09IFwiZnVuY3Rpb25cIilcclxuICAgICAgICBmb3IgKHZhciBpID0gMCwgcCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMocyk7IGkgPCBwLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGlmIChlLmluZGV4T2YocFtpXSkgPCAwICYmIE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChzLCBwW2ldKSlcclxuICAgICAgICAgICAgICAgIHRbcFtpXV0gPSBzW3BbaV1dO1xyXG4gICAgICAgIH1cclxuICAgIHJldHVybiB0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYykge1xyXG4gICAgdmFyIGMgPSBhcmd1bWVudHMubGVuZ3RoLCByID0gYyA8IDMgPyB0YXJnZXQgOiBkZXNjID09PSBudWxsID8gZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBrZXkpIDogZGVzYywgZDtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5kZWNvcmF0ZSA9PT0gXCJmdW5jdGlvblwiKSByID0gUmVmbGVjdC5kZWNvcmF0ZShkZWNvcmF0b3JzLCB0YXJnZXQsIGtleSwgZGVzYyk7XHJcbiAgICBlbHNlIGZvciAodmFyIGkgPSBkZWNvcmF0b3JzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSBpZiAoZCA9IGRlY29yYXRvcnNbaV0pIHIgPSAoYyA8IDMgPyBkKHIpIDogYyA+IDMgPyBkKHRhcmdldCwga2V5LCByKSA6IGQodGFyZ2V0LCBrZXkpKSB8fCByO1xyXG4gICAgcmV0dXJuIGMgPiAzICYmIHIgJiYgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwga2V5LCByKSwgcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcGFyYW0ocGFyYW1JbmRleCwgZGVjb3JhdG9yKSB7XHJcbiAgICByZXR1cm4gZnVuY3Rpb24gKHRhcmdldCwga2V5KSB7IGRlY29yYXRvcih0YXJnZXQsIGtleSwgcGFyYW1JbmRleCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWV0YWRhdGEobWV0YWRhdGFLZXksIG1ldGFkYXRhVmFsdWUpIHtcclxuICAgIGlmICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgUmVmbGVjdC5tZXRhZGF0YSA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4gUmVmbGVjdC5tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2F3YWl0ZXIodGhpc0FyZywgX2FyZ3VtZW50cywgUCwgZ2VuZXJhdG9yKSB7XHJcbiAgICBmdW5jdGlvbiBhZG9wdCh2YWx1ZSkgeyByZXR1cm4gdmFsdWUgaW5zdGFuY2VvZiBQID8gdmFsdWUgOiBuZXcgUChmdW5jdGlvbiAocmVzb2x2ZSkgeyByZXNvbHZlKHZhbHVlKTsgfSk7IH1cclxuICAgIHJldHVybiBuZXcgKFAgfHwgKFAgPSBQcm9taXNlKSkoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xyXG4gICAgICAgIGZ1bmN0aW9uIGZ1bGZpbGxlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvci5uZXh0KHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiByZWplY3RlZCh2YWx1ZSkgeyB0cnkgeyBzdGVwKGdlbmVyYXRvcltcInRocm93XCJdKHZhbHVlKSk7IH0gY2F0Y2ggKGUpIHsgcmVqZWN0KGUpOyB9IH1cclxuICAgICAgICBmdW5jdGlvbiBzdGVwKHJlc3VsdCkgeyByZXN1bHQuZG9uZSA/IHJlc29sdmUocmVzdWx0LnZhbHVlKSA6IGFkb3B0KHJlc3VsdC52YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkKTsgfVxyXG4gICAgICAgIHN0ZXAoKGdlbmVyYXRvciA9IGdlbmVyYXRvci5hcHBseSh0aGlzQXJnLCBfYXJndW1lbnRzIHx8IFtdKSkubmV4dCgpKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19nZW5lcmF0b3IodGhpc0FyZywgYm9keSkge1xyXG4gICAgdmFyIF8gPSB7IGxhYmVsOiAwLCBzZW50OiBmdW5jdGlvbigpIHsgaWYgKHRbMF0gJiAxKSB0aHJvdyB0WzFdOyByZXR1cm4gdFsxXTsgfSwgdHJ5czogW10sIG9wczogW10gfSwgZiwgeSwgdCwgZztcclxuICAgIHJldHVybiBnID0geyBuZXh0OiB2ZXJiKDApLCBcInRocm93XCI6IHZlcmIoMSksIFwicmV0dXJuXCI6IHZlcmIoMikgfSwgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIChnW1N5bWJvbC5pdGVyYXRvcl0gPSBmdW5jdGlvbigpIHsgcmV0dXJuIHRoaXM7IH0pLCBnO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IHJldHVybiBmdW5jdGlvbiAodikgeyByZXR1cm4gc3RlcChbbiwgdl0pOyB9OyB9XHJcbiAgICBmdW5jdGlvbiBzdGVwKG9wKSB7XHJcbiAgICAgICAgaWYgKGYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJHZW5lcmF0b3IgaXMgYWxyZWFkeSBleGVjdXRpbmcuXCIpO1xyXG4gICAgICAgIHdoaWxlIChfKSB0cnkge1xyXG4gICAgICAgICAgICBpZiAoZiA9IDEsIHkgJiYgKHQgPSBvcFswXSAmIDIgPyB5W1wicmV0dXJuXCJdIDogb3BbMF0gPyB5W1widGhyb3dcIl0gfHwgKCh0ID0geVtcInJldHVyblwiXSkgJiYgdC5jYWxsKHkpLCAwKSA6IHkubmV4dCkgJiYgISh0ID0gdC5jYWxsKHksIG9wWzFdKSkuZG9uZSkgcmV0dXJuIHQ7XHJcbiAgICAgICAgICAgIGlmICh5ID0gMCwgdCkgb3AgPSBbb3BbMF0gJiAyLCB0LnZhbHVlXTtcclxuICAgICAgICAgICAgc3dpdGNoIChvcFswXSkge1xyXG4gICAgICAgICAgICAgICAgY2FzZSAwOiBjYXNlIDE6IHQgPSBvcDsgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICBjYXNlIDQ6IF8ubGFiZWwrKzsgcmV0dXJuIHsgdmFsdWU6IG9wWzFdLCBkb25lOiBmYWxzZSB9O1xyXG4gICAgICAgICAgICAgICAgY2FzZSA1OiBfLmxhYmVsKys7IHkgPSBvcFsxXTsgb3AgPSBbMF07IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA3OiBvcCA9IF8ub3BzLnBvcCgpOyBfLnRyeXMucG9wKCk7IGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgICAgICBpZiAoISh0ID0gXy50cnlzLCB0ID0gdC5sZW5ndGggPiAwICYmIHRbdC5sZW5ndGggLSAxXSkgJiYgKG9wWzBdID09PSA2IHx8IG9wWzBdID09PSAyKSkgeyBfID0gMDsgY29udGludWU7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDMgJiYgKCF0IHx8IChvcFsxXSA+IHRbMF0gJiYgb3BbMV0gPCB0WzNdKSkpIHsgXy5sYWJlbCA9IG9wWzFdOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChvcFswXSA9PT0gNiAmJiBfLmxhYmVsIDwgdFsxXSkgeyBfLmxhYmVsID0gdFsxXTsgdCA9IG9wOyBicmVhazsgfVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0ICYmIF8ubGFiZWwgPCB0WzJdKSB7IF8ubGFiZWwgPSB0WzJdOyBfLm9wcy5wdXNoKG9wKTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodFsyXSkgXy5vcHMucG9wKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBvcCA9IGJvZHkuY2FsbCh0aGlzQXJnLCBfKTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7IG9wID0gWzYsIGVdOyB5ID0gMDsgfSBmaW5hbGx5IHsgZiA9IHQgPSAwOyB9XHJcbiAgICAgICAgaWYgKG9wWzBdICYgNSkgdGhyb3cgb3BbMV07IHJldHVybiB7IHZhbHVlOiBvcFswXSA/IG9wWzFdIDogdm9pZCAwLCBkb25lOiB0cnVlIH07XHJcbiAgICB9XHJcbn1cclxuXHJcbmV4cG9ydCB2YXIgX19jcmVhdGVCaW5kaW5nID0gT2JqZWN0LmNyZWF0ZSA/IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBrMiwgeyBlbnVtZXJhYmxlOiB0cnVlLCBnZXQ6IGZ1bmN0aW9uKCkgeyByZXR1cm4gbVtrXTsgfSB9KTtcclxufSkgOiAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICBvW2syXSA9IG1ba107XHJcbn0pO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXhwb3J0U3RhcihtLCBvKSB7XHJcbiAgICBmb3IgKHZhciBwIGluIG0pIGlmIChwICE9PSBcImRlZmF1bHRcIiAmJiAhT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG8sIHApKSBfX2NyZWF0ZUJpbmRpbmcobywgbSwgcCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3ZhbHVlcyhvKSB7XHJcbiAgICB2YXIgcyA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBTeW1ib2wuaXRlcmF0b3IsIG0gPSBzICYmIG9bc10sIGkgPSAwO1xyXG4gICAgaWYgKG0pIHJldHVybiBtLmNhbGwobyk7XHJcbiAgICBpZiAobyAmJiB0eXBlb2Ygby5sZW5ndGggPT09IFwibnVtYmVyXCIpIHJldHVybiB7XHJcbiAgICAgICAgbmV4dDogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBpZiAobyAmJiBpID49IG8ubGVuZ3RoKSBvID0gdm9pZCAwO1xyXG4gICAgICAgICAgICByZXR1cm4geyB2YWx1ZTogbyAmJiBvW2krK10sIGRvbmU6ICFvIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IocyA/IFwiT2JqZWN0IGlzIG5vdCBpdGVyYWJsZS5cIiA6IFwiU3ltYm9sLml0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVhZChvLCBuKSB7XHJcbiAgICB2YXIgbSA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvW1N5bWJvbC5pdGVyYXRvcl07XHJcbiAgICBpZiAoIW0pIHJldHVybiBvO1xyXG4gICAgdmFyIGkgPSBtLmNhbGwobyksIHIsIGFyID0gW10sIGU7XHJcbiAgICB0cnkge1xyXG4gICAgICAgIHdoaWxlICgobiA9PT0gdm9pZCAwIHx8IG4tLSA+IDApICYmICEociA9IGkubmV4dCgpKS5kb25lKSBhci5wdXNoKHIudmFsdWUpO1xyXG4gICAgfVxyXG4gICAgY2F0Y2ggKGVycm9yKSB7IGUgPSB7IGVycm9yOiBlcnJvciB9OyB9XHJcbiAgICBmaW5hbGx5IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBpZiAociAmJiAhci5kb25lICYmIChtID0gaVtcInJldHVyblwiXSkpIG0uY2FsbChpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgZmluYWxseSB7IGlmIChlKSB0aHJvdyBlLmVycm9yOyB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWQoKSB7XHJcbiAgICBmb3IgKHZhciBhciA9IFtdLCBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcclxuICAgICAgICBhciA9IGFyLmNvbmNhdChfX3JlYWQoYXJndW1lbnRzW2ldKSk7XHJcbiAgICByZXR1cm4gYXI7XHJcbn1cclxuXHJcbi8qKiBAZGVwcmVjYXRlZCAqL1xyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheXMoKSB7XHJcbiAgICBmb3IgKHZhciBzID0gMCwgaSA9IDAsIGlsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGlsOyBpKyspIHMgKz0gYXJndW1lbnRzW2ldLmxlbmd0aDtcclxuICAgIGZvciAodmFyIHIgPSBBcnJheShzKSwgayA9IDAsIGkgPSAwOyBpIDwgaWw7IGkrKylcclxuICAgICAgICBmb3IgKHZhciBhID0gYXJndW1lbnRzW2ldLCBqID0gMCwgamwgPSBhLmxlbmd0aDsgaiA8IGpsOyBqKyssIGsrKylcclxuICAgICAgICAgICAgcltrXSA9IGFbal07XHJcbiAgICByZXR1cm4gcjtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc3ByZWFkQXJyYXkodG8sIGZyb20pIHtcclxuICAgIGZvciAodmFyIGkgPSAwLCBpbCA9IGZyb20ubGVuZ3RoLCBqID0gdG8ubGVuZ3RoOyBpIDwgaWw7IGkrKywgaisrKVxyXG4gICAgICAgIHRvW2pdID0gZnJvbVtpXTtcclxuICAgIHJldHVybiB0bztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaWYgKGdbbl0pIGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBuID09PSBcInJldHVyblwiIH0gOiBmID8gZih2KSA6IHY7IH0gOiBmOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jVmFsdWVzKG8pIHtcclxuICAgIGlmICghU3ltYm9sLmFzeW5jSXRlcmF0b3IpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJTeW1ib2wuYXN5bmNJdGVyYXRvciBpcyBub3QgZGVmaW5lZC5cIik7XHJcbiAgICB2YXIgbSA9IG9bU3ltYm9sLmFzeW5jSXRlcmF0b3JdLCBpO1xyXG4gICAgcmV0dXJuIG0gPyBtLmNhbGwobykgOiAobyA9IHR5cGVvZiBfX3ZhbHVlcyA9PT0gXCJmdW5jdGlvblwiID8gX192YWx1ZXMobykgOiBvW1N5bWJvbC5pdGVyYXRvcl0oKSwgaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGkpO1xyXG4gICAgZnVuY3Rpb24gdmVyYihuKSB7IGlbbl0gPSBvW25dICYmIGZ1bmN0aW9uICh2KSB7IHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7IHYgPSBvW25dKHYpLCBzZXR0bGUocmVzb2x2ZSwgcmVqZWN0LCB2LmRvbmUsIHYudmFsdWUpOyB9KTsgfTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgZCwgdikgeyBQcm9taXNlLnJlc29sdmUodikudGhlbihmdW5jdGlvbih2KSB7IHJlc29sdmUoeyB2YWx1ZTogdiwgZG9uZTogZCB9KTsgfSwgcmVqZWN0KTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tYWtlVGVtcGxhdGVPYmplY3QoY29va2VkLCByYXcpIHtcclxuICAgIGlmIChPYmplY3QuZGVmaW5lUHJvcGVydHkpIHsgT2JqZWN0LmRlZmluZVByb3BlcnR5KGNvb2tlZCwgXCJyYXdcIiwgeyB2YWx1ZTogcmF3IH0pOyB9IGVsc2UgeyBjb29rZWQucmF3ID0gcmF3OyB9XHJcbiAgICByZXR1cm4gY29va2VkO1xyXG59O1xyXG5cclxudmFyIF9fc2V0TW9kdWxlRGVmYXVsdCA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgdikge1xyXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG8sIFwiZGVmYXVsdFwiLCB7IGVudW1lcmFibGU6IHRydWUsIHZhbHVlOiB2IH0pO1xyXG59KSA6IGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIG9bXCJkZWZhdWx0XCJdID0gdjtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydFN0YXIobW9kKSB7XHJcbiAgICBpZiAobW9kICYmIG1vZC5fX2VzTW9kdWxlKSByZXR1cm4gbW9kO1xyXG4gICAgdmFyIHJlc3VsdCA9IHt9O1xyXG4gICAgaWYgKG1vZCAhPSBudWxsKSBmb3IgKHZhciBrIGluIG1vZCkgaWYgKGsgIT09IFwiZGVmYXVsdFwiICYmIE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtb2QsIGspKSBfX2NyZWF0ZUJpbmRpbmcocmVzdWx0LCBtb2QsIGspO1xyXG4gICAgX19zZXRNb2R1bGVEZWZhdWx0KHJlc3VsdCwgbW9kKTtcclxuICAgIHJldHVybiByZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2ltcG9ydERlZmF1bHQobW9kKSB7XHJcbiAgICByZXR1cm4gKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgPyBtb2QgOiB7IGRlZmF1bHQ6IG1vZCB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19jbGFzc1ByaXZhdGVGaWVsZEdldChyZWNlaXZlciwgcHJpdmF0ZU1hcCkge1xyXG4gICAgaWYgKCFwcml2YXRlTWFwLmhhcyhyZWNlaXZlcikpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXR0ZW1wdGVkIHRvIGdldCBwcml2YXRlIGZpZWxkIG9uIG5vbi1pbnN0YW5jZVwiKTtcclxuICAgIH1cclxuICAgIHJldHVybiBwcml2YXRlTWFwLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBwcml2YXRlTWFwLCB2YWx1ZSkge1xyXG4gICAgaWYgKCFwcml2YXRlTWFwLmhhcyhyZWNlaXZlcikpIHtcclxuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiYXR0ZW1wdGVkIHRvIHNldCBwcml2YXRlIGZpZWxkIG9uIG5vbi1pbnN0YW5jZVwiKTtcclxuICAgIH1cclxuICAgIHByaXZhdGVNYXAuc2V0KHJlY2VpdmVyLCB2YWx1ZSk7XHJcbiAgICByZXR1cm4gdmFsdWU7XHJcbn1cclxuIiwiLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcblxyXG4vKipcclxuICogU3BlY2lmaWVycyBvZiBkZWJ1ZyBtb2RlIG9mIHtAbGluayBNVG9vbk1hdGVyaWFsfS5cclxuICpcclxuICogU2VlOiB7QGxpbmsgTVRvb25NYXRlcmlhbC5kZWJ1Z01vZGV9XHJcbiAqL1xyXG5leHBvcnQgY29uc3QgTVRvb25NYXRlcmlhbERlYnVnTW9kZSA9IHtcclxuICAvKipcclxuICAgKiBSZW5kZXIgbm9ybWFsbHkuXHJcbiAgICovXHJcbiAgTm9uZTogJ25vbmUnLFxyXG5cclxuICAvKipcclxuICAgKiBWaXN1YWxpemUgbm9ybWFscyBvZiB0aGUgc3VyZmFjZS5cclxuICAgKi9cclxuICBOb3JtYWw6ICdub3JtYWwnLFxyXG5cclxuICAvKipcclxuICAgKiBWaXN1YWxpemUgbGl0L3NoYWRlIG9mIHRoZSBzdXJmYWNlLlxyXG4gICAqL1xyXG4gIExpdFNoYWRlUmF0ZTogJ2xpdFNoYWRlUmF0ZScsXHJcblxyXG4gIC8qKlxyXG4gICAqIFZpc3VhbGl6ZSBVViBvZiB0aGUgc3VyZmFjZS5cclxuICAgKi9cclxuICBVVjogJ3V2JyxcclxufSBhcyBjb25zdDtcclxuXHJcbmV4cG9ydCB0eXBlIE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUgPSB0eXBlb2YgTVRvb25NYXRlcmlhbERlYnVnTW9kZVtrZXlvZiB0eXBlb2YgTVRvb25NYXRlcmlhbERlYnVnTW9kZV07XHJcbiIsIi8qIGVzbGludC1kaXNhYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xyXG5cclxuZXhwb3J0IGNvbnN0IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlID0ge1xyXG4gIE5vbmU6ICdub25lJyxcclxuICBXb3JsZENvb3JkaW5hdGVzOiAnd29ybGRDb29yZGluYXRlcycsXHJcbiAgU2NyZWVuQ29vcmRpbmF0ZXM6ICdzY3JlZW5Db29yZGluYXRlcycsXHJcbn0gYXMgY29uc3Q7XHJcblxyXG5leHBvcnQgdHlwZSBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSA9IHR5cGVvZiBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZVtrZXlvZiB0eXBlb2YgTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGVdO1xyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcblxyXG4vLyBTaW5jZSB0aGVzZSBjb25zdGFudHMgYXJlIGRlbGV0ZWQgaW4gcjEzNiB3ZSBoYXZlIHRvIGRlZmluZSBieSBvdXJzZWx2ZXNcclxuLyogZXNsaW50LWRpc2FibGUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uICovXHJcbmNvbnN0IFJHQkVFbmNvZGluZyA9IDMwMDI7XHJcbmNvbnN0IFJHQk03RW5jb2RpbmcgPSAzMDA0O1xyXG5jb25zdCBSR0JNMTZFbmNvZGluZyA9IDMwMDU7XHJcbmNvbnN0IFJHQkRFbmNvZGluZyA9IDMwMDY7XHJcbmNvbnN0IEdhbW1hRW5jb2RpbmcgPSAzMDA3O1xyXG4vKiBlc2xpbnQtZW5hYmxlIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvbiAqL1xyXG5cclxuLyoqXHJcbiAqIENPTVBBVDogcHJlLXIxMzdcclxuICpcclxuICogUmVmOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2Jsb2IvcjEzNi9zcmMvcmVuZGVyZXJzL3dlYmdsL1dlYkdMUHJvZ3JhbS5qcyNMMjJcclxuICovXHJcbmV4cG9ydCBjb25zdCBnZXRFbmNvZGluZ0NvbXBvbmVudHMgPSAoZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZyk6IFtzdHJpbmcsIHN0cmluZ10gPT4ge1xyXG4gIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApID49IDEzNikge1xyXG4gICAgc3dpdGNoIChlbmNvZGluZykge1xyXG4gICAgICBjYXNlIFRIUkVFLkxpbmVhckVuY29kaW5nOlxyXG4gICAgICAgIHJldHVybiBbJ0xpbmVhcicsICcoIHZhbHVlICknXTtcclxuICAgICAgY2FzZSBUSFJFRS5zUkdCRW5jb2Rpbmc6XHJcbiAgICAgICAgcmV0dXJuIFsnc1JHQicsICcoIHZhbHVlICknXTtcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICBjb25zb2xlLndhcm4oJ1RIUkVFLldlYkdMUHJvZ3JhbTogVW5zdXBwb3J0ZWQgZW5jb2Rpbmc6JywgZW5jb2RpbmcpO1xyXG4gICAgICAgIHJldHVybiBbJ0xpbmVhcicsICcoIHZhbHVlICknXTtcclxuICAgIH1cclxuICB9IGVsc2Uge1xyXG4gICAgLy8gQ09NUEFUOiBwcmUtcjEzNlxyXG4gICAgc3dpdGNoIChlbmNvZGluZykge1xyXG4gICAgICBjYXNlIFRIUkVFLkxpbmVhckVuY29kaW5nOlxyXG4gICAgICAgIHJldHVybiBbJ0xpbmVhcicsICcoIHZhbHVlICknXTtcclxuICAgICAgY2FzZSBUSFJFRS5zUkdCRW5jb2Rpbmc6XHJcbiAgICAgICAgcmV0dXJuIFsnc1JHQicsICcoIHZhbHVlICknXTtcclxuICAgICAgY2FzZSBSR0JFRW5jb2Rpbmc6XHJcbiAgICAgICAgcmV0dXJuIFsnUkdCRScsICcoIHZhbHVlICknXTtcclxuICAgICAgY2FzZSBSR0JNN0VuY29kaW5nOlxyXG4gICAgICAgIHJldHVybiBbJ1JHQk0nLCAnKCB2YWx1ZSwgNy4wICknXTtcclxuICAgICAgY2FzZSBSR0JNMTZFbmNvZGluZzpcclxuICAgICAgICByZXR1cm4gWydSR0JNJywgJyggdmFsdWUsIDE2LjAgKSddO1xyXG4gICAgICBjYXNlIFJHQkRFbmNvZGluZzpcclxuICAgICAgICByZXR1cm4gWydSR0JEJywgJyggdmFsdWUsIDI1Ni4wICknXTtcclxuICAgICAgY2FzZSBHYW1tYUVuY29kaW5nOlxyXG4gICAgICAgIHJldHVybiBbJ0dhbW1hJywgJyggdmFsdWUsIGZsb2F0KCBHQU1NQV9GQUNUT1IgKSApJ107XHJcbiAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCd1bnN1cHBvcnRlZCBlbmNvZGluZzogJyArIGVuY29kaW5nKTtcclxuICAgIH1cclxuICB9XHJcbn07XHJcblxyXG4vKipcclxuICogQ09NUEFUOiBwcmUtcjEzN1xyXG4gKlxyXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIG5vIGxvbmdlciByZXF1aXJlZCBiZWdpbm5pbmcgZnJvbSByMTM3XHJcbiAqXHJcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9yMTM2L3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtLmpzI0w1MlxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbiA9IChmdW5jdGlvbk5hbWU6IHN0cmluZywgZW5jb2Rpbmc6IFRIUkVFLlRleHR1cmVFbmNvZGluZyk6IHN0cmluZyA9PiB7XHJcbiAgY29uc3QgY29tcG9uZW50cyA9IGdldEVuY29kaW5nQ29tcG9uZW50cyhlbmNvZGluZyk7XHJcbiAgcmV0dXJuICd2ZWM0ICcgKyBmdW5jdGlvbk5hbWUgKyAnKCB2ZWM0IHZhbHVlICkgeyByZXR1cm4gJyArIGNvbXBvbmVudHNbMF0gKyAnVG9MaW5lYXInICsgY29tcG9uZW50c1sxXSArICc7IH0nO1xyXG59O1xyXG4iLCJpbXBvcnQgKiBhcyBUSFJFRSBmcm9tICd0aHJlZSc7XHJcblxyXG4vKipcclxuICogQ09NUEFUOiBwcmUtcjEzN1xyXG4gKlxyXG4gKiBUaGlzIGZ1bmN0aW9uIGlzIG5vIGxvbmdlciByZXF1aXJlZCBiZWdpbm5pbmcgZnJvbSByMTM3XHJcbiAqXHJcbiAqIFJldHJpZXZlZCBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi84OGI2MzI4OTk4ZDE1NWZhMGE3YzFmMWU1ZTNiZDZiZmY3NTI2OGMwL3NyYy9yZW5kZXJlcnMvd2ViZ2wvV2ViR0xQcm9ncmFtcy5qcyNMOTJcclxuICpcclxuICogRGlmZjpcclxuICogICAtIFJlbW92ZSBXZWJHTFJlbmRlclRhcmdldCBoYW5kbGVyIGJlY2F1c2UgaXQgaW5jcmVhc2VzIGNvZGUgY29tcGxleGl0aWVzIG9uIFR5cGVTY3JpcHRcclxuICogICAtIEFkZCBhIGJvb2xlYW4gYGlzV2ViR0wyYCBhcyBhIHNlY29uZCBhcmd1bWVudC5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBnZXRUZXh0dXJlRW5jb2RpbmdGcm9tTWFwKG1hcDogVEhSRUUuVGV4dHVyZSwgaXNXZWJHTDI6IGJvb2xlYW4pOiBUSFJFRS5UZXh0dXJlRW5jb2Rpbmcge1xyXG4gIGxldCBlbmNvZGluZztcclxuXHJcbiAgaWYgKG1hcCAmJiBtYXAuaXNUZXh0dXJlKSB7XHJcbiAgICBlbmNvZGluZyA9IG1hcC5lbmNvZGluZztcclxuICAgIC8vIH0gZWxzZSBpZiAoIG1hcCAmJiBtYXAuaXNXZWJHTFJlbmRlclRhcmdldCApIHtcclxuICAgIC8vICAgY29uc29sZS53YXJuKCAnVEhSRUUuV2ViR0xQcm9ncmFtcy5nZXRUZXh0dXJlRW5jb2RpbmdGcm9tTWFwOiBkb25cXCd0IHVzZSByZW5kZXIgdGFyZ2V0cyBhcyB0ZXh0dXJlcy4gVXNlIHRoZWlyIC50ZXh0dXJlIHByb3BlcnR5IGluc3RlYWQuJyApO1xyXG4gICAgLy8gICBlbmNvZGluZyA9IG1hcC50ZXh0dXJlLmVuY29kaW5nO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBlbmNvZGluZyA9IFRIUkVFLkxpbmVhckVuY29kaW5nO1xyXG4gIH1cclxuXHJcbiAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPj0gMTMzKSB7XHJcbiAgICBpZiAoXHJcbiAgICAgIGlzV2ViR0wyICYmXHJcbiAgICAgIG1hcCAmJlxyXG4gICAgICBtYXAuaXNUZXh0dXJlICYmXHJcbiAgICAgIG1hcC5mb3JtYXQgPT09IFRIUkVFLlJHQkFGb3JtYXQgJiZcclxuICAgICAgbWFwLnR5cGUgPT09IFRIUkVFLlVuc2lnbmVkQnl0ZVR5cGUgJiZcclxuICAgICAgbWFwLmVuY29kaW5nID09PSBUSFJFRS5zUkdCRW5jb2RpbmdcclxuICAgICkge1xyXG4gICAgICBlbmNvZGluZyA9IFRIUkVFLkxpbmVhckVuY29kaW5nOyAvLyBkaXNhYmxlIGlubGluZSBkZWNvZGUgZm9yIHNSR0IgdGV4dHVyZXMgaW4gV2ViR0wgMlxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGVuY29kaW5nO1xyXG59XHJcbiIsIi8qIHRzbGludDpkaXNhYmxlOm1lbWJlci1vcmRlcmluZyAqL1xyXG5cclxuaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgdmVydGV4U2hhZGVyIGZyb20gJy4vc2hhZGVycy9tdG9vbi52ZXJ0JztcclxuaW1wb3J0IGZyYWdtZW50U2hhZGVyIGZyb20gJy4vc2hhZGVycy9tdG9vbi5mcmFnJztcclxuaW1wb3J0IHsgTVRvb25NYXRlcmlhbERlYnVnTW9kZSB9IGZyb20gJy4vTVRvb25NYXRlcmlhbERlYnVnTW9kZSc7XHJcbmltcG9ydCB7IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIH0gZnJvbSAnLi9NVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSc7XHJcbmltcG9ydCB0eXBlIHsgTVRvb25NYXRlcmlhbFBhcmFtZXRlcnMgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzJztcclxuaW1wb3J0IHsgZ2V0VGV4ZWxEZWNvZGluZ0Z1bmN0aW9uIH0gZnJvbSAnLi91dGlscy9nZXRUZXhlbERlY29kaW5nRnVuY3Rpb24nO1xyXG5pbXBvcnQgeyBnZXRUZXh0dXJlRW5jb2RpbmdGcm9tTWFwIH0gZnJvbSAnLi91dGlscy9nZXRUZXh0dXJlRW5jb2RpbmdGcm9tTWFwJztcclxuXHJcbi8qKlxyXG4gKiBNVG9vbiBpcyBhIG1hdGVyaWFsIHNwZWNpZmljYXRpb24gdGhhdCBoYXMgdmFyaW91cyBmZWF0dXJlcy5cclxuICogVGhlIHNwZWMgYW5kIGltcGxlbWVudGF0aW9uIGFyZSBvcmlnaW5hbGx5IGZvdW5kZWQgZm9yIFVuaXR5IGVuZ2luZSBhbmQgdGhpcyBpcyBhIHBvcnQgb2YgdGhlIG1hdGVyaWFsLlxyXG4gKlxyXG4gKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9TYW50YXJoL01Ub29uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgTVRvb25NYXRlcmlhbCBleHRlbmRzIFRIUkVFLlNoYWRlck1hdGVyaWFsIHtcclxuICBwdWJsaWMgdW5pZm9ybXM6IHtcclxuICAgIGxpdEZhY3RvcjogVEhSRUUuSVVuaWZvcm08VEhSRUUuQ29sb3I+O1xyXG4gICAgYWxwaGFUZXN0OiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgb3BhY2l0eTogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIG1hcDogVEhSRUUuSVVuaWZvcm08VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xyXG4gICAgbWFwVXZUcmFuc2Zvcm06IFRIUkVFLklVbmlmb3JtPFRIUkVFLk1hdHJpeDM+O1xyXG4gICAgbm9ybWFsTWFwOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XHJcbiAgICBub3JtYWxNYXBVdlRyYW5zZm9ybTogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz47XHJcbiAgICBub3JtYWxTY2FsZTogVEhSRUUuSVVuaWZvcm08VEhSRUUuVmVjdG9yMj47XHJcbiAgICBlbWlzc2l2ZTogVEhSRUUuSVVuaWZvcm08VEhSRUUuQ29sb3I+O1xyXG4gICAgZW1pc3NpdmVJbnRlbnNpdHk6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBlbWlzc2l2ZU1hcDogVEhSRUUuSVVuaWZvcm08VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xyXG4gICAgZW1pc3NpdmVNYXBVdlRyYW5zZm9ybTogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz47XHJcbiAgICBzaGFkZUNvbG9yRmFjdG9yOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5Db2xvcj47XHJcbiAgICBzaGFkZU11bHRpcGx5VGV4dHVyZTogVEhSRUUuSVVuaWZvcm08VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xyXG4gICAgc2hhZGVNdWx0aXBseVRleHR1cmVVdlRyYW5zZm9ybTogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz47XHJcbiAgICBzaGFkaW5nU2hpZnRGYWN0b3I6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBzaGFkaW5nU2hpZnRUZXh0dXJlOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD47XHJcbiAgICBzaGFkaW5nU2hpZnRUZXh0dXJlVXZUcmFuc2Zvcm06IFRIUkVFLklVbmlmb3JtPFRIUkVFLk1hdHJpeDM+O1xyXG4gICAgc2hhZGluZ1NoaWZ0VGV4dHVyZVNjYWxlOiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgc2hhZGluZ1Rvb255RmFjdG9yOiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgZ2lFcXVhbGl6YXRpb25GYWN0b3I6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBtYXRjYXBGYWN0b3I6IFRIUkVFLklVbmlmb3JtPFRIUkVFLkNvbG9yPjtcclxuICAgIG1hdGNhcFRleHR1cmU6IFRIUkVFLklVbmlmb3JtPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcclxuICAgIG1hdGNhcFRleHR1cmVVdlRyYW5zZm9ybTogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz47XHJcbiAgICBwYXJhbWV0cmljUmltQ29sb3JGYWN0b3I6IFRIUkVFLklVbmlmb3JtPFRIUkVFLkNvbG9yPjtcclxuICAgIHJpbU11bHRpcGx5VGV4dHVyZTogVEhSRUUuSVVuaWZvcm08VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xyXG4gICAgcmltTXVsdGlwbHlUZXh0dXJlVXZUcmFuc2Zvcm06IFRIUkVFLklVbmlmb3JtPFRIUkVFLk1hdHJpeDM+O1xyXG4gICAgcmltTGlnaHRpbmdNaXhGYWN0b3I6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBwYXJhbWV0cmljUmltRnJlc25lbFBvd2VyRmFjdG9yOiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgcGFyYW1ldHJpY1JpbUxpZnRGYWN0b3I6IFRIUkVFLklVbmlmb3JtPG51bWJlcj47XHJcbiAgICBvdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmU6IFRIUkVFLklVbmlmb3JtPFRIUkVFLlRleHR1cmUgfCBudWxsPjtcclxuICAgIG91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZVV2VHJhbnNmb3JtOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5NYXRyaXgzPjtcclxuICAgIG91dGxpbmVXaWR0aEZhY3RvcjogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIG91dGxpbmVDb2xvckZhY3RvcjogVEhSRUUuSVVuaWZvcm08VEhSRUUuQ29sb3I+O1xyXG4gICAgb3V0bGluZUxpZ2h0aW5nTWl4RmFjdG9yOiBUSFJFRS5JVW5pZm9ybTxudW1iZXI+O1xyXG4gICAgdXZBbmltYXRpb25NYXNrVGV4dHVyZTogVEhSRUUuSVVuaWZvcm08VEhSRUUuVGV4dHVyZSB8IG51bGw+O1xyXG4gICAgdXZBbmltYXRpb25NYXNrVGV4dHVyZVV2VHJhbnNmb3JtOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5NYXRyaXgzPjtcclxuICAgIHV2QW5pbWF0aW9uU2Nyb2xsWE9mZnNldDogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIHV2QW5pbWF0aW9uU2Nyb2xsWU9mZnNldDogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICAgIHV2QW5pbWF0aW9uUm90YXRpb25QaGFzZTogVEhSRUUuSVVuaWZvcm08bnVtYmVyPjtcclxuICB9O1xyXG5cclxuICBwdWJsaWMgZ2V0IGNvbG9yKCk6IFRIUkVFLkNvbG9yIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmxpdEZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBjb2xvcih2YWx1ZTogVEhSRUUuQ29sb3IpIHtcclxuICAgIHRoaXMudW5pZm9ybXMubGl0RmFjdG9yLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IG1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5tYXAudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgbWFwKHZhbHVlOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCkge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5tYXAudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgbm9ybWFsTWFwKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm5vcm1hbE1hcC52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBub3JtYWxNYXAodmFsdWU6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm5vcm1hbE1hcC52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBub3JtYWxTY2FsZSgpOiBUSFJFRS5WZWN0b3IyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm5vcm1hbFNjYWxlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IG5vcm1hbFNjYWxlKHZhbHVlOiBUSFJFRS5WZWN0b3IyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm5vcm1hbFNjYWxlLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IGVtaXNzaXZlKCk6IFRIUkVFLkNvbG9yIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLmVtaXNzaXZlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IGVtaXNzaXZlKHZhbHVlOiBUSFJFRS5Db2xvcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBlbWlzc2l2ZUludGVuc2l0eSgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuZW1pc3NpdmVJbnRlbnNpdHkudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgZW1pc3NpdmVJbnRlbnNpdHkodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZUludGVuc2l0eS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBlbWlzc2l2ZU1hcCgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5lbWlzc2l2ZU1hcC52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBlbWlzc2l2ZU1hcCh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMuZW1pc3NpdmVNYXAudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgc2hhZGVDb2xvckZhY3RvcigpOiBUSFJFRS5Db2xvciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5zaGFkZUNvbG9yRmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHNoYWRlQ29sb3JGYWN0b3IodmFsdWU6IFRIUkVFLkNvbG9yKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlQ29sb3JGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgc2hhZGVNdWx0aXBseVRleHR1cmUoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuc2hhZGVNdWx0aXBseVRleHR1cmUudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgc2hhZGVNdWx0aXBseVRleHR1cmUodmFsdWU6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRlTXVsdGlwbHlUZXh0dXJlLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHNoYWRpbmdTaGlmdEZhY3RvcigpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMuc2hhZGluZ1NoaWZ0RmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHNoYWRpbmdTaGlmdEZhY3Rvcih2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnNoYWRpbmdTaGlmdEZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzaGFkaW5nU2hpZnRUZXh0dXJlKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnNoYWRpbmdTaGlmdFRleHR1cmUudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgc2hhZGluZ1NoaWZ0VGV4dHVyZSh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMuc2hhZGluZ1NoaWZ0VGV4dHVyZS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBzaGFkaW5nU2hpZnRUZXh0dXJlU2NhbGUoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnNoYWRpbmdTaGlmdFRleHR1cmVTY2FsZS52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBzaGFkaW5nU2hpZnRUZXh0dXJlU2NhbGUodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5zaGFkaW5nU2hpZnRUZXh0dXJlU2NhbGUudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgc2hhZGluZ1Rvb255RmFjdG9yKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5zaGFkaW5nVG9vbnlGYWN0b3IudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgc2hhZGluZ1Rvb255RmFjdG9yKHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMuc2hhZGluZ1Rvb255RmFjdG9yLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IGdpRXF1YWxpemF0aW9uRmFjdG9yKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5naUVxdWFsaXphdGlvbkZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBnaUVxdWFsaXphdGlvbkZhY3Rvcih2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLmdpRXF1YWxpemF0aW9uRmFjdG9yLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IG1hdGNhcEZhY3RvcigpOiBUSFJFRS5Db2xvciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5tYXRjYXBGYWN0b3IudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgbWF0Y2FwRmFjdG9yKHZhbHVlOiBUSFJFRS5Db2xvcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5tYXRjYXBGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgbWF0Y2FwVGV4dHVyZSgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5tYXRjYXBUZXh0dXJlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IG1hdGNhcFRleHR1cmUodmFsdWU6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm1hdGNhcFRleHR1cmUudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgcGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yKCk6IFRIUkVFLkNvbG9yIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnBhcmFtZXRyaWNSaW1Db2xvckZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBwYXJhbWV0cmljUmltQ29sb3JGYWN0b3IodmFsdWU6IFRIUkVFLkNvbG9yKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnBhcmFtZXRyaWNSaW1Db2xvckZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCByaW1NdWx0aXBseVRleHR1cmUoKTogVEhSRUUuVGV4dHVyZSB8IG51bGwge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMucmltTXVsdGlwbHlUZXh0dXJlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHJpbU11bHRpcGx5VGV4dHVyZSh2YWx1ZTogVEhSRUUuVGV4dHVyZSB8IG51bGwpIHtcclxuICAgIHRoaXMudW5pZm9ybXMucmltTXVsdGlwbHlUZXh0dXJlLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHJpbUxpZ2h0aW5nTWl4RmFjdG9yKCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy5yaW1MaWdodGluZ01peEZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCByaW1MaWdodGluZ01peEZhY3Rvcih2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnJpbUxpZ2h0aW5nTWl4RmFjdG9yLnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHBhcmFtZXRyaWNSaW1GcmVzbmVsUG93ZXJGYWN0b3IoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnBhcmFtZXRyaWNSaW1GcmVzbmVsUG93ZXJGYWN0b3IudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgcGFyYW1ldHJpY1JpbUZyZXNuZWxQb3dlckZhY3Rvcih2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnBhcmFtZXRyaWNSaW1GcmVzbmVsUG93ZXJGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgcGFyYW1ldHJpY1JpbUxpZnRGYWN0b3IoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnBhcmFtZXRyaWNSaW1MaWZ0RmFjdG9yLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHBhcmFtZXRyaWNSaW1MaWZ0RmFjdG9yKHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMucGFyYW1ldHJpY1JpbUxpZnRGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgb3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlKCk6IFRIUkVFLlRleHR1cmUgfCBudWxsIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZS52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBvdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmUodmFsdWU6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZS52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBvdXRsaW5lV2lkdGhGYWN0b3IoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm91dGxpbmVXaWR0aEZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBvdXRsaW5lV2lkdGhGYWN0b3IodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGhGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgb3V0bGluZUNvbG9yRmFjdG9yKCk6IFRIUkVFLkNvbG9yIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvckZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBvdXRsaW5lQ29sb3JGYWN0b3IodmFsdWU6IFRIUkVFLkNvbG9yKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLm91dGxpbmVDb2xvckZhY3Rvci52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCBvdXRsaW5lTGlnaHRpbmdNaXhGYWN0b3IoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLm91dGxpbmVMaWdodGluZ01peEZhY3Rvci52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCBvdXRsaW5lTGlnaHRpbmdNaXhGYWN0b3IodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lTGlnaHRpbmdNaXhGYWN0b3IudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgdXZBbmltYXRpb25NYXNrVGV4dHVyZSgpOiBUSFJFRS5UZXh0dXJlIHwgbnVsbCB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvbk1hc2tUZXh0dXJlLnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHV2QW5pbWF0aW9uTWFza1RleHR1cmUodmFsdWU6IFRIUkVFLlRleHR1cmUgfCBudWxsKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbWF0aW9uTWFza1RleHR1cmUudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXQgdXZBbmltYXRpb25TY3JvbGxYT2Zmc2V0KCk6IG51bWJlciB7XHJcbiAgICByZXR1cm4gdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvblNjcm9sbFhPZmZzZXQudmFsdWU7XHJcbiAgfVxyXG4gIHB1YmxpYyBzZXQgdXZBbmltYXRpb25TY3JvbGxYT2Zmc2V0KHZhbHVlOiBudW1iZXIpIHtcclxuICAgIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25TY3JvbGxYT2Zmc2V0LnZhbHVlID0gdmFsdWU7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0IHV2QW5pbWF0aW9uU2Nyb2xsWU9mZnNldCgpOiBudW1iZXIge1xyXG4gICAgcmV0dXJuIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25TY3JvbGxZT2Zmc2V0LnZhbHVlO1xyXG4gIH1cclxuICBwdWJsaWMgc2V0IHV2QW5pbWF0aW9uU2Nyb2xsWU9mZnNldCh2YWx1ZTogbnVtYmVyKSB7XHJcbiAgICB0aGlzLnVuaWZvcm1zLnV2QW5pbWF0aW9uU2Nyb2xsWU9mZnNldC52YWx1ZSA9IHZhbHVlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldCB1dkFuaW1hdGlvblJvdGF0aW9uUGhhc2UoKTogbnVtYmVyIHtcclxuICAgIHJldHVybiB0aGlzLnVuaWZvcm1zLnV2QW5pbWF0aW9uUm90YXRpb25QaGFzZS52YWx1ZTtcclxuICB9XHJcbiAgcHVibGljIHNldCB1dkFuaW1hdGlvblJvdGF0aW9uUGhhc2UodmFsdWU6IG51bWJlcikge1xyXG4gICAgdGhpcy51bmlmb3Jtcy51dkFuaW1hdGlvblJvdGF0aW9uUGhhc2UudmFsdWUgPSB2YWx1ZTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyB1dkFuaW1hdGlvblNjcm9sbFhTcGVlZEZhY3RvciA9IDAuMDtcclxuICBwdWJsaWMgdXZBbmltYXRpb25TY3JvbGxZU3BlZWRGYWN0b3IgPSAwLjA7XHJcbiAgcHVibGljIHV2QW5pbWF0aW9uUm90YXRpb25TcGVlZEZhY3RvciA9IDAuMDtcclxuXHJcbiAgLyoqXHJcbiAgICogV2hldGhlciB0aGUgbWF0ZXJpYWwgaXMgYWZmZWN0ZWQgYnkgZm9nLlxyXG4gICAqIGB0cnVlYCBieSBkZWZhdWx0LlxyXG4gICAqL1xyXG4gIHB1YmxpYyBmb2cgPSB0cnVlO1xyXG5cclxuICAvKipcclxuICAgKiBXaWxsIGJlIHJlYWQgaW4gV2ViR0xQcm9ncmFtc1xyXG4gICAqXHJcbiAgICogU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2Jsb2IvNGY1MjM2YWMzZDZmNDFkOTA0YWE1ODQwMWI0MDU1NGU4ZmJkY2IxNS9zcmMvcmVuZGVyZXJzL3dlYmdsL1dlYkdMUHJvZ3JhbXMuanMjTDE5MC1MMTkxXHJcbiAgICovXHJcbiAgcHVibGljIG5vcm1hbE1hcFR5cGUgPSBUSFJFRS5UYW5nZW50U3BhY2VOb3JtYWxNYXA7XHJcblxyXG4gIC8qKlxyXG4gICAqIFdoZW4gdGhpcyBpcyBgdHJ1ZWAsIHZlcnRleCBjb2xvcnMgd2lsbCBiZSBpZ25vcmVkLlxyXG4gICAqIGB0cnVlYCBieSBkZWZhdWx0LlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2lnbm9yZVZlcnRleENvbG9yID0gdHJ1ZTtcclxuXHJcbiAgLyoqXHJcbiAgICogV2hlbiB0aGlzIGlzIGB0cnVlYCwgdmVydGV4IGNvbG9ycyB3aWxsIGJlIGlnbm9yZWQuXHJcbiAgICogYHRydWVgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgcHVibGljIGdldCBpZ25vcmVWZXJ0ZXhDb2xvcigpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLl9pZ25vcmVWZXJ0ZXhDb2xvcjtcclxuICB9XHJcbiAgcHVibGljIHNldCBpZ25vcmVWZXJ0ZXhDb2xvcih2YWx1ZTogYm9vbGVhbikge1xyXG4gICAgdGhpcy5faWdub3JlVmVydGV4Q29sb3IgPSB2YWx1ZTtcclxuXHJcbiAgICB0aGlzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3YwQ29tcGF0U2hhZGUgPSBmYWxzZTtcclxuXHJcbiAgLyoqXHJcbiAgICogVGhlcmUgaXMgYSBsaW5lIG9mIHRoZSBzaGFkZXIgY2FsbGVkIFwiY29tbWVudCBvdXQgaWYgeW91IHdhbnQgdG8gUEJSIGFic29sdXRlbHlcIiBpbiBWUk0wLjAgTVRvb24uXHJcbiAgICogV2hlbiB0aGlzIGlzIHRydWUsIHRoZSBtYXRlcmlhbCBlbmFibGVzIHRoZSBsaW5lIHRvIG1ha2UgaXQgY29tcGF0aWJsZSB3aXRoIHRoZSBsZWdhY3kgcmVuZGVyaW5nIG9mIFZSTS5cclxuICAgKiBVc3VhbGx5IG5vdCByZWNvbW1lbmRlZCB0byB0dXJuIHRoaXMgb24uXHJcbiAgICogYGZhbHNlYCBieSBkZWZhdWx0LlxyXG4gICAqL1xyXG4gIGdldCB2MENvbXBhdFNoYWRlKCk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIHRoaXMuX3YwQ29tcGF0U2hhZGU7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBUaGVyZSBpcyBhIGxpbmUgb2YgdGhlIHNoYWRlciBjYWxsZWQgXCJjb21tZW50IG91dCBpZiB5b3Ugd2FudCB0byBQQlIgYWJzb2x1dGVseVwiIGluIFZSTTAuMCBNVG9vbi5cclxuICAgKiBXaGVuIHRoaXMgaXMgdHJ1ZSwgdGhlIG1hdGVyaWFsIGVuYWJsZXMgdGhlIGxpbmUgdG8gbWFrZSBpdCBjb21wYXRpYmxlIHdpdGggdGhlIGxlZ2FjeSByZW5kZXJpbmcgb2YgVlJNLlxyXG4gICAqIFVzdWFsbHkgbm90IHJlY29tbWVuZGVkIHRvIHR1cm4gdGhpcyBvbi5cclxuICAgKiBgZmFsc2VgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgc2V0IHYwQ29tcGF0U2hhZGUodjogYm9vbGVhbikge1xyXG4gICAgdGhpcy5fdjBDb21wYXRTaGFkZSA9IHY7XHJcblxyXG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9kZWJ1Z01vZGU6IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUgPSBNVG9vbk1hdGVyaWFsRGVidWdNb2RlLk5vbmU7XHJcblxyXG4gIC8qKlxyXG4gICAqIERlYnVnIG1vZGUgZm9yIHRoZSBtYXRlcmlhbC5cclxuICAgKiBZb3UgY2FuIHZpc3VhbGl6ZSBzZXZlcmFsIGNvbXBvbmVudHMgZm9yIGRpYWdub3NpcyB1c2luZyBkZWJ1ZyBtb2RlLlxyXG4gICAqXHJcbiAgICogU2VlOiB7QGxpbmsgTVRvb25NYXRlcmlhbERlYnVnTW9kZX1cclxuICAgKi9cclxuICBnZXQgZGVidWdNb2RlKCk6IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUge1xyXG4gICAgcmV0dXJuIHRoaXMuX2RlYnVnTW9kZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlYnVnIG1vZGUgZm9yIHRoZSBtYXRlcmlhbC5cclxuICAgKiBZb3UgY2FuIHZpc3VhbGl6ZSBzZXZlcmFsIGNvbXBvbmVudHMgZm9yIGRpYWdub3NpcyB1c2luZyBkZWJ1ZyBtb2RlLlxyXG4gICAqXHJcbiAgICogU2VlOiB7QGxpbmsgTVRvb25NYXRlcmlhbERlYnVnTW9kZX1cclxuICAgKi9cclxuICBzZXQgZGVidWdNb2RlKG06IE1Ub29uTWF0ZXJpYWxEZWJ1Z01vZGUpIHtcclxuICAgIHRoaXMuX2RlYnVnTW9kZSA9IG07XHJcblxyXG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9vdXRsaW5lV2lkdGhNb2RlOiBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSA9IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLk5vbmU7XHJcblxyXG4gIGdldCBvdXRsaW5lV2lkdGhNb2RlKCk6IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlIHtcclxuICAgIHJldHVybiB0aGlzLl9vdXRsaW5lV2lkdGhNb2RlO1xyXG4gIH1cclxuICBzZXQgb3V0bGluZVdpZHRoTW9kZShtOiBNVG9vbk1hdGVyaWFsT3V0bGluZVdpZHRoTW9kZSkge1xyXG4gICAgdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9IG07XHJcblxyXG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9pc091dGxpbmUgPSBmYWxzZTtcclxuXHJcbiAgZ2V0IGlzT3V0bGluZSgpOiBib29sZWFuIHtcclxuICAgIHJldHVybiB0aGlzLl9pc091dGxpbmU7XHJcbiAgfVxyXG4gIHNldCBpc091dGxpbmUoYjogYm9vbGVhbikge1xyXG4gICAgdGhpcy5faXNPdXRsaW5lID0gYjtcclxuXHJcbiAgICB0aGlzLm5lZWRzVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJlYWRvbmx5IGJvb2xlYW4gdGhhdCBpbmRpY2F0ZXMgdGhpcyBpcyBhIFtbTVRvb25NYXRlcmlhbF1dLlxyXG4gICAqL1xyXG4gIHB1YmxpYyBnZXQgaXNNVG9vbk1hdGVyaWFsKCk6IHRydWUge1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICBjb25zdHJ1Y3RvcihwYXJhbWV0ZXJzOiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycyA9IHt9KSB7XHJcbiAgICBzdXBlcih7IHZlcnRleFNoYWRlciwgZnJhZ21lbnRTaGFkZXIgfSk7XHJcblxyXG4gICAgLy8gb3ZlcnJpZGUgZGVwdGhXcml0ZSB3aXRoIHRyYW5zcGFyZW50V2l0aFpXcml0ZVxyXG4gICAgaWYgKHBhcmFtZXRlcnMudHJhbnNwYXJlbnRXaXRoWldyaXRlKSB7XHJcbiAgICAgIHBhcmFtZXRlcnMuZGVwdGhXcml0ZSA9IHRydWU7XHJcbiAgICB9XHJcbiAgICBkZWxldGUgcGFyYW1ldGVycy50cmFuc3BhcmVudFdpdGhaV3JpdGU7XHJcblxyXG4gICAgLy8gPT0gZW5hYmxpbmcgYnVuY2ggb2Ygc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICBwYXJhbWV0ZXJzLmZvZyA9IHRydWU7XHJcbiAgICBwYXJhbWV0ZXJzLmxpZ2h0cyA9IHRydWU7XHJcbiAgICBwYXJhbWV0ZXJzLmNsaXBwaW5nID0gdHJ1ZTtcclxuXHJcbiAgICAvLyBDT01QQVQ6IHByZS1yMTI5XHJcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMTc4OFxyXG4gICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMjkpIHtcclxuICAgICAgKHBhcmFtZXRlcnMgYXMgYW55KS5za2lubmluZyA9IChwYXJhbWV0ZXJzIGFzIGFueSkuc2tpbm5pbmcgfHwgZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ09NUEFUOiBwcmUtcjEzMVxyXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL3B1bGwvMjIxNjlcclxuICAgIGlmIChwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApIDwgMTMxKSB7XHJcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhUYXJnZXRzID0gKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaFRhcmdldHMgfHwgZmFsc2U7XHJcbiAgICAgIChwYXJhbWV0ZXJzIGFzIGFueSkubW9ycGhOb3JtYWxzID0gKHBhcmFtZXRlcnMgYXMgYW55KS5tb3JwaE5vcm1hbHMgfHwgZmFsc2U7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gPT0gdW5pZm9ybXMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLnVuaWZvcm1zID0gVEhSRUUuVW5pZm9ybXNVdGlscy5tZXJnZShbXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmNvbW1vbiwgLy8gbWFwXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLm5vcm1hbG1hcCwgLy8gbm9ybWFsTWFwXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmVtaXNzaXZlbWFwLCAvLyBlbWlzc2l2ZU1hcFxyXG4gICAgICBUSFJFRS5Vbmlmb3Jtc0xpYi5mb2csXHJcbiAgICAgIFRIUkVFLlVuaWZvcm1zTGliLmxpZ2h0cyxcclxuICAgICAge1xyXG4gICAgICAgIGxpdEZhY3RvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDEuMCwgMS4wLCAxLjApIH0sXHJcbiAgICAgICAgbWFwVXZUcmFuc2Zvcm06IHsgdmFsdWU6IG5ldyBUSFJFRS5NYXRyaXgzKCkgfSxcclxuICAgICAgICBjb2xvckFscGhhOiB7IHZhbHVlOiAxLjAgfSxcclxuICAgICAgICBub3JtYWxNYXBVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIHNoYWRlQ29sb3JGYWN0b3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjk3LCAwLjgxLCAwLjg2KSB9LFxyXG4gICAgICAgIHNoYWRlTXVsdGlwbHlUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgc2hhZGVNdWx0aXBseVRleHR1cmVVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIHNoYWRpbmdTaGlmdEZhY3RvcjogeyB2YWx1ZTogMC4wIH0sXHJcbiAgICAgICAgc2hhZGluZ1NoaWZ0VGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIHNoYWRpbmdTaGlmdFRleHR1cmVVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIHNoYWRpbmdTaGlmdFRleHR1cmVTY2FsZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIHNoYWRpbmdUb29ueUZhY3RvcjogeyB2YWx1ZTogMC45IH0sXHJcbiAgICAgICAgZ2lFcXVhbGl6YXRpb25GYWN0b3I6IHsgdmFsdWU6IDAuOSB9LFxyXG4gICAgICAgIG1hdGNhcEZhY3RvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDEuMCwgMS4wLCAxLjApIH0sXHJcbiAgICAgICAgbWF0Y2FwVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIG1hdGNhcFRleHR1cmVVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIHBhcmFtZXRyaWNSaW1Db2xvckZhY3RvcjogeyB2YWx1ZTogbmV3IFRIUkVFLkNvbG9yKDAuMCwgMC4wLCAwLjApIH0sXHJcbiAgICAgICAgcmltTXVsdGlwbHlUZXh0dXJlOiB7IHZhbHVlOiBudWxsIH0sXHJcbiAgICAgICAgcmltTXVsdGlwbHlUZXh0dXJlVXZUcmFuc2Zvcm06IHsgdmFsdWU6IG5ldyBUSFJFRS5NYXRyaXgzKCkgfSxcclxuICAgICAgICByaW1MaWdodGluZ01peEZhY3RvcjogeyB2YWx1ZTogMC4wIH0sXHJcbiAgICAgICAgcGFyYW1ldHJpY1JpbUZyZXNuZWxQb3dlckZhY3RvcjogeyB2YWx1ZTogMS4wIH0sXHJcbiAgICAgICAgcGFyYW1ldHJpY1JpbUxpZnRGYWN0b3I6IHsgdmFsdWU6IDAuMCB9LFxyXG4gICAgICAgIGVtaXNzaXZlOiB7IHZhbHVlOiBuZXcgVEhSRUUuQ29sb3IoMC4wLCAwLjAsIDAuMCkgfSxcclxuICAgICAgICBlbWlzc2l2ZUludGVuc2l0eTogeyB2YWx1ZTogMS4wIH0sXHJcbiAgICAgICAgZW1pc3NpdmVNYXBVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIG91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIG91dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZVV2VHJhbnNmb3JtOiB7IHZhbHVlOiBuZXcgVEhSRUUuTWF0cml4MygpIH0sXHJcbiAgICAgICAgb3V0bGluZVdpZHRoRmFjdG9yOiB7IHZhbHVlOiAwLjUgfSxcclxuICAgICAgICBvdXRsaW5lQ29sb3JGYWN0b3I6IHsgdmFsdWU6IG5ldyBUSFJFRS5Db2xvcigwLjAsIDAuMCwgMC4wKSB9LFxyXG4gICAgICAgIG91dGxpbmVMaWdodGluZ01peEZhY3RvcjogeyB2YWx1ZTogMS4wIH0sXHJcbiAgICAgICAgdXZBbmltYXRpb25NYXNrVGV4dHVyZTogeyB2YWx1ZTogbnVsbCB9LFxyXG4gICAgICAgIHV2QW5pbWF0aW9uTWFza1RleHR1cmVVdlRyYW5zZm9ybTogeyB2YWx1ZTogbmV3IFRIUkVFLk1hdHJpeDMoKSB9LFxyXG4gICAgICAgIHV2QW5pbWF0aW9uU2Nyb2xsWE9mZnNldDogeyB2YWx1ZTogMC4wIH0sXHJcbiAgICAgICAgdXZBbmltYXRpb25TY3JvbGxZT2Zmc2V0OiB7IHZhbHVlOiAwLjAgfSxcclxuICAgICAgICB1dkFuaW1hdGlvblJvdGF0aW9uUGhhc2U6IHsgdmFsdWU6IDAuMCB9LFxyXG4gICAgICB9LFxyXG4gICAgICBwYXJhbWV0ZXJzLnVuaWZvcm1zLFxyXG4gICAgXSk7XHJcblxyXG4gICAgLy8gPT0gZmluYWxseSBjb21waWxlIHRoZSBzaGFkZXIgcHJvZ3JhbSA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLnNldFZhbHVlcyhwYXJhbWV0ZXJzKTtcclxuXHJcbiAgICAvLyA9PSB1cGxvYWQgdW5pZm9ybXMgdGhhdCBuZWVkIHRvIHVwbG9hZCA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cclxuICAgIHRoaXMuX3VwbG9hZFVuaWZvcm1zV29ya2Fyb3VuZCgpO1xyXG5cclxuICAgIC8vID09IHVwZGF0ZSBzaGFkZXIgc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgdGhpcy5jdXN0b21Qcm9ncmFtQ2FjaGVLZXkgPSAoKSA9PlxyXG4gICAgICBbXHJcbiAgICAgICAgdGhpcy5faWdub3JlVmVydGV4Q29sb3IgPyAnaWdub3JlVmVydGV4Q29sb3InIDogJycsXHJcbiAgICAgICAgdGhpcy5fdjBDb21wYXRTaGFkZSA/ICd2MENvbXBhdFNoYWRlJyA6ICcnLFxyXG4gICAgICAgIHRoaXMuX2RlYnVnTW9kZSAhPT0gJ25vbmUnID8gYGRlYnVnTW9kZToke3RoaXMuX2RlYnVnTW9kZX1gIDogJycsXHJcbiAgICAgICAgdGhpcy5fb3V0bGluZVdpZHRoTW9kZSAhPT0gJ25vbmUnID8gYG91dGxpbmVXaWR0aE1vZGU6JHt0aGlzLl9vdXRsaW5lV2lkdGhNb2RlfWAgOiAnJyxcclxuICAgICAgICB0aGlzLl9pc091dGxpbmUgPyAnaXNPdXRsaW5lJyA6ICcnLFxyXG4gICAgICAgIC4uLk9iamVjdC5lbnRyaWVzKHRoaXMuX2dlbmVyYXRlRGVmaW5lcygpKS5tYXAoKFt0b2tlbiwgbWFjcm9dKSA9PiBgJHt0b2tlbn06JHttYWNyb31gKSxcclxuICAgICAgICB0aGlzLm1hdGNhcFRleHR1cmUgPyBgbWF0Y2FwVGV4dHVyZUVuY29kaW5nOiR7dGhpcy5tYXRjYXBUZXh0dXJlLmVuY29kaW5nfWAgOiAnJyxcclxuICAgICAgICB0aGlzLnNoYWRlTXVsdGlwbHlUZXh0dXJlID8gYHNoYWRlTXVsdGlwbHlUZXh0dXJlRW5jb2Rpbmc6JHt0aGlzLnNoYWRlTXVsdGlwbHlUZXh0dXJlLmVuY29kaW5nfWAgOiAnJyxcclxuICAgICAgICB0aGlzLnJpbU11bHRpcGx5VGV4dHVyZSA/IGByaW1NdWx0aXBseVRleHR1cmVFbmNvZGluZzoke3RoaXMucmltTXVsdGlwbHlUZXh0dXJlLmVuY29kaW5nfWAgOiAnJyxcclxuICAgICAgXS5qb2luKCcsJyk7XHJcblxyXG4gICAgdGhpcy5vbkJlZm9yZUNvbXBpbGUgPSAoc2hhZGVyLCByZW5kZXJlcikgPT4ge1xyXG4gICAgICAvKipcclxuICAgICAgICogV2lsbCBiZSBuZWVkZWQgdG8gZGV0ZXJtaW5lIHdoZXRoZXIgd2Ugc2hvdWxkIGlubGluZSBjb252ZXJ0IHNSR0IgdGV4dHVyZXMgb3Igbm90LlxyXG4gICAgICAgKiBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvcHVsbC8yMjU1MVxyXG4gICAgICAgKi9cclxuICAgICAgY29uc3QgaXNXZWJHTDIgPSByZW5kZXJlci5jYXBhYmlsaXRpZXMuaXNXZWJHTDI7XHJcblxyXG4gICAgICBjb25zdCB0aHJlZVJldmlzaW9uID0gcGFyc2VJbnQoVEhSRUUuUkVWSVNJT04sIDEwKTtcclxuXHJcbiAgICAgIGNvbnN0IGRlZmluZXMgPVxyXG4gICAgICAgIE9iamVjdC5lbnRyaWVzKHsgLi4udGhpcy5fZ2VuZXJhdGVEZWZpbmVzKCksIC4uLnRoaXMuZGVmaW5lcyB9KVxyXG4gICAgICAgICAgLmZpbHRlcigoW3Rva2VuLCBtYWNyb10pID0+ICEhbWFjcm8pXHJcbiAgICAgICAgICAubWFwKChbdG9rZW4sIG1hY3JvXSkgPT4gYCNkZWZpbmUgJHt0b2tlbn0gJHttYWNyb31gKVxyXG4gICAgICAgICAgLmpvaW4oJ1xcbicpICsgJ1xcbic7XHJcblxyXG4gICAgICAvLyAtLSB0ZXh0dXJlIGVuY29kaW5ncyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXHJcbiAgICAgIC8vIENPTVBBVDogcHJlLXIxMzdcclxuICAgICAgbGV0IGVuY29kaW5ncyA9ICcnO1xyXG5cclxuICAgICAgaWYgKHBhcnNlSW50KFRIUkVFLlJFVklTSU9OLCAxMCkgPCAxMzcpIHtcclxuICAgICAgICBlbmNvZGluZ3MgPVxyXG4gICAgICAgICAgKHRoaXMubWF0Y2FwVGV4dHVyZSAhPT0gbnVsbFxyXG4gICAgICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbihcclxuICAgICAgICAgICAgICAgICdtYXRjYXBUZXh0dXJlVGV4ZWxUb0xpbmVhcicsXHJcbiAgICAgICAgICAgICAgICBnZXRUZXh0dXJlRW5jb2RpbmdGcm9tTWFwKHRoaXMubWF0Y2FwVGV4dHVyZSwgaXNXZWJHTDIpLFxyXG4gICAgICAgICAgICAgICkgKyAnXFxuJ1xyXG4gICAgICAgICAgICA6ICcnKSArXHJcbiAgICAgICAgICAodGhpcy5zaGFkZU11bHRpcGx5VGV4dHVyZSAhPT0gbnVsbFxyXG4gICAgICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbihcclxuICAgICAgICAgICAgICAgICdzaGFkZU11bHRpcGx5VGV4dHVyZVRleGVsVG9MaW5lYXInLFxyXG4gICAgICAgICAgICAgICAgZ2V0VGV4dHVyZUVuY29kaW5nRnJvbU1hcCh0aGlzLnNoYWRlTXVsdGlwbHlUZXh0dXJlLCBpc1dlYkdMMiksXHJcbiAgICAgICAgICAgICAgKSArICdcXG4nXHJcbiAgICAgICAgICAgIDogJycpICtcclxuICAgICAgICAgICh0aGlzLnJpbU11bHRpcGx5VGV4dHVyZSAhPT0gbnVsbFxyXG4gICAgICAgICAgICA/IGdldFRleGVsRGVjb2RpbmdGdW5jdGlvbihcclxuICAgICAgICAgICAgICAgICdyaW1NdWx0aXBseVRleHR1cmVUZXhlbFRvTGluZWFyJyxcclxuICAgICAgICAgICAgICAgIGdldFRleHR1cmVFbmNvZGluZ0Zyb21NYXAodGhpcy5yaW1NdWx0aXBseVRleHR1cmUsIGlzV2ViR0wyKSxcclxuICAgICAgICAgICAgICApICsgJ1xcbidcclxuICAgICAgICAgICAgOiAnJyk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIC8vIC0tIGdlbmVyYXRlIHNoYWRlciBjb2RlIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cclxuICAgICAgc2hhZGVyLnZlcnRleFNoYWRlciA9IGRlZmluZXMgKyBzaGFkZXIudmVydGV4U2hhZGVyO1xyXG4gICAgICBzaGFkZXIuZnJhZ21lbnRTaGFkZXIgPSBkZWZpbmVzICsgZW5jb2RpbmdzICsgc2hhZGVyLmZyYWdtZW50U2hhZGVyO1xyXG5cclxuICAgICAgLy8gLS0gY29tcGF0IC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxyXG5cclxuICAgICAgLy8gQ09NUEFUOiBwcmUtcjEzMlxyXG4gICAgICAvLyBUaHJlZS5qcyByMTMyIGludHJvZHVjZXMgbmV3IHNoYWRlciBjaHVua3MgPG5vcm1hbF9wYXJzX2ZyYWdtZW50PiBhbmQgPGFscGhhdGVzdF9wYXJzX2ZyYWdtZW50PlxyXG4gICAgICBpZiAodGhyZWVSZXZpc2lvbiA8IDEzMikge1xyXG4gICAgICAgIHNoYWRlci5mcmFnbWVudFNoYWRlciA9IHNoYWRlci5mcmFnbWVudFNoYWRlci5yZXBsYWNlKCcjaW5jbHVkZSA8bm9ybWFsX3BhcnNfZnJhZ21lbnQ+JywgJycpO1xyXG4gICAgICAgIHNoYWRlci5mcmFnbWVudFNoYWRlciA9IHNoYWRlci5mcmFnbWVudFNoYWRlci5yZXBsYWNlKCcjaW5jbHVkZSA8YWxwaGF0ZXN0X3BhcnNfZnJhZ21lbnQ+JywgJycpO1xyXG4gICAgICB9XHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBkYXRlIHRoaXMgbWF0ZXJpYWwuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gZGVsdGEgZGVsdGFUaW1lIHNpbmNlIGxhc3QgdXBkYXRlXHJcbiAgICovXHJcbiAgcHVibGljIHVwZGF0ZShkZWx0YTogbnVtYmVyKTogdm9pZCB7XHJcbiAgICB0aGlzLl91cGxvYWRVbmlmb3Jtc1dvcmthcm91bmQoKTtcclxuICAgIHRoaXMuX3VwZGF0ZVVWQW5pbWF0aW9uKGRlbHRhKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjb3B5KHNvdXJjZTogdGhpcyk6IHRoaXMge1xyXG4gICAgc3VwZXIuY29weShzb3VyY2UpO1xyXG4gICAgLy8gdW5pZm9ybXMgYXJlIGFscmVhZHkgY29waWVkIGF0IHRoaXMgbW9tZW50XHJcblxyXG4gICAgLy8gQmVnaW5uaW5nIGZyb20gcjEzMywgdW5pZm9ybSB0ZXh0dXJlcyB3aWxsIGJlIGNsb25lZCBpbnN0ZWFkIG9mIHJlZmVyZW5jZVxyXG4gICAgLy8gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2Jsb2IvYTg4MTNiZTA0YTg0OWJkMTU1ZjdjZjZmMWIyM2Q4ZWUyZTBmYjQ4Yi9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzI0wzMDQ3XHJcbiAgICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9tcmRvb2IvdGhyZWUuanMvYmxvYi9hODgxM2JlMDRhODQ5YmQxNTVmN2NmNmYxYjIzZDhlZTJlMGZiNDhiL3NyYy9yZW5kZXJlcnMvc2hhZGVycy9Vbmlmb3Jtc1V0aWxzLmpzI0wyMlxyXG4gICAgLy8gVGhpcyB3aWxsIGxlYXZlIHRoZWlyIGAudmVyc2lvbmAgdG8gYmUgYDBgXHJcbiAgICAvLyBhbmQgdGhlc2UgdGV4dHVyZXMgd29uJ3QgYmUgdXBsb2FkZWQgdG8gR1BVXHJcbiAgICAvLyBXZSBhcmUgZ29pbmcgdG8gd29ya2Fyb3VuZCB0aGlzIGluIGhlcmVcclxuICAgIC8vIEkndmUgb3BlbmVkIGFuIGlzc3VlIGZvciB0aGlzOiBodHRwczovL2dpdGh1Yi5jb20vbXJkb29iL3RocmVlLmpzL2lzc3Vlcy8yMjcxOFxyXG4gICAgdGhpcy5tYXAgPSBzb3VyY2UubWFwO1xyXG4gICAgdGhpcy5ub3JtYWxNYXAgPSBzb3VyY2Uubm9ybWFsTWFwO1xyXG4gICAgdGhpcy5lbWlzc2l2ZU1hcCA9IHNvdXJjZS5lbWlzc2l2ZU1hcDtcclxuICAgIHRoaXMuc2hhZGVNdWx0aXBseVRleHR1cmUgPSBzb3VyY2Uuc2hhZGVNdWx0aXBseVRleHR1cmU7XHJcbiAgICB0aGlzLnNoYWRpbmdTaGlmdFRleHR1cmUgPSBzb3VyY2Uuc2hhZGluZ1NoaWZ0VGV4dHVyZTtcclxuICAgIHRoaXMubWF0Y2FwVGV4dHVyZSA9IHNvdXJjZS5tYXRjYXBUZXh0dXJlO1xyXG4gICAgdGhpcy5yaW1NdWx0aXBseVRleHR1cmUgPSBzb3VyY2UucmltTXVsdGlwbHlUZXh0dXJlO1xyXG4gICAgdGhpcy5vdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmUgPSBzb3VyY2Uub3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlO1xyXG4gICAgdGhpcy51dkFuaW1hdGlvbk1hc2tUZXh0dXJlID0gc291cmNlLnV2QW5pbWF0aW9uTWFza1RleHR1cmU7XHJcblxyXG4gICAgLy8gPT0gY29weSBtZW1iZXJzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XHJcbiAgICB0aGlzLm5vcm1hbE1hcFR5cGUgPSBzb3VyY2Uubm9ybWFsTWFwVHlwZTtcclxuXHJcbiAgICB0aGlzLnV2QW5pbWF0aW9uU2Nyb2xsWFNwZWVkRmFjdG9yID0gc291cmNlLnV2QW5pbWF0aW9uU2Nyb2xsWFNwZWVkRmFjdG9yO1xyXG4gICAgdGhpcy51dkFuaW1hdGlvblNjcm9sbFlTcGVlZEZhY3RvciA9IHNvdXJjZS51dkFuaW1hdGlvblNjcm9sbFlTcGVlZEZhY3RvcjtcclxuICAgIHRoaXMudXZBbmltYXRpb25Sb3RhdGlvblNwZWVkRmFjdG9yID0gc291cmNlLnV2QW5pbWF0aW9uUm90YXRpb25TcGVlZEZhY3RvcjtcclxuXHJcbiAgICB0aGlzLmlnbm9yZVZlcnRleENvbG9yID0gc291cmNlLmlnbm9yZVZlcnRleENvbG9yO1xyXG5cclxuICAgIHRoaXMudjBDb21wYXRTaGFkZSA9IHNvdXJjZS52MENvbXBhdFNoYWRlO1xyXG4gICAgdGhpcy5kZWJ1Z01vZGUgPSBzb3VyY2UuZGVidWdNb2RlO1xyXG4gICAgdGhpcy5vdXRsaW5lV2lkdGhNb2RlID0gc291cmNlLm91dGxpbmVXaWR0aE1vZGU7XHJcblxyXG4gICAgdGhpcy5pc091dGxpbmUgPSBzb3VyY2UuaXNPdXRsaW5lO1xyXG5cclxuICAgIC8vID09IHVwZGF0ZSBzaGFkZXIgc3R1ZmYgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxyXG4gICAgdGhpcy5uZWVkc1VwZGF0ZSA9IHRydWU7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBVcGRhdGUgVVYgYW5pbWF0aW9uIHN0YXRlLlxyXG4gICAqIEludGVuZGVkIHRvIGJlIGNhbGxlZCB2aWEge0BsaW5rIHVwZGF0ZX0uXHJcbiAgICogQHBhcmFtIGRlbHRhIGRlbHRhVGltZVxyXG4gICAqL1xyXG4gIHByaXZhdGUgX3VwZGF0ZVVWQW5pbWF0aW9uKGRlbHRhOiBudW1iZXIpOiB2b2lkIHtcclxuICAgIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25TY3JvbGxYT2Zmc2V0LnZhbHVlICs9IGRlbHRhICogdGhpcy51dkFuaW1hdGlvblNjcm9sbFhTcGVlZEZhY3RvcjtcclxuICAgIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25TY3JvbGxZT2Zmc2V0LnZhbHVlICs9IGRlbHRhICogdGhpcy51dkFuaW1hdGlvblNjcm9sbFlTcGVlZEZhY3RvcjtcclxuICAgIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25Sb3RhdGlvblBoYXNlLnZhbHVlICs9IGRlbHRhICogdGhpcy51dkFuaW1hdGlvblJvdGF0aW9uU3BlZWRGYWN0b3I7XHJcblxyXG4gICAgdGhpcy51bmlmb3Jtc05lZWRVcGRhdGUgPSB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVXBsb2FkIHVuaWZvcm1zIHRoYXQgbmVlZCB0byB1cGxvYWQgYnV0IGRvZXNuJ3QgYXV0b21hdGljYWxseSBiZWNhdXNlIG9mIHJlYXNvbnMuXHJcbiAgICogSW50ZW5kZWQgdG8gYmUgY2FsbGVkIHZpYSB7QGxpbmsgY29uc3RydWN0b3J9IGFuZCB7QGxpbmsgdXBkYXRlfS5cclxuICAgKi9cclxuICBwcml2YXRlIF91cGxvYWRVbmlmb3Jtc1dvcmthcm91bmQoKTogdm9pZCB7XHJcbiAgICAvLyB3b3JrYXJvdW5kOiBzaW5jZSBvcGFjaXR5IGlzIGRlZmluZWQgYXMgYSBwcm9wZXJ0eSBpbiBUSFJFRS5NYXRlcmlhbFxyXG4gICAgLy8gYW5kIGNhbm5vdCBiZSBvdmVycmlkZGVuIGFzIGFuIGFjY2Vzc29yLFxyXG4gICAgLy8gV2UgYXJlIGdvaW5nIHRvIHVwZGF0ZSBvcGFjaXR5IGhlcmVcclxuICAgIHRoaXMudW5pZm9ybXMub3BhY2l0eS52YWx1ZSA9IHRoaXMub3BhY2l0eTtcclxuXHJcbiAgICAvLyB3b3JrYXJvdW5kOiB0ZXh0dXJlIHRyYW5zZm9ybXMgYXJlIG5vdCB1cGRhdGVkIGF1dG9tYXRpY2FsbHlcclxuICAgIHRoaXMuX3VwZGF0ZVRleHR1cmVNYXRyaXgodGhpcy51bmlmb3Jtcy5tYXAsIHRoaXMudW5pZm9ybXMubWFwVXZUcmFuc2Zvcm0pO1xyXG4gICAgdGhpcy5fdXBkYXRlVGV4dHVyZU1hdHJpeCh0aGlzLnVuaWZvcm1zLm5vcm1hbE1hcCwgdGhpcy51bmlmb3Jtcy5ub3JtYWxNYXBVdlRyYW5zZm9ybSk7XHJcbiAgICB0aGlzLl91cGRhdGVUZXh0dXJlTWF0cml4KHRoaXMudW5pZm9ybXMuZW1pc3NpdmVNYXAsIHRoaXMudW5pZm9ybXMuZW1pc3NpdmVNYXBVdlRyYW5zZm9ybSk7XHJcbiAgICB0aGlzLl91cGRhdGVUZXh0dXJlTWF0cml4KHRoaXMudW5pZm9ybXMuc2hhZGVNdWx0aXBseVRleHR1cmUsIHRoaXMudW5pZm9ybXMuc2hhZGVNdWx0aXBseVRleHR1cmVVdlRyYW5zZm9ybSk7XHJcbiAgICB0aGlzLl91cGRhdGVUZXh0dXJlTWF0cml4KHRoaXMudW5pZm9ybXMuc2hhZGluZ1NoaWZ0VGV4dHVyZSwgdGhpcy51bmlmb3Jtcy5zaGFkaW5nU2hpZnRUZXh0dXJlVXZUcmFuc2Zvcm0pO1xyXG4gICAgdGhpcy5fdXBkYXRlVGV4dHVyZU1hdHJpeCh0aGlzLnVuaWZvcm1zLm1hdGNhcFRleHR1cmUsIHRoaXMudW5pZm9ybXMubWF0Y2FwVGV4dHVyZVV2VHJhbnNmb3JtKTtcclxuICAgIHRoaXMuX3VwZGF0ZVRleHR1cmVNYXRyaXgodGhpcy51bmlmb3Jtcy5yaW1NdWx0aXBseVRleHR1cmUsIHRoaXMudW5pZm9ybXMucmltTXVsdGlwbHlUZXh0dXJlVXZUcmFuc2Zvcm0pO1xyXG4gICAgdGhpcy5fdXBkYXRlVGV4dHVyZU1hdHJpeChcclxuICAgICAgdGhpcy51bmlmb3Jtcy5vdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmUsXHJcbiAgICAgIHRoaXMudW5pZm9ybXMub3V0bGluZVdpZHRoTXVsdGlwbHlUZXh0dXJlVXZUcmFuc2Zvcm0sXHJcbiAgICApO1xyXG4gICAgdGhpcy5fdXBkYXRlVGV4dHVyZU1hdHJpeCh0aGlzLnVuaWZvcm1zLnV2QW5pbWF0aW9uTWFza1RleHR1cmUsIHRoaXMudW5pZm9ybXMudXZBbmltYXRpb25NYXNrVGV4dHVyZVV2VHJhbnNmb3JtKTtcclxuXHJcbiAgICAvLyBDT01QQVQgd29ya2Fyb3VuZDogc3RhcnRpbmcgZnJvbSByMTMyLCBhbHBoYVRlc3QgYmVjb21lcyBhIHVuaWZvcm0gaW5zdGVhZCBvZiBwcmVwcm9jZXNzb3IgdmFsdWVcclxuICAgIGNvbnN0IHRocmVlUmV2aXNpb24gPSBwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApO1xyXG5cclxuICAgIGlmICh0aHJlZVJldmlzaW9uID49IDEzMikge1xyXG4gICAgICB0aGlzLnVuaWZvcm1zLmFscGhhVGVzdC52YWx1ZSA9IHRoaXMuYWxwaGFUZXN0O1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMudW5pZm9ybXNOZWVkVXBkYXRlID0gdHJ1ZTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIFJldHVybnMgYSBtYXAgb2JqZWN0IG9mIHByZXByb2Nlc3NvciB0b2tlbiBhbmQgbWFjcm8gb2YgdGhlIHNoYWRlciBwcm9ncmFtLlxyXG4gICAqL1xyXG4gIHByaXZhdGUgX2dlbmVyYXRlRGVmaW5lcygpOiB7IFt0b2tlbjogc3RyaW5nXTogYm9vbGVhbiB8IG51bWJlciB8IHN0cmluZyB9IHtcclxuICAgIGNvbnN0IHRocmVlUmV2aXNpb24gPSBwYXJzZUludChUSFJFRS5SRVZJU0lPTiwgMTApO1xyXG5cclxuICAgIGNvbnN0IHVzZVV2SW5WZXJ0ID0gdGhpcy5vdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmUgIT09IG51bGw7XHJcbiAgICBjb25zdCB1c2VVdkluRnJhZyA9XHJcbiAgICAgIHRoaXMubWFwICE9PSBudWxsIHx8XHJcbiAgICAgIHRoaXMuZW1pc3NpdmVNYXAgIT09IG51bGwgfHxcclxuICAgICAgdGhpcy5zaGFkZU11bHRpcGx5VGV4dHVyZSAhPT0gbnVsbCB8fFxyXG4gICAgICB0aGlzLnNoYWRpbmdTaGlmdFRleHR1cmUgIT09IG51bGwgfHxcclxuICAgICAgdGhpcy5yaW1NdWx0aXBseVRleHR1cmUgIT09IG51bGwgfHxcclxuICAgICAgdGhpcy51dkFuaW1hdGlvbk1hc2tUZXh0dXJlICE9PSBudWxsO1xyXG5cclxuICAgIHJldHVybiB7XHJcbiAgICAgIC8vIFRlbXBvcmFyeSBjb21wYXQgYWdhaW5zdCBzaGFkZXIgY2hhbmdlIEAgVGhyZWUuanMgcjEyNlxyXG4gICAgICAvLyBTZWU6ICMyMTIwNSwgIzIxMzA3LCAjMjEyOTlcclxuICAgICAgVEhSRUVfVlJNX1RIUkVFX1JFVklTSU9OOiB0aHJlZVJldmlzaW9uLFxyXG5cclxuICAgICAgT1VUTElORTogdGhpcy5faXNPdXRsaW5lLFxyXG4gICAgICBNVE9PTl9VU0VfVVY6IHVzZVV2SW5WZXJ0IHx8IHVzZVV2SW5GcmFnLCAvLyB3ZSBjYW4ndCB1c2UgYFVTRV9VVmAgLCBpdCB3aWxsIGJlIHJlZGVmaW5lZCBpbiBXZWJHTFByb2dyYW0uanNcclxuICAgICAgTVRPT05fVVZTX1ZFUlRFWF9PTkxZOiB1c2VVdkluVmVydCAmJiAhdXNlVXZJbkZyYWcsXHJcbiAgICAgIFYwX0NPTVBBVF9TSEFERTogdGhpcy5fdjBDb21wYXRTaGFkZSxcclxuICAgICAgVVNFX1NIQURFTVVMVElQTFlURVhUVVJFOiB0aGlzLnNoYWRlTXVsdGlwbHlUZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBVU0VfU0hBRElOR1NISUZUVEVYVFVSRTogdGhpcy5zaGFkaW5nU2hpZnRUZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBVU0VfTUFUQ0FQVEVYVFVSRTogdGhpcy5tYXRjYXBUZXh0dXJlICE9PSBudWxsLFxyXG4gICAgICBVU0VfUklNTVVMVElQTFlURVhUVVJFOiB0aGlzLnJpbU11bHRpcGx5VGV4dHVyZSAhPT0gbnVsbCxcclxuICAgICAgVVNFX09VVExJTkVXSURUSE1VTFRJUExZVEVYVFVSRTogdGhpcy5vdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmUgIT09IG51bGwsXHJcbiAgICAgIFVTRV9VVkFOSU1BVElPTk1BU0tURVhUVVJFOiB0aGlzLnV2QW5pbWF0aW9uTWFza1RleHR1cmUgIT09IG51bGwsXHJcbiAgICAgIElHTk9SRV9WRVJURVhfQ09MT1I6IHRoaXMuX2lnbm9yZVZlcnRleENvbG9yID09PSB0cnVlLFxyXG4gICAgICBERUJVR19OT1JNQUw6IHRoaXMuX2RlYnVnTW9kZSA9PT0gJ25vcm1hbCcsXHJcbiAgICAgIERFQlVHX0xJVFNIQURFUkFURTogdGhpcy5fZGVidWdNb2RlID09PSAnbGl0U2hhZGVSYXRlJyxcclxuICAgICAgREVCVUdfVVY6IHRoaXMuX2RlYnVnTW9kZSA9PT0gJ3V2JyxcclxuICAgICAgT1VUTElORV9XSURUSF9XT1JMRDogdGhpcy5fb3V0bGluZVdpZHRoTW9kZSA9PT0gTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUuV29ybGRDb29yZGluYXRlcyxcclxuICAgICAgT1VUTElORV9XSURUSF9TQ1JFRU46IHRoaXMuX291dGxpbmVXaWR0aE1vZGUgPT09IE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlLlNjcmVlbkNvb3JkaW5hdGVzLFxyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX3VwZGF0ZVRleHR1cmVNYXRyaXgoc3JjOiBUSFJFRS5JVW5pZm9ybTxUSFJFRS5UZXh0dXJlIHwgbnVsbD4sIGRzdDogVEhSRUUuSVVuaWZvcm08VEhSRUUuTWF0cml4Mz4pOiB2b2lkIHtcclxuICAgIGlmIChzcmMudmFsdWUpIHtcclxuICAgICAgaWYgKHNyYy52YWx1ZS5tYXRyaXhBdXRvVXBkYXRlKSB7XHJcbiAgICAgICAgc3JjLnZhbHVlLnVwZGF0ZU1hdHJpeCgpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBkc3QudmFsdWUuY29weShzcmMudmFsdWUubWF0cml4KTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgeyBHTFRGUGFyc2VyIH0gZnJvbSAndGhyZWUvZXhhbXBsZXMvanNtL2xvYWRlcnMvR0xURkxvYWRlci5qcyc7XHJcbmltcG9ydCB7IE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzIH0gZnJvbSAnLi9NVG9vbk1hdGVyaWFsUGFyYW1ldGVycyc7XHJcblxyXG4vKipcclxuICogTWF0ZXJpYWxQYXJhbWV0ZXJzIGhhdGVzIGB1bmRlZmluZWRgLiBUaGlzIGhlbHBlciBhdXRvbWF0aWNhbGx5IHJlamVjdHMgYXNzaWduIG9mIHRoZXNlIGB1bmRlZmluZWRgLlxyXG4gKiBJdCBhbHNvIGhhbmRsZXMgYXN5bmNocm9ub3VzIHByb2Nlc3Mgb2YgdGV4dHVyZXMuXHJcbiAqIE1ha2Ugc3VyZSBhd2FpdCBmb3Ige0BsaW5rIEdMVEZNVG9vbk1hdGVyaWFsUGFyYW1zQXNzaWduSGVscGVyLnBlbmRpbmd9LlxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIEdMVEZNVG9vbk1hdGVyaWFsUGFyYW1zQXNzaWduSGVscGVyIHtcclxuICBwcml2YXRlIHJlYWRvbmx5IF9wYXJzZXI6IEdMVEZQYXJzZXI7XHJcbiAgcHJpdmF0ZSBfbWF0ZXJpYWxQYXJhbXM6IE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzO1xyXG4gIHByaXZhdGUgX3BlbmRpbmdzOiBQcm9taXNlPGFueT5bXTtcclxuXHJcbiAgcHVibGljIGdldCBwZW5kaW5nKCk6IFByb21pc2U8dW5rbm93bj4ge1xyXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHRoaXMuX3BlbmRpbmdzKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjb25zdHJ1Y3RvcihwYXJzZXI6IEdMVEZQYXJzZXIsIG1hdGVyaWFsUGFyYW1zOiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycykge1xyXG4gICAgdGhpcy5fcGFyc2VyID0gcGFyc2VyO1xyXG4gICAgdGhpcy5fbWF0ZXJpYWxQYXJhbXMgPSBtYXRlcmlhbFBhcmFtcztcclxuICAgIHRoaXMuX3BlbmRpbmdzID0gW107XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXNzaWduUHJpbWl0aXZlPFQgZXh0ZW5kcyBrZXlvZiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycz4oa2V5OiBULCB2YWx1ZTogTVRvb25NYXRlcmlhbFBhcmFtZXRlcnNbVF0pOiB2b2lkIHtcclxuICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XHJcbiAgICAgIHRoaXMuX21hdGVyaWFsUGFyYW1zW2tleV0gPSB2YWx1ZTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3NpZ25Db2xvcjxUIGV4dGVuZHMga2V5b2YgTVRvb25NYXRlcmlhbFBhcmFtZXRlcnM+KFxyXG4gICAga2V5OiBULFxyXG4gICAgdmFsdWU6IG51bWJlcltdIHwgdW5kZWZpbmVkLFxyXG4gICAgY29udmVydFNSR0JUb0xpbmVhcj86IGJvb2xlYW4sXHJcbiAgKTogdm9pZCB7XHJcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkge1xyXG4gICAgICB0aGlzLl9tYXRlcmlhbFBhcmFtc1trZXldID0gbmV3IFRIUkVFLkNvbG9yKCkuZnJvbUFycmF5KHZhbHVlKTtcclxuXHJcbiAgICAgIGlmIChjb252ZXJ0U1JHQlRvTGluZWFyKSB7XHJcbiAgICAgICAgdGhpcy5fbWF0ZXJpYWxQYXJhbXNba2V5XS5jb252ZXJ0U1JHQlRvTGluZWFyKCk7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyBhc3luYyBhc3NpZ25UZXh0dXJlPFQgZXh0ZW5kcyBrZXlvZiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycz4oXHJcbiAgICBrZXk6IFQsXHJcbiAgICB0ZXh0dXJlOiB7IGluZGV4OiBudW1iZXIgfSB8IHVuZGVmaW5lZCxcclxuICAgIGlzQ29sb3JUZXh0dXJlOiBib29sZWFuLFxyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgY29uc3QgcHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XHJcbiAgICAgIGlmICh0ZXh0dXJlICE9IG51bGwpIHtcclxuICAgICAgICBhd2FpdCB0aGlzLl9wYXJzZXIuYXNzaWduVGV4dHVyZSh0aGlzLl9tYXRlcmlhbFBhcmFtcywga2V5LCB0ZXh0dXJlKTtcclxuXHJcbiAgICAgICAgaWYgKGlzQ29sb3JUZXh0dXJlKSB7XHJcbiAgICAgICAgICB0aGlzLl9tYXRlcmlhbFBhcmFtc1trZXldLmVuY29kaW5nID0gVEhSRUUuc1JHQkVuY29kaW5nO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSkoKTtcclxuXHJcbiAgICB0aGlzLl9wZW5kaW5ncy5wdXNoKHByb21pc2UpO1xyXG5cclxuICAgIHJldHVybiBwcm9taXNlO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGFzc2lnblRleHR1cmVCeUluZGV4PFQgZXh0ZW5kcyBrZXlvZiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycz4oXHJcbiAgICBrZXk6IFQsXHJcbiAgICB0ZXh0dXJlSW5kZXg6IG51bWJlciB8IHVuZGVmaW5lZCxcclxuICAgIGlzQ29sb3JUZXh0dXJlOiBib29sZWFuLFxyXG4gICk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgcmV0dXJuIHRoaXMuYXNzaWduVGV4dHVyZShrZXksIHRleHR1cmVJbmRleCAhPSBudWxsID8geyBpbmRleDogdGV4dHVyZUluZGV4IH0gOiB1bmRlZmluZWQsIGlzQ29sb3JUZXh0dXJlKTtcclxuICB9XHJcbn1cclxuIiwiaW1wb3J0ICogYXMgVEhSRUUgZnJvbSAndGhyZWUnO1xyXG5pbXBvcnQgKiBhcyBWMU1Ub29uU2NoZW1hIGZyb20gJ0BwaXhpdi90eXBlcy12cm1jLW1hdGVyaWFscy1tdG9vbi0xLjAnO1xyXG5pbXBvcnQgdHlwZSB7IEdMVEYsIEdMVEZMb2FkZXJQbHVnaW4sIEdMVEZQYXJzZXIgfSBmcm9tICd0aHJlZS9leGFtcGxlcy9qc20vbG9hZGVycy9HTFRGTG9hZGVyLmpzJztcclxuaW1wb3J0IHsgTVRvb25NYXRlcmlhbCB9IGZyb20gJy4vTVRvb25NYXRlcmlhbCc7XHJcbmltcG9ydCB0eXBlIHsgTVRvb25NYXRlcmlhbFBhcmFtZXRlcnMgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzJztcclxuaW1wb3J0IHsgTVRvb25NYXRlcmlhbE91dGxpbmVXaWR0aE1vZGUgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlJztcclxuaW1wb3J0IHsgR0xURk1Ub29uTWF0ZXJpYWxQYXJhbXNBc3NpZ25IZWxwZXIgfSBmcm9tICcuL0dMVEZNVG9vbk1hdGVyaWFsUGFyYW1zQXNzaWduSGVscGVyJztcclxuaW1wb3J0IHsgTVRvb25NYXRlcmlhbExvYWRlclBsdWdpbk9wdGlvbnMgfSBmcm9tICcuL01Ub29uTWF0ZXJpYWxMb2FkZXJQbHVnaW5PcHRpb25zJztcclxuaW1wb3J0IHR5cGUgeyBNVG9vbk1hdGVyaWFsRGVidWdNb2RlIH0gZnJvbSAnLi9NVG9vbk1hdGVyaWFsRGVidWdNb2RlJztcclxuaW1wb3J0IHsgR0xURiBhcyBHTFRGU2NoZW1hIH0gZnJvbSAnQGdsdGYtdHJhbnNmb3JtL2NvcmUnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1Ub29uTWF0ZXJpYWxMb2FkZXJQbHVnaW4gaW1wbGVtZW50cyBHTFRGTG9hZGVyUGx1Z2luIHtcclxuICBwdWJsaWMgc3RhdGljIEVYVEVOU0lPTl9OQU1FID0gJ1ZSTUNfbWF0ZXJpYWxzX210b29uJztcclxuXHJcbiAgLyoqXHJcbiAgICogVGhpcyB2YWx1ZSB3aWxsIGJlIGFkZGVkIHRvIGByZW5kZXJPcmRlcmAgb2YgZXZlcnkgbWVzaGVzIHdobyBoYXZlIE1hdGVyaWFsc01Ub29uLlxyXG4gICAqIFRoZSBmaW5hbCByZW5kZXJPcmRlciB3aWxsIGJlIHN1bSBvZiB0aGlzIGByZW5kZXJPcmRlck9mZnNldGAgYW5kIGByZW5kZXJRdWV1ZU9mZnNldE51bWJlcmAgZm9yIGVhY2ggbWF0ZXJpYWxzLlxyXG4gICAqIGAwYCBieSBkZWZhdWx0LlxyXG4gICAqL1xyXG4gIHB1YmxpYyByZW5kZXJPcmRlck9mZnNldDogbnVtYmVyO1xyXG5cclxuICAvKipcclxuICAgKiBUaGVyZSBpcyBhIGxpbmUgb2YgdGhlIHNoYWRlciBjYWxsZWQgXCJjb21tZW50IG91dCBpZiB5b3Ugd2FudCB0byBQQlIgYWJzb2x1dGVseVwiIGluIFZSTTAuMCBNVG9vbi5cclxuICAgKiBXaGVuIHRoaXMgaXMgdHJ1ZSwgdGhlIG1hdGVyaWFsIGVuYWJsZXMgdGhlIGxpbmUgdG8gbWFrZSBpdCBjb21wYXRpYmxlIHdpdGggdGhlIGxlZ2FjeSByZW5kZXJpbmcgb2YgVlJNLlxyXG4gICAqIFVzdWFsbHkgbm90IHJlY29tbWVuZGVkIHRvIHR1cm4gdGhpcyBvbi5cclxuICAgKiBgZmFsc2VgIGJ5IGRlZmF1bHQuXHJcbiAgICovXHJcbiAgcHVibGljIHYwQ29tcGF0U2hhZGU6IGJvb2xlYW47XHJcblxyXG4gIC8qKlxyXG4gICAqIERlYnVnIG1vZGUgZm9yIHRoZSBtYXRlcmlhbC5cclxuICAgKiBZb3UgY2FuIHZpc3VhbGl6ZSBzZXZlcmFsIGNvbXBvbmVudHMgZm9yIGRpYWdub3NpcyB1c2luZyBkZWJ1ZyBtb2RlLlxyXG4gICAqXHJcbiAgICogU2VlOiB7QGxpbmsgTVRvb25NYXRlcmlhbERlYnVnTW9kZX1cclxuICAgKi9cclxuICBwdWJsaWMgZGVidWdNb2RlOiBNVG9vbk1hdGVyaWFsRGVidWdNb2RlO1xyXG5cclxuICBwdWJsaWMgcmVhZG9ubHkgcGFyc2VyOiBHTFRGUGFyc2VyO1xyXG5cclxuICAvKipcclxuICAgKiBMb2FkZWQgbWF0ZXJpYWxzIHdpbGwgYmUgc3RvcmVkIGluIHRoaXMgc2V0LlxyXG4gICAqIFdpbGwgYmUgdHJhbnNmZXJyZWQgaW50byBgZ2x0Zi51c2VyRGF0YS52cm1NVG9vbk1hdGVyaWFsc2AgaW4ge0BsaW5rIGFmdGVyUm9vdH0uXHJcbiAgICovXHJcbiAgcHJpdmF0ZSByZWFkb25seSBfbVRvb25NYXRlcmlhbFNldDogU2V0PE1Ub29uTWF0ZXJpYWw+O1xyXG5cclxuICBwdWJsaWMgZ2V0IG5hbWUoKTogc3RyaW5nIHtcclxuICAgIHJldHVybiBNVG9vbk1hdGVyaWFsTG9hZGVyUGx1Z2luLkVYVEVOU0lPTl9OQU1FO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNvbnN0cnVjdG9yKHBhcnNlcjogR0xURlBhcnNlciwgb3B0aW9uczogTVRvb25NYXRlcmlhbExvYWRlclBsdWdpbk9wdGlvbnMgPSB7fSkge1xyXG4gICAgdGhpcy5wYXJzZXIgPSBwYXJzZXI7XHJcblxyXG4gICAgdGhpcy5yZW5kZXJPcmRlck9mZnNldCA9IG9wdGlvbnMucmVuZGVyT3JkZXJPZmZzZXQgPz8gMDtcclxuICAgIHRoaXMudjBDb21wYXRTaGFkZSA9IG9wdGlvbnMudjBDb21wYXRTaGFkZSA/PyBmYWxzZTtcclxuICAgIHRoaXMuZGVidWdNb2RlID0gb3B0aW9ucy5kZWJ1Z01vZGUgPz8gJ25vbmUnO1xyXG5cclxuICAgIHRoaXMuX21Ub29uTWF0ZXJpYWxTZXQgPSBuZXcgU2V0KCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgYXN5bmMgYmVmb3JlUm9vdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHRoaXMuX3JlbW92ZVVubGl0RXh0ZW5zaW9uSWZNVG9vbkV4aXN0cygpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGFmdGVyUm9vdChnbHRmOiBHTFRGKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICBnbHRmLnVzZXJEYXRhLnZybU1Ub29uTWF0ZXJpYWxzID0gQXJyYXkuZnJvbSh0aGlzLl9tVG9vbk1hdGVyaWFsU2V0KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXRNYXRlcmlhbFR5cGUobWF0ZXJpYWxJbmRleDogbnVtYmVyKTogdHlwZW9mIFRIUkVFLk1hdGVyaWFsIHwgbnVsbCB7XHJcbiAgICBjb25zdCB2MUV4dGVuc2lvbiA9IHRoaXMuX2dldE1Ub29uRXh0ZW5zaW9uKG1hdGVyaWFsSW5kZXgpO1xyXG4gICAgaWYgKHYxRXh0ZW5zaW9uKSB7XHJcbiAgICAgIHJldHVybiBNVG9vbk1hdGVyaWFsO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGV4dGVuZE1hdGVyaWFsUGFyYW1zKG1hdGVyaWFsSW5kZXg6IG51bWJlciwgbWF0ZXJpYWxQYXJhbXM6IE1Ub29uTWF0ZXJpYWxQYXJhbWV0ZXJzKTogUHJvbWlzZTxhbnk+IHwgbnVsbCB7XHJcbiAgICBjb25zdCBleHRlbnNpb24gPSB0aGlzLl9nZXRNVG9vbkV4dGVuc2lvbihtYXRlcmlhbEluZGV4KTtcclxuICAgIGlmIChleHRlbnNpb24pIHtcclxuICAgICAgcmV0dXJuIHRoaXMuX2V4dGVuZE1hdGVyaWFsUGFyYW1zKGV4dGVuc2lvbiwgbWF0ZXJpYWxQYXJhbXMpO1xyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBudWxsO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGFzeW5jIGxvYWRNZXNoKG1lc2hJbmRleDogbnVtYmVyKTogUHJvbWlzZTxUSFJFRS5Hcm91cCB8IFRIUkVFLk1lc2ggfCBUSFJFRS5Ta2lubmVkTWVzaD4ge1xyXG4gICAgY29uc3QgcGFyc2VyID0gdGhpcy5wYXJzZXI7XHJcbiAgICBjb25zdCBqc29uID0gcGFyc2VyLmpzb24gYXMgR0xURlNjaGVtYS5JR0xURjtcclxuXHJcbiAgICBjb25zdCBtZXNoRGVmID0ganNvbi5tZXNoZXM/LlttZXNoSW5kZXhdO1xyXG5cclxuICAgIGlmIChtZXNoRGVmID09IG51bGwpIHtcclxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxyXG4gICAgICAgIGBNVG9vbk1hdGVyaWFsTG9hZGVyUGx1Z2luOiBBdHRlbXB0IHRvIHVzZSBtZXNoZXNbJHttZXNoSW5kZXh9XSBvZiBnbFRGIGJ1dCB0aGUgbWVzaCBkb2Vzbid0IGV4aXN0YCxcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBwcmltaXRpdmVzRGVmID0gbWVzaERlZi5wcmltaXRpdmVzO1xyXG5cclxuICAgIGNvbnN0IG1lc2hPckdyb3VwID0gYXdhaXQgcGFyc2VyLmxvYWRNZXNoKG1lc2hJbmRleCk7XHJcblxyXG4gICAgaWYgKHByaW1pdGl2ZXNEZWYubGVuZ3RoID09PSAxKSB7XHJcbiAgICAgIGNvbnN0IG1lc2ggPSBtZXNoT3JHcm91cCBhcyBUSFJFRS5NZXNoO1xyXG4gICAgICBjb25zdCBtYXRlcmlhbEluZGV4ID0gcHJpbWl0aXZlc0RlZlswXS5tYXRlcmlhbDtcclxuXHJcbiAgICAgIGlmIChtYXRlcmlhbEluZGV4ICE9IG51bGwpIHtcclxuICAgICAgICB0aGlzLl9zZXR1cFByaW1pdGl2ZShtZXNoLCBtYXRlcmlhbEluZGV4KTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIHtcclxuICAgICAgY29uc3QgZ3JvdXAgPSBtZXNoT3JHcm91cCBhcyBUSFJFRS5Hcm91cDtcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmltaXRpdmVzRGVmLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgY29uc3QgbWVzaCA9IGdyb3VwLmNoaWxkcmVuW2ldIGFzIFRIUkVFLk1lc2g7XHJcbiAgICAgICAgY29uc3QgbWF0ZXJpYWxJbmRleCA9IHByaW1pdGl2ZXNEZWZbaV0ubWF0ZXJpYWw7XHJcblxyXG4gICAgICAgIGlmIChtYXRlcmlhbEluZGV4ICE9IG51bGwpIHtcclxuICAgICAgICAgIHRoaXMuX3NldHVwUHJpbWl0aXZlKG1lc2gsIG1hdGVyaWFsSW5kZXgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBtZXNoT3JHcm91cDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIERlbGV0ZSB1c2Ugb2YgYEtIUl9tYXRlcmlhbHNfdW5saXRgIGZyb20gaXRzIGBtYXRlcmlhbHNgIGlmIHRoZSBtYXRlcmlhbCBpcyB1c2luZyBNVG9vbi5cclxuICAgKlxyXG4gICAqIFNpbmNlIEdMVEZMb2FkZXIgaGF2ZSBzbyBtYW55IGhhcmRjb2RlZCBwcm9jZWR1cmUgcmVsYXRlZCB0byBgS0hSX21hdGVyaWFsc191bmxpdGBcclxuICAgKiB3ZSBoYXZlIHRvIGRlbGV0ZSB0aGUgZXh0ZW5zaW9uIGJlZm9yZSB3ZSBzdGFydCB0byBwYXJzZSB0aGUgZ2xURi5cclxuICAgKi9cclxuICBwcml2YXRlIF9yZW1vdmVVbmxpdEV4dGVuc2lvbklmTVRvb25FeGlzdHMoKTogdm9pZCB7XHJcbiAgICBjb25zdCBwYXJzZXIgPSB0aGlzLnBhcnNlcjtcclxuICAgIGNvbnN0IGpzb24gPSBwYXJzZXIuanNvbiBhcyBHTFRGU2NoZW1hLklHTFRGO1xyXG5cclxuICAgIGNvbnN0IG1hdGVyaWFsRGVmcyA9IGpzb24ubWF0ZXJpYWxzO1xyXG4gICAgbWF0ZXJpYWxEZWZzPy5tYXAoKG1hdGVyaWFsRGVmLCBpTWF0ZXJpYWwpID0+IHtcclxuICAgICAgY29uc3QgZXh0ZW5zaW9uID0gdGhpcy5fZ2V0TVRvb25FeHRlbnNpb24oaU1hdGVyaWFsKTtcclxuXHJcbiAgICAgIGlmIChleHRlbnNpb24gJiYgbWF0ZXJpYWxEZWYuZXh0ZW5zaW9ucz8uWydLSFJfbWF0ZXJpYWxzX3VubGl0J10pIHtcclxuICAgICAgICBkZWxldGUgbWF0ZXJpYWxEZWYuZXh0ZW5zaW9uc1snS0hSX21hdGVyaWFsc191bmxpdCddO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2dldE1Ub29uRXh0ZW5zaW9uKG1hdGVyaWFsSW5kZXg6IG51bWJlcik6IFYxTVRvb25TY2hlbWEuVlJNQ01hdGVyaWFsc01Ub29uIHwgdW5kZWZpbmVkIHtcclxuICAgIGNvbnN0IHBhcnNlciA9IHRoaXMucGFyc2VyO1xyXG4gICAgY29uc3QganNvbiA9IHBhcnNlci5qc29uIGFzIEdMVEZTY2hlbWEuSUdMVEY7XHJcblxyXG4gICAgY29uc3QgbWF0ZXJpYWxEZWYgPSBqc29uLm1hdGVyaWFscz8uW21hdGVyaWFsSW5kZXhdO1xyXG5cclxuICAgIGlmIChtYXRlcmlhbERlZiA9PSBudWxsKSB7XHJcbiAgICAgIGNvbnNvbGUud2FybihcclxuICAgICAgICBgTVRvb25NYXRlcmlhbExvYWRlclBsdWdpbjogQXR0ZW1wdCB0byB1c2UgbWF0ZXJpYWxzWyR7bWF0ZXJpYWxJbmRleH1dIG9mIGdsVEYgYnV0IHRoZSBtYXRlcmlhbCBkb2Vzbid0IGV4aXN0YCxcclxuICAgICAgKTtcclxuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICAgIH1cclxuXHJcbiAgICBjb25zdCBleHRlbnNpb24gPSBtYXRlcmlhbERlZi5leHRlbnNpb25zPy5bTVRvb25NYXRlcmlhbExvYWRlclBsdWdpbi5FWFRFTlNJT05fTkFNRV0gYXNcclxuICAgICAgfCBWMU1Ub29uU2NoZW1hLlZSTUNNYXRlcmlhbHNNVG9vblxyXG4gICAgICB8IHVuZGVmaW5lZDtcclxuICAgIGlmIChleHRlbnNpb24gPT0gbnVsbCkge1xyXG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gICAgfVxyXG5cclxuICAgIGNvbnN0IHNwZWNWZXJzaW9uID0gZXh0ZW5zaW9uLnNwZWNWZXJzaW9uO1xyXG4gICAgaWYgKHNwZWNWZXJzaW9uICE9PSAnMS4wLWJldGEnKSB7XHJcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGV4dGVuc2lvbjtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYXN5bmMgX2V4dGVuZE1hdGVyaWFsUGFyYW1zKFxyXG4gICAgZXh0ZW5zaW9uOiBWMU1Ub29uU2NoZW1hLlZSTUNNYXRlcmlhbHNNVG9vbixcclxuICAgIG1hdGVyaWFsUGFyYW1zOiBNVG9vbk1hdGVyaWFsUGFyYW1ldGVycyxcclxuICApOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIC8vIFJlbW92aW5nIG1hdGVyaWFsIHBhcmFtcyB0aGF0IGlzIG5vdCByZXF1aXJlZCB0byBzdXByZXNzIHdhcm5pbmdzLlxyXG4gICAgZGVsZXRlIChtYXRlcmlhbFBhcmFtcyBhcyBUSFJFRS5NZXNoU3RhbmRhcmRNYXRlcmlhbFBhcmFtZXRlcnMpLm1ldGFsbmVzcztcclxuICAgIGRlbGV0ZSAobWF0ZXJpYWxQYXJhbXMgYXMgVEhSRUUuTWVzaFN0YW5kYXJkTWF0ZXJpYWxQYXJhbWV0ZXJzKS5yb3VnaG5lc3M7XHJcblxyXG4gICAgY29uc3QgYXNzaWduSGVscGVyID0gbmV3IEdMVEZNVG9vbk1hdGVyaWFsUGFyYW1zQXNzaWduSGVscGVyKHRoaXMucGFyc2VyLCBtYXRlcmlhbFBhcmFtcyk7XHJcblxyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgndHJhbnNwYXJlbnRXaXRoWldyaXRlJywgZXh0ZW5zaW9uLnRyYW5zcGFyZW50V2l0aFpXcml0ZSk7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduQ29sb3IoJ3NoYWRlQ29sb3JGYWN0b3InLCBleHRlbnNpb24uc2hhZGVDb2xvckZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduVGV4dHVyZSgnc2hhZGVNdWx0aXBseVRleHR1cmUnLCBleHRlbnNpb24uc2hhZGVNdWx0aXBseVRleHR1cmUsIHRydWUpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgnc2hhZGluZ1NoaWZ0RmFjdG9yJywgZXh0ZW5zaW9uLnNoYWRpbmdTaGlmdEZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduVGV4dHVyZSgnc2hhZGluZ1NoaWZ0VGV4dHVyZScsIGV4dGVuc2lvbi5zaGFkaW5nU2hpZnRUZXh0dXJlLCB0cnVlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3NoYWRpbmdTaGlmdFRleHR1cmVTY2FsZScsIGV4dGVuc2lvbi5zaGFkaW5nU2hpZnRUZXh0dXJlPy5zY2FsZSk7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdzaGFkaW5nVG9vbnlGYWN0b3InLCBleHRlbnNpb24uc2hhZGluZ1Rvb255RmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ2dpRXF1YWxpemF0aW9uRmFjdG9yJywgZXh0ZW5zaW9uLmdpRXF1YWxpemF0aW9uRmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25Db2xvcignbWF0Y2FwRmFjdG9yJywgZXh0ZW5zaW9uLm1hdGNhcEZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduVGV4dHVyZSgnbWF0Y2FwVGV4dHVyZScsIGV4dGVuc2lvbi5tYXRjYXBUZXh0dXJlLCB0cnVlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25Db2xvcigncGFyYW1ldHJpY1JpbUNvbG9yRmFjdG9yJywgZXh0ZW5zaW9uLnBhcmFtZXRyaWNSaW1Db2xvckZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduVGV4dHVyZSgncmltTXVsdGlwbHlUZXh0dXJlJywgZXh0ZW5zaW9uLnJpbU11bHRpcGx5VGV4dHVyZSwgdHJ1ZSk7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdyaW1MaWdodGluZ01peEZhY3RvcicsIGV4dGVuc2lvbi5yaW1MaWdodGluZ01peEZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdwYXJhbWV0cmljUmltRnJlc25lbFBvd2VyRmFjdG9yJywgZXh0ZW5zaW9uLnBhcmFtZXRyaWNSaW1GcmVzbmVsUG93ZXJGYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgncGFyYW1ldHJpY1JpbUxpZnRGYWN0b3InLCBleHRlbnNpb24ucGFyYW1ldHJpY1JpbUxpZnRGYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgnb3V0bGluZVdpZHRoTW9kZScsIGV4dGVuc2lvbi5vdXRsaW5lV2lkdGhNb2RlIGFzIE1Ub29uTWF0ZXJpYWxPdXRsaW5lV2lkdGhNb2RlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ291dGxpbmVXaWR0aEZhY3RvcicsIGV4dGVuc2lvbi5vdXRsaW5lV2lkdGhGYWN0b3IpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblRleHR1cmUoJ291dGxpbmVXaWR0aE11bHRpcGx5VGV4dHVyZScsIGV4dGVuc2lvbi5vdXRsaW5lV2lkdGhNdWx0aXBseVRleHR1cmUsIGZhbHNlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25Db2xvcignb3V0bGluZUNvbG9yRmFjdG9yJywgZXh0ZW5zaW9uLm91dGxpbmVDb2xvckZhY3Rvcik7XHJcbiAgICBhc3NpZ25IZWxwZXIuYXNzaWduUHJpbWl0aXZlKCdvdXRsaW5lTGlnaHRpbmdNaXhGYWN0b3InLCBleHRlbnNpb24ub3V0bGluZUxpZ2h0aW5nTWl4RmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25UZXh0dXJlKCd1dkFuaW1hdGlvbk1hc2tUZXh0dXJlJywgZXh0ZW5zaW9uLnV2QW5pbWF0aW9uTWFza1RleHR1cmUsIGZhbHNlKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3V2QW5pbWF0aW9uU2Nyb2xsWFNwZWVkRmFjdG9yJywgZXh0ZW5zaW9uLnV2QW5pbWF0aW9uU2Nyb2xsWFNwZWVkRmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3V2QW5pbWF0aW9uU2Nyb2xsWVNwZWVkRmFjdG9yJywgZXh0ZW5zaW9uLnV2QW5pbWF0aW9uU2Nyb2xsWVNwZWVkRmFjdG9yKTtcclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3V2QW5pbWF0aW9uUm90YXRpb25TcGVlZEZhY3RvcicsIGV4dGVuc2lvbi51dkFuaW1hdGlvblJvdGF0aW9uU3BlZWRGYWN0b3IpO1xyXG5cclxuICAgIGFzc2lnbkhlbHBlci5hc3NpZ25QcmltaXRpdmUoJ3YwQ29tcGF0U2hhZGUnLCB0aGlzLnYwQ29tcGF0U2hhZGUpO1xyXG4gICAgYXNzaWduSGVscGVyLmFzc2lnblByaW1pdGl2ZSgnZGVidWdNb2RlJywgdGhpcy5kZWJ1Z01vZGUpO1xyXG5cclxuICAgIGF3YWl0IGFzc2lnbkhlbHBlci5wZW5kaW5nO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICogVGhpcyB3aWxsIGRvIHR3byBwcm9jZXNzZXMgdGhhdCBpcyByZXF1aXJlZCB0byByZW5kZXIgTVRvb24gcHJvcGVybHkuXHJcbiAgICpcclxuICAgKiAtIFNldCByZW5kZXIgb3JkZXJcclxuICAgKiAtIEdlbmVyYXRlIG91dGxpbmVcclxuICAgKlxyXG4gICAqIEBwYXJhbSBtZXNoIEEgdGFyZ2V0IEdMVEYgcHJpbWl0aXZlXHJcbiAgICogQHBhcmFtIG1hdGVyaWFsSW5kZXggVGhlIG1hdGVyaWFsIGluZGV4IG9mIHRoZSBwcmltaXRpdmVcclxuICAgKi9cclxuICBwcml2YXRlIF9zZXR1cFByaW1pdGl2ZShtZXNoOiBUSFJFRS5NZXNoLCBtYXRlcmlhbEluZGV4OiBudW1iZXIpOiB2b2lkIHtcclxuICAgIGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuX2dldE1Ub29uRXh0ZW5zaW9uKG1hdGVyaWFsSW5kZXgpO1xyXG4gICAgaWYgKGV4dGVuc2lvbikge1xyXG4gICAgICBjb25zdCByZW5kZXJPcmRlciA9IHRoaXMuX3BhcnNlUmVuZGVyT3JkZXIoZXh0ZW5zaW9uKTtcclxuICAgICAgbWVzaC5yZW5kZXJPcmRlciA9IHJlbmRlck9yZGVyICsgdGhpcy5yZW5kZXJPcmRlck9mZnNldDtcclxuXHJcbiAgICAgIHRoaXMuX2dlbmVyYXRlT3V0bGluZShtZXNoKTtcclxuXHJcbiAgICAgIHRoaXMuX2FkZFRvTWF0ZXJpYWxTZXQobWVzaCk7XHJcblxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiBHZW5lcmF0ZSBvdXRsaW5lIGZvciB0aGUgZ2l2ZW4gbWVzaCwgaWYgaXQgbmVlZHMuXHJcbiAgICpcclxuICAgKiBAcGFyYW0gbWVzaCBUaGUgdGFyZ2V0IG1lc2hcclxuICAgKi9cclxuICBwcml2YXRlIF9nZW5lcmF0ZU91dGxpbmUobWVzaDogVEhSRUUuTWVzaCk6IHZvaWQge1xyXG4gICAgLy8gT0ssIGl0J3MgdGhlIGhhY2t5IHBhcnQuXHJcbiAgICAvLyBXZSBhcmUgZ29pbmcgdG8gZHVwbGljYXRlIHRoZSBNVG9vbk1hdGVyaWFsIGZvciBvdXRsaW5lIHVzZS5cclxuICAgIC8vIFRoZW4gd2UgYXJlIGdvaW5nIHRvIGNyZWF0ZSB0d28gZ2VvbWV0cnkgZ3JvdXBzIGFuZCByZWZlciBzYW1lIGJ1ZmZlciBidXQgZGlmZmVyZW50IG1hdGVyaWFsLlxyXG4gICAgLy8gSXQncyBob3cgd2UgZHJhdyB0d28gbWF0ZXJpYWxzIGF0IG9uY2UgdXNpbmcgYSBzaW5nbGUgbWVzaC5cclxuXHJcbiAgICAvLyBtYWtlIHN1cmUgdGhlIG1hdGVyaWFsIGlzIG10b29uXHJcbiAgICBjb25zdCBzdXJmYWNlTWF0ZXJpYWwgPSBtZXNoLm1hdGVyaWFsO1xyXG4gICAgaWYgKCEoc3VyZmFjZU1hdGVyaWFsIGluc3RhbmNlb2YgTVRvb25NYXRlcmlhbCkpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIGNoZWNrIHdoZXRoZXIgd2UgcmVhbGx5IGhhdmUgdG8gcHJlcGFyZSBvdXRsaW5lIG9yIG5vdFxyXG4gICAgaWYgKHN1cmZhY2VNYXRlcmlhbC5vdXRsaW5lV2lkdGhNb2RlID09PSAnbm9uZScgfHwgc3VyZmFjZU1hdGVyaWFsLm91dGxpbmVXaWR0aEZhY3RvciA8PSAwLjApIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIG1ha2UgaXRzIG1hdGVyaWFsIGFuIGFycmF5XHJcbiAgICBtZXNoLm1hdGVyaWFsID0gW3N1cmZhY2VNYXRlcmlhbF07IC8vIG1lc2gubWF0ZXJpYWwgaXMgZ3VhcmFudGVlZCB0byBiZSBhIE1hdGVyaWFsIGluIEdMVEZMb2FkZXJcclxuXHJcbiAgICAvLyBkdXBsaWNhdGUgdGhlIG1hdGVyaWFsIGZvciBvdXRsaW5lIHVzZVxyXG4gICAgY29uc3Qgb3V0bGluZU1hdGVyaWFsID0gc3VyZmFjZU1hdGVyaWFsLmNsb25lKCkgYXMgTVRvb25NYXRlcmlhbDtcclxuICAgIG91dGxpbmVNYXRlcmlhbC5uYW1lICs9ICcgKE91dGxpbmUpJztcclxuICAgIG91dGxpbmVNYXRlcmlhbC5pc091dGxpbmUgPSB0cnVlO1xyXG4gICAgb3V0bGluZU1hdGVyaWFsLnNpZGUgPSBUSFJFRS5CYWNrU2lkZTtcclxuICAgIG1lc2gubWF0ZXJpYWwucHVzaChvdXRsaW5lTWF0ZXJpYWwpO1xyXG5cclxuICAgIC8vIG1ha2UgdHdvIGdlb21ldHJ5IGdyb3VwcyBvdXQgb2YgYSBzYW1lIGJ1ZmZlclxyXG4gICAgY29uc3QgZ2VvbWV0cnkgPSBtZXNoLmdlb21ldHJ5OyAvLyBtZXNoLmdlb21ldHJ5IGlzIGd1YXJhbnRlZWQgdG8gYmUgYSBCdWZmZXJHZW9tZXRyeSBpbiBHTFRGTG9hZGVyXHJcbiAgICBjb25zdCBwcmltaXRpdmVWZXJ0aWNlcyA9IGdlb21ldHJ5LmluZGV4ID8gZ2VvbWV0cnkuaW5kZXguY291bnQgOiBnZW9tZXRyeS5hdHRyaWJ1dGVzLnBvc2l0aW9uLmNvdW50IC8gMztcclxuICAgIGdlb21ldHJ5LmFkZEdyb3VwKDAsIHByaW1pdGl2ZVZlcnRpY2VzLCAwKTtcclxuICAgIGdlb21ldHJ5LmFkZEdyb3VwKDAsIHByaW1pdGl2ZVZlcnRpY2VzLCAxKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgX2FkZFRvTWF0ZXJpYWxTZXQobWVzaDogVEhSRUUuTWVzaCk6IHZvaWQge1xyXG4gICAgY29uc3QgbWF0ZXJpYWxPck1hdGVyaWFscyA9IG1lc2gubWF0ZXJpYWw7XHJcbiAgICBjb25zdCBtYXRlcmlhbFNldCA9IG5ldyBTZXQ8VEhSRUUuTWF0ZXJpYWw+KCk7XHJcblxyXG4gICAgaWYgKEFycmF5LmlzQXJyYXkobWF0ZXJpYWxPck1hdGVyaWFscykpIHtcclxuICAgICAgbWF0ZXJpYWxPck1hdGVyaWFscy5mb3JFYWNoKChtYXRlcmlhbCkgPT4gbWF0ZXJpYWxTZXQuYWRkKG1hdGVyaWFsKSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBtYXRlcmlhbFNldC5hZGQobWF0ZXJpYWxPck1hdGVyaWFscyk7XHJcbiAgICB9XHJcblxyXG4gICAgZm9yIChjb25zdCBtYXRlcmlhbCBvZiBtYXRlcmlhbFNldCkge1xyXG4gICAgICBpZiAobWF0ZXJpYWwgaW5zdGFuY2VvZiBNVG9vbk1hdGVyaWFsKSB7XHJcbiAgICAgICAgdGhpcy5fbVRvb25NYXRlcmlhbFNldC5hZGQobWF0ZXJpYWwpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIF9wYXJzZVJlbmRlck9yZGVyKGV4dGVuc2lvbjogVjFNVG9vblNjaGVtYS5WUk1DTWF0ZXJpYWxzTVRvb24pOiBudW1iZXIge1xyXG4gICAgLy8gdHJhbnNwYXJlbnRXaXRoWldyaXRlIHJhbmdlcyBmcm9tIDAgdG8gKzlcclxuICAgIC8vIG1lcmUgdHJhbnNwYXJlbnQgcmFuZ2VzIGZyb20gLTkgdG8gMFxyXG4gICAgY29uc3QgZW5hYmxlZFpXcml0ZSA9IGV4dGVuc2lvbi50cmFuc3BhcmVudFdpdGhaV3JpdGU7XHJcbiAgICByZXR1cm4gKGVuYWJsZWRaV3JpdGUgPyAwIDogMTkpICsgKGV4dGVuc2lvbi5yZW5kZXJRdWV1ZU9mZnNldE51bWJlciA/PyAwKTtcclxuICB9XHJcbn1cclxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBdURBO0FBQ08sU0FBUyxTQUFTLENBQUMsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFO0FBQzdELElBQUksU0FBUyxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsT0FBTyxLQUFLLFlBQVksQ0FBQyxHQUFHLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQyxVQUFVLE9BQU8sRUFBRSxFQUFFLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFO0FBQ2hILElBQUksT0FBTyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsT0FBTyxDQUFDLEVBQUUsVUFBVSxPQUFPLEVBQUUsTUFBTSxFQUFFO0FBQy9ELFFBQVEsU0FBUyxTQUFTLENBQUMsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUNuRyxRQUFRLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRTtBQUN0RyxRQUFRLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsRUFBRTtBQUN0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
