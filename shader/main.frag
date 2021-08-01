precision mediump float;

uniform vec3      lightDirection;
uniform sampler2D textureUnit;
uniform vec3      globalColor;
uniform float     gradient;
uniform bool      isTexture;
uniform bool      isEdge;
uniform bool      isToonShading;

varying vec3 vNormal;
varying vec2 vTexCoord;

void main() {
    // ベクトルの単位化
    vec3 light = normalize(lightDirection);
    vec3 normal = normalize(vNormal);

    // 最終出力される色
    vec3 rgb = vec3(0.0);

    if (isEdge != true) {
        // 輝度
        float luminance = dot(light, normal) * 0.5 + 0.5;
        if (isToonShading == true) {
            // 解像度を落とす
            luminance = floor(luminance * gradient) / gradient;
        }

        // グローバルカラーと拡散光を乗算
        rgb = vec3(luminance);

        // フラグの状態に応じてテクスチャのサンプリング（色の参照と抽出）を行う
        vec4 samplerColor = vec4(1.0);
        if (isTexture == true) {
            samplerColor = texture2D(textureUnit, vTexCoord);
        }

        rgb *= samplerColor.rgb;
    }

    gl_FragColor = vec4(rgb, 1.0);
}