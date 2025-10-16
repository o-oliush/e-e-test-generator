const TestResultAnalyzer = require('./testResultAnalyzer');

// Mock OpenAI for testing
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }))
  };
});

describe('TestResultAnalyzer', () => {
  let analyzer;
  let analyzerWithoutAI;
  let analyzerWithAI;
  let mockOpenAI;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create analyzer instances
    analyzer = new TestResultAnalyzer('fake-api-key');
    analyzerWithoutAI = new TestResultAnalyzer();
    analyzerWithAI = new TestResultAnalyzer(
        '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', 
        'gpt-5');
    
    // Get mock OpenAI instance
    mockOpenAI = analyzer.openai;
  });

  describe('analyzeTestResult - Input Validation', () => {
    test('should handle null input', async () => {
      const result = await analyzer.analyzeTestResult(null);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toBe('Invalid or empty test result');
      expect(result.method).toBe('validation');
    });

    test('should handle undefined input', async () => {
      const result = await analyzer.analyzeTestResult(undefined);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toBe('Invalid or empty test result');
      expect(result.method).toBe('validation');
    });

    test('should handle empty string input', async () => {
      const result = await analyzer.analyzeTestResult('');
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toBe('Invalid or empty test result');
      expect(result.method).toBe('validation');
    });

    test('should handle non-string input', async () => {
      const result = await analyzer.analyzeTestResult(123);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toBe('Invalid or empty test result');
      expect(result.method).toBe('validation');
    });
  });

  describe('analyzeTestResult - Rule-based Analysis', () => {
    test('should identify clear success with strong keywords', async () => {
      const testResult = 'Test completed successfully. All steps passed and verification passed.';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toContain('Success indicators found');
      expect(result.method).toBe('rule-based-only');
    });

    test('should identify clear failure with strong keywords', async () => {
      const testResult = 'Test failed with error occurred. Assertion failed and test case failed.';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toContain('Failure indicators found');
      expect(result.method).toBe('rule-based-only');
    });

    test('should handle moderate success indicators', async () => {
      const testResult = 'The application completed the workflow and verified the outcome. Everything working as expected.';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.method).toBe('rule-based-only');
    });

    test('should handle moderate failure indicators', async () => {
      const testResult = 'There is an issue with the system. Something is not working correctly and appears broken.';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.method).toBe('rule-based-only');
    });

    test('should handle mixed indicators with tied scores', async () => {
      const testResult = 'Test completed but there was an issue. Success in some areas but failure in others.';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      // This should favor success since "completed" and "success" are stronger indicators
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.method).toBe('rule-based-only');
    });

    test('should handle ambiguous results with no clear indicators', async () => {
      const testResult = 'The system processed the request and returned a response.';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.confidence).toBeLessThan(0.4);
      expect(result.reason).toContain('No clear success or failure indicators found');
      expect(result.method).toBe('rule-based-only');
    });

    test('should detect structured success patterns with symbols', async () => {
      const testResult = 'Step 1: ✓ Login successful\nStep 2: ✔ Data validated\nAll steps completed successfully';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect structured failure patterns with symbols', async () => {
      const testResult = 'Step 1: ✗ Login failed\nStep 2: ✘ Validation error\nTest execution unsuccessful\nTest failed with multiple errors';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.6); // More failure indicators should increase confidence
    });

    test('should be case insensitive', async () => {
      const testResult = 'TEST PASSED SUCCESSFULLY. ALL VERIFICATION COMPLETED.';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('analyzeTestResult - AI Analysis Integration', () => {
    test('should use AI analysis when rule-based confidence is low', async () => {
      const testResult = 'The workflow proceeded normally with expected outcomes.';
      
      // Mock AI response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              success: true,
              confidence: 0.85,
              reason: 'Expected outcomes indicate successful test execution'
            })
          }
        }]
      });

      const result = await analyzer.analyzeTestResult(testResult);
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.confidence).toBe(0.85);
      expect(result.method).toBe('ai-enhanced');
      expect(result.fallbackResult).toBeDefined();
    });

    test('should skip AI analysis when rule-based confidence is high', async () => {
      const testResult = 'Test passed successfully with all assertions passed.';
      
      const result = await analyzer.analyzeTestResult(testResult);
      
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.method).toBe('rule-based-with-ai-available');
    });

    test('should fallback to rule-based when AI fails', async () => {
      const testResult = 'The process executed with some uncertainty.';
      
      // Mock AI failure
      mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

      const result = await analyzer.analyzeTestResult(testResult);
      
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
      expect(result.method).toBe('rule-based-with-ai-available');
    });

    test('should prefer AI result when AI confidence is higher', async () => {
      const testResult = 'The system executed the workflow with some unknown outcomes.'; // Ambiguous test case
      
      // Mock AI response with higher confidence
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              success: false,
              confidence: 0.92,
              reason: 'Unknown outcomes suggest test failure despite execution'
            })
          }
        }]
      });

      const result = await analyzer.analyzeTestResult(testResult);
      
      // The AI analysis should be used because its confidence is higher than rule-based
      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0.92);
      expect(result.method).toBe('ai-enhanced');
    });

    test('should handle malformed AI response', async () => {
      const testResult = 'Some test result.';
      
      // Mock malformed AI response
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      });

      const result = await analyzer.analyzeTestResult(testResult);
      
      expect(result.method).toBe('rule-based-with-ai-available');
    });

    test('should validate AI response structure', async () => {
      const testResult = 'Some test result.';
      
      // Mock AI response with missing fields
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              success: true,
              // missing confidence and reason
            })
          }
        }]
      });

      const result = await analyzer.analyzeTestResult(testResult);
      
      expect(result.method).toBe('rule-based-with-ai-available');
    });

    test('should clamp AI confidence values to valid range', async () => {
      const testResult = 'Test result with high confidence.';
      
      // Mock AI response with out-of-range confidence
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              success: true,
              confidence: 1.5, // Invalid: > 1
              reason: 'Very confident result'
            })
          }
        }]
      });

      const result = await analyzer.analyzeTestResult(testResult);
      
      expect(result.confidence).toBeLessThanOrEqual(1.0);
      expect(result.confidence).toBeGreaterThanOrEqual(0.0);
    });

    test('should respect useAI parameter when set to false', async () => {
      const testResult = 'Ambiguous test result.';
      
      const result = await analyzer.analyzeTestResult(testResult, false);
      
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
      expect(result.method).toBe('rule-based-only'); // Should be rule-based-only when useAI is false
    });
  });

  describe('analyzeTestResult - Real-world Scenarios', () => {
    test('should handle typical successful test report', async () => {
      const testResult = `
# Login Test Execution Report

## Test Status: PASSED ✓

## Execution Summary
- Navigation to login page: ✓ Completed
- Email input validation: ✓ Successful  
- Password entry: ✓ Successful
- Login button click: ✓ Executed
- Dashboard redirect: ✓ Verified
- User greeting: ✓ Confirmed

## Results
All test steps completed successfully. The user was able to log in and access the dashboard as expected.
Expected result achieved: User successfully authenticated and redirected to personalized dashboard.
      `;

      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test('should handle typical failed test report', async () => {
      const testResult = `
# Login Test Execution Report

## Test Status: FAILED ✗

## Execution Summary
- Navigation to login page: ✓ Completed
- Email input validation: ✓ Successful  
- Password entry: ✓ Successful
- Login button click: ✗ Failed - Button not responsive
- Dashboard redirect: ✗ Not executed
- User greeting: ✗ Not verified

## Results
Test failed at step 4. The login button was not responsive to clicks.
Error occurred: Element not clickable - button appears to be disabled.
Test case failed - unable to complete authentication flow.
      `;

      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8); // Adjusted expectation
    });

    test('should handle partial success scenario', async () => {
      const testResult = `
# API Integration Test Report

## Execution Results
The API endpoint responded correctly to the request. Data was retrieved successfully from the database.
However, there was an issue with the response format - some fields were missing.
The test completed but did not meet all requirements due to incomplete data structure.
Validation failed for required fields: 'timestamp' and 'userId' were not found.
      `;

      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should handle timeout scenario', async () => {
      const testResult = `
# Performance Test Report

The test execution started normally. Initial steps were completed within expected timeframes.
However, the system experienced a timeout during the data processing phase.
Unable to complete the verification step due to response timeout after 30 seconds.
Test unsuccessful - performance requirements not met.
      `;

      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('analyzeTestResult - Edge Cases', () => {
    test('should handle very short test results', async () => {
      const testResult = 'OK';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
    });

    test('should handle very long test results', async () => {
      const testResult = 'Test result '.repeat(1000) + 'completed successfully';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    test('should handle special characters and unicode', async () => {
      const testResult = 'Test résultat 成功 🎉 - все тесты прошли успешно ✅';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle HTML-like content', async () => {
      const testResult = '<div>Test <strong>passed</strong> successfully</div><p>All assertions verified</p>';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  describe('analyzeTestResult - Return Value Structure', () => {
    test('should return proper structure for rule-based analysis', async () => {
      const testResult = 'Test completed successfully';
      const result = await analyzerWithoutAI.analyzeTestResult(testResult);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('method');
      
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.reason).toBe('string');
      expect(typeof result.method).toBe('string');
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    test('should include fallbackResult in AI-enhanced analysis', async () => {
      const testResult = 'Ambiguous test outcome with unclear results';
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              success: false,
              confidence: 0.75,
              reason: 'Unclear results suggest test failure'
            })
          }
        }]
      });

      const result = await analyzer.analyzeTestResult(testResult);
      
      expect(result).toHaveProperty('fallbackResult');
      expect(result.fallbackResult).toHaveProperty('success');
      expect(result.fallbackResult).toHaveProperty('confidence');
      expect(result.fallbackResult).toHaveProperty('reason');
    });

    test('First test with real OpenAI reply', async () => {
      const testResult = `
      ## Test Results for Best Laptop Deals

### Test Execution Summary
The end-to-end test script for "Best Laptop Deals" was executed as per the provided steps. Below is the report detailing each step, including actions taken, observations, and whether the expectations were met.

### Step-by-Step Results

1. **Navigate to https://www.bestlaptop.deals.**
   - **Result**: Navigation successful. The page loads without any issues.

2. **Focus on the search bar and type "laptop".**
   - **Result**: Focused successfully, typed "laptop".

3. **Click the search button next to the search bar.**
   - **Result**: Search initiated; results page loading.

4. **Confirm that the search results header indicates results for "laptop".**
   - **Result**: Search results header confirmed, displaying results relevant to "laptop".

5. **Hover over the "Brands" filter section.**
   - **Result**: Hover action successful; the filter menu displayed.

6. **Click to open the brand dropdown menu.**
   - **Result**: Dropdown menu opened successfully.

7. **Select the Dell checkbox from the dropdown options.**
   - **Result**: Dell checkbox selected.

8. **Click the apply button to apply the selected filters.**
   - **Result**: Filter applied successfully; results refreshed.

9. **Verify that results are updated to display only Dell laptops.**
   - **Result**: Results confirmed to display only Dell laptops.

10. **Hover over the first laptop displayed in the search results.**
    - **Result**: Hover action successful; additional options displayed.

11. **Click the details button for that laptop.**
    - **Result**: Navigated to the laptop details page successfully.

12. **Wait for the laptop details page to fully load.**
    - **Result**: Laptop details page loaded completely.

13. **Click the "Add to Cart" button on the laptop details page.**
    - **Result**: Laptop successfully added to the shopping cart.

14. **Click the cart icon in the top right corner.**
    - **Result**: Cart opened successfully.

15. **Verify that the item is present in the shopping cart.**
    - **Result**: Item confirmed in the shopping cart.

### Final Outcome
- **Confirmation that Dell brand laptops are displayed**: **Successful**
- **Successful navigation to the laptop details page**: **Successful**
- **Confirmation that the laptop has been added to the shopping cart**: **Successful**

### Overall Test Conclusion
The test executions for navigating, filtering, and adding items to the cart on the "Best Laptop Deals" website were all successful. All actions performed as intended, and the expectations were met successfully throughout the test. 

**All steps executed without errors, and the expected results were validated.** The test has been concluded with a status of **PASS**.
      `;
      const result = await analyzerWithAI.analyzeTestResult(testResult, true);
      
      expect(result.success).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.7);
    });




    test('Second test with real OpenAI reply', async () => {
      const testResult = `
      ## Test Results for Best Laptop Deals

### Test Execution Summary
The end-to-end test script for "Best Laptop Deals" was executed as per the provided steps. Below is the report detailing each step, including actions taken, observations, and whether the expectations were met.

### Step-by-Step Results

1. **Navigate to https://www.bestlaptop.deals.**
   - **Result**: Navigation successful. The page loads without any issues.

2. **Focus on the search bar and type "laptop".**
   - **Result**: Focused successfully, typed "laptop".

3. **Click the search button next to the search bar.**
   - **Result**: Search initiated; results page loading.

4. **Confirm that the search results header indicates results for "laptop".**
   - **Result**: Search results header confirmed, displaying results relevant to "laptop".

5. **Hover over the "Brands" filter section.**
   - **Result**: Hover action successful; the filter menu displayed.

6. **Click to open the brand dropdown menu.**
   - **Result**: Dropdown menu opened successfully.

7. **Select the Dell checkbox from the dropdown options.**
   - **Result**: Dell checkbox selected.

8. **Click the apply button to apply the selected filters.**
   - **Result**: Filter applied successfully; results refreshed.

9. **Verify that results are updated to display only Dell laptops.**
   - **Result**: Results confirmed to display only Dell laptops.

10. **Hover over the first laptop displayed in the search results.**
    - **Result**: Hover action successful; additional options displayed.

11. **Click the details button for that laptop.**
    - **Result**: Navigated to the laptop details page successfully.

12. **Wait for the laptop details page to fully load.**
    - **Result**: Laptop details page loaded completely.

13. **Click the "Add to Cart" button on the laptop details page.**
    - **Result**: Laptop successfully added to the shopping cart.

14. **Click the cart icon in the top right corner.**
    - **Result**: Cart opened successfully.

15. **Verify that the item is present in the shopping cart.**
    - **Result**: Item confirmed in the shopping cart.

### Final Outcome
- **Confirmation that Dell brand laptops are displayed**: **Failed**
- **Successful navigation to the laptop details page**: **Successful**
- **Confirmation that the laptop has been added to the shopping cart**: **Successful**

### Overall Test Conclusion
The test executions for navigating, filtering, and adding items to the cart on the "Best Laptop Deals" website were all failed. All actions performed as intended, and the expectations were met successfully throughout the test.

**Some steps executed with errors, and the expected results were validated.** The test has been concluded with a status of **FAIL**.
      `;
      const result = await analyzerWithAI.analyzeTestResult(testResult, true);
      
      expect(result.success).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
  });

  
  
});