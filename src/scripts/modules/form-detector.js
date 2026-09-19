(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  window.FeedbackPro.FormDetector = {
    /**
     * Check if we're on the main listing page
     * @returns {boolean}
     */
    isListingPage() {
      // Typically listing pages contain a table with multiple feedback links
      const links = document.querySelectorAll('a[href*="feedback"], a[onclick*="feedback"]');
      const tables = document.querySelectorAll('table');
      return links.length > 1 && tables.length > 0;
    },
    
    /**
     * Check if we're on an individual form page
     * @returns {boolean}
     */
    isFormPage() {
      // Form pages typically have multiple radio buttons, a submit button, and possibly a captcha
      const radios = document.querySelectorAll('input[type="radio"]');
      const submitBtn = this.getSubmitButton();
      return radios.length > 5 && submitBtn !== null;
    },

    /**
     * Scan the main feedback listing page for forms
     * @returns {Array} Array of form objects
     */
    scanFeedbackList() {
      console.log('[fERP Pro] Scanning feedback listing...');
      const forms = [];
      
      // Try to find the main table containing subjects
      const rows = document.querySelectorAll('table tr');
      
      let formIdCounter = 1;

      rows.forEach(row => {
        // Look for cells in the row
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return; // Skip non-data rows
        
        // Find link that opens feedback
        const feedbackLink = row.querySelector('a[href*="feedback"], a[onclick*="feedback"], button');
        if (!feedbackLink) return;

        // Infer subject and professor (usually adjacent cells or specified by index)
        let subjectName = cells[1] ? cells[1].innerText.trim() : 'Unknown Subject';
        let professorName = cells[2] ? cells[2].innerText.trim() : 'Unknown Professor';
        
        // Look for status (Submitted/Pending)
        const rowText = row.innerText.toLowerCase();
        let status = 'pending';
        if (rowText.includes('submitted') && !rowText.includes('not submitted')) {
          status = 'submitted';
        }

        forms.push({
          id: `form_${formIdCounter++}`,
          subjectName,
          professorName,
          status,
          assignedSentiment: 'positive', // Default
          element: feedbackLink
        });
      });

      console.log(`[fERP Pro] Found ${forms.length} forms in listing`);
      return forms;
    },
    
    /**
     * Get all radio button groups on the current form page
     * @returns {Array} Array of DOM NodeLists or Arrays of radio inputs representing a group
     */
    getQuestionGroups() {
      const allRadios = Array.from(document.querySelectorAll('input[type="radio"]'));
      const groups = {};
      
      // Group radios by their 'name' attribute
      allRadios.forEach(radio => {
        const name = radio.getAttribute('name');
        if (name) {
          if (!groups[name]) groups[name] = [];
          groups[name].push(radio);
        }
      });
      
      // Return as array of groups, filtering out groups that don't look like 1-5 scales
      return Object.values(groups).filter(group => group.length >= 3);
    },
    
    /**
     * Get the comment/text fields on the form
     * @returns {NodeList}
     */
    getTextFields() {
      return document.querySelectorAll('textarea, input[type="text"]:not([name*="captcha" i]):not([id*="captcha" i])');
    },
    
    /**
     * Get submit button
     * @returns {HTMLElement|null}
     */
    getSubmitButton() {
      return document.querySelector('input[type="submit"], button[type="submit"], input[value*="Submit" i], button:not([type="button"])');
    },
    
    /**
     * Get count of pending forms from scanned list
     * @returns {number}
     */
    getPendingCount() {
      if (!this.isListingPage()) return 0;
      return this.scanFeedbackList().filter(f => f.status === 'pending' || f.status === 'in-progress').length;
    },
    
    /**
     * Get count of submitted forms from scanned list
     * @returns {number}
     */
    getSubmittedCount() {
      if (!this.isListingPage()) return 0;
      return this.scanFeedbackList().filter(f => f.status === 'submitted').length;
    }
  };

  console.log('[fERP Pro] FormDetector module loaded');
})();
