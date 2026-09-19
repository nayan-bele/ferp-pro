(function() {
  window.FeedbackPro = window.FeedbackPro || {};

  window.FeedbackPro.Profiles = {
    SENTIMENTS: ['positive', 'neutral', 'negative'],
    
    RANGES: { 
      positive: [4, 5], 
      neutral: [3, 4], 
      negative: [1, 2] 
    },

    /**
     * Get a rating value for a given sentiment
     * @param {string} sentiment - 'positive', 'neutral', or 'negative'
     * @param {boolean} randomize - Whether to pick randomly within the range or max out
     * @returns {number} The generated rating (1-5)
     */
    getRating(sentiment = 'positive', randomize = true) {
      const range = this.RANGES[sentiment] || this.RANGES['positive'];
      
      if (!randomize) {
        // Return the highest value in the range if not randomizing
        return Math.max(...range);
      }

      // Randomly pick a value within the specified range
      const min = Math.min(...range);
      const max = Math.max(...range);
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Get all ratings for a form's questions
     * @param {string} sentiment - 'positive', 'neutral', or 'negative'
     * @param {number} questionCount - Number of questions to generate ratings for
     * @param {boolean} randomize - Whether to randomize ratings
     * @returns {number[]} Array of rating values
     */
    getFormRatings(sentiment = 'positive', questionCount = 10, randomize = true) {
      const ratings = [];
      for (let i = 0; i < questionCount; i++) {
        ratings.push(this.getRating(sentiment, randomize));
      }
      return ratings;
    }
  };

  console.log('[fERP Pro] Profiles module loaded');
})();
