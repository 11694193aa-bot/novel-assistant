const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  page.on('pageerror', err => console.log('PAGE_ERR:', err.message));
  page.on('console', msg => { if(msg.type()==='error') console.log('CONSOLE:', msg.text()); });

  console.log('打开页面...');
  await page.goto('http://localhost:5199', { waitUntil: 'networkidle0', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  // 检查初始状态
  let state = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.ms-bottom-tab, .nav-btn')).map(b => b.textContent.trim());
    return {
      tabs,
      treeNodes: document.querySelectorAll('.tree-node').length,
      mindMapView: !!document.querySelector('.mindmap-view'),
      emptyCanvas: document.querySelector('.empty-canvas')?.textContent?.trim() || 'none',
      mmActionBtns: Array.from(document.querySelectorAll('.mm-action-btn')).map(b => b.textContent.trim()),
      bookItems: document.querySelectorAll('.dir-book-item').length
    };
  });
  console.log('初始状态:', JSON.stringify(state, null, 2));

  // 切换导图
  const allBtns = await page.$$('button');
  for (const b of allBtns) {
    const t = await page.evaluate(el => el.textContent, b);
    if (t.trim() === '导图') {
      console.log('点击导图按钮');
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  state = await page.evaluate(() => ({
    treeNodes: document.querySelectorAll('.tree-node').length,
    mindMapView: !!document.querySelector('.mindmap-view'),
    emptyCanvas: document.querySelector('.empty-canvas')?.textContent?.trim() || 'none',
    bookPopover: document.querySelector('.mm-book-popover')?.textContent?.slice(0, 50) || 'none',
    allButtons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().slice(0, 15)).join(', ')
  }));
  console.log('切换后:', JSON.stringify(state, null, 2));

  // 如果 empty canvas，尝试创建卡片
  if (state.emptyCanvas && state.emptyCanvas.includes('选择或创建')) {
    console.log('需要先选书...');
    // 点书籍按钮
    for (const b of await page.$$('button')) {
      const t = await page.evaluate(el => el.title, b);
      if (t === '选择书籍') { await b.click(); break; }
    }
    await new Promise(r => setTimeout(r, 1000));

    // 选第一本书或创建
    const bookItems = await page.$$('.dir-book-item');
    if (bookItems.length > 0) {
      await bookItems[0].click();
      console.log('选了第一本书');
    } else {
      // 创建新书
      const addBookBtn = Array.from(await page.$$('button')).find(async b => (await page.evaluate(el => el.textContent, b)).includes('+'));
      if (addBookBtn) await addBookBtn.click();
      console.log('尝试创建新书');
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // 检查是否有添加按钮
  const addBtns = [];
  for (const b of await page.$$('button')) {
    const t = await page.evaluate(el => el.title || el.textContent, b);
    if (t.includes('新建母卡片') || t.includes('添加子卡片') || t === '添加') {
      addBtns.push(b);
    }
  }
  console.log('找到', addBtns.length, '个添加按钮');

  // 创建2张母卡片
  for (let i = 0; i < 2 && addBtns.length > 0; i++) {
    await addBtns[0].click();
    console.log('点击添加按钮 #' + (i+1));
    await new Promise(r => setTimeout(r, 500));
  }

  // 切换到树状模式
  for (const b of await page.$$('button')) {
    const t = await page.evaluate(el => el.textContent, b);
    if (t.trim() === '树状') {
      console.log('切换到树状视图');
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));

  // 最终检查
  const final = await page.evaluate(() => {
    const ns = document.querySelectorAll('.tree-node:not(.tree-root-node)');
    return {
      treeNodes: ns.length,
      nodes: Array.from(ns).map(n => ({
        id: n.dataset.cardId,
        className: n.className,
        rect: (() => { const r = n.getBoundingClientRect(); return {x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height)}; })(),
        text: n.textContent?.trim().slice(0, 30)
      }))
    };
  });
  console.log('最终:', JSON.stringify(final, null, 2));

  // === 执行触摸拖拽测试 ===
  if (final.treeNodes >= 2) {
    const n1 = final.nodes[0].rect;
    const n2 = final.nodes[1].rect;
    const cx1 = n1.x + n1.w/2, cy1 = n1.y + n1.h/2;
    const cx2 = n2.x + n2.w/2, cy2 = n2.y + n2.h * 0.6;

    console.log(`\n=== 拖拽测试: (${cx1},${cy1}) -> (${cx2},${cy2}) ===`);

    const cdp = await page.createCDPSession();

    // touchstart
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: cx1, y: cy1 }]
    });
    console.log('touchStart 已发送');

    // 等待长按计时器
    await new Promise(r => setTimeout(r, 700));

    // 检查幽灵是否出现
    let ghost = await page.evaluate(() => {
      const g = document.querySelector('.touch-ghost');
      return g ? { text: g.textContent, style: g.style.cssText } : null;
    });
    console.log('500ms后幽灵:', ghost ? '出现了!' + ghost.text : '未出现!');

    // touchmove
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: cx2, y: cy2 }]
    });
    console.log('touchMove 已发送');
    await new Promise(r => setTimeout(r, 200));

    // 检查 drag-over 指示器
    let indicator = await page.evaluate(() => {
      const el = document.querySelector('.drag-over-inside, .drag-over-before, .drag-over-after');
      return el ? el.className : null;
    });
    console.log('drag-over 指示器:', indicator || '无');

    // touchend
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    console.log('touchEnd 已发送');
    await new Promise(r => setTimeout(r, 1000));

    // 检查结果
    const afterState = await page.evaluate(() => {
      const ns = document.querySelectorAll('.tree-node:not(.tree-root-node)');
      return Array.from(ns).map(n => ({
        id: n.dataset.cardId,
        text: n.textContent?.trim().slice(0, 30)
      }));
    });
    console.log('拖拽后节点顺序:', JSON.stringify(afterState));

    ghost = await page.evaluate(() => {
      const g = document.querySelector('.touch-ghost');
      return g ? '还在' : '已移除';
    });
    console.log('幽灵:', ghost);
  } else {
    console.log('\n树节点不足，无法测试拖拽');
  }

  await browser.close();
  console.log('\n测试完成');
})();
