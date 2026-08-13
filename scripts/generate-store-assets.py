#!/usr/bin/env python3
"""Chrome Web Store掲載画像を外部素材なしで生成する。"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store-assets"
SHOT = OUT / "screenshots"
PROMO = OUT / "promotional"
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

BG = "#000000"
PANEL = "#101317"
LINE = "#2f3336"
TEXT = "#e7e9ea"
MUTED = "#71767b"
CYAN = "#00ba7c"
BLUE = "#1d9bf0"
RED = "#f4212e"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def icon_mark(draw, x, y, scale=1.0):
    w, h = int(116 * scale), int(116 * scale)
    rounded(draw, (x, y, x+w, y+h), int(26*scale), "#090b0d", "#586069", max(1, int(4*scale)))
    draw.ellipse((x+19*scale, y+38*scale, x+44*scale, y+63*scale), fill=BLUE)
    draw.ellipse((x+65*scale, y+49*scale, x+90*scale, y+74*scale), fill=CYAN)
    draw.ellipse((x+43*scale, y+72*scale, x+68*scale, y+97*scale), fill="#25a7f5")
    draw.rectangle((x+55*scale, y+34*scale, x+91*scale, y+42*scale), fill=TEXT)
    draw.rectangle((x+20*scale, y+70*scale, x+50*scale, y+78*scale), fill=TEXT)
    draw.rectangle((x+21*scale, y+87*scale, x+38*scale, y+95*scale), fill=TEXT)


def header(draw, title, subtitle, page):
    icon_mark(draw, 70, 56, .55)
    draw.text((146, 61), title, font=font(30, True), fill=TEXT)
    draw.text((146, 103), subtitle, font=font(17), fill=MUTED)
    draw.text((1120, 68), f"{page}/3", font=font(17, True), fill=MUTED)


def footer(draw):
    draw.text((70, 748), "X Context Toolkit  —  X上のミュートとブロックを少ない操作で", font=font(16), fill=MUTED)
    draw.text((1040, 748), "非公式ツール", font=font(15), fill="#59636c")


def popup_card(draw, x, y):
    rounded(draw, (x, y, x+430, y+300), 18, "#f7f9f9", "#cfd9de", 2)
    draw.text((x+26, y+24), "Xにミュートキーワードを追加", font=font(23, True), fill="#0f1419")
    draw.text((x+26, y+62), "ワンクリックブロック対応版", font=font(14), fill="#536471")
    rounded(draw, (x+332, y+25, x+399, y+51), 12, "#202327")
    draw.text((x+343, y+29), "v1.0.11", font=font(12, True), fill="white")
    draw.line((x+26, y+93, x+404, y+93), fill="#cfd9de", width=1)
    rounded(draw, (x+26, y+122, x+309, y+174), 8, "white", "#8b98a5", 2)
    draw.text((x+43, y+137), "おすすめ欄", font=font(17), fill="#536471")
    rounded(draw, (x+309, y+122, x+404, y+174), 8, BLUE)
    draw.text((x+335, y+136), "追加", font=font(18, True), fill="white")
    rounded(draw, (x+26, y+196, x+404, y+254), 8, "#d1e7dd", "#a3cfbb")
    draw.text((x+45, y+214), "追加を受け付けました", font=font(17, True), fill="#0a3622")


def screenshot_mute():
    im = Image.new("RGB", (1280, 800), BG); d = ImageDraw.Draw(im)
    header(d, "ミュートキーワードをすばやく追加", "ポップアップから入力。受付後はバックグラウンドで処理します。", 1)
    rounded(d, (70, 160, 1210, 700), 28, PANEL, LINE, 2)
    popup_card(d, 150, 260)
    d.text((660, 255), "入力して、追加するだけ", font=font(34, True), fill=TEXT)
    d.text((660, 320), "1", font=font(23, True), fill=BLUE); d.text((704, 320), "キーワードを入力", font=font(21), fill=TEXT)
    d.text((660, 378), "2", font=font(23, True), fill=BLUE); d.text((704, 378), "「追加」を押す", font=font(21), fill=TEXT)
    d.text((660, 436), "3", font=font(23, True), fill=BLUE); d.text((704, 436), "そのまま閲覧を続ける", font=font(21), fill=TEXT)
    rounded(d, (650, 514, 1115, 594), 12, "#071d16", "#126b4d", 2)
    d.ellipse((675, 537, 697, 559), fill=CYAN)
    d.text((718, 530), "失敗した場合だけ通知します", font=font(18, True), fill="#b6f2d5")
    footer(d); return im


def tweet_card(draw, x, y, with_block=True):
    rounded(draw, (x, y, x+960, y+330), 18, "#050505", LINE, 2)
    draw.ellipse((x+30, y+27, x+78, y+75), fill="#243447")
    draw.text((x+46, y+37), "人", font=font(19, True), fill="#b8c7d9")
    draw.text((x+96, y+26), "サンプルユーザー", font=font(19, True), fill=TEXT)
    draw.text((x+258, y+29), "@sample_user · 2時間", font=font(16), fill=MUTED)
    if with_block:
        draw.ellipse((x+814, y+27, x+850, y+63), outline=RED, width=3)
        draw.line((x+820, y+33, x+844, y+57), fill=RED, width=4)
    draw.text((x+870, y+25), "◌", font=font(28), fill=MUTED)
    draw.text((x+914, y+22), "•••", font=font(22, True), fill=MUTED)
    draw.text((x+96, y+91), "タイムラインを見ながら、気になる投稿者を", font=font(22), fill=TEXT)
    draw.text((x+96, y+130), "少ない操作でブロックできます。", font=font(22), fill=TEXT)
    for px, mark in [(110, "○"), (280, "↻"), (465, "♡"), (650, "▥"), (820, "⌑")]:
        draw.text((x+px, y+252), mark, font=font(25), fill=MUTED)


def screenshot_block():
    im = Image.new("RGB", (1280, 800), BG); d = ImageDraw.Draw(im)
    header(d, "ポスト上からワンクリックでブロック", "右上のブロックボタンを押すと、確認画面まで自動で処理します。", 2)
    tweet_card(d, 150, 210)
    d.line((970, 182, 980, 227), fill=RED, width=3)
    rounded(d, (855, 140, 1120, 184), 20, "#351014", RED, 2)
    d.text((883, 151), "投稿者をブロック", font=font(17, True), fill="#ffb3ba")
    rounded(d, (250, 590, 1030, 665), 14, PANEL, LINE, 2)
    d.text((285, 611), "ページ移動なし", font=font(20, True), fill=TEXT)
    d.text((490, 611), "・", font=font(20), fill=MUTED)
    d.text((540, 611), "確認ポップアップを自動処理", font=font(20, True), fill=TEXT)
    footer(d); return im


def screenshot_context():
    im = Image.new("RGB", (1280, 800), BG); d = ImageDraw.Draw(im)
    header(d, "選択した言葉を右クリックから追加", "X上のテキストを選択して、コンテキストメニューからミュートできます。", 3)
    rounded(d, (120, 190, 1160, 690), 26, PANEL, LINE, 2)
    d.text((190, 250), "興味のない話題は、タイムラインから", font=font(27), fill=TEXT)
    d.rectangle((663, 245, 885, 291), fill="#164d73")
    d.text((667, 250), "すばやくミュート", font=font(27, True), fill="white")
    d.text((885, 250), "できます。", font=font(27), fill=TEXT)
    rounded(d, (555, 340, 1005, 535), 10, "#202124", "#5f6368", 2)
    d.text((585, 365), "コピー", font=font(18), fill="#e8eaed")
    d.text((585, 411), "検索", font=font(18), fill="#e8eaed")
    d.line((575, 450, 985, 450), fill="#5f6368", width=1)
    rounded(d, (570, 463, 990, 518), 7, "#303134")
    d.text((588, 478), "X ミュートキーワードに追加", font=font(18, True), fill="#8ab4f8")
    d.text((190, 565), "受付後は閲覧を続けられます。失敗時のみ通知します。", font=font(20), fill=MUTED)
    footer(d); return im


def promo():
    im = Image.new("RGB", (440, 280), "#071014"); d = ImageDraw.Draw(im)
    d.ellipse((-70, -100, 190, 160), fill="#083b4b")
    d.ellipse((300, 150, 520, 370), fill="#351014")
    icon_mark(d, 44, 82, .9)
    d.text((177, 82), "X Context", font=font(27, True), fill=TEXT)
    d.text((177, 119), "Toolkit", font=font(27, True), fill=TEXT)
    d.text((178, 171), "ミュート  /  ブロック", font=font(16, True), fill="#aab8c2")
    d.ellipse((180, 210, 198, 228), fill=CYAN)
    d.ellipse((220, 210, 238, 228), outline=RED, width=3)
    d.line((224, 214, 234, 224), fill=RED, width=3)
    return im


def main():
    SHOT.mkdir(parents=True, exist_ok=True); PROMO.mkdir(parents=True, exist_ok=True)
    (OUT / "icon-128.png").write_bytes((ROOT / "icons/icon128.png").read_bytes())
    promo().save(PROMO / "promo-small-440x280.png", optimize=True)
    screenshot_mute().save(SHOT / "01-mute-popup-1280x800.png", optimize=True)
    screenshot_block().save(SHOT / "02-one-click-block-1280x800.png", optimize=True)
    screenshot_context().save(SHOT / "03-context-menu-1280x800.png", optimize=True)
    for path in sorted(OUT.rglob("*.png")):
        with Image.open(path) as im:
            print(f"{path.relative_to(ROOT)}: {im.width}x{im.height}")


if __name__ == "__main__":
    main()
