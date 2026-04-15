// @ts-nocheck
import { validateEliteOutput } from './supabase/functions/_shared/elite-validator.ts';

const sampleText = `
# 🎓 Lesson: Advanced React Patterns

**TL;DR:** Master the art of component composition.

## 🌟 Introduction
React is not just about building components...

### 📖 The Core Concept
Elite pattern architecture involves...

> **💡 PRO TIP**
> Use composition over inheritance.

## 🎯 Key Takeaways
• **Pattern A:** HOCs
• **Pattern B:** Hooks

**Next Steps:** Implement a custom hook.
`;

const report = validateEliteOutput(sampleText);
console.log('Validation Report:', JSON.stringify(report, null, 2));

if (report.isValid) {
  console.log('✅ Elite Standards Met!');
} else {
  console.log('❌ Standards Not Met. Issues:', report.issues.join(', '));
}
