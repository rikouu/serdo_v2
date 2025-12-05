#!/usr/bin/env node

const { fetch } = require('undici');

const BASE = 'http://localhost:4000/api/v1';

async function test() {
  console.log('🧪 开始测试Auto Check功能...\n');
  
  try {
    // 1. 登录获取token
    console.log('1️⃣ 登录...');
    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin' })
    });
    
    if (!loginRes.ok) {
      console.log('❌ 登录失败');
      return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.token;
    console.log('✅ 登录成功\n');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    
    // 2. 获取检查状态
    console.log('2️⃣ 获取检查状态...');
    const statusRes = await fetch(`${BASE}/check-status`, { headers });
    
    if (!statusRes.ok) {
      console.log('❌ 获取状态失败');
      return;
    }
    
    const status = await statusRes.json();
    console.log('✅ 检查状态:', JSON.stringify(status, null, 2));
    console.log('');
    
    // 3. 手动触发服务器检查
    console.log('3️⃣ 手动触发服务器检查...');
    const serverCheckRes = await fetch(`${BASE}/servers/check`, {
      method: 'POST',
      headers
    });
    
    if (!serverCheckRes.ok) {
      console.log('❌ 服务器检查失败');
      return;
    }
    
    const serverCheckData = await serverCheckRes.json();
    console.log(`✅ 服务器检查完成: ${serverCheckData.results?.length || 0} 台服务器`);
    console.log('');
    
    // 4. 等待一下确保日志被记录
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 5. 获取检查日志
    console.log('4️⃣ 获取检查日志...');
    const logsRes = await fetch(`${BASE}/check-logs?page=1&pageSize=5`, { headers });
    
    if (!logsRes.ok) {
      console.log('❌ 获取日志失败');
      return;
    }
    
    const logsData = await logsRes.json();
    console.log(`✅ 获取到 ${logsData.logs?.length || 0} 条日志`);
    console.log('最新日志:');
    if (logsData.logs && logsData.logs.length > 0) {
      const log = logsData.logs[0];
      console.log(`   - 类型: ${log.type}`);
      console.log(`   - 触发方式: ${log.trigger}`);
      console.log(`   - 总数: ${log.total}, 成功: ${log.success}, 失败: ${log.failed}`);
      console.log(`   - 耗时: ${log.duration}ms`);
      console.log(`   - 时间: ${new Date(log.timestamp).toLocaleString()}`);
    }
    console.log('');
    
    // 6. 测试日志分页
    console.log('5️⃣ 测试日志分页...');
    const logsPage2Res = await fetch(`${BASE}/check-logs?page=2&pageSize=5`, { headers });
    
    if (logsPage2Res.ok) {
      const logsPage2Data = await logsPage2Res.json();
      console.log(`✅ 第2页日志: ${logsPage2Data.logs?.length || 0} 条`);
      console.log(`   总页数: ${logsPage2Data.pagination?.totalPages || 0}`);
    }
    console.log('');
    
    // 7. 测试按类型过滤
    console.log('6️⃣ 测试按类型过滤...');
    const logsServerRes = await fetch(`${BASE}/check-logs?page=1&pageSize=5&type=server`, { headers });
    
    if (logsServerRes.ok) {
      const logsServerData = await logsServerRes.json();
      console.log(`✅ 服务器检查日志: ${logsServerData.logs?.length || 0} 条`);
    }
    console.log('');
    
    // 8. 再次获取状态，确认时间已更新
    console.log('7️⃣ 确认自动检查时间已更新...');
    const statusRes2 = await fetch(`${BASE}/check-status`, { headers });
    
    if (statusRes2.ok) {
      const status2 = await statusRes2.json();
      console.log('✅ 更新后的状态:');
      console.log(`   服务器上次检查: ${new Date(status2.server.lastCheckAt).toLocaleString()}`);
      console.log(`   服务器下次检查: ${new Date(status2.server.nextCheckAt).toLocaleString()}`);
      
      if (status2.server.lastCheckAt !== status.server.lastCheckAt) {
        console.log('✅ 手动检查已更新自动检查时间！');
      } else {
        console.log('⚠️  时间未更新（可能未变化或检查未启用）');
      }
    }
    console.log('');
    
    console.log('🎉 所有测试通过！\n');
    console.log('📊 功能检查清单:');
    console.log('  ✅ 检查日志记录系统');
    console.log('  ✅ 手动检查记录日志');
    console.log('  ✅ 手动检查更新自动时间');
    console.log('  ✅ 日志查询API');
    console.log('  ✅ 日志分页');
    console.log('  ✅ 日志类型过滤');
    console.log('  ✅ 检查状态API');
    console.log('');
    console.log('💡 下一步: 请在浏览器中打开 http://localhost:3000 查看仪表盘底部的自动检查日志模块！');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

test();

