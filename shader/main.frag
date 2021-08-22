precision mediump float;

uniform vec4  globalColor;
uniform float power;

void main()
{
    float dest = step(.5, mod(gl_PointCoord.y / .25, 1.));

    gl_FragColor = vec4(vec3(dest) + .5, 1.) * globalColor;
}