#!/bin/bash

# =============================================================================
# Serdo 生产环境密码问题修复脚本
# =============================================================================
# 
# 用途: 自动诊断和修复生产环境的密码加密问题
# 作者: Serdo Team
# 日期: 2024-12-05
#
# 使用方法:
#   chmod +x scripts/fix-production-password.sh
#   ./scripts/fix-production-password.sh
#
# =============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 标题
echo -e "${BLUE}"
echo "======================================================================="
echo "  Serdo 生产环境密码问题修复脚本"
echo "======================================================================="
echo -e "${NC}"

# =============================================================================
# 步骤 1: 检查当前目录
# =============================================================================

log_info "步骤 1: 检查当前目录..."

if [ ! -f "package.json" ]; then
    log_error "错误: 请在 Serdo 项目根目录下运行此脚本"
    exit 1
fi

if [ ! -d "api" ]; then
    log_error "错误: 找不到 api 目录"
    exit 1
fi

log_success "当前目录正确"

# =============================================================================
# 步骤 2: 检查后端配置
# =============================================================================

log_info "步骤 2: 检查后端配置..."

cd api

# 检查 .env 文件
if [ ! -f ".env" ]; then
    log_warning ".env 文件不存在，创建中..."
    
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_success ".env 文件已创建"
    else
        log_error ".env.example 文件不存在"
        exit 1
    fi
fi

# 检查 REDACT_MODE 配置
if grep -q "REDACT_MODE=true" .env; then
    log_success "REDACT_MODE 已正确设置为 true"
elif grep -q "REDACT_MODE=false" .env; then
    log_warning "REDACT_MODE 当前为 false，修改为 true..."
    sed -i.bak 's/REDACT_MODE=false/REDACT_MODE=true/' .env
    log_success "REDACT_MODE 已修改为 true"
elif grep -q "REDACT_MODE=" .env; then
    log_warning "REDACT_MODE 配置异常，修改为 true..."
    sed -i.bak 's/REDACT_MODE=.*/REDACT_MODE=true/' .env
    log_success "REDACT_MODE 已修改为 true"
else
    log_warning "REDACT_MODE 未配置，添加中..."
    echo "" >> .env
    echo "# 密码加密模式（生产环境必须为 true）" >> .env
    echo "REDACT_MODE=true" >> .env
    log_success "REDACT_MODE 已添加"
fi

# 检查 JWT_SECRET
if grep -q "JWT_SECRET=your-super-secret-jwt-key-change-this-in-production" .env || \
   grep -q "JWT_SECRET=change" .env || \
   ! grep -q "JWT_SECRET=" .env; then
    log_warning "JWT_SECRET 使用默认值，生成随机密钥..."
    
    # 生成随机密钥
    NEW_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    
    if grep -q "JWT_SECRET=" .env; then
        sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" .env
    else
        echo "" >> .env
        echo "JWT_SECRET=$NEW_SECRET" >> .env
    fi
    
    log_success "JWT_SECRET 已生成并设置"
    log_warning "注意: JWT_SECRET 已更改，所有用户需要重新登录"
else
    log_success "JWT_SECRET 已配置"
fi

cd ..

# =============================================================================
# 步骤 3: 检查 systemd 配置（如果使用）
# =============================================================================

log_info "步骤 3: 检查 systemd 服务配置..."

SERVICE_FILE="/etc/systemd/system/serdo-api.service"

if [ -f "$SERVICE_FILE" ]; then
    log_info "发现 systemd 服务配置"
    
    if sudo grep -q "Environment.*REDACT_MODE=true" "$SERVICE_FILE"; then
        log_success "systemd 配置中 REDACT_MODE 已设置"
    else
        log_warning "systemd 配置中未设置 REDACT_MODE"
        log_info "请手动编辑 $SERVICE_FILE"
        log_info "添加行: Environment=\"REDACT_MODE=true\""
        log_info "然后运行: sudo systemctl daemon-reload && sudo systemctl restart serdo-api"
    fi
else
    log_warning "未找到 systemd 服务配置（可能使用其他方式运行）"
fi

# =============================================================================
# 步骤 4: 重启后端服务
# =============================================================================

log_info "步骤 4: 重启后端服务..."

# 检查是否使用 PM2
if command -v pm2 &> /dev/null; then
    log_info "检测到 PM2，尝试重启..."
    
    if pm2 list | grep -q "serdo-api"; then
        pm2 restart serdo-api
        log_success "PM2 服务已重启"
    else
        log_warning "PM2 中未找到 serdo-api 进程"
    fi
fi

# 检查是否使用 systemd
if systemctl is-active --quiet serdo-api; then
    log_info "检测到 systemd 服务，尝试重启..."
    sudo systemctl restart serdo-api
    log_success "systemd 服务已重启"
elif [ -f "$SERVICE_FILE" ]; then
    log_info "systemd 服务未运行，尝试启动..."
    sudo systemctl start serdo-api
    log_success "systemd 服务已启动"
fi

# =============================================================================
# 步骤 5: 验证配置
# =============================================================================

log_info "步骤 5: 验证配置..."

# 等待服务启动
sleep 3

# 检查 API 是否运行
API_PORT=$(grep "PORT=" api/.env | cut -d'=' -f2 || echo "4000")
API_URL="http://localhost:$API_PORT"

log_info "检查 API 服务: $API_URL"

if curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/v1/health" | grep -q "200"; then
    log_success "API 服务运行正常"
else
    log_warning "无法访问 API 服务（可能需要登录或健康检查端点不存在）"
    log_info "请手动检查: curl $API_URL/api/v1/health"
fi

# 检查进程日志
if systemctl is-active --quiet serdo-api; then
    log_info "检查服务日志中的 REDACT_MODE..."
    
    if sudo journalctl -u serdo-api -n 50 | grep -q "REDACT"; then
        log_success "日志中找到 REDACT_MODE 相关信息"
        sudo journalctl -u serdo-api -n 10 | grep REDACT || true
    else
        log_warning "日志中未找到 REDACT_MODE 信息"
    fi
fi

# =============================================================================
# 步骤 6: 前端处理
# =============================================================================

log_info "步骤 6: 前端处理..."

log_info "检查前端构建..."

if [ -d "dist" ]; then
    log_info "发现 dist 目录"
    
    # 检查 dist 目录的最后修改时间
    DIST_TIME=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" dist 2>/dev/null || stat -c "%y" dist 2>/dev/null || echo "未知")
    log_info "dist 目录最后修改时间: $DIST_TIME"
    
    log_warning "建议重新构建前端以确保使用最新代码"
    read -p "是否现在重新构建前端？(y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "开始构建前端..."
        npm run build
        log_success "前端构建完成"
        
        log_info "dist 目录内容:"
        ls -lh dist/
    fi
else
    log_warning "未找到 dist 目录，需要构建前端"
    read -p "是否现在构建前端？(y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "安装依赖..."
        npm install
        
        log_info "构建前端..."
        npm run build
        log_success "前端构建完成"
    fi
fi

# =============================================================================
# 步骤 7: 用户操作指南
# =============================================================================

echo ""
echo -e "${GREEN}=======================================================================${NC}"
echo -e "${GREEN}  修复完成！${NC}"
echo -e "${GREEN}=======================================================================${NC}"
echo ""

log_info "接下来的操作步骤："
echo ""
echo "1. 清除浏览器缓存"
echo "   - Chrome/Edge: Ctrl+Shift+Delete"
echo "   - Firefox: Ctrl+Shift+Delete"
echo "   - Safari: Cmd+Option+E"
echo ""
echo "2. 重新登录系统"
echo "   - 访问前端地址"
echo "   - 输入用户名和密码登录"
echo ""
echo "3. 重新输入所有密码"
echo "   - 进入 Settings 页面"
echo "   - 点击各个密码字段的"查看"按钮"
echo "   - 会提示"无法解密密码""
echo "   - 重新输入密码"
echo "   - 点击 Save Changes"
echo ""
echo "4. 测试密码功能"
echo "   - 刷新页面（F5）"
echo "   - 再次点击"查看"按钮"
echo "   - 应该能正常显示密码"
echo ""

log_warning "⚠️ 重要提示:"
echo "- REDACT_MODE 已设置为 true（加密模式）"
echo "- 所有旧密码需要重新输入"
echo "- 刷新页面后可以正常查看密码"
echo "- 关闭浏览器后需要重新输入（这是安全特性）"
echo ""

# =============================================================================
# 步骤 8: 生成诊断报告
# =============================================================================

log_info "生成诊断报告..."

REPORT_FILE="password-fix-report-$(date +%Y%m%d-%H%M%S).txt"

{
    echo "======================================================================"
    echo "  Serdo 密码问题修复报告"
    echo "======================================================================"
    echo ""
    echo "生成时间: $(date)"
    echo ""
    echo "1. 环境配置"
    echo "----------------------------------------------------------------------"
    echo "REDACT_MODE: $(grep REDACT_MODE api/.env | cut -d'=' -f2 || echo '未设置')"
    echo "JWT_SECRET: $(grep JWT_SECRET api/.env | cut -d'=' -f2 | head -c 20)..."
    echo "PORT: $(grep PORT api/.env | cut -d'=' -f2 || echo '4000')"
    echo ""
    echo "2. 服务状态"
    echo "----------------------------------------------------------------------"
    if systemctl is-active --quiet serdo-api; then
        echo "systemd 服务: 运行中"
    else
        echo "systemd 服务: 未运行"
    fi
    
    if pm2 list | grep -q "serdo-api"; then
        echo "PM2 进程: 运行中"
        pm2 list | grep serdo-api
    else
        echo "PM2 进程: 未找到"
    fi
    echo ""
    echo "3. 前端构建"
    echo "----------------------------------------------------------------------"
    if [ -d "dist" ]; then
        echo "dist 目录: 存在"
        echo "最后修改: $(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" dist 2>/dev/null || stat -c "%y" dist 2>/dev/null)"
    else
        echo "dist 目录: 不存在"
    fi
    echo ""
    echo "4. 文件清单"
    echo "----------------------------------------------------------------------"
    echo "配置文件:"
    ls -lh api/.env* 2>/dev/null || echo "无"
    echo ""
    echo "数据文件:"
    ls -lh api/api/data/*.json 2>/dev/null | head -5 || echo "无"
    echo ""
    echo "======================================================================"
    echo "  修复完成"
    echo "======================================================================"
    echo ""
    echo "请按照以下步骤完成后续操作:"
    echo "1. 清除浏览器缓存"
    echo "2. 重新登录系统"
    echo "3. 重新输入所有密码"
    echo "4. 测试密码查看功能"
    echo ""
    echo "如有问题，请查看完整文档: PRODUCTION_PASSWORD_FIX.md"
    echo ""
} > "$REPORT_FILE"

log_success "诊断报告已保存: $REPORT_FILE"

# =============================================================================
# 完成
# =============================================================================

echo ""
echo -e "${GREEN}✅ 修复脚本执行完成！${NC}"
echo ""
log_info "报告文件: $REPORT_FILE"
log_info "详细文档: PRODUCTION_PASSWORD_FIX.md"
log_info "诊断工具: public/debug-crypto.html"
echo ""

exit 0

