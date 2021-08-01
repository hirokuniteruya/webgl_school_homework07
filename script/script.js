import { WebGLUtility, WebGLOrbitCamera, WebGLMath, Mat4, Vec3, Vec2, Qtn, WebGLGeometry } from './webgl.js';

(() => {
    // DOM への参照の取得
    const canvas = document.getElementById('webgl-canvas');

    // webgl.js に記載のクラスを扱いやすいように変数に入れておく
    const webgl = new WebGLUtility();
    const geo   = WebGLGeometry;
    const m     = Mat4;

    // 複数の関数で利用する広いスコープが必要な変数を宣言しておく
    let startTime  = 0;
    let waveOffset = 0;

    // tweakpane で操作するパラメータ
    const PARAMS = {
        gradient        : 4,
        globalColor     : [0.1, 0.7, 0.4],
        inflate         : 0.02,
        isEdgeRendering : true,
        isTexture       : true,
        isToonShading   : true,
        amplitude       : 10,
    }

    // ジオメトリ情報, VBO, IBO
    let plane    = null; // プレーンのジオメトリ情報
    let planeVBO = null; // プレーン用の VBO
    let planeIBO = null; // プレーン用の IBO

    // ロケーションとストライド
    let attLocation = null;
    let attStride   = null;
    let uniLocation = null;

    // 行列
    let vMatrix     = null; // ビュー変換行列
    let pMatrix     = null; // プロジェクション変換行列
    let vpMatrix    = null; // ビュー x プロジェクション変換行列

    let camera      = null; // オービットコントロール風カメラ

    // テクスチャオブジェクト
    let texture     = null;
    let texture_b   = null;

    window.addEventListener('DOMContentLoaded', main, false);

    async function main() {
        // special thanks! https://github.com/cocopon/tweakpane ===============
        const pane = new Tweakpane.Pane({
            container: document.querySelector('#float-layer'),
        });
        const f_toon = pane.addFolder({
            title: 'トゥーンレンダリング',
            expanded: true,
        })
        f_toon.addInput(PARAMS, 'isToonShading');
        f_toon.addInput(PARAMS, 'gradient', { min: 0, max: 8, step: 1 });
        f_toon.addInput(PARAMS, 'isEdgeRendering');
        f_toon.addInput(PARAMS, 'inflate', { min: 0, max: 0.5, step: 0.01 });
        const f_others = pane.addFolder({
            title: 'その他',
            expanded: true,
        })
        f_others.addInput(PARAMS, 'isTexture');
        f_others.addInput(PARAMS, 'amplitude', { min: 0, max: 100, step: 1 });
        // pane.addInput(PARAMS, 'globalColor');
        // ====================================================================

        webgl.initialize(canvas);
        webgl.width  = window.innerWidth;
        webgl.height = window.innerHeight;
        window.addEventListener('resize', () => {
            webgl.width  = window.innerWidth;
            webgl.height = window.innerHeight;
        });

        // カメラのインスタンスを生成
        const cameraOption = {
            distance: 3.0,
            min: -3,
            max: 3.0,
            move: 2.0,
        };
        camera = new WebGLOrbitCamera(canvas, cameraOption);
        camera.defaultPosition = [-3.0, 2.0, 0.0];

        await loadImages();
        await loadShaders();
        
        renderingProc();
    }

    function loadImages() {
        return new Promise(resolve => {
            const imagesUrl = [
                './img/sea.jpg',
                './img/sky.jpg'
            ];

            const images = [];
            let loadingCount = 0;

            for (let i = 0; i < imagesUrl.length; i++) {
                images[i] = new Image();

                images[i].addEventListener('load', () => {
                    if (++loadingCount === imagesUrl.length) {
                        console.log('画像を全て読み込んだ');

                        const gl = webgl.gl;

                        // 全ての画像がロードできたので、テクスチャオブジェクトを生成する
                        texture = webgl.createTexture(images[0]);
                        texture_b = webgl.createTexture(images[1]);
                        // ユニット番号が 0 であるユニットに対してテクスチャを予めバインドしておく
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, texture);

                        resolve();
                    }
                })

                images[i].src = imagesUrl[i];
            }

            //

            // // 空の Image オブジェクト（<img> タグに相当）を生成
            // const image = new Image();

            // // ロード完了後の処理を定義
            // image.addEventListener('load', () => {
            //     const gl = webgl.gl;

            //     // 画像がロードできたので、テクスチャオブジェクトを生成する
            //     texture = webgl.createTexture(image);
            //     // ユニット番号が 0 であるユニットに対してテクスチャを予めバインドしておく
            //     gl.activeTexture(gl.TEXTURE0);
            //     gl.bindTexture(gl.TEXTURE_2D, texture);

            //     // 満足したことを通知する
            //     resolve();
            // }, false);

            // // ロードを開始
            // image.src = './img/sea_at_dusk.jpg';
        })
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

        canvas.addEventListener('mousemove', onMousemove, false);

        startTime = Date.now();
        render();

    }

    function setupGeometry() {
        plane = createPlane(2.0, 2.0, 32, 1, [1.0, 1.0, 1.0, 1.0]);
        console.log('plane: ', plane);
        planeVBO = [
            webgl.createVBO(plane.position),
            webgl.createVBO(plane.normal),
            webgl.createVBO(plane.texCoord),
        ];
        planeIBO = webgl.createIBO(plane.index);
    }

    function setupLocation() {
        const gl = webgl.gl;

        attLocation = [
            gl.getAttribLocation(webgl.program, 'position'),
            gl.getAttribLocation(webgl.program, 'normal'),
            gl.getAttribLocation(webgl.program, 'texCoord'),
        ];
        attStride = [3, 3, 2];

        uniLocation = {
            mvpMatrix      : gl.getUniformLocation(webgl.program, 'mvpMatrix'),
            normalMatrix   : gl.getUniformLocation(webgl.program, 'normalMatrix'),
            lightDirection : gl.getUniformLocation(webgl.program, 'lightDirection'),
            textureUnit    : gl.getUniformLocation(webgl.program, 'textureUnit'),
            isTexture      : gl.getUniformLocation(webgl.program, 'isTexture'),
            isToonShading  : gl.getUniformLocation(webgl.program, 'isToonShading'),
            isEdge         : gl.getUniformLocation(webgl.program, 'isEdge'),
            amplitude      : gl.getUniformLocation(webgl.program, 'amplitude'),
            globalColor    : gl.getUniformLocation(webgl.program, 'globalColor'),
            gradient       : gl.getUniformLocation(webgl.program, 'gradient'),
            inflate        : gl.getUniformLocation(webgl.program, 'inflate'),
            isBack         : gl.getUniformLocation(webgl.program, 'isBack'),
            time           : gl.getUniformLocation(webgl.program, 'time'),
            waveOffset     : gl.getUniformLocation(webgl.program, 'waveOffset'),
        };
    }

    function setupRendering(time) {
        const gl = webgl.gl;
        gl.viewport(0, 0, webgl.width, webgl.height);
        gl.clearColor(0.3, 0.3, 0.3, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // カリング
        gl.enable(gl.CULL_FACE);
        // 深度テスト
        gl.enable(gl.DEPTH_TEST);

        // ビュー x プロジェクション変換行列を生成
        vMatrix = camera.update();
        // console.log(camera.position);
        const fovy = 45;
        const aspect = webgl.width / webgl.height;
        const near = 0.1;
        const far = 20.0;
        pMatrix = m.perspective(fovy, aspect, near, far);
        vpMatrix = m.multiply(pMatrix, vMatrix);

        // ライトベクトルを uniform 変数としてシェーダに送る
        gl.uniform3fv(uniLocation.lightDirection, [1.0, 1.0, 1.0]);
        // テクスチャユニットの番号をシェーダに送る
        gl.uniform1i(uniLocation.textureUnit, 0);
        // テクスチャを使うかどうかのフラグをシェーダに送る
        gl.uniform1i(uniLocation.isTexture, PARAMS.isTexture);
        // トゥーンシェーディングを行うかどうかのフラグをシェーダに送る
        gl.uniform1i(uniLocation.isToonShading, PARAMS.isToonShading);
        // グローバルカラーを uniform 変数としてシェーダに送る
        gl.uniform3fv(uniLocation.globalColor, PARAMS.globalColor);
        // 階調が何段階あるか（トゥーンシェーディングの解像度）
        gl.uniform1f(uniLocation.gradient, PARAMS.gradient);
        // エッジ描画時に膨らませる量
        gl.uniform1f(uniLocation.inflate, PARAMS.inflate);
        // 波の振幅をシェーダに送る
        gl.uniform1f(uniLocation.amplitude, PARAMS.amplitude);
        // 経過時間をシェーダに送る
        gl.uniform1f(uniLocation.time, time);
        // 波のオフセットをシェーダに送る
        gl.uniform1f(uniLocation.waveOffset, waveOffset);
    }

    function renderMesh() {
        const gl = webgl.gl;

        // プレーンの VBO と IBO をバインドする
        webgl.enableAttribute(planeVBO, attLocation, attStride);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, planeIBO);

        // モデル座標変換行列を生成してシェーダに送る
        let mMatrix = m.identity(m.create());
        gl.uniformMatrix4fv(uniLocation.mMatrix, false, mMatrix);

        // 法線変換用の行列を生成してシェーダに送る
        const normalMatrix = m.transpose(m.inverse(mMatrix));
        gl.uniformMatrix4fv(uniLocation.normalMatrix, false, normalMatrix);

        // mvp 行列を生成してシェーダに送る
        const mvpMatrix = m.multiply(vpMatrix, mMatrix);
        gl.uniformMatrix4fv(uniLocation.mvpMatrix, false, mvpMatrix);

        // 表側を描画する ----------------------------
        gl.uniform1i(uniLocation.isBack, false);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // もし、エッジを描画するフラグが有効なら、エッジを描画する
        if (PARAMS.isEdgeRendering === true) {
            // カリング面を反転
            gl.cullFace(gl.FRONT);
            gl.uniform1i(uniLocation.isEdge, true);
            gl.drawElements(gl.TRIANGLES, plane.index.length, gl.UNSIGNED_SHORT, 0);
        }

        // カラー表示される頂点を描画する
        gl.cullFace(gl.BACK);
        gl.uniform1i(uniLocation.isEdge, false);
        // バインド中の頂点を描画する
        gl.drawElements(gl.TRIANGLES, plane.index.length, gl.UNSIGNED_SHORT, 0);

        // 裏側を描画する ----------------------------
        gl.uniform1i(uniLocation.isBack, true);
        gl.bindTexture(gl.TEXTURE_2D, texture_b);

        // もし、エッジを描画するフラグが有効なら、エッジを描画する
        if (PARAMS.isEdgeRendering === true) {
            // カリング面を反転
            gl.cullFace(gl.BACK);
            gl.uniform1i(uniLocation.isEdge, true);
            gl.drawElements(gl.TRIANGLES, plane.index.length, gl.UNSIGNED_SHORT, 0);
        }

        // カラー表示される頂点を描画する
        gl.cullFace(gl.FRONT);
        gl.uniform1i(uniLocation.isEdge, false);
        // バインド中の頂点を描画する
        gl.drawElements(gl.TRIANGLES, plane.index.length, gl.UNSIGNED_SHORT, 0);
    }

    function render() {

        requestAnimationFrame(render);

        const nowTime = ( Date.now() - startTime) / 1000;

        // レンダリング時のクリア処理など
        setupRendering(nowTime);

        // メッシュを更新し描画を行う
        renderMesh();

    }

    function onMousemove(e) {
        const x = e.offsetX / webgl.width;
        waveOffset = 2 * Math.PI * x;
    }

    /**
     * 板ポリゴンの頂点情報を生成する
     * 参考: https://github.com/mrdoob/three.js/blob/master/src/geometries/PlaneGeometry.js
     * @param {number} width - 板ポリゴンの一辺の幅
     * @param {number} height - 板ポリゴンの一辺の高さ
     * @param {number} widthSegments - 板ポリゴンの横方向の分割数
     * @param {number} heightSegments - 板ポリゴンの縦方向の分割数
     * @param {Array.<number>} color - RGBA を 0.0 から 1.0 の範囲で指定した配列
     * @returns {object}
     */
    function createPlane(width, height, widthSegments, heightSegments, color) {

        const width_half  = width / 2;
        const height_half = height / 2;

        const gridX = Math.floor(widthSegments);
        const gridY = Math.floor(heightSegments);
        const gridX1 = gridX + 1;
        const gridY1 = gridY + 1;

        const segment_width  = width  / gridX;
        const segment_height = height / gridY;

        //

        const indices  = [];
        const vertices = [];
        const normals  = [];
        const colors   = [];
        const uvs      = [];

        // 頂点情報（座標、法線、テクスチャ座標、色）の算出と格納
        for (let iy = 0; iy < gridY1; iy++) {

            const y = - height_half + iy * segment_height;

            for (let ix = 0; ix < gridX1; ix++) {

                const x = - width_half + ix * segment_width;

                vertices.push(x, -y, 0);

                normals.push(0, 0, 1);

                colors.push(...color);

                uvs.push( ix / gridX );
                uvs.push( iy / gridY );

            }

        }

        // 頂点情報（インデックス）の算出と格納
        for (let iy = 0; iy < gridY; iy++) {

            for (let ix = 0; ix < gridX; ix++) {

                const a = ix + gridX1 * iy;
                const b = ix + gridX1 * ( iy + 1 );
                const c = ( ix + 1 ) + gridX1 * ( iy + 1 );
                const d = ( ix + 1 ) + gridX1 * iy;

                indices.push(a, b, d);
                indices.push(b, c, d);

            }
        }

        return {
            position: vertices,
            normal: normals,
            color: colors,
            texCoord: uvs,
            index: indices
        }
    }
    
})();