const canvas = document.querySelector("#globe");
const spinToggle = document.querySelector("#spinToggle");
const statusEl = document.querySelector("#status");
const textureBase = "https://unpkg.com/three@0.166.1/examples/textures/planets/";
const countryDataUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
const countryLabelUrl = "https://cdn.jsdelivr.net/npm/world-countries@5.1.0/countries.json";
const priorityCountryCodes = new Set(["KOR", "JPN", "CHN", "USA", "RUS", "IND", "GBR", "FRA", "DEU"]);
const koreanCapitals = {
  KOR: "서울",
  JPN: "도쿄",
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030712, 0.035);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 0.7, 6.2);

const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 3.2;
controls.maxDistance = 9;
controls.rotateSpeed = 0.7;
controls.zoomSpeed = 0.75;

const globeGroup = new THREE.Group();
scene.add(globeGroup);

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(2, 128, 128),
  new THREE.MeshStandardMaterial({
    map: makeOceanTexture(),
    roughness: 0.74,
    metalness: 0.02,
  }),
);
earth.rotation.y = 2.15;
globeGroup.add(earth);

const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(2.035, 128, 128),
  new THREE.MeshStandardMaterial({
    map: makeFallbackCloudTexture(),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  }),
);
globeGroup.add(clouds);

const graticule = new THREE.Group();
earth.add(graticule);
addGraticule(graticule);
addCityMarkers(earth);
loadCountryMap(earth);

const labelGroup = new THREE.Group();
earth.add(labelGroup);
const globeLabels = [];
addOceanLabels(labelGroup);
loadCountryLabels(labelGroup);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(2.12, 128, 128),
  new THREE.MeshBasicMaterial({
    color: 0x77d4ff,
    transparent: true,
    opacity: 0.14,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
  }),
);
globeGroup.add(atmosphere);

const stars = new THREE.Points(
  makeStarGeometry(1400),
  new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.018,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  }),
);
scene.add(stars);

scene.add(new THREE.AmbientLight(0x9fc8ff, 0.55));

const sun = new THREE.DirectionalLight(0xffffff, 2.6);
sun.position.set(5, 3, 4);
scene.add(sun);

const rim = new THREE.DirectionalLight(0x77d4ff, 1.2);
rim.position.set(-4, 1.5, -3);
scene.add(rim);

let autoSpin = true;
loadCloudTexture();

spinToggle.addEventListener("click", () => {
  autoSpin = !autoSpin;
  spinToggle.classList.toggle("active", autoSpin);
  spinToggle.setAttribute("aria-pressed", String(autoSpin));
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);

  if (autoSpin) {
    earth.rotation.y += 0.0018;
    clouds.rotation.y += 0.0024;
  }

  clouds.rotation.z = Math.sin(performance.now() * 0.0002) * 0.015;
  stars.rotation.y += 0.00012;
  controls.update();
  updateLabelVisibility();
  renderer.render(scene, camera);
}

function loadCloudTexture() {
  textureLoader.load(`${textureBase}earth_clouds_1024.png`, (texture) => {
    texture.encoding = THREE.sRGBEncoding;
    clouds.material.map = texture;
    clouds.material.needsUpdate = true;
  });
}

function makeOceanTexture() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 4096;
  canvasTexture.height = 2048;
  const ctx = canvasTexture.getContext("2d");
  const ocean = ctx.createLinearGradient(0, 0, 0, canvasTexture.height);
  ocean.addColorStop(0, "#11558c");
  ocean.addColorStop(0.5, "#0b6d8a");
  ocean.addColorStop(1, "#07395f");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function makeFallbackCloudTexture() {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 2048;
  canvasTexture.height = 1024;
  const ctx = canvasTexture.getContext("2d");
  ctx.clearRect(0, 0, canvasTexture.width, canvasTexture.height);

  for (let i = 0; i < 150; i += 1) {
    const x = Math.random() * canvasTexture.width;
    const y = Math.random() * canvasTexture.height;
    const width = 70 + Math.random() * 210;
    const height = 8 + Math.random() * 34;
    const alpha = 0.08 + Math.random() * 0.16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((Math.random() - 0.5) * 0.5);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, width);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, width, height, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

function addGraticule(parent) {
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.14,
  });

  for (let lat = -60; lat <= 60; lat += 30) {
    parent.add(makeLatitudeLine(lat, material));
  }

  for (let lon = -150; lon <= 180; lon += 30) {
    parent.add(makeLongitudeLine(lon, material));
  }
}

function makeLatitudeLine(latitude, material) {
  const points = [];
  for (let lon = -180; lon <= 180; lon += 3) {
    points.push(latLonToVector(latitude, lon, 2.006));
  }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

function makeLongitudeLine(longitude, material) {
  const points = [];
  for (let lat = -90; lat <= 90; lat += 3) {
    points.push(latLonToVector(lat, longitude, 2.006));
  }
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function addCityMarkers(parent) {
  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffdf73 });
  const cities = [
    [37.5665, 126.978, "Seoul"],
    [35.6762, 139.6503, "Tokyo"],
    [39.9042, 116.4074, "Beijing"],
    [28.6139, 77.209, "Delhi"],
    [51.5072, -0.1276, "London"],
    [48.8566, 2.3522, "Paris"],
    [40.7128, -74.006, "New York"],
    [34.0522, -118.2437, "Los Angeles"],
    [-33.8688, 151.2093, "Sydney"],
    [-23.5505, -46.6333, "Sao Paulo"],
    [30.0444, 31.2357, "Cairo"],
  ];

  cities.forEach(([lat, lon, name]) => {
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 10), markerMaterial);
    marker.position.copy(latLonToVector(lat, lon, 2.045));
    marker.name = name;
    parent.add(marker);
  });
}

async function loadCountryMap(parent) {
  try {
    const response = await fetch(countryDataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const world = await response.json();
    const countries = topojson.feature(world, world.objects.countries);
    earth.material.map = makeCountryTexture(countries.features);
    earth.material.needsUpdate = true;

    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0xdff7ff,
      transparent: true,
      opacity: 0.42,
    });
    const borders = new THREE.Group();

    countries.features.forEach((country) => {
      const polygons =
        country.geometry.type === "Polygon"
          ? [country.geometry.coordinates]
          : country.geometry.coordinates;

      polygons.forEach((polygon) => {
        polygon.forEach((ring) => {
          if (ring.length < 2) return;
          const points = ring.map(([lon, lat]) => latLonToVector(lat, lon, 2.014));
          borders.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), borderMaterial));
        });
      });
    });

    parent.add(borders);
    statusEl.textContent = "드래그해서 회전하고 휠로 확대하세요. 가까이 확대하면 나라 이름이 더 잘 보입니다";
  } catch {
    statusEl.textContent = "국가 지도 데이터를 불러오지 못해 바다만 표시 중입니다";
  }
}

async function loadCountryLabels(parent) {
  try {
    const response = await fetch(countryLabelUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const countries = await response.json();

    countries
      .filter((country) => Array.isArray(country.latlng) && country.latlng.length === 2)
      .sort((a, b) => (b.area || 0) - (a.area || 0))
      .forEach((country, index) => {
        const [lat, lon] = country.latlng;
        const capital = koreanCapitals[country.cca3] || country.capital?.[0] || "수도 정보 없음";
        const koreanName = country.translations?.kor?.common;
        const name = koreanName || country.name?.common || "Unknown";
        const priority = index < 44 || priorityCountryCodes.has(country.cca3);
        const label = makeTextLabel(`${name} (${capital})`, {
          fill: priority ? "#f7fbff" : "#e2edf5",
          stroke: "rgba(5, 12, 25, 0.82)",
          fontSize: priority ? 42 : 34,
          maxWidth: priority ? 500 : 420,
        });
        label.position.copy(latLonToVector(lat, lon, priority ? 2.22 : 2.18));
        label.userData.kind = "country";
        label.userData.priority = priority;
        label.userData.minZoom = priority ? 8.2 : 5.15;
        parent.add(label);
        globeLabels.push(label);
      });
  } catch {
    statusEl.textContent = "국가 지도는 표시 중입니다. 나라/수도 라벨은 불러오지 못했습니다";
  }
}

function addOceanLabels(parent) {
  [
    ["태평양", 8, -150, 0.72],
    ["태평양", -18, 165, 0.64],
    ["대서양", 12, -32, 0.62],
    ["인도양", -24, 78, 0.58],
    ["북극해", 76, 30, 0.5],
    ["남극해", -62, 45, 0.5],
  ].forEach(([name, lat, lon, scale]) => {
    const label = makeTextLabel(name, {
      fill: "rgba(196, 235, 255, 0.92)",
      stroke: "rgba(2, 12, 24, 0.7)",
      fontSize: 56,
      maxWidth: 300,
    });
    label.position.copy(latLonToVector(lat, lon, 2.24));
    label.scale.multiplyScalar(scale);
    label.userData.kind = "ocean";
    label.userData.priority = true;
    label.userData.minZoom = 9;
    parent.add(label);
    globeLabels.push(label);
  });
}

function makeTextLabel(text, options = {}) {
  const fontSize = options.fontSize || 36;
  const maxWidth = options.maxWidth || 420;
  const paddingX = 22;
  const paddingY = 13;
  const canvasLabel = document.createElement("canvas");
  const ctx = canvasLabel.getContext("2d");
  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  const measured = Math.min(ctx.measureText(text).width, maxWidth);
  canvasLabel.width = Math.ceil(measured + paddingX * 2);
  canvasLabel.height = Math.ceil(fontSize + paddingY * 2);

  ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = options.stroke || "rgba(5, 12, 25, 0.82)";
  ctx.lineWidth = 8;
  ctx.fillStyle = options.fill || "#f7fbff";
  const labelText = fitText(ctx, text, maxWidth);
  ctx.strokeText(labelText, canvasLabel.width / 2, canvasLabel.height / 2);
  ctx.fillText(labelText, canvasLabel.width / 2, canvasLabel.height / 2);

  const texture = new THREE.CanvasTexture(canvasLabel);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  const width = canvasLabel.width / 420;
  const height = canvasLabel.height / 420;
  sprite.scale.set(width, height, 1);
  return sprite;
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let fitted = text;
  while (fitted.length > 4 && ctx.measureText(`${fitted}...`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}...`;
}

function updateLabelVisibility() {
  const earthCenter = new THREE.Vector3();
  earth.getWorldPosition(earthCenter);
  const cameraDirection = camera.position.clone().sub(earthCenter).normalize();
  const cameraDistance = camera.position.distanceTo(earthCenter);
  const zoomScore = 10 - cameraDistance;
  const worldPosition = new THREE.Vector3();

  globeLabels.forEach((label) => {
    label.getWorldPosition(worldPosition);
    const surfaceDirection = worldPosition.clone().sub(earthCenter).normalize();
    const onFrontSide = surfaceDirection.dot(cameraDirection) > 0.2;
    const closeEnough = label.userData.kind === "ocean" || label.userData.priority || zoomScore >= label.userData.minZoom;
    label.visible = onFrontSide && closeEnough;
    label.material.opacity = label.userData.kind === "ocean" ? 0.82 : 0.94;
  });
}

function makeCountryTexture(countries) {
  const canvasTexture = document.createElement("canvas");
  canvasTexture.width = 4096;
  canvasTexture.height = 2048;
  const ctx = canvasTexture.getContext("2d");
  const ocean = ctx.createLinearGradient(0, 0, 0, canvasTexture.height);
  ocean.addColorStop(0, "#125a92");
  ocean.addColorStop(0.5, "#0a718f");
  ocean.addColorStop(1, "#073a62");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);

  countries.forEach((country, index) => {
    const polygons =
      country.geometry.type === "Polygon"
        ? [country.geometry.coordinates]
        : country.geometry.coordinates;
    ctx.fillStyle = landColor(index);
    ctx.strokeStyle = "rgba(235, 248, 255, 0.72)";
    ctx.lineWidth = 1.7;

    polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        drawProjectedRing(ctx, ring, canvasTexture.width, canvasTexture.height);
        ctx.fill();
        ctx.stroke();
      });
    });
  });

  drawMapGrain(ctx, canvasTexture.width, canvasTexture.height);

  const texture = new THREE.CanvasTexture(canvasTexture);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function drawProjectedRing(ctx, ring, width, height) {
  ctx.beginPath();

  ring.forEach(([lon, lat], index) => {
    const x = ((lon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;

    if (index === 0) {
      ctx.moveTo(x, y);
      return;
    }

    const [prevLon, prevLat] = ring[index - 1];
    const prevX = ((prevLon + 180) / 360) * width;
    const prevY = ((90 - prevLat) / 180) * height;
    if (Math.abs(x - prevX) > width * 0.5) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }

    if (index === ring.length - 1 && Math.abs(x - prevX) <= width * 0.5) {
      ctx.lineTo(prevX, prevY);
    }
  });

  ctx.closePath();
}

function landColor(index) {
  const colors = ["#4f8a4f", "#6f9652", "#8d9857", "#3f7d5d", "#6d8e46", "#998d55"];
  return colors[index % colors.length];
}

function drawMapGrain(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 2200; i += 1) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function latLonToVector(latitude, longitude, radius) {
  const phi = THREE.MathUtils.degToRad(90 - latitude);
  const theta = THREE.MathUtils.degToRad(longitude + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function makeStarGeometry(count) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = 18 + Math.random() * 30;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function noise(value) {
  const raw = Math.sin(value * 12.9898) * 43758.5453;
  return raw - Math.floor(raw);
}

window.addEventListener("resize", resize);
resize();
animate();
