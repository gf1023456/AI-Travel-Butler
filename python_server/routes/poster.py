"""
AI Travel Butler - 海报生成路由
完全复刻 code.html 原型的设计
"""
import io
import os
import base64
from typing import Tuple, Optional
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api", tags=["海报"])
# ========== 颜色配置（Material Design 3 风格）==========
C_SURFACE = '#F8F9FA'
C_PRIMARY = '#1A237E'           # Deep Indigo
C_ON_SURFACE = '#191C1D'
C_ON_SURFACE_VARIANT = '#454652'
C_OUTLINE = '#767683'
C_CIRCLE_BG = (212, 230, 229)  # secondary-container
C_CARD_BORDER = (225, 227, 228)


def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))


def load_font(size: int, is_title: bool = False):
    """加载中文字体，标题优先使用艺术字体"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 标题字体：优先艺术感强的字体（支持跨平台）
    title_font_paths = [
      #  os.path.join(base_dir, 'static', 'font', 'stxingkai.ttf'),  # 项目内置华文行楷
        os.path.join(base_dir, 'static', 'font', '玄宗体.otf'),  # 项目内置华文行楷
        os.path.join(base_dir, 'static', 'font', 'simkai.ttf'),     # 项目内置楷体
        "C:/Windows/Fonts/stxingkai.ttf",   # Windows 华文行楷
        "C:/Windows/Fonts/simkai.ttf",      # Windows 楷体
        "C:/Windows/Fonts/msyhbd.ttf",      # Windows 微软雅黑粗体
        "C:/Windows/Fonts/msyh.ttc",        # Windows 微软雅黑
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",  # Linux 文泉驿正黑
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", # Linux 通用
    ]
    # 正文字体
    body_font_paths = [
        os.path.join(base_dir, 'static', 'font', 'msyh.ttc'),      # 项目内置微软雅黑
        os.path.join(base_dir, 'static', 'font', 'simsun.ttc'),    # 项目内置宋体
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/msyhbd.ttf",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    
    font_paths = title_font_paths if is_title else body_font_paths
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size)
            except:
                continue
    return ImageFont.load_default()



def load_bg_image(width: int, height: int) -> Optional[Image.Image]:
    """加载背景图"""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        bg_path = os.path.join(base_dir, 'static', 'bgm.png')
        if os.path.exists(bg_path):
            img = Image.open(bg_path).convert('RGB')
            return ImageOps.fit(img, (width, height), Image.Resampling.LANCZOS)
    except Exception as e:
        print(f"[Poster] bgm.png load failed: {e}")
    return None


def load_logo_image(size: int) -> Optional[Image.Image]:
    """加载品牌Logo图片"""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        logo_path = os.path.join(base_dir, 'static', 'logo.png')
        if os.path.exists(logo_path):
            img = Image.open(logo_path).convert('RGBA')
            return img.resize((size, size), Image.Resampling.LANCZOS)
    except Exception as e:
        print(f"[Poster] logo.png load failed: {e}")
    return None


def load_qr_image(size: int) -> Optional[Image.Image]:
    """加载二维码图片"""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        qr_path = os.path.join(base_dir, 'static', 'erwei.png')
        if os.path.exists(qr_path):
            img = Image.open(qr_path).convert('RGB')
            return img.resize((size, size), Image.Resampling.LANCZOS)
    except Exception as e:
        print(f"[Poster] erwei.png load failed: {e}")
    return None


def draw_rounded_rect(draw: ImageDraw.Draw, x: int, y: int, w: int, h: int, r: int, fill):
    """绘制圆角矩形"""
    # 主体矩形
    draw.rectangle([x + r, y, x + w - r, y + h], fill=fill)
    draw.rectangle([x, y + r, x + w, y + h - r], fill=fill)
    # 四个圆角
    draw.ellipse([x, y, x + 2 * r, y + 2 * r], fill=fill)
    draw.ellipse([x + w - 2 * r, y, x + w, y + 2 * r], fill=fill)
    draw.ellipse([x, y + h - 2 * r, x + 2 * r, y + h], fill=fill)
    draw.ellipse([x + w - 2 * r, y + h - 2 * r, x + w, y + h], fill=fill)


def apply_frosted_glass(target_img: Image.Image, x: int, y: int, w: int, h: int, blur_radius: int = 24):
    """
    在目标区域应用毛玻璃效果
    1. 提取并模糊背景对应区域
    2. 叠加半透明白色
    3. 添加白色边框
    """
    # 1. 提取背景区域
    bg_region = target_img.crop((x, y, x + w, y + h))
    
    # 2. 模糊处理
    blurred = bg_region.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    
    # 3. 叠加半透明白色 (10% 透明度 ≈ 25/255)
    overlay = Image.new('RGBA', blurred.size, (255, 255, 255, 25))
    blurred = Image.alpha_composite(blurred.convert('RGBA'), overlay)
    
    # 4. 粘贴回目标图像
    target_img.paste(blurred.convert('RGB'), (x, y))
    
    # 5. 添加顶部白色边框 (模拟 border-t border-white/20)
    # draw = ImageDraw.Draw(target_img)
    # draw.rectangle([x, y, x + w, y + 1], fill=(255, 255, 255, 51))  # 20% white
    #
    return target_img



def draw_text_with_outline(draw: ImageDraw.Draw, pos, text, font, fill, outline_fill=None, outline_width=2):
    """带描边的文字绘制（用于标题投影效果）"""
    if outline_fill:
        for dx in range(-outline_width, outline_width + 1):
            for dy in range(-outline_width, outline_width + 1):
                if dx or dy:
                    draw.text((pos[0] + dx, pos[1] + dy), text, font=font, fill=outline_fill)
    draw.text(pos, text, font=font, fill=fill)

async def create_poster(data: dict) -> bytes:
    W, P = 750, 32  # 海报宽度和边距
    HEADER_H = 480  # 头部高度
    
    # ========== 加载字体 ==========
    title_font = load_font(88, is_title=True)      # 主标题大字（艺术字体）
    title_small_font = load_font(54, is_title=True) # 第二个字稍小（艺术字体）
    yu_font = load_font(46, is_title=True)          # "与"字（艺术字体）
    subtitle_font = load_font(33, is_title=True)    # 副标题（艺术字体）
    days_font = load_font(14)                       # 天数字体
    body_font = load_font(14)                       # 正文/描述
    headline_font = load_font(16)                    # 卡片标题
    small_font = load_font(12)                      # 小字
    num_font = load_font(28)                        # 卡片右侧编号（大号淡灰）
    
    # ========== 获取数据 ==========
    day_plan_itinerary = data.get('dayPlanItinerary', [])
    itinerary_summary = data.get('itinerarySummary', '')
    days = data.get('days', [])
    
    # ========== 计算海报总高度 ==========
    card_h = 80          # 卡片高度（与时间轴绘制保持一致）
    card_gap = 16        # 卡片间距
    cards_total_h = len(day_plan_itinerary) * (card_h + card_gap)
    
    features_h = 80     # 功能亮点区
    footer_h = 120       # 底部区域
    content_h = max(280, cards_total_h + features_h + footer_h + 60)
    total_h = HEADER_H + content_h
    
    # ========== 创建画布 ==========
    img = Image.new('RGB', (W, total_h), hex_to_rgb(C_SURFACE))
    
    # ========== 1. Header 背景图 ==========
    bg_img = load_bg_image(W, HEADER_H)
    if bg_img:
        img.paste(bg_img, (0, 0))
    else:
        # 备用渐变背景
        for y in range(HEADER_H):
            ratio = y / HEADER_H
            r = int(26 + ratio * (72 - 26))
            g = int(35 + ratio * (107 - 35))
            b = int(126 + ratio * (190 - 126))
            for x in range(W):
                img.putpixel((x, y), (r, g, b))
    
    draw = ImageDraw.Draw(img)
    
    # ========== 2. 毛玻璃效果区域 ==========
    glass_h = 285
    glass_y = HEADER_H - glass_h
    glass_x = 0
    glass_w = W
    
    # 应用毛玻璃效果
    img = apply_frosted_glass(img, glass_x, glass_y, glass_w, glass_h, blur_radius=24)
    draw = ImageDraw.Draw(img)
    
    # ========== 3. 解析标题 ==========
    main_title = itinerary_summary or '智能行程'
    sub_title = '匠心之酄巡礼'
    
    # 解析主副标题（支持多种分隔符）
    comma_idx = main_title.find('，')
    if comma_idx > 0 and comma_idx < 15:
        sub_title = main_title[comma_idx + 1:].strip() or sub_title
        main_title = main_title[:comma_idx].strip()
    elif '：' in main_title:
        parts = main_title.split('：')
        main_title = parts[0].strip()
        sub_title = parts[1].strip() if len(parts) > 1 else sub_title
    elif ':' in main_title:
        parts = main_title.split(':')
        main_title = parts[0].strip()
        sub_title = parts[1].strip() if len(parts) > 1 else sub_title
    
    # 拆分"XX与XX"格式，限制长度防止溢出
    title_y = glass_y + 14  # 毛玻璃区域顶部开始
    part1, part2 = main_title, ''
    
    # 智能精简标题：去掉常见冗长后缀
    trim_words = ['深度打卡', '深度游', '经典路线', '详细攻略', '精选路线', '必玩', '之旅']
    for word in trim_words:
        if word in main_title and len(main_title) > 6:
            main_title = main_title.replace(word, '')
    
    if '与' in main_title:
        idx = main_title.index('与')
        part1 = main_title[:idx][:5]
        part2 = main_title[idx + 1:][:4]
    elif len(main_title) > 6:
        part1 = main_title[:5]
        part2 = main_title[5:9]
    else:
        part1 = main_title[:6]
    
    # 如果标题太长，只保留核心地名（去掉数字）
    if len(part1) >= 5:
        # 尝试提取纯地名，去掉数字和"日"
        cleaned = ''.join([c for c in part1 if not c.isdigit() and c != '日'])
        if len(cleaned) >= 2:
            part1 = cleaned[:5]
    
    # ========== 5. 绘制标题（复刻原型的不对称布局）==========
    # 第一行：part1 + "与" + part2
    draw.text((P, title_y), part1, font=title_font, fill=(255, 255, 255))
    
    # 获取 part1 宽度来计算"与"的位置
    bbox1 = draw.textbbox((0, 0), part1, font=title_font)
    w1 = bbox1[2] - bbox1[0]
    
    # "与"字（较小，垂直偏移）
    draw.text((P + w1 + 4, title_y + 20), '与', font=yu_font, fill=(255, 255, 255, 178))
    
    bbox_yu = draw.textbbox((0, 0), '与', font=yu_font)
    w_yu = bbox_yu[2] - bbox_yu[0]
    
    # part2（如果有）
    if part2:
        draw.text((P + w1 + w_yu + 8, title_y), part2, font=title_small_font, fill=(255, 255, 255, 230))
    
    # 副标题区域（带竖线）
    sub_y = title_y + 120
    draw.line([(P, sub_y), (P, sub_y + 24)], fill=(255, 255, 255, 128), width=2)
    draw.text((P + 14, sub_y), sub_title[:20], font=subtitle_font, fill=(255, 255, 255, 230))
    
    # 天数信息
    days_y = sub_y + 66
    total_days = len(days) or 10
    nights = max(1, total_days - 1)
    days_text = f"{total_days} 天 & {nights} 晚"
    draw.text((P, days_y), days_text, font=days_font, fill=(255, 255, 255, 178))
    
    # ========== 6. 内容区域 - 行程引言 ==========
    y = HEADER_H + 54
    
    intro = f"从{part1}到{part2}，在每一处细节中寻找传统与现代的交响。" if part2 else "在每一处细节中寻找传统与现代的交响。"
    draw.text((P, y), intro, font=small_font, fill=hex_to_rgb(C_ON_SURFACE_VARIANT))
    y += 70
    
    # ========== 7. 行程卡片（时间轴样式）==========
    days_map = {}
    for item in day_plan_itinerary:
        day_key = str(item.get('day', 1))
        if day_key not in days_map:
            days_map[day_key] = []
        days_map[day_key].append(item)
    
    sorted_days = sorted(days_map.keys(), key=int)
    
    # 时间轴配置
    timeline_x = P + 20
    card_indent = 48
    card_w = W - P * 2 - card_indent
    
    # 预计算所有卡片位置
    card_positions = []
    card_count = 0
    temp_y = y
    for day in sorted_days:
        for item in days_map[day]:
            card_count += 1
            seq_str = f"{card_count:02d}"
            card_positions.append((temp_y, item, seq_str))
            temp_y += card_h + card_gap
    
    # 画时间轴竖线（连接所有卡片圆点）
    if len(card_positions) > 1:
        first_dot_y = card_positions[0][0] + card_h // 2
        last_dot_y = card_positions[-1][0] + card_h // 2
        draw.line([(timeline_x, first_dot_y), (timeline_x, last_dot_y)],
                  fill=(212, 230, 229), width=2)
    
    # 绘制每个卡片
    for card_y, item, seq_str in card_positions:
        card_x = P + card_indent
        
        # 画圆点
        dot_r = 6
        draw.ellipse([timeline_x - dot_r, card_y + card_h // 2 - dot_r,
                      timeline_x + dot_r, card_y + card_h // 2 + dot_r],
                     fill=hex_to_rgb(C_PRIMARY))
        
        # 画卡片阴影（简化偏移）
        draw_rounded_rect(draw, card_x + 1, card_y + 2, card_w, card_h, 16, (245, 246, 248))
        # 画卡片主体
        draw_rounded_rect(draw, card_x, card_y, card_w, card_h, 16, (255, 255, 255))
        # 画卡片边框
        draw.rectangle([card_x + 1, card_y + 1, card_x + card_w - 1, card_y + card_h - 1],
                       outline=(235, 236, 238), width=1)
        
        # 景点名称
        name = (item.get('name', '景点') or '景点')[:20]
        draw.text((card_x + 20, card_y + 18), name, font=headline_font, fill=hex_to_rgb(C_ON_SURFACE))
        
        # 描述
        description = item.get('description', '')[:35]
        if description:
            draw.text((card_x + 20, card_y + 46), description, font=small_font,
                      fill=hex_to_rgb(C_ON_SURFACE_VARIANT))
        
        # 右侧编号（淡灰色大号）
        bbox = draw.textbbox((0, 0), seq_str, font=num_font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        draw.text((card_x + card_w - tw - 20, card_y + (card_h - th) // 2), seq_str,
                  font=num_font, fill=hex_to_rgb('#C6C5D4'))
    
    y = temp_y
    
    # ========== 8. 功能亮点区域 ==========
    y += 16
    draw.line([P, y, W - P, y], fill=hex_to_rgb('#E1E3E4'), width=1)
    y += 24
    
    features = [
        ('智', '智能规划'),
        ('路', '路线优化'),
        ('文', '人文洞察')
    ]
    
    feat_w = (W - P * 2) / 3
    for idx, (icon, label) in enumerate(features):
        cx = int(P + feat_w * idx + feat_w / 2)
        
        # 图标圆圈（浅色背景）
        draw.ellipse([cx - 24, y, cx + 24, y + 48],
                     fill=hex_to_rgb('#E0E0FF'))
        
        # 图标文字
        draw.text((cx - 6, y + 14), icon, font=body_font,
                  fill=hex_to_rgb(C_PRIMARY))
        
        # 标签
        bbox = draw.textbbox((0, 0), label, font=small_font)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw // 2, y + 56), label, font=small_font,
                  fill=hex_to_rgb(C_ON_SURFACE_VARIANT))
    
    y += 84
    draw.line([P, y, W - P, y], fill=hex_to_rgb('#E1E3E4'), width=1)
    y += 24
    
    # ========== 10. 底部品牌区域 + 二维码 ==========
    logo_size = 40
    qr_size = 96
    
    # 先计算底部区域所需高度，确保画布足够
    bottom_content_h = max(logo_size + 30, qr_size + 12)
    required_h = y + bottom_content_h + 40  # 40px 底部安全区
    if required_h > total_h:
        new_img = Image.new('RGB', (W, required_h), hex_to_rgb(C_SURFACE))
        new_img.paste(img, (0, 0))
        img = new_img
        draw = ImageDraw.Draw(img)
        total_h = required_h
    
    # Logo 图片（优先使用 logo.png，否则 fallback 到蓝色方块+emoji）
    logo_img = load_logo_image(logo_size)
    if logo_img:
        # RGBA 转 RGB 后粘贴
        logo_rgb = Image.new('RGB', logo_img.size, (255, 255, 255))
        logo_rgb.paste(logo_img, mask=logo_img.split()[3])
        img.paste(logo_rgb, (P, y))
    else:
        draw_rounded_rect(draw, P, y, logo_size, logo_size, 12, hex_to_rgb(C_PRIMARY))
        draw.text((P + 8, y + 8), '🧭', font=body_font, fill=(255, 255, 255))
    
    # 品牌名
    draw.text((P + logo_size + 12, y + 2), '慧游', font=headline_font, fill=hex_to_rgb(C_PRIMARY))
    
    # 品牌口号
    draw.text((P + logo_size + 12, y + 28), '让灵感即刻启程', font=small_font,
              fill=hex_to_rgb(C_OUTLINE))
    
    # 二维码区域（在扩展后的画布上绘制）
    qr_x = W - P - qr_size
    qr_y = y
    
    # 二维码白底 + 边框
    draw_rounded_rect(draw, qr_x - 6, qr_y - 6, qr_size + 12, qr_size + 12, 16, (255, 255, 255))
    draw.rectangle([qr_x - 6, qr_y - 6, qr_x + qr_size + 6, qr_y + qr_size + 6],
                   outline=C_CARD_BORDER, width=1)
    
    # 加载并绘制二维码
    qr_img = load_qr_image(qr_size)
    if qr_img:
        img.paste(qr_img, (qr_x, qr_y))
    else:
        draw.rectangle([qr_x, qr_y, qr_x + qr_size, qr_y + qr_size],
                       fill=(240, 240, 240))
        draw.text((qr_x + 36, qr_y + 40), 'QR', font=subtitle_font, fill=hex_to_rgb(C_OUTLINE))
    
    # 扫码文字
    draw.text((qr_x - 30, y + 10), '扫码', font=small_font, fill=hex_to_rgb(C_OUTLINE))
    draw.text((qr_x - 30, y + 30), '开启', font=small_font, fill=hex_to_rgb(C_OUTLINE))
    
    y += logo_size + 30
    
    # 底部安全区
    draw.rectangle([0, total_h - 20, W, total_h], fill=hex_to_rgb(C_SURFACE))
    
    # 免责声明
    disclaimer = '本行程仅供参考，出行前请核实相关信息'
    bbox = draw.textbbox((0, 0), disclaimer, font=small_font)
    tw = bbox[2] - bbox[0]
    draw.text(((W - tw) // 2, total_h - 32), disclaimer, font=small_font,
              fill=hex_to_rgb(C_OUTLINE))
    
    # ========== 导出 ==========
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='PNG', quality=95)
    return img_buffer.getvalue()


@router.post("/generate-poster-base64")
async def generate_poster_base64(poster_data: dict):
    try:
        poster_bytes = await create_poster(poster_data)
        base64_str = base64.b64encode(poster_bytes).decode('utf-8')
        return {
            "code": 0,
            "data": {
                "image": f"data:image/png;base64,{base64_str}",
                "size": len(poster_bytes)
            },
            "msg": "海报生成成功"
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



