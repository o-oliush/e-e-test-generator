const { OpenAI } = require('openai');

/**
 * Test Result Analyzer
 * Analyzes LLM-generated test execution reports to determine success/failure status
 */
class TestResultAnalyzer {
  constructor(openaiApiKey = null, model = 'gpt-4o-mini') {
    this.openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;
    this.model = model;
  }

  /**
   * Analyzes test result content to determine if the test was successful
   * @param {string} testResult - The test execution result from LLM
   * @param {boolean} useAI - Whether to use AI analysis (requires OpenAI API key)
   * @returns {Promise<Object>} Analysis result with success status and confidence
   */
  async analyzeTestResult(testResult, useAI = true) {
    if (!testResult || typeof testResult !== 'string') {
      return {
        success: false,
        confidence: 1.0,
        reason: 'Invalid or empty test result',
        method: 'validation'
      };
    }

    // First try rule-based analysis
    const ruleBasedResult = this._analyzeWithRules(testResult);
    
    // If AI is available and enabled, use it for more sophisticated analysis
    if (useAI && this.openai) {
      try {
        console.log('Run analysis with AI:');
        const aiResult = await this._analyzeWithAI(testResult);
          return {
            ...aiResult,
            method: 'ai-enhanced',
            fallbackResult: ruleBasedResult
          };
        
      } catch (error) {
        console.warn('AI analysis failed, falling back to rule-based analysis:', error.message);
      }
    }

    return {
      ...ruleBasedResult,
      method: (useAI && this.openai) ? 'rule-based-with-ai-available' : 'rule-based-only'
    };
  }

  /**
   * Rule-based analysis using keyword matching and patterns
   * @private
   */
  _analyzeWithRules(testResult) {
    const content = testResult.toLowerCase().trim();
    
    // Strong success indicators
    const strongSuccessKeywords = [
      'test passed', 'test successful', 'all tests passed', 'success', 'passed successfully',
      'test completed successfully', 'all steps completed', 'verification passed',
      'assertion passed', 'expected result achieved', 'test case passed'
    ];

    // Strong failure indicators
    const strongFailureKeywords = [
      'test failed', 'test failure', 'failed', 'error occurred', 'assertion failed',
      'test case failed', 'unable to', 'could not', 'timeout', 'exception',
      'unexpected result', 'verification failed', 'test unsuccessful'
    ];

    // Moderate success indicators
    const moderateSuccessKeywords = [
      'completed', 'verified', 'confirmed', 'validated', 'working as expected',
      'behaves correctly', 'functioning properly', 'meets requirements'
    ];

    // Moderate failure indicators
    const moderateFailureKeywords = [
      'issue', 'problem', 'incorrect', 'unexpected', 'not working', 'broken',
      'does not work', 'missing', 'invalid', 'not found', 'not available'
    ];

    let successScore = 0;
    let failureScore = 0;

    // Check for strong indicators
    strongSuccessKeywords.forEach(keyword => {
      if (content.includes(keyword)) successScore += 3;
    });

    strongFailureKeywords.forEach(keyword => {
      if (content.includes(keyword)) failureScore += 3;
    });

    // Check for moderate indicators
    moderateSuccessKeywords.forEach(keyword => {
      if (content.includes(keyword)) successScore += 1;
    });

    moderateFailureKeywords.forEach(keyword => {
      if (content.includes(keyword)) failureScore += 1;
    });

    // Analyze structure patterns
    if (this._hasStructuredSuccessPattern(content)) {
      successScore += 2;
    }

    if (this._hasStructuredFailurePattern(content)) {
      failureScore += 2;
    }

    // Determine result
    const totalScore = successScore + failureScore;
    let success = false;
    let confidence = 0.5; // Default uncertainty
    let reason = 'Ambiguous result';

    if (totalScore === 0) {
      // No clear indicators
      confidence = 0.3;
      reason = 'No clear success or failure indicators found';
    } else if (successScore > failureScore) {
      success = true;
      confidence = Math.min(0.95, 0.6 + (successScore / totalScore) * 0.35);
      reason = `Success indicators found (score: ${successScore} vs ${failureScore})`;
    } else if (failureScore > successScore) {
      success = false;
      confidence = Math.min(0.95, 0.6 + (failureScore / totalScore) * 0.35);
      reason = `Failure indicators found (score: ${failureScore} vs ${successScore})`;
    } else {
      // Tied scores
      confidence = 0.4;
      reason = 'Mixed success and failure indicators';
    }

    return { success, confidence, reason };
  }

  /**
   * AI-based analysis using OpenAI
   * @private
   */
  async _analyzeWithAI(testResult) {
    const systemPrompt = `You are a test result analyzer. Your job is to determine if a test execution report indicates SUCCESS or FAILURE.

Analyze the provided test result and respond with a JSON object containing:
- "success": boolean (true if test passed, false if failed)
- "confidence": number between 0 and 1 (how confident you are in this assessment)
- "reason": string (brief explanation of your decision)

Consider these factors:
- Explicit success/failure statements
- Whether expected results were achieved
- Presence of errors, exceptions, or unexpected behaviors
- Completion of all test steps
- Validation of expected outcomes

Be conservative with confidence scores. Only use confidence > 0.9 for very clear results.`;

    const userPrompt = `Analyze this test execution result and determine if it indicates success or failure:

${testResult}

Respond only with valid JSON in the specified format.`;

    console.log('Call OpenAI api to analyze the test result with prompt:');
    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      //temperature: 0.1, // Low temperature for consistent analysis
      //max_tokens: 200
    });

    console.log('!!! AI completion:', completion);
    const response = completion.choices[0]?.message?.content?.trim();
    console.log('!!! AI response:', response);
    
    try {
      const parsed = JSON.parse(response);
      
      // Validate the response structure
      if (typeof parsed.success !== 'boolean' || 
          typeof parsed.confidence !== 'number' ||
          typeof parsed.reason !== 'string') {
        throw new Error('Invalid response structure');
      }

      // Ensure confidence is in valid range
      parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

      return parsed;
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Check for structured success patterns
   * @private
   */
  _hasStructuredSuccessPattern(content) {
    const successPatterns = [
      /✓|✔|passed|success/gi,
      /all.*steps.*completed/i,
      /test.*completed.*successfully/i,
      /expected.*result.*achieved/i
    ];

    return successPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for structured failure patterns
   * @private
   */
  _hasStructuredFailurePattern(content) {
    const failurePatterns = [
      /✗|✘|failed|failure|error/gi,
      /step.*failed/i,
      /unable.*to.*complete/i,
      /unexpected.*result/i,
      /assertion.*failed/i
    ];

    return failurePatterns.some(pattern => pattern.test(content));
  }
}

module.exports = TestResultAnalyzer;