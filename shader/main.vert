attribute vec3 position;
attribute vec3 normal;
attribute vec2 texCoord;

uniform mat4  mvpMatrix;
uniform mat4  normalMatrix;
uniform bool  isEdge;  // エッジ部分の描画モードかどうか
uniform float inflate; // エッジ描画時に頂点座標を膨らませる量
uniform float amplitude;
uniform bool  isBack;
uniform float time;
uniform float waveOffset;

varying vec3 vNormal;
varying vec2 vTexCoord;

#define PI 3.14159265358979

void main() {
    // テクスチャ座標をフラグメントシェーダに送る
    vTexCoord = texCoord;

    vec3 pos = position;

    // 頂点を波打たせる
    float rad = 2. * PI * pos.x;
    pos.z = sin(rad + time + waveOffset) * amplitude * .01;

    // 法線を求める
    float delta_x = 0.1;
    float delta_z;
    vec3 calculatedNormal;
    rad = 2. * PI * ( pos.x + delta_x );
    delta_z = sin(rad + time + waveOffset) * amplitude * .01 - pos.z;
    calculatedNormal = vec3(-delta_z, 0, delta_x);

    // 法線を行列で変換してからフラグメントシェーダに送る
    vNormal = (normalMatrix * vec4(calculatedNormal, 0.0)).xyz;

    // もしエッジ描画モードである場合は、法線方向に少し膨らませる
    if (isEdge == true) {
        if (isBack == true) {
            pos -= normal * inflate;
        } else {
            pos += normal * inflate;
        }
    }

    gl_Position = mvpMatrix * vec4(pos, 1.0);
}

