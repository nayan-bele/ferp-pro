(function() {
  console.log('[fERP Pro] Running Neutral Script...');
  const rows = document.querySelectorAll('tr');
  let processed = 0;
  
  rows.forEach(row => {
    const radios = row.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      const neutralChoices = Array.from(radios).filter(r => r.value === '3' || r.value === '4');
      if (neutralChoices.length > 0) {
        const choice = neutralChoices[Math.floor(Math.random() * neutralChoices.length)];
        choice.checked = true;
        choice.dispatchEvent(new Event('change', { bubbles: true }));
        processed++;
      } else if (radios.length >= 3) {
        const choice = radios[2]; // Fallback to middle option
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
  
  console.log(`[fERP Pro] Processed ${processed} questions with neutral sentiment. Please enter CAPTCHA and submit.`);
})();
