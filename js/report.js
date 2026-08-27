/**
 * report.js — PDF 导出功能 & 报告模板
 *
 * 使用 html2canvas + jsPDF 将报告区域渲染为 PDF
 * 报告格式严格按照 身家诊断报告_交付模板.md 的结构
 */

async function generatePDF(element, filename) {
  if (!element) throw new Error('没有可导出的报告内容');
  if (typeof window.html2canvas !== 'function') throw new Error('PDF 渲染组件 html2canvas 未加载');
  if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') throw new Error('PDF 组件 jsPDF 未加载');

  const loadingDiv = document.createElement('div');
  const origWidth = element.style.width;
  try {
    const { jsPDF } = window.jspdf;
    loadingDiv.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(26,26,46,.9);color:#d4af37;padding:20px 40px;border-radius:12px;z-index:9999;font-family:sans-serif;font-size:1rem;';
    loadingDiv.textContent = '正在生成PDF...';
    document.body.appendChild(loadingDiv);
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
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename + '.pdf');
    return true;
  } catch (err) {
    console.error('PDF generation error:', err);
    throw err;
  } finally {
    element.style.width = origWidth;
    loadingDiv.remove();
  }
}

/**
 * 导出身家诊断完整报告
 * 严格按照 身家诊断报告_交付模板.md 的结构
 */
async function exportWealthReport() {
  const today = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).replaceAll('/', '-');
  const calculation = AppState.requiredReturn.computation || WealthModel.computeRequiredReturn(
    AppState.assets,
    AppState.expenses,
    AppState.requiredReturn.r3 ?? 10,
    AppState.requiredReturn.principalOverride
  );
  const recommendations = typeof window.buildWealthActionRecommendations === 'function'
    ? window.buildWealthActionRecommendations()
    : [];
  const expenses = WealthModel.normalizeExpenses(AppState.expenses);
  // Build a comprehensive report element
  const reportDiv = document.createElement('div');
  reportDiv.id = 'wealth-report-full';
  reportDiv.style.cssText = 'background:#fff;padding:40px;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;color:#1a1a2e;line-height:1.8;width:750px;';

  const dcf = AppState.dcfResults;
  const totalBook = dcf ? dcf.totalBook : 0;
  const totalPV = dcf ? dcf.totalPV : 0;
  const discountPct = dcf ? dcf.discountPct : 0;
  const currentR = Number.isFinite(calculation.r1.rate) ? calculation.r1.rate : 0;
  const requiredR = calculation.requiredRate;
  const m2Rate = calculation.r3;

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
            <th style="padding:10px;text-align:right;">诊断</th>
          </tr>
        </thead>
        <tbody>
          ${(dcf?.detailRows || []).map(r => `
            <tr style="border-bottom:1px solid #f0ede5;">
              <td style="padding:10px;">${r.label}</td>
              <td style="padding:10px;text-align:right;">${Math.round(r.bookVal).toLocaleString()}</td>
              <td style="padding:10px;text-align:right;">${totalBook > 0 ? (r.bookVal/totalBook*100).toFixed(1) : '0.0'}%</td>
              <td style="padding:10px;text-align:right;color:${r.destroyed > r.bookVal * 0.1 ? '#a32d2d' : '#1d9e75'};">${r.assessment}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <!-- Part 2: Annualized return -->
    <div style="margin-bottom:32px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第二部分：整体身家年化净回报</h2>
      <p style="font-size:.9rem;color:#555;">本报告所有收益与增值字段均采用年化口径。资产年收益减去负债年成本后，再除以净资产。</p>
      <p style="font-size:.9rem;color:#555;">资产年收益 <strong>${fmtMoney(calculation.r1.annualAssetIncome)}</strong> − 负债年成本 <strong>${fmtMoney(calculation.r1.annualDebtCost)}</strong>，净资产 <strong>${fmtMoney(calculation.r1.netAssets)}</strong>，得到 R₁ = <strong style="font-size:1.2rem;">${fmtPct(currentR)}</strong>。</p>
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
            <td style="padding:10px;">A. 当前身家净回报率 R₁</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">${fmtPct(currentR)}</td>
            <td style="padding:10px;">资产收益减负债成本 ÷ 净资产</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede5;">
            <td style="padding:10px;">B. 现金流倒算</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">${Number.isFinite(calculation.r2.rate) ? fmtPct(calculation.r2.rate) : '未形成约束'}</td>
            <td style="padding:10px;">逐年现金流现值 = 可投入本金</td>
          </tr>
          <tr style="border-bottom:1px solid #f0ede5;">
            <td style="padding:10px;">C. M2购买力底线</td>
            <td style="padding:10px;text-align:right;font-weight:bold;">${fmtPct(m2Rate)}</td>
            <td style="padding:10px;">本次诊断采用的可编辑假设值</td>
          </tr>
        </tbody>
      </table>
      <p style="margin-top:16px;text-align:center;font-size:1.1rem;">
        R<sub>要求</sub> = max(角度一, 角度二, 角度三) = <strong style="font-size:1.4rem;color:#d4af37;">${fmtPct(requiredR)}</strong><br>
        <span style="font-size:.82rem;color:#777;">最终取值来源：${calculation.winnerLabel}</span>
      </p>
      <div style="margin-top:18px;padding:16px;background:#fafaf7;border-radius:6px;">
        <p style="margin:0;font-size:.85rem;color:#555;"><strong>可投入本金：</strong>净资产 ${fmtMoney(calculation.investable.netAssets)} − 自住房 ${fmtMoney(calculation.investable.excludedSelfUseRealEstate)} = 默认 ${fmtMoney(calculation.investable.defaultPrincipal)}${calculation.investable.overridden ? `；本次手工调整为 ${fmtMoney(calculation.investable.principal)}` : ''}。</p>
      </div>
      ${expenses.length ? `
        <table style="width:100%;margin-top:14px;border-collapse:collapse;font-size:.82rem;">
          <thead><tr style="background:#f6f5f0;"><th style="padding:8px;text-align:left;">刚性支出</th><th style="padding:8px;text-align:right;">每次金额</th><th style="padding:8px;text-align:right;">首次发生</th><th style="padding:8px;text-align:right;">频率</th></tr></thead>
          <tbody>${expenses.map(expense => `<tr style="border-bottom:1px solid #f0ede5;"><td style="padding:8px;">${escapeWealthHTML(expense.description)}</td><td style="padding:8px;text-align:right;">${fmtMoney(expense.amount)}</td><td style="padding:8px;text-align:right;">第 ${expense.firstYear} 年</td><td style="padding:8px;text-align:right;">${expense.frequency === 'annual' ? `每年，持续 ${expense.duration} 年` : '一次性'}</td></tr>`).join('')}</tbody>
        </table>` : '<p style="font-size:.82rem;color:#888;">本次未录入有效刚性支出，R₂ 不参与最大值比较。</p>'}
    </div>

    <!-- Part 4: Real Wealth -->
    <div style="margin-bottom:32px;background:#fcf8f0;padding:24px;border-radius:8px;">
      <h2 style="font-size:1.3rem;color:#1a1a2e;border-bottom:1px solid #e5e2d8;padding-bottom:8px;margin-bottom:16px;">第四部分：真实身家（中性单情景）</h2>
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
        以 ${fmtPct(requiredR)} 要求回报率和 ${dcf?.horizonYears || 10} 年评估期衡量，您的真实身家为 <strong>${fmtMoney(totalPV)}</strong>，
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
            const m2Val = totalBook * Math.pow(1 + m2Rate / 100, y);
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

      ${recommendations.map((item, i) => `
        <div style="margin-bottom:16px;padding:16px;background:#fafaf7;border-radius:6px;">
          <h4 style="color:${item.priority === '高' ? '#a32d2d' : '#8a6418'};margin-bottom:4px;">${i + 1}. [${escapeWealthHTML(item.priority)}优先级] ${escapeWealthHTML(item.title)}</h4>
          <p style="font-size:.82rem;color:#555;"><strong>证据：</strong>${escapeWealthHTML(item.evidence)}</p>
          <p style="font-size:.82rem;color:#555;"><strong>行动：</strong>${escapeWealthHTML(item.action)}</p>
          <p style="font-size:.82rem;color:#777;"><strong>边界：</strong>${escapeWealthHTML(item.caveat)}</p>
        </div>
      `).join('')}

      <p style="padding:12px 16px;background:#f6f5f0;border-radius:6px;font-size:.78rem;color:#777;">以上建议由可审计规则生成，用于家族内部讨论与顾问复核，不构成具体产品、买卖时点或配置比例建议。</p>
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
      <p><strong>附录：本次计算口径与审计轨迹</strong></p>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td>收益字段</td><td>年化口径</td><td>由用户录入或演示样本提供</td></tr>
        <tr><td>R₁</td><td>${fmtPct(currentR)}</td><td>资产年收益 − 负债年成本，再除以净资产</td></tr>
        <tr><td>R₂</td><td>${Number.isFinite(calculation.r2.rate) ? fmtPct(calculation.r2.rate) : '未形成约束'}</td><td>逐年刚性支出现金流现值倒算</td></tr>
        <tr><td>R₃</td><td>${fmtPct(m2Rate)}</td><td>本次诊断采用的可编辑 M2 假设</td></tr>
        <tr><td>评估期</td><td>${dcf?.horizonYears || 10} 年</td><td>中性单情景 DCF</td></tr>
      </table>
      <p style="margin-top:12px;">报告由浏览器本地生成，输入数据保存在当前设备浏览器中。本报告用于诊断演示与顾问复核。</p>
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
  try {
    return await generatePDF(reportDiv, `梦工场身家诊断报告_${today}`);
  } finally {
    reportDiv.remove();
  }
}
