(function() {
  console.log('[fERP Pro] Running Positive Script...');
  const rows = document.querySelectorAll('tr');
  let processed = 0;
  
  rows.forEach(row => {
    const radios = row.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      const topChoices = Array.from(radios).filter(r => r.value === '4' || r.value === '5' || parseInt(r.value) >= 4);
      if (topChoices.length > 0) {
        const choice = topChoices[Math.floor(Math.random() * topChoices.length)];
        choice.checked = true;
        choice.dispatchEvent(new Event('change', { bubbles: true }));
        processed++;
      } else if (radios.length >= 5) {
        const choice = radios[radios.length - 1]; // Fallback to last option
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
  
  console.log(`[fERP Pro] Processed ${processed} questions with positive sentiment. Please enter CAPTCHA and submit.`);
})();
