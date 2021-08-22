precision mediump float;

#define PI 3.141592653589793

uniform vec4  globalColor;
uniform float power;

varying float vIndex;
varying vec2  vPosition;

void main() {
    // 1. gl_PointCoord.st の座標系を、中心を原点とした座標系に変換する
    // vec2 p = gl_PointCoord.st * 2.0 - 1.0;
    // 2. 原点からの距離を求める
    // float len = length(p);
    // float len = distance(gl_PointCoord, vec2(.5));
    // 3. 光ったような効果を得たいので、ベクトルの長さを除数として使う
    // float dest = power / len;
    // 4-1. 外縁は完全に透明（黒）になってほしいので頂点から遠いほど暗くする
    // dest *= max(.5 - len, 0.0);
    // 4-2. または、べき乗を活用する
    // dest = pow(dest, 5.0);

    // float rotationFlag = mod(vIndex, 2.);

    vec2 newST = (vPosition * 1.) + 1.;
    newST *= .2;

    // float dest = mod(newST.y / .2, 1.);
    float dest = mod(newST.y, 1.);
    dest = step(.5, dest);
    // float dest = step(.5, mod(newST.y / 1., 1.));

    gl_FragColor = vec4(vec3(dest + .5), 1.) * globalColor;

    /* debug area */
    // gl_FragColor = vec4(vec3(newST.y), 1.);

}