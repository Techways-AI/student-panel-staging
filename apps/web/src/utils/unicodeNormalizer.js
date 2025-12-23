// utils/unicodeNormalizer.js
/**
 * Utility functions for normalizing Unicode characters to ASCII equivalents
 * This helps prevent KaTeX warnings and improves compatibility
 */

/**
 * Normalizes Unicode characters to ASCII equivalents for better compatibility
 * @param {string} text - The text to normalize
 * @returns {string} - Normalized text with ASCII equivalents
 */
export function normalizeUnicodeToASCII(text) {
  if (typeof text !== 'string') return text;
  
  return text
    // Punctuation and dashes
    .replace(/–/g, '-')           // en-dash to hyphen
    .replace(/—/g, '--')          // em-dash to double hyphen
    .replace(/′/g, "'")           // prime to apostrophe
    .replace(/″/g, "''")          // double prime to double apostrophe
    .replace(/…/g, '...')         // ellipsis to three dots
    .replace(/'/g, "'")           // left single quote to apostrophe
    .replace(/'/g, "'")           // right single quote to apostrophe
    .replace(/"/g, '"')           // left double quote to double quote
    .replace(/"/g, '"')           // right double quote to double quote
    
    // Mathematical symbols
    .replace(/×/g, 'x')           // multiplication sign to x
    .replace(/÷/g, '/')           // division sign to /
    .replace(/±/g, '+/-')         // plus-minus sign to +/-
    .replace(/≠/g, '!=')          // not equal to !=
    .replace(/≤/g, '<=')          // less than or equal to <=
    .replace(/≥/g, '>=')          // greater than or equal to >=
    .replace(/∞/g, 'infinity')    // infinity symbol to text
    
    // Greek letters (common ones)
    .replace(/α/g, 'alpha')       // alpha
    .replace(/β/g, 'beta')        // beta
    .replace(/γ/g, 'gamma')       // gamma
    .replace(/δ/g, 'delta')       // delta
    .replace(/ε/g, 'epsilon')     // epsilon
    .replace(/θ/g, 'theta')       // theta
    .replace(/λ/g, 'lambda')       // lambda
    .replace(/μ/g, 'mu')          // mu
    .replace(/π/g, 'pi')          // pi
    .replace(/σ/g, 'sigma')       // sigma
    .replace(/τ/g, 'tau')         // tau
    .replace(/φ/g, 'phi')         // phi
    .replace(/ω/g, 'omega')       // omega
    
    // Currency symbols
    .replace(/€/g, 'EUR')         // euro symbol
    .replace(/£/g, 'GBP')         // pound symbol
    .replace(/¥/g, 'JPY')         // yen symbol
    .replace(/₹/g, 'INR')         // rupee symbol
    
    // Other common symbols
    .replace(/©/g, '(c)')         // copyright symbol
    .replace(/®/g, '(R)')         // registered trademark
    .replace(/™/g, '(TM)')        // trademark symbol
    .replace(/°/g, 'deg')         // degree symbol
    .replace(/℃/g, 'C')          // celsius symbol
    .replace(/℉/g, 'F')          // fahrenheit symbol
    .replace(/№/g, 'No.')         // numero symbol
    .replace(/§/g, 'S')          // section symbol
    .replace(/¶/g, 'P')          // paragraph symbol
    .replace(/†/g, '+')          // dagger symbol
    .replace(/‡/g, '++')         // double dagger symbol
    .replace(/•/g, '*')          // bullet point
    .replace(/◦/g, 'o')          // white bullet
    .replace(/▪/g, '■')          // black small square
    .replace(/▫/g, '□')          // white small square
    .replace(/→/g, '->')         // right arrow
    .replace(/←/g, '<-')          // left arrow
    .replace(/↑/g, '^')          // up arrow
    .replace(/↓/g, 'v')          // down arrow
    .replace(/↔/g, '<->')        // left-right arrow
    .replace(/↕/g, '^v')         // up-down arrow
    .replace(/⇒/g, '=>')         // right double arrow
    .replace(/⇐/g, '<=')         // left double arrow
    .replace(/⇑/g, '^^')         // up double arrow
    .replace(/⇓/g, 'vv')         // down double arrow
    .replace(/⇔/g, '<=>')        // left-right double arrow
    .replace(/⇕/g, '^v')         // up-down double arrow
    .replace(/∀/g, 'for all')    // for all symbol
    .replace(/∃/g, 'exists')     // there exists symbol
    .replace(/∄/g, 'not exists') // there does not exist symbol
    .replace(/∅/g, 'empty set')  // empty set symbol
    .replace(/∈/g, 'in')         // element of
    .replace(/∉/g, 'not in')     // not an element of
    .replace(/⊂/g, 'subset')     // subset of
    .replace(/⊃/g, 'superset')   // superset of
    .replace(/⊆/g, 'subset or equal') // subset of or equal to
    .replace(/⊇/g, 'superset or equal') // superset of or equal to
    .replace(/∪/g, 'union')      // union
    .replace(/∩/g, 'intersection') // intersection
    .replace(/∧/g, 'and')        // logical and
    .replace(/∨/g, 'or')         // logical or
    .replace(/¬/g, 'not')        // logical not
    .replace(/⊕/g, 'xor')        // exclusive or
    .replace(/⊗/g, 'otimes')     // tensor product
    .replace(/⊥/g, 'perpendicular') // perpendicular
    .replace(/∥/g, 'parallel')   // parallel
    .replace(/∠/g, 'angle')      // angle
    .replace(/∟/g, 'right angle') // right angle
    .replace(/△/g, 'triangle')   // triangle
    .replace(/□/g, 'square')     // square
    .replace(/○/g, 'circle')     // circle
    .replace(/◊/g, 'diamond')     // diamond
    .replace(/♠/g, 'spades')     // spades
    .replace(/♣/g, 'clubs')      // clubs
    .replace(/♥/g, 'hearts')     // hearts
    .replace(/♦/g, 'diamonds');  // diamonds
}

/**
 * Normalizes Unicode characters specifically for KaTeX compatibility
 * @param {string} text - The text to normalize
 * @returns {string} - Normalized text with KaTeX-compatible equivalents
 */
export function normalizeUnicodeForKaTeX(text) {
  if (typeof text !== 'string') return text;
  
  return text
    // Replace en-dash (–) with hyphen (-)
    .replace(/–/g, '-')
    // Replace em-dash (—) with double hyphen (--)
    .replace(/—/g, '--')
    // Replace prime (′) with apostrophe (')
    .replace(/′/g, "'")
    // Replace double prime (″) with double apostrophe ('')
    .replace(/″/g, "''")
    // Replace ellipsis (…) with three dots (...)
    .replace(/…/g, '...')
    // Replace left single quote (') with apostrophe (')
    .replace(/'/g, "'")
    // Replace right single quote (') with apostrophe (')
    .replace(/'/g, "'")
    // Replace left double quote (") with double quote (")
    .replace(/"/g, '"')
    // Replace right double quote (") with double quote (")
    .replace(/"/g, '"')
    // Replace multiplication sign (×) with x
    .replace(/×/g, 'x')
    // Replace division sign (÷) with /
    .replace(/÷/g, '/')
    // Replace plus-minus sign (±) with +/-
    .replace(/±/g, '+/-')
    // Replace not equal (≠) with !=
    .replace(/≠/g, '!=')
    // Replace less than or equal (≤) with <=
    .replace(/≤/g, '<=')
    // Replace greater than or equal (≥) with >=
    .replace(/≥/g, '>=')
    // Replace infinity (∞) with infinity symbol
    .replace(/∞/g, '\\infty')
    // Replace alpha (α) with \alpha
    .replace(/α/g, '\\alpha')
    // Replace beta (β) with \beta
    .replace(/β/g, '\\beta')
    // Replace gamma (γ) with \gamma
    .replace(/γ/g, '\\gamma')
    // Replace delta (δ) with \delta
    .replace(/δ/g, '\\delta')
    // Replace epsilon (ε) with \epsilon
    .replace(/ε/g, '\\epsilon')
    // Replace theta (θ) with \theta
    .replace(/θ/g, '\\theta')
    // Replace lambda (λ) with \lambda
    .replace(/λ/g, '\\lambda')
    // Replace mu (μ) with \mu
    .replace(/μ/g, '\\mu')
    // Replace pi (π) with \pi
    .replace(/π/g, '\\pi')
    // Replace sigma (σ) with \sigma
    .replace(/σ/g, '\\sigma')
    // Replace tau (τ) with \tau
    .replace(/τ/g, '\\tau')
    // Replace phi (φ) with \phi
    .replace(/φ/g, '\\phi')
    // Replace omega (ω) with \omega
    .replace(/ω/g, '\\omega');
}

/**
 * Checks if a string contains Unicode characters that might cause issues
 * @param {string} text - The text to check
 * @returns {boolean} - True if the text contains problematic Unicode characters
 */
export function hasProblematicUnicode(text) {
  if (typeof text !== 'string') return false;
  
  // Common problematic Unicode characters
  const problematicChars = /[–—′″…'"×÷±≠≤≥∞αβγδεθλμπστφω€£¥₹©®™°℃℉№§¶†‡•◦▪▫→←↑↓↔↕⇒⇐⇑⇓⇔⇕∀∃∄∅∈∉⊂⊃⊆⊇∪∩∧∨¬⊕⊗⊥∥∠∟△□○◊♠♣♥♦]/;
  
  return problematicChars.test(text);
}

/**
 * Gets a list of problematic Unicode characters found in the text
 * @param {string} text - The text to analyze
 * @returns {Array} - Array of objects with character, code, and description
 */
export function findProblematicUnicode(text) {
  if (typeof text !== 'string') return [];
  
  const problematicChars = /[–—′″…'"×÷±≠≤≥∞αβγδεθλμπστφω€£¥₹©®™°℃℉№§¶†‡•◦▪▫→←↑↓↔↕⇒⇐⇑⇓⇔⇕∀∃∄∅∈∉⊂⊃⊆⊇∪∩∧∨¬⊕⊗⊥∥∠∟△□○◊♠♣♥♦]/g;
  const matches = [];
  let match;
  
  while ((match = problematicChars.exec(text)) !== null) {
    const char = match[0];
    const code = char.charCodeAt(0);
    matches.push({
      character: char,
      code: code,
      description: getUnicodeDescription(char)
    });
  }
  
  return matches;
}

/**
 * Gets a description of a Unicode character
 * @param {string} char - The Unicode character
 * @returns {string} - Description of the character
 */
function getUnicodeDescription(char) {
  // Use a Map to avoid issues with Unicode object keys
  const descriptions = new Map([
    ['–', 'en-dash'],
    ['—', 'em-dash'],
    ['′', 'prime'],
    ['″', 'double prime'],
    ['…', 'ellipsis'],
    ['', 'left single quote'],
    ['', 'right single quote'],
    ['"', 'left double quote'],
    ['"', 'right double quote'],
    ['×', 'multiplication sign'],
    ['÷', 'division sign'],
    ['±', 'plus-minus sign'],
    ['≠', 'not equal'],
    ['≤', 'less than or equal'],
    ['≥', 'greater than or equal'],
    ['∞', 'infinity'],
    ['α', 'alpha'],
    ['β', 'beta'],
    ['γ', 'gamma'],
    ['δ', 'delta'],
    ['ε', 'epsilon'],
    ['θ', 'theta'],
    ['λ', 'lambda'],
    ['μ', 'mu'],
    ['π', 'pi'],
    ['σ', 'sigma'],
    ['τ', 'tau'],
    ['φ', 'phi'],
    ['ω', 'omega']
  ]);
  
  return descriptions.get(char) || `Unicode character (${char.charCodeAt(0)})`;
}

