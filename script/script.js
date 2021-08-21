import { WebGLUtility, WebGLOrbitCamera, WebGLMath, Mat4, Vec3, Vec2, Qtn, WebGLGeometry } from './webgl.js';

(() => {
    // DOM への参照の取得
    const canvas = document.getElementById('webgl-canvas');

    // webgl.js に記載のクラスを扱いやすいように変数に入れておく
    const webgl = new WebGLUtility();
    const m = Mat4;

    // 複数の関数で利用する広いスコープが必要な変数を宣言しておく
    let startTime  = 0;

    // tweakpane で操作するパラメータ
    const PARAMS = {
        globalColor : [0.2, 0.6, 0.9],
        globalAlpha : 0.5,
        pointSize   : 16.0,
        pointPower  : 0.1,
    }

    const POINT_COUNT = 1000; // 生成する頂点の個数
    const POINT_RANGE = 10.0; // 生成する頂点の配置される範囲

    // ジオメトリ情報, VBO, IBO
    let points      = null;   // 頂点データ（座標）を格納する配列
    let randomValue = null;   // 頂点データ（乱数）
    let pointVBO    = null;

    // ロケーションとストライド
    let attLocation = null;
    let attStride   = null;
    let uniLocation = null;

    // 行列
    let vMatrix     = null;
    let pMatrix     = null;
    let vpMatrix    = null;

    let camera      = null; // doxas さん作オービットコントロール風カメラ

    window.addEventListener('DOMContentLoaded', main, false);

    async function main() {
        // special thanks! https://github.com/cocopon/tweakpane ===============
        const pane = new Tweakpane.Pane({
            container: document.querySelector('#float-layer'),
        });
        const f_toon = pane.addFolder({
            title: 'ポイントスプライト',
            expanded: true,
        })
        f_toon.addInput(PARAMS, 'globalAlpha', { min: 0, max: 1,  step: 0.001 });
        f_toon.addInput(PARAMS, 'pointSize',   { min: 0, max: 16, step: 0.01 });
        f_toon.addInput(PARAMS, 'pointPower',  { min: 0, max: 1,  step: 0.001 });
        const r = PARAMS.globalColor[0] * 255;
        const g = PARAMS.globalColor[1] * 255;
        const b = PARAMS.globalColor[2] * 255;
        pane.addInput({ color: { r, g, b }}, 'color', { picker: 'inline', expanded: true })
            .on('change', ev => {
                PARAMS.globalColor = [
                    ev.value.r / 255,
                    ev.value.g / 255,
                    ev.value.b / 255,
                ];
            });
        // ====================================================================

        // キャンバスのセットアップ
        webgl.initialize(canvas);
        webgl.width  = window.innerWidth;
        webgl.height = window.innerHeight;
        window.addEventListener('resize', () => {
            webgl.width  = window.innerWidth;
            webgl.height = window.innerHeight;
        });

        // カメラのインスタンスを生成
        const cameraOption = {
            distance: 5.0,
            min: 1.0,
            max: 20.0,
            move: 2.0,
        };
        camera = new WebGLOrbitCamera(canvas, cameraOption);

        await loadShaders();
        
        renderingProc();
    }

    function loadShaders() {
        return new Promise(resolve => {
            const promises = [
                WebGLUtility.loadFile('./shader/main.vert'),
                WebGLUtility.loadFile('./shader/main.frag'),
            ];

            Promise.all(promises).then(shaderSources => {
                const gl = webgl.gl;
                const vs = webgl.createShaderObject(shaderSources[0], gl.VERTEX_SHADER);
                const fs = webgl.createShaderObject(shaderSources[1], gl.FRAGMENT_SHADER);
                webgl.program = webgl.createProgramObject(vs, fs);

                // 満足したことを通知する
                resolve();
            });
        })
    }

    function renderingProc() {

        setupGeometry();
        setupLocation();
        startTime = Date.now();
        render();

    }

    /**
     * 頂点属性（頂点ジオメトリ）のセットアップを行う
     */
    function setupGeometry() {

        // 頂点の情報を定義する
        points = [];
        randomValue = [];

        for (let i = 0; i < POINT_COUNT; ++i) {
            const w = POINT_RANGE / 2;
            points.push(
                (Math.random() * 2.0 - 1.0) * w,
                (Math.random() * 2.0 - 1.0) * w,
                (Math.random() * 2.0 - 1.0) * w,
            );
            randomValue.push(
                Math.random(),
                Math.random(),
                Math.random(),
                Math.random(),
            );
        }

        pointVBO = [
            webgl.createVBO(points),
            webgl.createVBO(randomValue),
        ];
    }

    /**
     * ロケーションに関するセットアップを行う
     */
    function setupLocation() {
        const gl = webgl.gl;

        attLocation = [
            gl.getAttribLocation(webgl.program, 'position'),
            gl.getAttribLocation(webgl.program, 'randomValue'),
        ];
        attStride = [3, 4];

        uniLocation = {
            mvpMatrix      : gl.getUniformLocation(webgl.program, 'mvpMatrix'),
            globalColor    : gl.getUniformLocation(webgl.program, 'globalColor'),
            time           : gl.getUniformLocation(webgl.program, 'time'),
            pointSize      : gl.getUniformLocation(webgl.program, 'pointSize'),
            pointPower     : gl.getUniformLocation(webgl.program, 'power'),
        };
    }

    /**
     * 毎フレームごとにレンダリングのセットアップを行います
     * @param {number} time - 経過時間
     */
    function setupRendering(time) {
        const gl = webgl.gl;
        gl.viewport(0, 0, webgl.width, webgl.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // カリング
        gl.enable(gl.CULL_FACE);
        // 深度テスト
        gl.disable(gl.DEPTH_TEST); // 深度テストは行わない!!
        // ブレンド
        gl.enable(gl.BLEND)
        gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE); // 加算合成 ＋ アルファブレンド

        // ビュー x プロジェクション変換行列を生成
        vMatrix = camera.update();
        const fovy = 45;
        const aspect = webgl.width / webgl.height;
        const near = 0.1;
        const far = 50.0;
        pMatrix = m.perspective(fovy, aspect, near, far);
        vpMatrix = m.multiply(pMatrix, vMatrix);

        // 経過時間をシェーダに送る
        gl.uniform1f(uniLocation.time, time);
        // ポイントサイズ
        gl.uniform1f(uniLocation.pointSize, PARAMS.pointSize);
        // 頂点の発光に使う係数
        gl.uniform1f(uniLocation.pointPower, PARAMS.pointPower);
        // グローバルカラーを uniform 変数としてシェーダに送る
        gl.uniform4fv(uniLocation.globalColor, [
            PARAMS.globalColor[0],
            PARAMS.globalColor[1],
            PARAMS.globalColor[2],
            PARAMS.globalAlpha,
        ])
    }

    /**
     * メッシュ情報の更新と描画を行う
     * @param {number} time - 経過時間
     */
    function renderMesh(time) {
        const gl = webgl.gl;

        // VBO をバインドする
        webgl.enableAttribute(pointVBO, attLocation, attStride);

        // モデル座標変換行列を生成してシェーダに送る
        let mMatrix = m.identity(m.create());
        mMatrix = m.rotate(mMatrix, time * 0.05, [1.0, 1.0, 1.0]);
        const mvpMatrix = m.multiply(vpMatrix, mMatrix);
        gl.uniformMatrix4fv(uniLocation.mvpMatrix, false, mvpMatrix);

        // バインド中の頂点を点として描画する
        gl.drawArrays(gl.POINTS, 0, points.length / 3);
    }

    function render() {

        requestAnimationFrame(render);

        const nowTime = ( Date.now() - startTime) / 1000;

        // レンダリング時のクリア処理など
        setupRendering(nowTime);

        // メッシュを更新し描画を行う
        renderMesh(nowTime);

    }

})();