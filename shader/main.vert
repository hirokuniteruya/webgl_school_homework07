attribute vec3 position;
attribute vec4 randomValue;

uniform mat4  mvpMatrix;
uniform float pointSize;
uniform float time;

void main() {
    // 頂点属性として入ってきた乱数値を頂点の動きなどに活用する
    float width      = randomValue.x;
    float sinScale   = randomValue.y * 0.9 + 0.1;
    float cosScale   = randomValue.z * 0.9 + 0.1;
    float pointScale = randomValue.w * 0.7 + 0.3;
    // とりあえずサイン・コサインで動かしてみる
    vec3 offset = vec3(cos(time * cosScale), sin(time * sinScale), 0.0) * width;
    // オフセット量を頂点座標に加算してから行列にで変換して出力
    gl_Position = mvpMatrix * vec4(position + offset, 1.0);
    // ポイントサイズにも乱数値が影響するように
    gl_PointSize = pointSize * pointScale;
}