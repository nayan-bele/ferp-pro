(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  window.FeedbackPro.FormFiller = {
    /**
     * Fill all questions on the current form page
     * @param {string} sentiment - 'positive', 'neutral', or 'negative'
     * @param {Object} options - { randomize: bool, customText: string, dryRun: bool }
     * @returns {boolean} Success status
     */
    fillForm(sentiment = 'positive', options = {}) {
      console.log(`[fERP Pro] Filling form with sentiment: ${sentiment}`, options);
      const { randomize = true, customText = '', dryRun = false } = options;
      
      const detector = window.FeedbackPro.FormDetector;
      const profiles = window.FeedbackPro.Profiles;
      
      if (!detector || !profiles) {
        console.error('[fERP Pro] Required modules (FormDetector, Profiles) not found');
        return false;
      }
      
      const questionGroups = detector.getQuestionGroups();
      
      if (questionGroups.length === 0) {
        console.warn('[fERP Pro] No question groups found to fill');
        return false;
      }
      
      // Get array of ratings for all questions
      const ratings = profiles.getFormRatings(sentiment, questionGroups.length, randomize);
      
      questionGroups.forEach((group, index) => {
        const rating = ratings[index];
        if (!dryRun) {
          this.fillRadioGroup(group, rating);
        }
      });
      
      if (customText && !dryRun) {
        this.fillTextFields(customText);
      }
      
      return true;
    },
    
    /**
     * Fill a single radio group with a rating value
     * @param {Array<HTMLElement>} radioGroup - Array of radio input elements
     * @param {number} value - The rating value (1-5)
     */
    fillRadioGroup(radioGroup, value) {
      if (!radioGroup || radioGroup.length === 0) return;
      
      // Sort radios by their value or position to ensure 1-5 mapping is correct
      const sortedGroup = [...radioGroup].sort((a, b) => {
        const valA = parseInt(a.value || '0', 10);
        const valB = parseInt(b.value || '0', 10);
        if (valA && valB && !isNaN(valA) && !isNaN(valB)) {
          return valA - valB;
        }
        return 0; // fallback to DOM order
      });
      
      // Map 1-5 value to array index (0-4)
      const targetIndex = Math.min(Math.max(value - 1, 0), sortedGroup.length - 1);
      const targetRadio = sortedGroup[targetIndex];
      
      if (targetRadio) {
        targetRadio.checked = true;
        
        // Dispatch events to trigger any attached listeners
        ['change', 'input', 'click'].forEach(eventType => {
          const event = new Event(eventType, { bubbles: true, cancelable: true });
          targetRadio.dispatchEvent(event);
        });
      }
    },
    
    /**
     * Fill text fields with custom text
     * @param {string} customText - Text to inject into textareas/inputs
     */
    fillTextFields(customText) {
      if (!customText) return;
      
      const detector = window.FeedbackPro.FormDetector;
      if (!detector) return;
      
      const textFields = detector.getTextFields();
      textFields.forEach(field => {
        field.value = customText;
        
        // Dispatch events
        ['input', 'change', 'blur'].forEach(eventType => {
          const event = new Event(eventType, { bubbles: true, cancelable: true });
          field.dispatchEvent(event);
        });
      });
    },
    
    /**
     * Preview what would be filled (for dry run mode)
     * @param {string} sentiment 
     * @param {Object} options 
     * @returns {Object} Preview data structure
     */
    previewFill(sentiment, options = {}) {
      const detector = window.FeedbackPro.FormDetector;
      const profiles = window.FeedbackPro.Profiles;
      
      if (!detector || !profiles) return null;
      
      const questionGroups = detector.getQuestionGroups();
      const textFields = detector.getTextFields();
      
      const { randomize = true, customText = '' } = options;
      const ratings = profiles.getFormRatings(sentiment, questionGroups.length, randomize);
      
      return {
        sentiment,
        questionsCount: questionGroups.length,
        ratings,
        textFieldsCount: textFields.length,
        customText,
        averageExpectedRating: ratings.length ? (ratings.reduce((a,b) => a+b, 0) / ratings.length).toFixed(2) : 0
      };
    }
  };

  console.log('[fERP Pro] FormFiller module loaded');
})();
