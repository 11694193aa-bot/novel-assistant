import puppeteer from 'puppeteer';

const URL = 'http://localhost:5199';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  console.log('1. 打开页面...');
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(2000);

  // 点击思维导图 tab
  console.log('2. 切换到思维导图...');
  const mindmapTab = await page.$('.ms-bottom-tab:nth-child(2), button:has-text("导图")');
  if (mindmapTab) {
    await mindmapTab.tap();
    await sleep(1000);
  } else {
    // 桌面端
    const navBtns = await page.$$('.nav-btn');
    for (const btn of navBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('导图')) { await btn.click(); break; }
    }
    await sleep(1000);
  }

  // 点击"添加"创建母卡片
  console.log('3. 创建测试卡片...');
  // 先检查是否有书籍选中
  const bookSelector = await page.$('.dir-book-item, .mm-action-btn');
  if (!bookSelector) {
    console.log('需要先创建/选择书籍');
    // 尝试点书籍选择器
    const bookBtn = await page.$('button[title="选择书籍"]');
    if (bookBtn) { await bookBtn.click(); await sleep(500); }
    const firstBook = await page.$('.dir-book-item');
    if (firstBook) { await firstBook.click(); await sleep(500); }
  }

  // 点击添加按钮创建母卡片
  const addBtns = await page.$$('button');
  for (const btn of addBtns) {
    const text = await page.evaluate(el => el.textContent, btn);
    const title = await page.evaluate(el => el.title, btn);
    if (text.includes('添加') || title.includes('新建母卡片')) {
      await btn.click();
      console.log('  点击了添加按钮');
      await sleep(500);
    }
  }

  // 再点一次创建第二张
  for (const btn of addBtns) {
    const text = await page.evaluate(el => el.textContent, btn);
    const title = await page.evaluate(el => el.title, btn);
    if (text.includes('添加') || title.includes('新建母卡片')) {
      await btn.click();
      console.log('  点击了添加按钮 (第二张)');
      await sleep(500);
    }
  }

  // 切换到树状模式
  console.log('4. 切换到树状视图...');
  const treeBtn = await page.$('button:has-text("树状")');
  if (treeBtn) { await treeBtn.click(); await sleep(1000); }

  // 查找树节点
  const treeNodes = await page.$$('.tree-node');
  console.log(`5. 找到 ${treeNodes.length} 个树节点`);

  if (treeNodes.length >= 2) {
    // 获取节点位置
    const node1 = treeNodes[0];
    const node2 = treeNodes[1];
    const box1 = await node1.boundingBox();
    const box2 = await node2.boundingBox();
    console.log(`  节点1: x=${box1?.x}, y=${box1?.y}, w=${box1?.width}, h=${box1?.height}`);
    console.log(`  节点2: x=${box2?.x}, y=${box2?.y}, w=${box2?.width}, h=${box2?.height}`);

    if (box1 && box2) {
      // 在节点1上长按
      const cx = box1.x + box1.width / 2;
      const cy = box1.y + box1.height / 2;

      console.log(`6. 在节点1中心 (${cx}, ${cy}) 长按...`);
      await page.touchscreen.tap(cx, cy); // touchstart
      await sleep(100);

      // 使用 CDP 发送 touch 事件
      const client = await page.createCDPSession();
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: cx, y: cy }]
      });
      console.log('  touchStart 发送');

      // 等待长按
      await sleep(600);

      // 移动到节点2
      const targetCx = box2.x + box2.width / 2;
      const targetCy = box2.y + box2.height * 0.6; // 中间偏下 → inside
      console.log(`7. 移动到节点2 (${targetCx}, ${targetCy})...`);

      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: targetCx, y: targetCy }]
      });
      await sleep(200);

      // 松手
      console.log('8. 松手...');
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: []
      });
      await sleep(1000);

      // 检查结果
      const nodesAfter = await page.$$('.tree-node');
      console.log(`9. 拖拽后节点数: ${nodesAfter.length}`);

      // 检查是否有 drag-over 类
      const dragOverEls = await page.$$('.drag-over-inside, .drag-over-before, .drag-over-after');
      console.log(`   drag-over 元素数: ${dragOverEls.length}`);
    }
  } else {
    console.log('  节点不足，无法测试');
  }

  console.log('\n测试完成');
  await browser.close();
}

main().catch(e => { console.error('测试失败:', e.message); process.exit(1); });
