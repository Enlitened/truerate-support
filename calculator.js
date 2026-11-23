'use strict';
// Exact lookup only. All tax, super and equivalent-salary results are exported by TrueRateCore.
const calculator = (() => {
  const cents = value => {
    const [whole, fraction = ''] = String(value).split('.');
    return BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  };
  const format = value => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(Number(value) / 100);
  function lookup(data, inputs) {
    const key = [inputs.rate, inputs.days, inputs.leave, inputs.gap, inputs.expenses, +inputs.cover, +inputs.loan].join('|');
    const row = data.contractor[key];
    const employee = data.employee[[inputs.salary, +inputs.cover, +inputs.loan].join('|')];
    if (!row || !employee) return null;
    return { row, employee, difference: cents(row[0]) + cents(row[1]) - cents(employee[0]) - cents(employee[1]) };
  }
  return { cents, format, lookup };
})();
if (typeof module !== 'undefined') module.exports = calculator;
if (typeof document !== 'undefined') {
  const form = document.querySelector('#inputs');
  let data;
  const field = id => document.getElementById(id);
  function update() {
    const status = field('status');
    if (!data) return;
    if (!form.checkValidity()) { field('answer').hidden = true; status.textContent = 'Choose a day rate in A$25 steps and a salary in A$1,000 steps within the displayed limits.'; return; }
    const inputs = Object.fromEntries(['rate','salary','days','leave','gap','expenses'].map(id => [id, Number(field(id).value)]));
    inputs.cover = field('cover').checked; inputs.loan = field('loan').checked;
    const result = calculator.lookup(data, inputs);
    if (!result) { field('answer').hidden = true; status.textContent = 'This combination is unavailable. Check the supported inputs.'; return; }
    const { row, employee, difference } = result;
    const money = calculator.format;
    ['cash','super','tax'].forEach((name, i) => { field('contract-'+name).textContent = money(calculator.cents(row[i])); field('salary-'+name).textContent = money(calculator.cents(employee[i])); });
    field('contract-gross').textContent = money(calculator.cents(row[4])); field('salary-gross').textContent = money(BigInt(inputs.salary)*100n);
    field('verdict').textContent = difference > -100000n && difference < 100000n ? 'Close enough to weigh the conditions, stability and flexibility.' : `${difference > 0n ? 'Contracting' : 'The permanent role'} leaves ${money(difference < 0n ? -difference : difference)} more in cash and super over the year.`;
    field('equivalent').textContent = `A salary of about ${money(calculator.cents(row[5]))} plus employer super matches this contract in cash and super.`;
    field('billable').textContent = `${row[6]} estimated billable days. Unpaid leave and contract gaps reduce the contractor result.`;
    field('gst').textContent = `${money(calculator.cents(row[3]))} GST is collected on top of billings and excluded from take-home. It is not income to keep.`;
    field('answer').hidden = false; status.textContent = `${data.taxYear} estimate updated.`;
  }
  form.addEventListener('input', update);
  fetch('calculator-data.json', { credentials: 'omit' }).then(response => { if (!response.ok) throw Error('load'); return response.json(); }).then(value => { data = value; update(); }).catch(() => { field('status').textContent = 'The comparison data could not load. Reload the page or use the TrueRate app.'; });
}
