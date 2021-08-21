precision mediump float;

uniform vec4  globalColor;
uniform float power;

void main() {
    // 1. gl_PointCoord.st の座標系を、中心を原点とした座標系に変換する
    vec2 p = gl_PointCoord.st * 2.0 - 1.0;
    // 2. 原点からの距離を求める
    float len = length(p);
    // 3. 光ったような効果を得たいので、ベクトルの長さを除数として使う
    float dest = power / len;
    // 4-1. 外縁は完全に透明（黒）になってほしいので頂点から遠いほど暗くする
    dest *= max(1.0 - len, 0.0);
    // 4-2. または、べき乗を活用する
    // dest = pow(dest, 5.0);

    gl_FragColor = vec4(vec3(dest), 1.0) * globalColor;

}