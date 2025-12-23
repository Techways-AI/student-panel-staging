import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import mermaid from "mermaid";
import { useTheme } from "../context/ThemeContext";
 
// Initialize Mermaid
mermaid.initialize({ startOnLoad: false });
 
// RDKit Loader URL
const RDKitURL =
  "https://unpkg.com/@rdkit/rdkit/Code/MinimalLib/dist/RDKit_minimal.js";

// RDKit Loader Promise
let rdkitLoaderPromise = null;

// Mermaid Renderer component
function MermaidRenderer({ code }) {
  const { isDarkMode } = useTheme();
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    mermaid.initialize({ startOnLoad: false, theme: isDarkMode ? "dark" : "default" });
    (async () => {
      try {
        const { svg } = await mermaid.render(
          "mermaid-" + Math.random().toString(36).slice(2),
          code
        );
        if (!cancelled) setSvg(svg);
      } catch (err) {
        if (!cancelled)
          setSvg(`<pre style="color:red;">${err.message}</pre>`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, isDarkMode]);

  return (
    <div
      className="mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ margin: "1rem 0" }}
    />
  );
}

// Molecule Renderer component
function MoleculeRenderer({ smiles }) {
  const { isDarkMode } = useTheme();
  const [svg, setSvg] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRDKit() {
      if (window.RDKit) return window.RDKit;
      if (!rdkitLoaderPromise) {
        rdkitLoaderPromise = new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = RDKitURL;
          script.async = true;
          script.onload = () => {
            window
              .initRDKitModule()
              .then((m) => {
                window.RDKit = m;
                resolve(m);
              })
              .catch(reject);
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      return rdkitLoaderPromise;
    }

    loadRDKit()
      .then((RDKit) => {
        if (cancelled) return;
        const mol = RDKit.get_mol(smiles);
        if (mol) {
          setSvg(mol.get_svg());
          mol.delete();
        } else {
          setSvg(`<span style="color:red;">Invalid SMILES</span>`);
        }
      })
      .catch(() => setSvg(`<span style="color:red;">Failed to load RDKit</span>`));

    return () => {
      cancelled = true;
    };
  }, [smiles]);

  if (!svg) return <div>Loading structure...</div>;

  return (
    <div
      style={{
        background: isDarkMode ? "#111827" : "#fff",
        border: `1px solid ${isDarkMode ? "#1f2937" : "#eee"}`,
        borderRadius: 8,
        padding: "0.5rem",
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// Main Markdown Renderer component
export default function MarkdownRenderer({ answer, isUser }) {
  const { isDarkMode } = useTheme();
  const palette = isDarkMode
    ? {
        text: "#e5e7eb",
        heading: "#f1f5f9",
        codeBackground: "#1f2937",
        blockquoteBackground: "#1e293b",
        blockquoteBorder: "#3b82f6",
        blockquoteAccent: "#60a5fa",
        tableBackground: "#111827",
        tableBorder: "#1f2937",
        tableHeaderBackground: "#1f2937",
        rowBorder: "#1f2937",
        moleculeBorder: "#1f2937",
        moleculeBackground: "#111827",
      }
    : {
        text: "#1a1a2e",
        heading: "#1a1a2e",
        codeBackground: "#f3f4f6",
        blockquoteBackground: "#f8fafc",
        blockquoteBorder: "#2563eb",
        blockquoteAccent: "#2563eb",
        tableBackground: "#ffffff",
        tableBorder: "#d1d5db",
        tableHeaderBackground: "#f8fafc",
        rowBorder: "#e5e7eb",
        moleculeBorder: "#eee",
        moleculeBackground: "#fff",
      };

  if (!answer || typeof answer !== "string") {
    return <div style={{ color: "orange" }}>Invalid answer format</div>;
  }

  // Helper: Convert LaTeX to readable text
  function convertLatexToText(mathContent) {
    return mathContent
      // Handle \mathrm{} first (before other conversions)
      .replace(/\\mathrm\{([^}]+)\}/g, '$1')
      
      // Handle subscripts with curly braces: C_{16:0} → C₁₆:₀
      .replace(/([A-Za-z])_\{([^}]+)\}/g, (match, base, subscript) => {
        const subscriptMap = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
          '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return base + subscript.split('').map(char => subscriptMap[char] || char).join('');
      })
      
      // Handle simple subscripts: C_2 → C₂
      .replace(/([A-Za-z])_([0-9])/g, (match, base, subscript) => {
        const subscriptMap = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
          '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return base + subscriptMap[subscript];
      })
      
      // Handle superscripts with curly braces: FADH^{2+} → FADH²⁺
      .replace(/([A-Za-z0-9])_\{([^}]+)\}\^\{([^}]+)\}/g, (match, base, sub, sup) => {
        const subscriptMap = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅',
          '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        const superscriptMap = {
          '+': '⁺', '-': '⁻', '2+': '²⁺', '3+': '³⁺', '2-': '²⁻', '3-': '³⁻',
          '4+': '⁴⁺', '4-': '⁴⁻', '1': '¹', '2': '²', '3': '³', '4': '⁴',
          '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '0': '⁰'
        };
        const subStr = sub.split('').map(char => subscriptMap[char] || char).join('');
        const supStr = superscriptMap[sup] || sup;
        return base + subStr + supStr;
      })
      
      // Handle simple superscripts: K^+ → K⁺
      .replace(/([A-Za-z0-9])\^([0-9]*[+-]?)/g, (match, base, superscript) => {
        const superscriptMap = {
          '+': '⁺', '-': '⁻', '2+': '²⁺', '3+': '³⁺', '2-': '²⁻', '3-': '³⁻',
          '4+': '⁴⁺', '4-': '⁴⁻', '1': '¹', '2': '²', '3': '³', '4': '⁴',
          '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '0': '⁰'
        };
        return base + (superscriptMap[superscript] || superscript);
      })
      
      // Math symbols
      .replace(/\\approx/g, '≈')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠')
      .replace(/\\equiv/g, '≡')
      .replace(/\\propto/g, '∝')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\pm/g, '±')
      .replace(/\\infty/g, '∞')
      .replace(/\\sum/g, '∑')
      .replace(/\\int/g, '∫')
      .replace(/\\partial/g, '∂')
      .replace(/\\nabla/g, '∇')
      .replace(/\\sim/g, '~')
      
      // Greek letters
      .replace(/\\pi/g, 'π')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ')
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\epsilon/g, 'ε')
      .replace(/\\theta/g, 'θ')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\mu/g, 'μ')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\tau/g, 'τ')
      .replace(/\\phi/g, 'φ')
      .replace(/\\omega/g, 'ω')
      
      // Set theory symbols
      .replace(/\\in/g, '∈')
      .replace(/\\notin/g, '∉')
      .replace(/\\subset/g, '⊂')
      .replace(/\\supset/g, '⊃')
      .replace(/\\cup/g, '∪')
      .replace(/\\cap/g, '∩')
      .replace(/\\emptyset/g, '∅')
      
      // Arrows
      .replace(/\\rightarrow/g, '→')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\leftrightarrow/g, '↔')
      .replace(/\\Rightarrow/g, '⇒')
      .replace(/\\Leftarrow/g, '⇐')
      .replace(/\\Leftrightarrow/g, '⇔')
      
      // Clean up
      .replace(/\\,/g, '') // Remove thin spaces
      .replace(/\\%/g, '%') // Convert \% to %
      .replace(/\\text\{([^}]+)\}/g, '$1'); // Convert \text{...} to text
  }
 
  // Helper: Convert chemical formula to Unicode subscripts/superscripts
  function convertChemicalFormula(formula) {
    if (!formula || typeof formula !== 'string') return formula;
    
    return formula
      // Handle regular numbers as subscripts (common in chemical formulas)
      .replace(/([A-Za-z])([2-9])/g, (match, element, number) => {
        const subscriptMap = {
          '2': '₂', '3': '₃', '4': '₄', '5': '₅', 
          '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return element + subscriptMap[number];
      })
      
      // Handle parentheses with subscripts
      .replace(/\(([^)]+)\)([2-9])/g, (match, content, number) => {
        const subscriptMap = {
          '2': '₂', '3': '₃', '4': '₄', '5': '₅', 
          '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return `(${content})${subscriptMap[number]}`;
      })
      
      // Handle brackets with subscripts
      .replace(/\[([^\]]+)\]([2-9])/g, (match, content, number) => {
        const subscriptMap = {
          '2': '₂', '3': '₃', '4': '₄', '5': '₅', 
          '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return `[${content}]${subscriptMap[number]}`;
      });
  }

  // Preprocess text: handle custom tags and enhance math
  function preprocessText(text) {
    return text
      .replace(/<mol>(.*?)<\/mol>/g, (_, s) => `<div class="molecule-placeholder" data-smiles="${s}"></div>`)
      .replace(/<chem>(.*?)<\/chem>/g, (_, s) => convertChemicalFormula(s))
      .replace(/<formula>(.*?)<\/formula>/g, (_, s) => convertChemicalFormula(s))
     
      // Add line breaks before headings for proper formatting
      .replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2')
      .replace(/([^\n])\n(###?\s)/g, '$1\n\n$2')
     
      // Remove "Body-fluid Compartments:" in table contexts
      .replace(/^\s*•\s*Body-fluid Compartments:/gm, '')
      .replace(/^\s*-\s*Body-fluid Compartments:/gm, '')
      .replace(/^\s*\*\s*Body-fluid Compartments:/gm, '')
      .replace(/## Body-fluid Compartments:/g, '')
      .replace(/Body-fluid Compartments:/g, '')
     
      // Remove horizontal line separators
      .replace(/^---$/gm, '') // Remove horizontal lines
      .replace(/^___$/gm, '') // Remove underscore lines
      .replace(/^\*\*\*$/gm, '') // Remove asterisk lines
      .replace(/^---\s*$/gm, '') // Remove horizontal lines with spaces
      .replace(/^___\s*$/gm, '') // Remove underscore lines with spaces
      .replace(/^\*\*\*\s*$/gm, '') // Remove asterisk lines with spaces
      .replace(/^[-_*]{3,}$/gm, '') // Remove any 3+ consecutive dashes/underscores/asterisks
      .replace(/^[-_*]{2,}\s*$/gm, '') // Remove any 2+ consecutive with trailing spaces
     
      // Clean tables to only contain electrolyte data
      .replace(/\|\s*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*Body-fluid[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*Compartments[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*## Body-fluid Compartments:[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*Body-fluid Compartments:[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*Total body water[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*ICF[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*ECF[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*Plasma[^|]*\|\s*\|/g, '')
      .replace(/\|\s*[^|]*Interstitial[^|]*\|\s*\|/g, '')
     
      // Remove multiple empty lines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s*\n\s*\n\s*\n/g, '\n\n')
     
      // Remove lines with only whitespace
      .replace(/^\s*\n/gm, '')
      .replace(/\n\s*$/gm, '')
     
      // Limit multiple newlines
      .replace(/\n{3,}/g, '\n\n')
     
      // Convert inline math $...$
      .replace(/\$([^$]+)\$/g, (_, mathContent) => convertLatexToText(mathContent))
     
      // Convert display math $$...$$
      .replace(/\$\$([^$]+)\$\$/g, (_, mathContent) => convertLatexToText(mathContent))
     
      // Remove LaTeX syntax not in math blocks
      .replace(/\\,/g, '')
      .replace(/\\%/g, '%')
     
      // Convert raw LaTeX expressions (not in math blocks)
      .replace(/\\mathrm\{([^}]+)\}/g, '$1') // \mathrm{C_{16:0}} → C_{16:0}
      .replace(/\\Delta\^(\d+)/g, 'Δ$1') // \Delta^2 → Δ2
      .replace(/\\mathrm\{([^}]+)\}/g, '$1') // \mathrm{FADH₂} → FADH₂
      
      // Convert raw LaTeX chemical formulas (non math block)
      .replace(/([A-Z][a-z]?)_(\d+)\^\{([^}]+)\}/g, (match, elem, sub, charge) => {
        const subscripts = '₀₁₂₃₄₅₆₇₈₉';
        const superscripts = {
          '+': '⁺', '-': '⁻', '2+': '²⁺', '3-': '³⁻', '2-': '²⁻', '3+': '³⁺',
          '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '0': '⁰'
        };
        const subStr = subscripts[parseInt(sub)] || '_' + sub;
        const supStr = superscripts[charge] || '^' + charge;
        return elem + subStr + supStr;
      })
      // Handle simple superscripts like K^+
      .replace(/([A-Z][a-z]?)\^(\d*[+-]?)/g, (_, elem, charge) => {
        const superscripts = {
          '+': '⁺', '-': '⁻', '2+': '²⁺', '3-': '³⁻', '2-': '²⁻', '3+': '³⁺',
          '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '0': '⁰'
        };
        return elem + (superscripts[charge] || '^' + charge);
      })
      // Subscripts like PO_4
      .replace(/([A-Z][a-z]?)_(\d+)/g, (match, elem, sub) => {
        const subscripts = '₀₁₂₃₄₅₆₇₈₉';
        return elem + (subscripts[parseInt(sub)] || '_' + sub);
      })
     
      // Enhance Greek and math symbols in non-LaTeX content
      .replace(/\\pi/g, 'π')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ')
      .replace(/\\epsilon/g, 'ε')
      .replace(/\\theta/g, 'θ')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\mu/g, 'μ')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\tau/g, 'τ')
      .replace(/\\phi/g, 'φ')
      .replace(/\\omega/g, 'ω')
     
      // Math symbols
      .replace(/\\infty/g, '∞')
      .replace(/\\sum/g, '∑')
      .replace(/\\int/g, '∫')
      .replace(/\\partial/g, '∂')
      .replace(/\\nabla/g, '∇')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\pm/g, '±')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠')
      .replace(/\\approx/g, '≈')
      .replace(/\\equiv/g, '≡')
      .replace(/\\propto/g, '∝')
      .replace(/\\in/g, '∈')
      .replace(/\\notin/g, '∉')
      .replace(/\\subset/g, '⊂')
      .replace(/\\supset/g, '⊃')
      .replace(/\\cup/g, '∪')
      .replace(/\\cap/g, '∩')
      .replace(/\\emptyset/g, '∅')
      .replace(/\\rightarrow/g, '→')
      .replace(/\\leftarrow/g, '←')
      .replace(/\\leftrightarrow/g, '↔')
      .replace(/\\Rightarrow/g, '⇒')
      .replace(/\\Leftarrow/g, '⇐')
      .replace(/\\Leftrightarrow/g, '⇔');
  }
 
 
  // Initial preprocessing
  let processed = preprocessText(answer);

  // React component map
  const components = {
    code({ inline, className, children, ...props }) {
      const txt = String(children).trim();
      if (!inline && className === "language-mermaid") {
        return <MermaidRenderer code={txt} />;
      }
      return (
        <code
          style={{
            background: palette.codeBackground,
            padding: "0.2rem 0.4rem",
            borderRadius: "4px",
            fontSize: "0.85rem",
            fontFamily: inline ? "'Times New Roman', serif" : "monospace",
          }}
          {...props}
        >
          {children}
        </code>
      );
    },
    span({ children, ...props }) {
      return <span {...props}>{children}</span>;
    },
    p({ children, ...props }) {
      return (
        <p
          style={{
            width: "100%",
            maxWidth: "100%",
            margin: "0 0 1rem 0",
            padding: 0,
            boxSizing: "border-box",
            display: "block",
            textAlign: "left",
            lineHeight: "1.7",
            wordWrap: "break-word",
            overflowWrap: "break-word",
            hyphens: "auto",
          }}
          {...props}
        >
          {children}
        </p>
      );
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote
          style={{
            borderLeft: `4px solid ${palette.blockquoteBorder}`,
            padding: "1rem 1.5rem",
            margin: "1rem 0",
            background: palette.blockquoteBackground,
            borderRadius: "0 8px 8px 0",
            fontStyle: "italic",
            position: "relative",
          }}
          {...props}
        >
          <div
            style={{
              fontWeight: "600",
              color: palette.blockquoteAccent,
              marginBottom: "0.5rem",
              fontSize: "0.9rem",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Theorem
          </div>
          {children}
        </blockquote>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul
          style={{
            paddingLeft: "1.5rem",
            margin: "0.5rem 0",
            lineHeight: "1.7",
          }}
          {...props}
        >
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol
          style={{
            paddingLeft: "1.5rem",
            margin: "0.5rem 0",
            lineHeight: "1.7",
          }}
          {...props}
        >
          {children}
        </ol>
      );
    },
    li({ children, ...props }) {
      return (
        <li
          style={{
            margin: "0.25rem 0",
            lineHeight: "1.7",
          }}
          {...props}
        >
          {children}
        </li>
      );
    },
    div({ className, children, ...props }) {
      if (className === "molecule-placeholder") {
        const smiles = props['data-smiles'];
        return <MoleculeRenderer smiles={smiles} />;
      }
      return (
        <div
          {...props}
          style={{
            width: "100%",
            maxWidth: "100%",
            margin: 0,
            padding: 0,
            boxSizing: "border-box",
            display: "block",
            textAlign: "left",
            ...props.style,
          }}
        >
          {children}
        </div>
      );
    },
    h1({ children, ...props }) {
      return (
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: "600",
            margin: "1.5rem 0 1rem 0",
            color: palette.heading,
            lineHeight: "1.4",
          }}
          {...props}
        >
          {children}
        </h1>
      );
    },
    h2({ children, ...props }) {
      return (
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: "600",
            margin: "1.25rem 0 0.75rem 0",
            color: palette.heading,
            lineHeight: "1.4",
          }}
          {...props}
        >
          {children}
        </h2>
      );
    },
    h3({ children, ...props }) {
      return (
        <h3
          style={{
            fontSize: "1.1rem",
            fontWeight: "600",
            margin: "1rem 0 0.5rem 0",
            color: palette.heading,
            lineHeight: "1.4",
          }}
          {...props}
        >
          {children}
        </h3>
      );
    },
    table({ children, ...props }) {
      return (
        <div
          style={{
            margin: "1rem 0",
            width: "100%",
            overflowX: "auto",
            boxSizing: "border-box",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.95rem",
              background: palette.tableBackground,
              border: `1px solid ${palette.tableBorder}`,
              borderRadius: "8px",
              overflow: "hidden",
              tableLayout: "fixed",
            }}
            {...props}
          >
            {children}
          </table>
        </div>
      );
    },
    thead({ children, ...props }) {
      return (
        <thead
          style={{
            background: palette.tableHeaderBackground,
          }}
          {...props}
        >
          {children}
        </thead>
      );
    },
    tbody({ children, ...props }) {
      return (
        <tbody
          style={{
            background: "transparent",
          }}
          {...props}
        >
          {children}
        </tbody>
      );
    },
    tr({ children, ...props }) {
      return (
        <tr
          style={{
            borderBottom: `1px solid ${palette.rowBorder}`,
          }}
          {...props}
        >
          {children}
        </tr>
      );
    },
    td({ children, ...props }) {
      // Check if content looks like a heading
      const contentStr = String(children);
      if (
        contentStr.includes("Body-fluid Compartments") ||
        contentStr.includes("###") ||
        contentStr.includes("##")
      ) {
        return (
          <td
            style={{
              padding: "0.75rem 1rem",
              border: "none",
              verticalAlign: "top",
              textAlign: "left",
              fontSize: "0.95rem",
              lineHeight: "1.6",
              width: "50%",
              boxSizing: "border-box",
              wordWrap: "break-word",
              fontWeight: "600",
              color: palette.heading,
            }}
            {...props}
          >
            {children}
          </td>
        );
      }
 
      return (
        <td
          style={{
            padding: "0.75rem 1rem",
            border: "none",
            verticalAlign: "top",
            textAlign: "center",
            fontSize: "0.95rem",
            lineHeight: "1.6",
            width: "50%",
            boxSizing: "border-box",
            wordWrap: "break-word",
            color: palette.text,
          }}
          {...props}
        >
          {children}
        </td>
      );
    },
    th({ children, ...props }) {
      return (
        <th
          style={{
            padding: "0.75rem 1rem",
            fontWeight: "600",
            background: "transparent",
            border: "none",
            textAlign: "center",
            fontSize: "0.95rem",
            color: palette.heading,
            width: "50%",
            boxSizing: "border-box",
            wordWrap: "break-word",
            display: "table-cell",
            verticalAlign: "middle",
          }}
          {...props}
        >
          {children}
        </th>
      );
    },
  };
 
  return (
    <div
        style={{
          color: palette.text,
          lineHeight: "1.7",
          fontSize: "0.95rem",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          margin: 0,
          padding: 0,
          display: "block",
          textAlign: "left",
          fontFamily: "'Times New Roman', serif",
        }}
      >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {typeof processed === 'string' ? processed : String(processed)}
      </ReactMarkdown>
      </div>
  );
} 
 

