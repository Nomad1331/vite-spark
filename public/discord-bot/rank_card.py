from PIL import Image, ImageDraw, ImageFont, ImageFilter
import requests
from io import BytesIO
import os

def rank_from_level(level):
    """Helper to get rank from level"""
    if level >= 150:
        return "S-RANK"
    if level >= 100:
        return "A-RANK"
    if level >= 75:
        return "B-RANK"
    if level >= 50:
        return "C-RANK"
    if level >= 26:
        return "D-RANK"
    return "E-RANK"

def next_rank_milestone(level):
    """Get next rank and levels needed"""
    milestones = [
        (26, "D-RANK"),
        (50, "C-RANK"),
        (75, "B-RANK"),
        (100, "A-RANK"),
        (150, "S-RANK")
    ]
    
    for milestone_level, rank_name in milestones:
        if level < milestone_level:
            levels_needed = milestone_level - level
            return levels_needed, rank_name
    
    return None, "MAX RANK"

def create_rank_card(username, avatar_url, level, rank_name, server_rank, current_xp, needed_xp, total_xp):
    """
    Generate rank card using the custom Solo Leveling template
    """
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    from io import BytesIO
    import requests, os

    # Load template
    template_path = "assets/images/rank_card_template.png"
    try:
        img = Image.open(template_path).convert("RGBA")
    except FileNotFoundError:
        return None

    width, height = img.size
    draw = ImageDraw.Draw(img)

    # Fonts
    try:
        font_name   = ImageFont.truetype("assets/fonts/Cinzel-SemiBold.ttf", 55)
        font_large  = ImageFont.truetype("assets/fonts/Cinzel-SemiBold.ttf", 42)
        font_medium = ImageFont.truetype("assets/fonts/Cinzel-SemiBold.ttf", 40)
        font_small  = ImageFont.truetype("assets/fonts/Cinzel-SemiBold.ttf", 32)
        font_tiny   = ImageFont.truetype("assets/fonts/Cinzel-SemiBold.ttf", 32)
    except:
        font_name = font_large = font_medium = font_small = font_tiny = ImageFont.load_default()

    # =========================
    # Avatar
    # =========================
    avatar_size = 288
    avatar_x, avatar_y = 315, 400

    try:
        r = requests.get(avatar_url, timeout=5)
        avatar = Image.open(BytesIO(r.content)).convert("RGBA")
        avatar = avatar.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)

        mask = Image.new("L", (avatar_size, avatar_size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, avatar_size, avatar_size), fill=255)

        avatar.putalpha(mask)
        img.paste(
            avatar,
            (avatar_x - avatar_size // 2, avatar_y - avatar_size // 2),
            avatar
        )
    except:
        pass

    # =========================
    # Username
    # =========================
    username_text = username.upper()
    ux, uy = width // 2 - 255, 295

    draw.text((ux+3, uy+3), username_text, font=font_name, fill=(0,0,0,200), anchor="lm")
    draw.text((ux, uy), username_text, font=font_name, fill=(205,250,252,255), anchor="lm")

    # =========================
    # Rank letter ONLY (template already says RANK)
    # =========================
    rank_letter = rank_name
    draw.text((537, 377), rank_letter, font=font_medium, fill=(0,0,0,200), anchor="ls")
    draw.text((533, 377), rank_letter, font=font_medium, fill=(0,0,0,200), anchor="ls")
    draw.text((535, 379), rank_letter, font=font_medium, fill=(0,0,0,200), anchor="ls")
    draw.text((535, 375), rank_letter, font=font_medium, fill=(0,0,0,200), anchor="ls")
    draw.text((535, 377), rank_letter, font=font_medium, fill=(241,200,191,255), anchor="ls")

    # =========================
    # Level VALUE only
    # =========================
    draw.text((902, 366), f"LEVEL: {level}", font=font_medium, fill=(0,0,0,200), anchor="mm")
    draw.text((898, 366), f"LEVEL: {level}", font=font_medium, fill=(0,0,0,200), anchor="mm")
    draw.text((900, 368), f"LEVEL: {level}", font=font_medium, fill=(0,0,0,200), anchor="mm")
    draw.text((900, 364), f"LEVEL: {level}", font=font_medium, fill=(0,0,0,200), anchor="mm")
    draw.text((900, 366), f"LEVEL: {level}", font=font_medium, fill=(100,220,255,255), anchor="mm")

    # =========================
    # Server Rank
    # =========================
    sr_text = f"RANK: #{server_rank}"
    rx, ry = width - 300, 250

    draw.text((rx+2, ry), sr_text, font=font_large, fill=(0,0,0,200), anchor="mm")
    draw.text((rx-2, ry), sr_text, font=font_large, fill=(0,0,0,200), anchor="mm")
    draw.text((rx, ry+2), sr_text, font=font_large, fill=(0,0,0,200), anchor="mm")
    draw.text((rx, ry-2), sr_text, font=font_large, fill=(0,0,0,200), anchor="mm")
    draw.text((rx, ry), sr_text, font=font_large, fill=(255,215,0,255), anchor="mm")

    # =========================
    # Milestone VALUE only
    # =========================
    levels_needed, next_rank = next_rank_milestone(level)
    milestone = f"{levels_needed} LEVELS UNTIL {next_rank}" if levels_needed else "MAX"

    draw.text((515, 450), milestone, font=font_small, fill=(208,204,250,255), anchor="lm")

    # =========================
    # Total XP VALUE only
    # =========================
    draw.text(
        (515, 500),
        f"TOTAL XP: {total_xp:,}",
        font=font_tiny,
        fill=(205,204,250,255),
        anchor="lm"
    )

    # =========================
    # Progress Bar (perfectly centered)
    # =========================
    bar_width, bar_height = 860, 55
    bar_x = (width - bar_width) // 2 + 100
    bar_y = 569

    # DEBUG: Print values to check what we're receiving
    print(f"🔍 Card Generator Debug:")
    print(f"   current_xp: {current_xp}")
    print(f"   needed_xp: {needed_xp}")
    print(f"   total_xp: {total_xp}")
    print(f"   level: {level}")

    progress = min(current_xp / needed_xp if needed_xp else 0, 1)
    fill_width = int(bar_width * progress)

    for i in range(fill_width):
        ratio = i / bar_width
        color = (
            int(150 * ratio),
            int(200 + 55 * ratio),
            255,
            255
        )
        draw.rectangle(
            [(bar_x + i, bar_y), (bar_x + i + 1, bar_y + bar_height)],
            fill=color
        )

    if fill_width > 0:
        glow = Image.new("RGBA", img.size, (0,0,0,0))
        gdraw = ImageDraw.Draw(glow)
        gdraw.rectangle(
            [(bar_x, bar_y-5), (bar_x+fill_width, bar_y+bar_height+5)],
            fill=(100,220,255,80)
        )
        glow = glow.filter(ImageFilter.GaussianBlur(10))
        img = Image.alpha_composite(img, glow)
        draw = ImageDraw.Draw(img)

    # =========================
    # XP Text (clean 4-direction outline)
    # =========================
    xp_text = f"{current_xp:,} / {needed_xp:,} XP"
    cx, cy = bar_x + bar_width // 2, bar_y + bar_height // 2

    outline_offset = 2
    outline_color = (0, 0, 0, 200)

    # Left
    draw.text((cx - outline_offset, cy), xp_text, font=font_medium, fill=outline_color, anchor="mm")
    # Right
    draw.text((cx + outline_offset, cy), xp_text, font=font_medium, fill=outline_color, anchor="mm")
    # Up
    draw.text((cx, cy - outline_offset), xp_text, font=font_medium, fill=outline_color, anchor="mm")
    # Down
    draw.text((cx, cy + outline_offset), xp_text, font=font_medium, fill=outline_color, anchor="mm")

    # Main text
    draw.text((cx, cy), xp_text, font=font_medium, fill=(255,255,255,255), anchor="mm")


    # =========================
    # Save (use a unique, sanitized filename to avoid race/caching issues)
    # =========================
    import time
    safe_name = ''.join(c for c in username if c.isalnum() or c in ('_', '-')).strip() or 'user'
    ts = int(time.time() * 1000)
    os.makedirs("temp", exist_ok=True)
    output_path = f"temp/rank_card_{safe_name}_{ts}.png"

    final = Image.new("RGB", img.size, (0,0,0))
    final.paste(img, mask=img)
    final.save(output_path, quality=95)

    return output_path
