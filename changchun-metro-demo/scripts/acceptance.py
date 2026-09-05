# -*- coding: utf-8 -*-
"""
MVP 验收脚本：PRD 第 3.2 节三条典型任务链路
运行前提：pip install playwright && playwright install chromium；dev server 已启动（默认 localhost:5173）
用法：python scripts/acceptance.py [base_url]
"""
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'
results = []


def check(name, ok, note=''):
    results.append(('PASS' if ok else 'FAIL', name, note))


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1600, 'height': 900})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))

        page.goto(BASE, wait_until='networkidle', timeout=30000)

        # ---- 任务 A：从区域开始探索 ----
        # 1. 城市总览加载（3D 场景懒加载，等 canvas 出现）
        page.wait_for_selector('.three-host canvas', timeout=15000)
        check('A1 城市3D场景渲染', page.locator('.three-host canvas').count() > 0)

        # 2. 选择区域 → 进入地铁视角
        page.get_by_role('button', name='宽城区').first.click()
        page.wait_for_timeout(1800)
        page.locator('.info-panel .btn.primary').first.click()
        page.wait_for_timeout(1500)
        check('A2 选择区域进入地铁层', 'layer=metro' in page.url and 'district=' in page.url, page.url)

        # 3. 选线路 → 选站点 → 查看站点周边景点
        page.locator('.info-panel .line-badge.clickable', has_text='4号线').first.click()
        page.wait_for_timeout(1500)
        page.locator('.info-panel .chain-stop', has_text='伪满皇宫').first.click()
        page.wait_for_timeout(1200)
        page.locator('.info-panel .btn.primary').first.click()
        page.wait_for_timeout(1500)
        count = page.locator('.poi-count').inner_text() if page.locator('.poi-count').count() else ''
        check('A3 站点周边景点层', 'layer=poi' in page.url and '站周边' in count, count)

        # 4. 打开景点详情抽屉
        page.locator('.poi-strip .poi-card').first.click()
        page.wait_for_timeout(1200)
        drawer = page.locator('.drawer')
        check('A4 景点详情抽屉打开', drawer.count() > 0 and drawer.is_visible())

        # ---- 任务 B：从地铁线开始规划（从干净的地铁层入口开始）----
        page.goto(BASE + '/?layer=metro', wait_until='networkidle')
        page.wait_for_timeout(1500)
        page.locator('.info-panel .line-badge.clickable', has_text='1号线').first.click()
        page.wait_for_timeout(1800)
        check('B1 选择线路高亮', 'line=line-01' in page.url, page.url)
        page.keyboard.press('4')
        page.wait_for_timeout(1500)
        check('B2 切2D总览保留上下文', 'layer=map2d' in page.url and 'line=line-01' in page.url, page.url)

        # ---- 任务 C：从景点开始了解城市 ----
        page.keyboard.press('3')
        page.wait_for_timeout(1500)
        page.locator('.poi-strip .poi-card').first.click()
        page.wait_for_timeout(1200)
        page.locator('.drawer .btn.link', has_text='最近地铁站').first.click()
        page.wait_for_timeout(1500)
        check('C1 详情跳转地铁站', 'layer=metro' in page.url and 'station=' in page.url, page.url)

        check('无 JS 运行错误', len(errors) == 0, '; '.join(errors[:2]))
        browser.close()

    fails = [r for r in results if r[0] == 'FAIL']
    for status, name, note in results:
        print(f"[{status}] {name}" + (f"  ({note})" if note else ''))
    print(f"\n{len(results) - len(fails)}/{len(results)} 通过")
    sys.exit(1 if fails else 0)


if __name__ == '__main__':
    run()
