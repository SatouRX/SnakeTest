// 获取画布和上下文
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 游戏区域设置：将画布划分为20x20个格子
const gridSize = 20;
let tileSize = canvas.width / gridSize;

// 初始化蛇和方向
let snake = [{ x: 10, y: 10 }];
let direction = { x: 0, y: 0 };

// 定义障碍物（确保不与起始点重叠）
const obstacles = [
  { x: 5, y: 5 },
  { x: 14, y: 10 },
  { x: 10, y: 15 }
];

// 生成初始食物（调用前 obstacles 已初始化）
let food = spawnFood();

// 全局变量：分数、命数和游戏结束标记
let score = 0;
let lives = 3;
let gameOver = false;

// 新增恢复模式相关变量
let isRecovering = false;    // 标记是否处于恢复模式
let flashVisible = true;     // 控制闪烁效果（true时蛇可见）
let flashIntervalId = null;  // 闪烁定时器ID
const recoveryDuration = 3000; // 恢复模式持续时间（毫秒）

// 游戏更新频率（毫秒）
const gameSpeed = 100;
let lastTime = 0;

// 触摸起始坐标（用于手机控制）
let touchStartX = 0;
let touchStartY = 0;

// --- 游戏玩法提示 ---
// 页面加载后弹出提示框，告知玩家各颜色含义以及恢复模式说明
window.addEventListener("load", function() {
  alert("游戏玩法提示：\n\n" +
        "绿色：你的蛇\n" +
        "灰色：障碍物\n" +
        "红色食物：10分\n" +
        "青色食物：20分\n" +
        "紫色食物：30分\n\n" +
        "每次碰撞会扣除一条命（但保留原有蛇身长度），\n" +
        "恢复时蛇会暂停并闪烁几秒，然后自动选择安全方向继续移动。\n\n" +
        "命数归零后会自动重置游戏，欢迎再次挑战！");
});

// --- 事件监听 ---
// 键盘控制（恢复模式下不响应）
document.addEventListener("keydown", e => {
  if (isRecovering) return;
  switch (e.key) {
    case "ArrowUp":
      if (direction.y !== 1) { direction = { x: 0, y: -1 }; }
      break;
    case "ArrowDown":
      if (direction.y !== -1) { direction = { x: 0, y: 1 }; }
      break;
    case "ArrowLeft":
      if (direction.x !== 1) { direction = { x: -1, y: 0 }; }
      break;
    case "ArrowRight":
      if (direction.x !== -1) { direction = { x: 1, y: 0 }; }
      break;
  }
});

// 触摸控制：记录起始坐标并在触摸结束时判断滑动方向（恢复模式下不响应）
canvas.addEventListener("touchstart", function(e) {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
});

canvas.addEventListener("touchend", function(e) {
  if (isRecovering) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0 && direction.x !== -1) {
      direction = { x: 1, y: 0 };
    } else if (dx < 0 && direction.x !== 1) {
      direction = { x: -1, y: 0 };
    }
  } else {
    if (dy > 0 && direction.y !== -1) {
      direction = { x: 0, y: 1 };
    } else if (dy < 0 && direction.y !== 1) {
      direction = { x: 0, y: -1 };
    }
  }
});

// --- 食物生成 ---
// 随机生成食物位置和类型（红色：10分，青色：20分，紫色：30分）
function spawnFood() {
  let newFood;
  while (true) {
    newFood = {
      x: Math.floor(Math.random() * gridSize),
      y: Math.floor(Math.random() * gridSize)
    };
    const type = Math.floor(Math.random() * 3); // 0,1,2
    if (type === 0) {
      newFood.color = "red";
      newFood.points = 10;
    } else if (type === 1) {
      newFood.color = "cyan";
      newFood.points = 20;
    } else {
      newFood.color = "purple";
      newFood.points = 30;
    }
    // 确保食物不生成在蛇身或障碍物上
    if (!snake.some(segment => segment.x === newFood.x && segment.y === newFood.y) &&
        !obstacles.some(ob => ob.x === newFood.x && ob.y === newFood.y)) {
      return newFood;
    }
  }
}

// --- 更新游戏状态 ---
// 如果处于恢复状态或玩家还未设置方向，则不更新移动
function update() {
  if (isRecovering) return;
  if (direction.x === 0 && direction.y === 0) return;

  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

  // 检测撞墙
  if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
    handleCollision();
    return;
  }
  // 检测撞到自身
  if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
    handleCollision();
    return;
  }
  // 检测撞到障碍物
  if (obstacles.some(ob => ob.x === head.x && ob.y === head.y)) {
    handleCollision();
    return;
  }

  // 一切正常，添加新头部
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score += food.points;
    food = spawnFood();
  } else {
    snake.pop();
  }
}

// --- 自动寻找安全方向 ---
// 检查蛇头上下左右四个方向，返回第一个安全方向
function findSafeDirection(head) {
  const directions = [
    { x: 0, y: -1 }, // 上
    { x: 1, y: 0 },  // 右
    { x: 0, y: 1 },  // 下
    { x: -1, y: 0 }  // 左
  ];
  for (let d of directions) {
    const newHead = { x: head.x + d.x, y: head.y + d.y };
    if (
      newHead.x >= 0 && newHead.x < gridSize &&
      newHead.y >= 0 && newHead.y < gridSize &&
      !snake.some(segment => segment.x === newHead.x && segment.y === newHead.y) &&
      !obstacles.some(ob => ob.x === newHead.x && ob.y === newHead.y)
    ) {
      return d;
    }
  }
  // 若所有方向都不安全，则默认向右
  return { x: 1, y: 0 };
}

// --- 碰撞处理 ---
// 碰撞时扣除一条命（不重置蛇身长度），进入恢复模式，闪烁几秒后自动选择安全方向继续移动；
// 若命数归零，则进入游戏结束状态，并在一段延时后调用 resetGame() 重置游戏
function handleCollision() {
  lives--;
  if (lives > 0) {
    isRecovering = true;
    // 暂停玩家输入（方向设为0），但保留当前蛇身长度
    direction = { x: 0, y: 0 };
    flashVisible = true;
    flashIntervalId = setInterval(() => {
      flashVisible = !flashVisible;
    }, 250);
    setTimeout(() => {
      clearInterval(flashIntervalId);
      flashVisible = true;
      isRecovering = false;
      // 自动检测当前蛇头周围安全方向，设置为新的移动方向
      direction = findSafeDirection(snake[0]);
    }, recoveryDuration);
  } else {
    gameOver = true;
    // 显示游戏结束画面后2秒重置游戏
    setTimeout(resetGame, 2000);
  }
}

// --- 绘制画面 ---
// 绘制背景、障碍物、食物、蛇以及分数与命数信息
function draw() {
  // 清空画布
  ctx.fillStyle = "#222";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制障碍物（灰色）
  ctx.fillStyle = "gray";
  obstacles.forEach(ob => {
    ctx.fillRect(ob.x * tileSize, ob.y * tileSize, tileSize, tileSize);
  });

  // 绘制食物
  ctx.fillStyle = food.color;
  ctx.fillRect(food.x * tileSize, food.y * tileSize, tileSize, tileSize);

  // 绘制蛇（如果处于恢复模式且闪烁为隐藏状态，则不绘制蛇）
  if (!isRecovering || flashVisible) {
    ctx.fillStyle = "lime";
    snake.forEach(segment => {
      ctx.fillRect(segment.x * tileSize, segment.y * tileSize, tileSize, tileSize);
    });
  }

  // 绘制分数和命数信息
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.fillText(`命数：${lives}`, 10, 20);
  ctx.fillText(`分值：${score}`, canvas.width - 100, 20);

  // 游戏结束时显示提示文字
  if (gameOver) {
    ctx.fillStyle = "yellow";
    ctx.font = "24px Arial";
    ctx.fillText(`游戏结束！最终分值：${score}`, canvas.width / 2 - 120, canvas.height / 2);
  }
}

// --- 游戏主循环 ---
function gameLoop(timestamp) {
  if (!gameOver) {
    if (timestamp - lastTime > gameSpeed) {
      lastTime = timestamp;
      update();
    }
  }
  draw();
  requestAnimationFrame(gameLoop);
}

// --- 重置游戏 ---
// 显示提示后重置游戏状态，给玩家继续游戏的机会
function resetGame() {
  alert(`游戏结束！最终分值：${score}\n点击确定重新开始。`);
  // 重置所有状态
  snake = [{ x: 10, y: 10 }];
  direction = { x: 0, y: 0 };
  score = 0;
  lives = 3;
  gameOver = false;
  food = spawnFood();
}

// --- 自适应画布 ---
// 根据窗口尺寸调整画布大小并重新计算格子尺寸
function resizeCanvas() {
  const size = Math.min(window.innerWidth, window.innerHeight) - 20;
  canvas.width = size;
  canvas.height = size;
  tileSize = canvas.width / gridSize;
  draw();
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// 开始游戏循环
requestAnimationFrame(gameLoop);
