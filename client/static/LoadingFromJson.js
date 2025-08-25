/*by lingqing
  https://github.com/Lingqing550/three.jsModelFromBlockBench
*/

class JsonModel {
  constructor(jsonPath) {
    this.jsonPath = jsonPath;
    this.isThreeJsLoader = false;
    this.canvasWidth = 300;
    this.canvasHeight = 300;
    this.animationPriority = 0;
    this.three = {};
  };
  toHu(du) {
    return Math.PI * (du / 180);
  };
  async threeJsLoader() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = './lib/three.min.js';
      script.onload = () => {
        this.isThreeJsLoader = true;
        resolve();
      };
      script.onerror = (err) => {
        console.error(`Three.js加载失败:${err}`);
        reject(new Error('Three.js加载失败'));
      };
      document.head.appendChild(script);
    });
  };
  async jsonLoader() {
    !this.isThreeJsLoader && await this.threeJsLoader();
    this.jsonModel = await fetch(this.jsonPath).then(data => data.json()).catch(err => console.error('json文件加载失败:', err));
  };
  async sceneMaker() {
    !this.jsonModel && await this.jsonLoader();
    const scene = new THREE.Scene();
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 500);
    const renderer = new THREE.WebGLRenderer({ alpha: true, premultipliedAlpha: false });
    renderer.setSize(width, height);
    const bigBox = await this.bigBoxMaker();
    scene.add(bigBox);
    camera.position.set(bigBox.position.x, bigBox.position.y, bigBox.position.z - 50);
    camera.lookAt(0, 0, 0);
    scene.add(camera);
    renderer.clearDepth();
    this.three.allScene = { renderer: renderer, camera: camera, scene: scene };
    this.three.domElement = renderer.domElement;
    setInterval(() => {
      renderer.render(scene, camera);
    }, 16);
    return renderer.domElement;
  };
  async bigBoxMaker() {
    !this.isThreeJsLoader && await this.threeJsLoader();
    const cubeBox = new THREE.Object3D();
    let promiseList = [];
    const cubeBoxPosition = new THREE.Vector3();
    this.jsonModel.elements.forEach(jsonCube => promiseList.push(this.cubeMaker(jsonCube).then(cube => (cubeBoxPosition.add(cube.position), cubeBox.add(cube))).catch(err => console.error(`加载方块错误:${err}`))));
    await Promise.all(promiseList);
    cubeBoxPosition.divideScalar(cubeBox.children.length);
    const bigBox = new THREE.Object3D();
    cubeBox.position.set(-cubeBoxPosition.x, -cubeBoxPosition.y, -cubeBoxPosition.z);
    this.three.modelBox = bigBox;
    this.three.allModelCenter = cubeBoxPosition;
    bigBox.add(cubeBox);
    return bigBox;
  };
  async cubeMaker(cubeObj) {
    const {
      name: cubeName,
      from: from,
      to: to,
      rotation: cubeRotation,
      faces: cubeFaces
    } = cubeObj;
    const mCTextureMap = ["east", "west", "up", "down", "south", "north"];
    let cubeTexture = new Array(6);
    for (let i = 0; i < 6; i++) cubeTexture[i] = new THREE.MeshBasicMaterial({ color: 0xffffff });
    let promiseList = new Array();
    for (let i = 0; i < 6; i++) {
      if (cubeFaces[mCTextureMap[i]]) {
        promiseList.push(await this.textureMaker(cubeFaces[mCTextureMap[i]]).then(texture => cubeTexture[i] = texture).catch(err =>
          console.error('纹理加载失败:', err)));
      };
    };
    await Promise.all(promiseList);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(to[0] - from[0], to[1] - from[1], to[2] - from[2]), cubeTexture);
    cube.name = cubeName;
    cube.position.set((to[0] - from[0]) / 2 + from[0], (to[1] - from[1]) / 2 + from[1], (to[2] - from[2]) / 2 + from[2]);
    cubeRotation && this.cubeTurn(cube, cubeRotation);
    return cube;
  };
  cubeTurn(cubeObj, rotation) {
    const {
      angle: angle,
      axis: axis,
      origin: origin
    } = rotation;
    switch (axis) {
      case "x":
        const distanceXX = Math.cos(this.toHu(angle)) * (cubeObj.position.z - origin[2]) + Math.sin(this.toHu(angle)) * (cubeObj.position.y - origin[1]);
        const distanceXY = Math.cos(this.toHu(angle)) * (cubeObj.position.y - origin[1]) - Math.sin(this.toHu(angle)) * (cubeObj.position.z - origin[2]);
        cubeObj.position.z = (distanceXX + origin[2]);
        cubeObj.position.y = (distanceXY + origin[1]);
        cubeObj.rotation.x += this.toHu(angle);
        break;
      case "y":
        const distanceYX = Math.cos(this.toHu(angle)) * (cubeObj.position.x - origin[0]) + Math.sin(this.toHu(angle)) * (cubeObj.position.z - origin[2]);
        const distanceYY = Math.cos(this.toHu(angle)) * (cubeObj.position.z - origin[2]) - Math.sin(this.toHu(angle)) * (cubeObj.position.x - origin[0]);
        cubeObj.position.x = (distanceYX + origin[0]);
        cubeObj.position.z = (distanceYY + origin[2]);
        cubeObj.rotation.y += this.toHu(angle);
        break;
      case "z":
        const distanceZX = Math.cos(this.toHu(angle)) * (cubeObj.position.x - origin[0]) + Math.sin(this.toHu(angle)) * (cubeObj.position.y - origin[1]);
        const distanceZY = Math.cos(this.toHu(angle)) * (cubeObj.position.y - origin[1]) - Math.sin(this.toHu(angle)) * (cubeObj.position.x - origin[0]);
        cubeObj.position.x = distanceZX + origin[0];
        cubeObj.position.y = distanceZY + origin[1];
        cubeObj.rotation.z += this.toHu(angle);
        break;
    };
  };
  textureMaker(texture) {
    const {
      uv: uv,
      rotation: rotation
    } = texture;
    const texturePath = this.jsonPath.substr(0, this.jsonPath.lastIndexOf('/') + 1) + this.jsonModel.textures[texture.texture.substr(1)].substr(2);
    let temporary = 0;
    let flip = "";
    uv[0] > uv[2] && (temporary = uv[0], uv[0] = uv[2], uv[2] = temporary, flip = flip + "x");
    uv[1] > uv[3] && (temporary = uv[1], uv[1] = uv[3], uv[3] = temporary, flip = flip + "y");
    return this.imgLoader(texturePath).then((texture) => {
      const loadedTexture = texture;
      const textureWidth = (uv[2] - uv[0]) * 4;
      const textureHeight = (uv[3] - uv[1]) * 4;
      const canvas = document.createElement('canvas');
      canvas.width = textureWidth;
      canvas.height = textureHeight;
      const ctx = canvas.getContext('2d');
      let endCanvas = canvas;
      flip.includes('x') && (ctx.translate(canvas.width, 0), ctx.scale(-1, 1));
      flip.includes('xy') && (ctx.translate(canvas.width, xanvas.height), ctx.scale(-1, -1));
      flip.includes('y') && (ctx.translate(0, canvas.height), ctx.scale(1, -1));
      ctx.drawImage(loadedTexture, uv[0] * 4, uv[1] * 4, textureWidth, textureHeight, 0, 0, textureWidth, textureHeight);
      if (rotation) {
        const newCanvas = document.createElement('canvas');
        if (rotation % 180 != 0) {
          newCanvas.width = textureHeight;
          newCanvas.height = textureWidth;
          const newCtx = newCanvas.getContext('2d');
          newCtx.translate(newCanvas.width / 2, newCanvas.height / 2);
          newCtx.rotate(this.toHu(rotation));
          newCtx.drawImage(endCanvas, -canvas.width / 2, -canvas.height / 2);
          endCanvas = newCanvas;
        };
      };
      return new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(endCanvas,
          THREE.UVMapping,
          THREE.ClampToEdgeWrapping,
          THREE.ClampToEdgeWrapping,
          THREE.NearestFilter),
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide
      });
    }).catch(err => console.error('纹理未成功加载:' + err))
  };
  imgLoader(imgPath) {
    return new Promise((resolve,
      reject) => {
      new THREE.TextureLoader().load(imgPath, texture => resolve(texture.image), undefined, err => reject(new Error(`纹理图片加载失败:${err}`)));
    });
  };
  addRotateAnimation(rotation) {
    !this.three.modelBox && this.bigBoxMaker();
    const {
      angle: angle,
      axis: axis
    } = rotation;
    const animationPriority = 1;
    const animation = () => {
      requestAnimationFrame(animation);
      if (this.animationPriority > animationPriority) {
        return;
      };
      this.animationPriority = animationPriority;
      this.three.modelBox.rotation[axis] += (this.toHu(angle));
    };
    animation();
    return animation;
  };
  addMouseInteraction() {
    !this.three.modelBox && this.bigBoxMaker();
    const animationPriority = 2;
    let interaction = (e) => {
      if (this.animationPriority > animationPriority) {
        return;
      };
      this.three.modelBox.rotateY(this.toHu(-e.movementX));
      this.three.modelBox.rotateX(this.toHu(-e.movementY));
    };
    this.three.domElement.addEventListener('mousedown', () => {
      this.animationPriority = animationPriority;
      document.addEventListener('mousemove', interaction);
    });
    document.addEventListener('mouseup', () => {
      this.animationPriority = 0;
      interaction && document.removeEventListener('mousemove', interaction);
    })
  };
  animationMaker() {
    if (!this.jsonModel.animations) {
      throw new Error("模型不包含动画或模型未加载");
    };
    const animationsJson = this.jsonModel.animations;
    let animationsList = [];
    animationsJson.forEach(animations => {
      let clipKeyList = [];
      Object.keys(animations.animation).forEach(part => {
        Object.keys(animations.animation[part]).forEach(clipJsonName => {
          let values = [];
          let times = Object.keys(animations.animation[part][clipJsonName]);
          times.forEach(time => {
            values = values.concat(animations.animation[part][clipJsonName][time]);
          });
          times = times.map(Number);
          if (clipJsonName == "rotation") {
            values = values.map(this.toHu);
            const kfX = new THREE.KeyframeTrack(`${part}.${clipJsonName}[x]`, times, [values[0], values[3], values[6]]);
            const kfY = new THREE.KeyframeTrack(`${part}.${clipJsonName}[y]`, times, [values[1], values[4], values[7]]);
            const kfZ = new THREE.KeyframeTrack(`${part}.${clipJsonName}[z]`, times, [values[2], values[5], values[8]]);
            clipKeyList.push(kfX, kfY, kfZ);
          } else {
            const kF = new THREE.KeyframeTrack(`${part}.${clipJsonName}`, times, values);
            clipKeyList.push(kF);
          };
        });
      });
      const clip = new THREE.AnimationClip(animations.name, animations.time, clipKeyList);
      animationsList.push(clip);
    });
    this.three.animationsList = animationsList;
    return animationsList;
  };
  animationPlayer(animationIndex) {
    !this.three.animationsList && this.animationMaker();
    const animation = this.three.animationsList[animationIndex];
    const mixer = new THREE.AnimationMixer(this.three.modelBox);
    const clipAction = mixer.clipAction(animation);
    clipAction.play();
    const clock = new THREE.Clock();
    const loop = () => {
      requestAnimationFrame(loop);
      const frame = clock.getDelta();
      mixer.update(frame);
    };
    loop();
  };
};