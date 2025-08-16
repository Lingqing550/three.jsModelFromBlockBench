class JsonModel {
  constructor(jsonPath) {
    this.jsonPath = jsonPath;
    this.isThreeJsLoader = false;
    this.canvasWidth = 300;
    this.canvasHeight = 300;
    this.animationPriority = 0;
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
    const cubeBox = new THREE.Object3D();
    let promiseList = [];
    const cubeBoxPosition = new THREE.Vector3();
    this.jsonModel.elements.forEach(jsonCube => promiseList.push(this.cubeMaker(jsonCube).then(cube => (cubeBoxPosition.add(cube.position), cubeBox.add(cube))).catch(err => console.error(`加载方块错误:${err}`))));
    await Promise.all(promiseList);
    cubeBoxPosition.divideScalar(cubeBox.children.length);
    const bigBox = new THREE.Object3D();
    cubeBox.position.set(-cubeBoxPosition.x, -cubeBoxPosition.y, -cubeBoxPosition.z);
    bigBox.add(cubeBox);
    scene.add(bigBox);
    console.log(cubeBoxPosition);
    camera.position.set(bigBox.position.x, bigBox.position.y, bigBox.position.z - 50);
    camera.lookAt(bigBox.position);
    scene.add(camera);
    renderer.clearDepth();
    this.rotateAnimation(bigBox, {
      "angle": 0.5, "axis": "y", "origin": [cubeBoxPosition.x, cubeBoxPosition.y, cubeBoxPosition.z]
    }, { renderer: renderer, camera: camera, scene: scene });
    this.mouseInteraction(renderer.domElement, bigBox, { renderer: renderer, camera: camera, scene: scene });
    renderer.render(scene, camera);
    this.threeJsModel = renderer.domElement;
    return renderer.domElement;
  };
  async cubeMaker(cubeObj) {
    const {
      name: cubeName,
      from: from,
      to: to,
      rotation: cubeRotation,
      faces: cubeFaces
    } = cubeObj;
    const mCTextureMap = ["east",
      "west",
      "up",
      "down",
      "south",
      "north"];
    let cubeTexture = new Array(6);
    for (let i = 0; i < 6; i++) {
      cubeTexture[i] = new THREE.MeshBasicMaterial({
        color: 0xffffff
      });
    };
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
  rotateAnimation(cubeObj, rotation, scenes) {
    const {
      angle: angle,
      axis: axis,
      origin: origin
    } = rotation;
    const {
      renderer: renderer,
      camera: camera,
      scene: scene
    } = scenes;
    let animation = 0;
    let allAngle = 0;
    const animationPriority = 1;
    switch (axis) {
      case "x":
        animation = () => {
          requestAnimationFrame(animation);
          if (this.animationPriority > animationPriority) {
            return;
          };
          this.animationPriority = animationPriority;
          allAngle += angle;
          cubeObj.rotation.x = (this.toHu(allAngle));
          renderer.render(scene, camera);
        };
        break;
      case "y":
        animation = () => {
          requestAnimationFrame(animation);
          if (this.animationPriority > animationPriority) {
            return;
          };
          this.animationPriority = animationPriority;
          allAngle += angle;
          cubeObj.rotation.y = (this.toHu(allAngle));
          renderer.render(scene, camera);
        };
        break;
      case "z":
        animation = () => {
          requestAnimationFrame(animation);
          if (this.animationPriority > animationPriority) {
            return;
          };
          this.animationPriority = animationPriority;
          allAngle += angle;
          cubeObj.rotation.z = (this.toHu(allAngle));
          renderer.render(scene, camera);
        };
        break;
    };
    animation();
    return animation;
  };
  mouseInteraction(element, cubeObj, scenes) {
    const {
      renderer: renderer,
      camera: camera,
      scene: scene
    } = scenes;
    const animationPriority = 2;
    let interaction = (e) => {
      if (this.animationPriority > animationPriority) {
        return;
      };
      cubeObj.rotateY(this.toHu(-e.movementX));
      cubeObj.rotateX(this.toHu(-e.movementY));
      renderer.render(scene, camera);
    };
    element.addEventListener('mousedown', () => {
      this.animationPriority = animationPriority;
      document.addEventListener('mousemove', interaction);
    });
    document.addEventListener('mouseup', () => {
      this.animationPriority = 0;
      interaction && document.removeEventListener('mousemove', interaction);
    })
  };
};