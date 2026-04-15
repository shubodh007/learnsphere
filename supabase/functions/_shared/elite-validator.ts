// @ts-nocheck
/**
 * LearnSphere Elite Output Validator
 * 
 * Ensures AI responses meet the premium formatting standards.
 */

export interface ValidationReport {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  metadata: {
    hasTitle: boolean;
    hasTLDR: boolean;
    hasHierarchy: boolean;
    hasProperCodeBlocks: boolean;
  };
}

export function validateEliteOutput(text: string): ValidationReport {
  const issues: string[] = [];
  const metadata = {
    hasTitle: text.includes('# '),
    hasTLDR: text.toLowerCase().includes('tl;dr'),
    hasHierarchy: text.includes('## ') || text.includes('### '),
    hasProperCodeBlocks: text.includes('\x60\x60\x60')
  };

  if (!metadata.hasTitle) issues.push('Missing Level 1 title (#)');
  if (!metadata.hasTLDR) issues.push('Missing TL;DR summary');
  if (!metadata.hasHierarchy) issues.push('Poor typographic hierarchy (missing ## or ###)');
  
  // Scoring logic
  let score = 100;
  if (!metadata.hasTitle) score -= 20;
  if (!metadata.hasTLDR) score -= 20;
  if (!metadata.hasHierarchy) score -= 30;
  if (text.length < 100) score -= 10;
  
  // Check for walls of text (paragraphs > 500 chars)
  const paragraphs = text.split('\\n\\n');
  if (paragraphs.some(p => p.length > 600)) {
    issues.push('Contains "wall of text" - use more white space');
    score -= 10;
  }

  return {
    isValid: score >= 70,
    score: Math.max(0, score),
    issues,
    metadata
  };
}
