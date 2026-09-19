(function() {
  console.log('[fERP Pro] Running Negative Script...');
  const rows = document.querySelectorAll('tr');
  let processed = 0;
  
  rows.forEach(row => {
    const radios = row.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      const bottomChoices = Array.from(radios).filter(r => r.value === '1' || r.value === '2');
      if (bottomChoices.length > 0) {
        const choice = bottomChoices[Math.floor(Math.random() * bottomChoices.length)];
        choice.checked = true;
        choice.dispatchEvent(new Event('change', { bubbles: true }));
        processed++;
      } else if (radios.length >= 2) {
        const choice = radios[Math.floor(Math.random() * 2)]; // Fallback to first or second
        choice.checked = true;
        choice.dispatchEvent(new Event('change', { bubbles: true }));
        processed++;
      }
    }
  });
  
  const captcha = document.querySelector('input[type="text"][name*="captcha" i], input[type="text"][id*="captcha" i], input.captcha-input');
  if (captcha) {
    captcha.focus();
  }
  
  console.log(`[fERP Pro] Processed ${processed} questions with negative sentiment. Please enter CAPTCHA and submit.`);
})();
