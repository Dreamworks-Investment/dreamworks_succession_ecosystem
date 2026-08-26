/**
 * report.js — PDF 导出功能 & 报告模板
 *
 * 使用 html2canvas + jsPDF 将报告区域渲染为 PDF
 * 报告格式严格按照 身家诊断报告_交付模板.md 的结构
 */

async function generatePDF(element, filename) {
  if (!element) {
    alert('没有可导出的报告内容');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;

    // Show loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(26,26,46,.9);color:#d4af37;padding:20px 40px;border-radius:12px;z-index:9999;font-family:sans-serif;font-size:1rem;';
    loadingDiv.textContent = '正在生成PDF...';
    document.body.appendChild(loadingDiv);

    // Save original state
    const origWidth = element.style.width;
    element.style.width = '750px'; // Fixed width for consistent PDF rendering

    // Render to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true
    });

    element.style.width = origWidth;

    // Create PDF
    const imgWidth = 190; // A4 width in mm minus margins
    const pageHeight = 277; // A4 height minus margins
    const imgHeight = canvas.height * imgWidth / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 10; // top margin

    // First page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Additional pages
    while (heightLeft > 0) {
      position = -(pageHeight * (pdf.internal.getNumberOfPages() - 1)) + 10;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename + '.pdf');
    document.body.removeChild(loadingDiv);

  } catch (err) {
    console.error('PDF generation error:', err);
    alert('PDF生成失败，请重试。错误：' + err.message);
  }
}

/**
 * 导出身家诊断完整报告
 * 严格按照 身家诊断报告_交付模板.md 的结构
 */
async function exportWealthReport() {
  // Build a comprehensive report element
  const reportDiv = document.createElement('div');
  reportDiv.id = 'wealth-report-full';
  reportDiv.style.cssText = 'background:#fff;padding:40px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#1a1a2e;line-height:1.8;width:750px;';

  const dcf = AppState.dcfResults;
  const totalBook = dcf ? dcf.totalBook : 0;
  const totalPV = dcf ? dcf.totalPV : 0;
  const discountPct = dcf ? dcf.discountPct : 0;
  const currentR = AppState.requiredReturn.r1 || 0;
  const requiredR = Math.max(AppState.requiredReturn.r1 || 0, AppState.requiredReturn.r2 || 0, AppState.requiredReturn.r3 || 10);

  const kpiPassed = currentR >= requiredR;

  reportDiv.innerHTML = `
    <div style="text-align:center;margin-bottom:32px;padding-bottom:24px;border-bottom:3px solid #d4af37;">
      <h1 style="font-size:1.8rem;margin-bottom:8px;color:#1a1a2e;">身家诊断报告</h1>
      <p style="color:#999;font-size:.85rem;">梦工场 · 家族传承系统 | ${today}</p>
    </div>

    <!-- KPI Emphasis Box -->
    <div style="text-align:center;padding:24px;border-radius:8px;margin-bottom:28px;background:${kpiPassed ? '#e1f5ee' : '#fcebeb'};border:2px solid ${kpiPassed ? '#1d9e75' : '#a32d2d'};">
      <div style="font-size:.9rem;color:${kpiPassed ? '#1d9e75' : '#a32d2d'};margin-bottom:8px;font-weight:600;">核心KPI：整体身家长期回报率 vs 身家要求回报率</div>
      <div style="font-size:2rem;font-weight:700;color:${kpiPassed ? '#1d9e75' : '#a32d2d'};margin-bottom:4px;">
        R<sub>身家</sub> ${fmtPct(currentR)} &nbsp;${kpiPassed ? '&ge;' : '&lt;'}&nbsp; R<sub>要求</sub> ${fmtPct(requiredR)}
      </div>
      <div style="font-size:.9rem;color:${kpiPassed ? '#1d9e75' : '#a32d2d'};">
        ${kpiPassed ? '整体身家回报率超过要求回报率，财富在真正增长' : '整体身家回报率低于要求回报率——你的财富在悄悄缩水'}
      </div>
      ${!kpiPassed ? '<div style="font-size:.8rem;color:#a32d2d;margin-top:4px;">差距 ' + (requiredR - currentR).toFixed(1) + ' 个百分点，40年后财富差额可达数十倍</div>' : ''}
    </div>

    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#d4af37;margin-bottom:8px;">前言</h2>
      <p style="font-size:.9rem;color:#555;">自梦工场成立以来，我们便定位于高净值人士的家财、家业、家人全程价值诊断与增进伙伴。</p>
      <p style="font-size:.9rem;color:#555;">国人常说"身家性命"。作为性命，每年需要体检；作为与性命等价齐观的身家，却大都被无意识毁损。绝大多数富人终究返贫成为常态，而富过三代成为奇迹。</p>
    </div>

    <div style="background:#fafaf7;padding:24px;border-radius:8px;margin-bottom:32px;border-left:4px solid #d4af37;">
      <h2 style="font-size:1.2rem;color:#1a1a2e;margin-bottom:12px;">一句话结论</h2>
      <p style="font-size:.95rem;line-height:1.8;">
        您的资产账面约 <strong>${fmtMoney(totalBook)}</strong>，整体年化回报率约 <strong>${fmtPct(currentR)}</strong>。<br>
        以 <strong>${fmtPct(requiredR)}</strong> 要求回报率计算，您的<strong>真实身家</strong>在中性情景下约 <strong>${fmtMoney(totalPV)}</strong>，
        较账面值<strong style="color:#a32d2d;">${discountPct < -0.5 ? '折价 ' + Math.abs(discountPct).toFixed(1) + '%' : '基本持平'}</strong>。
      </p>
    </div>

    <!-- Part 1: Asset Portrait -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第一部分：您的身家画像</h2>
      <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
        <thead>
          <tr style="background:#f6f5f0;">
            <th style="padding:10px;text-align:left;">资产类别</th>
            <th style="padding:10px;text-align:right;">账面值（万元）</th>
            <th style="padding:10px;text-align:right;">占比</th>
            <th style="padding:10px;text-align:right;">年化回报率</th>
          </tr>
        </thead>
        <tbody>
          ${(dcf?.detailRows || []).map(r => `
            <tr style="border-bottom:1px solid #f0ede5;">
              <td style="padding:10px;">${r.label}</td>
              <td style="padding:10px;text-align:right;">${Math.round(r.bookVal).toLocaleString()}</td>
              <td style="padding:10px;text-align:right;">${(r.bookVal/totalBook*100).toFixed(1)}%</td>
              <td style="padding:10px;text-align:right;color:${r.destroyed > r.bookVal * 0.1 ? '#a32d2d' : '#1d9e75'};">${r.assessment}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Part 2: Past 5 Years -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第二部分：过去五年回报率分析</h2>
      <p style="font-size:.9rem;color:#555;">整体身家加权平均回报率：<strong style="font-size:1.2rem;">${fmtPct(currentR)}</strong></p>
      <p style="font-size:.9rem;color:#555;">与要求回报率 ${fmtPct(requiredR)} 对比：
        <strong style="color:${currentR < requiredR ? '#a32d2d' : '#1d9e75'}">
          ${currentR < requiredR ? '大幅低于要求回报率——你的身家在悄悄缩水' : '接近或高于要求回报率'}
        </strong>
      </p>
    </div>

    <!-- Part 3: Required Return -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第三部分：身家要求回报率</h2>
      <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
        <thead>
          <tr style="background:#f6f5f0;">
            <th style="padding:10px;text-align:left;">角度</th>
            <th style="padding:10px;text-align:right;">结果</th>
            <th style="padding:10px;text-align:left;">依据</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #f0ede5;">
            <td style="padding:10px;">A. 过去5年实际回报率</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">${fmtPct(currentR)}</td>
            <td style="padding:10px;">加权平均计算</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede5;">
            <td style="padding:10px;">B. 现金流倒算</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">${AppState.requiredReturn.r2 ? fmtPct(AppState.requiredReturn.r2) : '未计算'}</td>
            <td style="padding:10px;">未来刚性支付义务</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede5;">
            <td style="padding:10px;">C. M2购买力底线</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">10.0%</td>
            <td style="padding:10px;">中国M2近10年增速</td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:16px;text-align:center;font-size:1.1rem;">
        R<sub>要求</sub> = max(角度一, 角度二, 角度三) = <strong style="font-size:1.4rem;color:#d4af37;">${fmtPct(requiredR)}</strong>
      </p>
    </div>

    <!-- Part 4: Real Wealth -->
    <div style="margin-bottom:32px;background:#fcf8f0;padding:24px;border-radius:8px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第四部分：真实身家（全书最重要的一页）</h2>
      <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
        <thead>
          <tr style="background:#f6f5f0;">
            <th style="padding:10px;"></th>
            <th style="padding:10px;text-align:right;">账面值</th>
            <th style="padding:10px;text-align:right;">现值</th>
            <th style="padding:10px;text-align:right;">差额</th>
          </tr>
        </thead>
        <tbody>
          ${(dcf?.detailRows || []).map(r => `
            <tr style="border-bottom:1px solid #f0ede5;">
              <td style="padding:10px;">${r.label}</td>
              <td style="padding:10px;text-align:right;">${Math.round(r.bookVal).toLocaleString()}</td>
              <td style="padding:10px;text-align:right;">${Math.round(r.pv).toLocaleString()}</td>
              <td style="padding:10px;text-align:right;color:${r.destroyed > 0 ? '#a32d2d' : '#1d9e75'};">${r.destroyed > 0 ? '-' : '+'}${Math.round(Math.abs(r.destroyed)).toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr style="font-weight:bold;border-top:2px solid #d4af37;">
            <td style="padding:10px;">合计</td>
            <td style="padding:10px;text-align:right;">${Math.round(totalBook).toLocaleString()}</td>
            <td style="padding:10px;text-align:right;">${Math.round(totalPV).toLocaleString()}</td>
            <td style="padding:10px;text-align:right;color:#a32d2d;">${Math.round(totalPV - totalBook).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <p style="margin-top:16px;font-size:.95rem;color:#555;text-align:center;">
        以 ${fmtPct(requiredR)} 要求回报率衡量，您的真实身家为 <strong>${fmtMoney(totalPV)}</strong>，
        较账面值的 <strong>${fmtMoney(totalBook)}</strong> ${discountPct < -0.5 ? '折价 <span style="color:#a32d2d;">' + Math.abs(discountPct).toFixed(1) + '%</span>' : '基本持平'}。
      </p>
      <p style="font-size:.9rem;color:#888;text-align:center;margin-top:12px;">
        这意味着：您名义上有 ${fmtMoney(totalBook)}，但如果按"合格富人的最低赚钱速度"来衡量，这些资产的真实价值只有 ${fmtMoney(totalPV)}。
      </p>
    </div>

    <!-- Part 5: Wealth Growth -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第五部分：财富增长曲线</h2>
      <table style="width:100%;border-collapse:collapse;font-size:.9rem;">
        <thead>
          <tr style="background:#f6f5f0;">
            <th style="padding:10px;">时间</th>
            <th style="padding:10px;text-align:right;">按当前结构</th>
            <th style="padding:10px;text-align:right;">按要求回报率</th>
            <th style="padding:10px;text-align:right;">按M2购买力</th>
            <th style="padding:10px;text-align:right;">差额</th>
          </tr>
        </thead>
        <tbody>
          ${[0,5,10,15,20,40].map(y => {
            const currVal = totalBook * Math.pow(1 + currentR / 100, y);
            const reqVal = totalBook * Math.pow(1 + requiredR / 100, y);
            const m2Val = totalBook * Math.pow(1 + 10 / 100, y);
            const diff = reqVal - currVal;
            return `
              <tr style="border-bottom:1px solid #f0ede5;">
                <td style="padding:10px;">${y === 0 ? '当前' : y + '年后'}</td>
                <td style="padding:10px;text-align:right;">${Math.round(currVal).toLocaleString()}</td>
                <td style="padding:10px;text-align:right;">${Math.round(reqVal).toLocaleString()}</td>
                <td style="padding:10px;text-align:right;">${Math.round(m2Val).toLocaleString()}</td>
                <td style="padding:10px;text-align:right;color:#a32d2d;font-weight:600;">${Math.abs(diff) > totalBook * 0.01 ? Math.round(diff).toLocaleString() : '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:.85rem;color:#888;margin-top:12px;text-align:center;">
        "君子慎始，差若毫厘，谬以千里。" ——《礼记·经解》
      </p>
    </div>

    <!-- Part 6: Suggestions -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第六部分：调整建议</h2>
      <p style="font-size:.9rem;color:#555;margin-bottom:16px;">
        <strong>核心目标：</strong>让整体身家加权年化回报率 > 要求回报率 ${fmtPct(requiredR)}
      </p>

      ${(dcf?.detailRows || []).filter(r => r.destroyed > 0).sort((a, b) => b.destroyed - a.destroyed).slice(0, 5).map((r, i) => `
        <div style="margin-bottom:16px;padding:16px;background:#fafaf7;border-radius:6px;">
          <h4 style="color:#a32d2d;margin-bottom:4px;">建议${i + 1}：优化${r.label}配置</h4>
          <p style="font-size:.85rem;color:#555;">该资产类账面值 ${Math.round(r.bookVal).toLocaleString()} 万元，价值损毁约 ${Math.round(r.destroyed).toLocaleString()} 万元。建议逐项审视此类资产，减少低回报配置，将释放的资本投入更高回报的长期资产。</p>
        </div>
      `).join('')}

      <div style="padding:16px;background:#f6f5f0;border-radius:6px;margin-top:16px;">
        <h4 style="margin-bottom:4px;">风险管理建议</h4>
        <ul style="font-size:.85rem;color:#555;padding-left:20px;line-height:1.8;">
          <li>家族信托架构：隔离企业经营风险对家族财富的冲击</li>
          <li>资本久期匹配：长短期资本与需求端匹配</li>
          <li>资产分散化：从单一行业/企业 → 多元化配置</li>
          <li>定期体检：建议年度完整复检，季度快速检视</li>
        </ul>
      </div>
    </div>

    <!-- Part 7: Next Steps -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第七部分：下一步</h2>
      <p style="font-size:.9rem;color:#555;line-height:1.8;">
        各类资产在长时间维度下的回报率水平更有指导意义。身家随着环境、企业和个人的变化也在变化，需要<strong>定期体检调整</strong>，以持续超越身家要求回报率。
      </p>
      <p style="font-size:.9rem;color:#555;">建议：<strong>季度</strong>快速检视资产结构变化；<strong>年度</strong>完整重做身家诊断；<strong>重大事件后</strong>（企业重大变动、大额资产买卖、家族结构变化）立即复检。</p>
    </div>

    <!-- Appendix -->
    <div style="margin-bottom:24px;font-size:.8rem;color:#999;border-top:1px solid #e5e2d8;padding-top:16px;">
      <p><strong>附录：要求回报率的参照锚</strong></p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td>十年期国债收益率</td><td>~1.7%</td><td>无风险利率</td></tr>
        <tr><td>沪深300全收益19年</td><td>~9%</td><td>A股被动宽指</td></tr>
        <tr><td>中国M2近10年增速</td><td>~10.5%</td><td>货币贬值速度</td></tr>
        <tr><td>梦工场选股门槛</td><td>~15%</td><td>狠值投资最低要求</td></tr>
        <tr><td>巴菲特60年回报</td><td>~20%</td><td>全球顶尖长期投资者</td></tr>
      </table>
      <p style="margin-top:12px;">数据来源：中国人民银行、Bloomberg、Siegel "Stocks for the Long Run"</p>
    </div>

    <div style="text-align:center;margin-top:40px;padding-top:24px;border-top:1px solid #e5e2d8;">
      <p style="font-size:.85rem;color:#999;">梦工场身家诊断团队</p>
      <p style="font-size:.85rem;color:#999;">${today}</p>
    </div>
  `;

  // Append to body temporarily (hidden)
  reportDiv.style.position = 'absolute';
  reportDiv.style.left = '-9999px';
  reportDiv.style.top = '0';
  document.body.appendChild(reportDiv);

  await generatePDF(reportDiv, '身家诊断报告');

  document.body.removeChild(reportDiv);
}
