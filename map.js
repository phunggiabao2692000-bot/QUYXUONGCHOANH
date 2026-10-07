<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<title>Xem bản đồ</title>
<style>
  body{margin:0;overflow:hidden;background:#000;font-family:'Segoe UI',Arial,sans-serif}
  #info{position:absolute;top:10px;left:10px;color:#fff;background:rgba(0,0,0,.7);padding:10px 14px;font-size:14px;line-height:1.7;border:1px solid #522}
  #info b{display:inline-block;width:12px;height:12px;margin-right:6px;vertical-align:middle}
  #err{display:none;position:fixed;left:0;right:0;bottom:0;background:#b00;color:#fff;padding:10px 14px}
  button{margin-top:8px;padding:6px 14px;background:#600;color:#fff;border:1px solid #c00;cursor:pointer;font-family:inherit}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
<div id="info">
  <div><b style="background:#3399ff"></b>Chỗ người chơi xuất hiện</div>
  <div><b style="background:#ff2200"></b>Chỗ quái vật xuất hiện</div>
  <div><b style="background:#ffd700"></b>Chìa khóa</div>
  <div><b style="background:#33ff66"></b>Pin (4 cái)</div>
  <div><b style="background:#8b4513"></b>Cửa thoát hiểm</div>
  <hr>
  <div><b>WASD</b> kéo bản đồ &nbsp; <b>Q / E</b> phóng to / thu nhỏ</div>
  <div><b>C</b> bật/tắt trần nhà &nbsp; <b>F</b> chế độ sáng / tối</div>
  <button onclick="location.reload()">Tạo mê cung mới</button>
</div>
<div id="err"></div>

<script>
try {
// =====================================================
//  PHẦN BẢN ĐỒ (giống hệt trong game)
// =====================================================
const N = 19, CS = 3.2, WH = 3.2;   // N: số ô mỗi cạnh | CS: kích thước 1 ô | WH: chiều cao tường
const rnd = a => Math.floor(Math.random() * a);
const grid = Array.from({ length: N }, () => Array(N).fill(1)); // 1 = tường, 0 = sàn
const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

// 1) Đục mê cung bằng thuật toán DFS (đảm bảo mọi chỗ đều đi tới được)
(function carve(x, y) {
  grid[y][x] = 0;
  dirs.slice().sort(() => Math.random() - .5).forEach(([dx, dy]) => {
    const nx = x + dx * 2, ny = y + dy * 2;
    if (nx > 0 && ny > 0 && nx < N - 1 && ny < N - 1 && grid[ny][nx]) { grid[y + dy][x + dx] = 0; carve(nx, ny); }
  });
})(1, 1);

// 2) Mở thêm 35 lối tắt để có đường vòng (tăng/giảm số 35 để mê cung thoáng/kín hơn)
for (let i = 0; i < 35; i++) {
  const x = 1 + rnd(N - 2), y = 1 + rnd(N - 2);
  if (grid[y][x] && ((!grid[y][x-1] && !grid[y][x+1]) || (!grid[y-1][x] && !grid[y+1][x]))) grid[y][x] = 0;
}

const DOOR = [N - 2, N - 1]; // vị trí cửa thoát hiểm (cột, hàng)
const spots = [];            // danh sách các ô sàn "gốc" (ô lẻ) để đặt vật phẩm
for (let y = 1; y < N; y += 2) for (let x = 1; x < N; x += 2) spots.push([x, y]);
function pick(minD, from) { // chọn ô ngẫu nhiên cách "from" ít nhất minD ô
  let s; do { s = spots[rnd(spots.length)]; } while (Math.abs(s[0] - from[0]) + Math.abs(s[1] - from[1]) < minD);
  return s;
}

// 3) Vị trí các thứ trên bản đồ
const PLAYER = [1, 1];
const KEY = pick(14, PLAYER);
const MONSTER = pick(14, PLAYER);
const BATS = [0, 1, 2, 3].map(() => pick(4, PLAYER));

// =====================================================
//  PHẦN VẼ 3D
// =====================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101010);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const amb = new THREE.AmbientLight(0xffffff, 0.9); scene.add(amb);
const sun = new THREE.DirectionalLight(0xffffff, 0.6); sun.position.set(20, 60, 10); scene.add(sun);

function tex(base, n, rep) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * .35})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, Math.random() * 22 + 2, Math.random() * 22 + 2);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); return t;
}

// Tường (mỗi ô tường là 1 khối, trừ ô cửa)
let walls = 0;
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (grid[y][x] && !(x === DOOR[0] && y === DOOR[1])) walls++;
const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CS, WH, CS),
  new THREE.MeshStandardMaterial({ map: tex('#4a3b36', 160, 1), roughness: .95 }), walls);
let wi = 0; const m4 = new THREE.Matrix4();
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
  if (grid[y][x] && !(x === DOOR[0] && y === DOOR[1])) { m4.setPosition(x * CS, WH / 2, y * CS); wallMesh.setMatrixAt(wi++, m4); }
scene.add(wallMesh);

// Sàn & trần
const mid = (N - 1) / 2 * CS;
const floor = new THREE.Mesh(new THREE.PlaneGeometry(N * CS, N * CS),
  new THREE.MeshStandardMaterial({ map: tex('#2a1f1c', 200, N * CS / 4), roughness: 1 }));
floor.rotation.x = -Math.PI / 2; floor.position.set(mid, 0, mid); scene.add(floor);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(N * CS, N * CS), new THREE.MeshStandardMaterial({ color: 0x120a0a }));
ceil.rotation.x = Math.PI / 2; ceil.position.set(mid, WH, mid); ceil.visible = false; scene.add(ceil);

// Cửa thoát hiểm
const door = new THREE.Mesh(new THREE.BoxGeometry(CS * .9, WH * .95, .25), new THREE.MeshStandardMaterial({ color: 0x8b4513 }));
door.position.set(DOOR[0] * CS, WH * .475, DOOR[1] * CS); scene.add(door);

// Vật phẩm + điểm xuất hiện
const key = new THREE.Mesh(new THREE.TorusGeometry(.5, .14, 8, 16), new THREE.MeshBasicMaterial({ color: 0xffd700 }));
key.position.set(KEY[0] * CS, 1, KEY[1] * CS); key.rotation.x = Math.PI / 2; scene.add(key);
BATS.forEach(([x, y]) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(.6, .9, .6), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
  b.position.set(x * CS, .6, y * CS); scene.add(b);
});
function marker(cell, color) { // cột sáng đánh dấu
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 2.5, 16), new THREE.MeshBasicMaterial({ color }));
  m.position.set(cell[0] * CS, 1.25, cell[1] * CS); scene.add(m);
}
marker(PLAYER, 0x3399ff);
marker(MONSTER, 0xff2200);

// =====================================================
//  CAMERA NHÌN TỪ TRÊN XUỐNG
// =====================================================
const keys = {}; let tx = mid, tz = mid, h = 75, bright = true;
camera.up.set(0, 0, -1);
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'KeyC') ceil.visible = !ceil.visible;
  if (e.code === 'KeyF') {
    bright = !bright; amb.intensity = bright ? .9 : .15; sun.intensity = bright ? .6 : 0;
    scene.background.set(bright ? 0x101010 : 0x030000);
  }
});
addEventListener('keyup', e => keys[e.code] = false);
(function loop() {
  requestAnimationFrame(loop);
  const s = h * .012;
  if (keys.KeyW) tz -= s; if (keys.KeyS) tz += s;
  if (keys.KeyA) tx -= s; if (keys.KeyD) tx += s;
  if (keys.KeyQ) h = Math.max(8, h - .8); if (keys.KeyE) h = Math.min(160, h + .8);
  camera.position.set(tx, h, tz); camera.lookAt(tx, 0, tz);
  renderer.render(scene, camera);
})();
} catch (e) {
  const el = document.getElementById('err'); el.innerText = 'Lỗi: ' + e.message; el.style.display = 'block';
}
</script>
</body>
</html>
