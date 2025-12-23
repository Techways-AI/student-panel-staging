import random
from typing import List, Dict

# Comprehensive question bank for B.Pharmacy based on PCI Syllabus
QUESTION_BANK = {
    # Year I - Semester I
    (1, 1): [
        # Human Anatomy and Physiology I
        {
            "question": "What is the basic structural unit of the human body?",
            "options": ["Tissue", "Organ", "Cell", "System"],
            "answer": 2,  # Cell
            "subject": "Human Anatomy and Physiology I"
        },
        {
            "question": "Which body system is primarily responsible for transporting nutrients?",
            "options": ["Digestive system", "Circulatory system", "Respiratory system", "Nervous system"],
            "answer": 1,  # Circulatory system
            "subject": "Human Anatomy and Physiology I"
        },
        {
            "question": "Which of the following cranial nerves is responsible for vision?",
            "options": ["Olfactory", "Optic", "Facial", "Vagus"],
            "answer": 1,  # Optic
            "subject": "Human Anatomy and Physiology I"
        },
        # Pharmaceutical Analysis I
        {
            "question": "What is the main principle of titration?",
            "options": ["Oxidation", "Neutralization", "Precipitation", "Extraction"],
            "answer": 1,  # Neutralization
            "subject": "Pharmaceutical Analysis I"
        },
        {
            "question": "Which indicator is commonly used in acid-base titrations?",
            "options": ["Phenolphthalein", "Starch", "Methyl orange", "Bromothymol blue"],
            "answer": 0,  # Phenolphthalein
            "subject": "Pharmaceutical Analysis I"
        },
        {
            "question": "In UV spectroscopy, which range of wavelengths is typically used?",
            "options": ["10-200 nm", "200-400 nm", "400-700 nm", "700-900 nm"],
            "answer": 1,  # 200-400 nm
            "subject": "Pharmaceutical Analysis I"
        },
        # Pharmaceutics
        {
            "question": "Which dosage form is designed to release the drug slowly over time?",
            "options": ["Tablet", "Capsule", "Sustained release", "Solution"],
            "answer": 2,  # Sustained release
            "subject": "Pharmaceutics"
        },
        {
            "question": "What is the main role of excipients in formulations?",
            "options": ["Act as active ingredients", "Provide color", "Improve drug stability", "All of the above"],
            "answer": 3,  # All of the above
            "subject": "Pharmaceutics"
        },
        {
            "question": "Which mixing equipment is used for powders?",
            "options": ["Homogenizer", "V-blender", "Autoclave", "Turbine"],
            "answer": 1,  # V-blender
            "subject": "Pharmaceutics"
        },
        # Pharmaceutical Inorganic Chemistry
        {
            "question": "Which of the following is a pharmaceutical buffer?",
            "options": ["NaCl", "NaOH", "Borax", "NaHCO3"],
            "answer": 2,  # Borax
            "subject": "Pharmaceutical Inorganic Chemistry"
        },
        {
            "question": "What is the oxidation state of iron in ferrous sulfate?",
            "options": ["+1", "+2", "+3", "+4"],
            "answer": 1,  # +2
            "subject": "Pharmaceutical Inorganic Chemistry"
        },
        {
            "question": "Which compound is used as an antacid?",
            "options": ["NaCl", "Mg(OH)2", "CaCl2", "HCl"],
            "answer": 1,  # Mg(OH)2
            "subject": "Pharmaceutical Inorganic Chemistry"
        }
    ],
    
    # Year I - Semester II
    (1, 2): [
        # Human Anatomy and Physiology II
        {
            "question": "Which part of the brain controls balance?",
            "options": ["Cerebrum", "Medulla", "Cerebellum", "Pons"],
            "answer": 2,  # Cerebellum
            "subject": "Human Anatomy and Physiology II"
        },
        {
            "question": "Which blood cells are responsible for immunity?",
            "options": ["Red blood cells", "White blood cells", "Platelets", "All of the above"],
            "answer": 1,  # White blood cells
            "subject": "Human Anatomy and Physiology II"
        },
        {
            "question": "Which hormone regulates blood sugar levels?",
            "options": ["Insulin", "Adrenaline", "Thyroxine", "Cortisol"],
            "answer": 0,  # Insulin
            "subject": "Human Anatomy and Physiology II"
        },
        # Pharmaceutical Organic Chemistry-I
        {
            "question": "What is the hybridization of carbon in methane?",
            "options": ["sp", "sp2", "sp3", "sp3d"],
            "answer": 2,  # sp3
            "subject": "Pharmaceutical Organic Chemistry-I"
        },
        {
            "question": "Which is an example of aromatic compound?",
            "options": ["Ethane", "Cyclohexane", "Benzene", "Butane"],
            "answer": 2,  # Benzene
            "subject": "Pharmaceutical Organic Chemistry-I"
        },
        {
            "question": "Which reaction is used to convert alcohol to aldehyde?",
            "options": ["Reduction", "Oxidation", "Hydrolysis", "Substitution"],
            "answer": 1,  # Oxidation
            "subject": "Pharmaceutical Organic Chemistry-I"
        },
        # Biochemistry
        {
            "question": "Which biomolecule is the main source of energy?",
            "options": ["Proteins", "Lipids", "Carbohydrates", "Nucleic acids"],
            "answer": 2,  # Carbohydrates
            "subject": "Biochemistry"
        },
        {
            "question": "Which enzyme breaks down starch?",
            "options": ["Lipase", "Amylase", "Pepsin", "Trypsin"],
            "answer": 1,  # Amylase
            "subject": "Biochemistry"
        },
        {
            "question": "What is the structure of DNA?",
            "options": ["Single-stranded", "Triple helix", "Double helix", "Linear"],
            "answer": 2,  # Double helix
            "subject": "Biochemistry"
        }
    ],
    
    # Year II - Semester I
    (2, 1): [
        # Pharmaceutical Organic Chemistry-II
        {
            "question": "Which functional group defines a ketone?",
            "options": ["-OH", "-COOH", "-CHO", "C=O"],
            "answer": 3,  # C=O
            "subject": "Pharmaceutical Organic Chemistry-II"
        },
        {
            "question": "Which compound contains a carboxylic acid group?",
            "options": ["Methanol", "Ethanol", "Acetic acid", "Acetone"],
            "answer": 2,  # Acetic acid
            "subject": "Pharmaceutical Organic Chemistry-II"
        },
        {
            "question": "Which of the following undergoes nucleophilic substitution?",
            "options": ["Alkanes", "Aromatic compounds", "Haloalkanes", "Alkenes"],
            "answer": 2,  # Haloalkanes
            "subject": "Pharmaceutical Organic Chemistry-II"
        },
        # Physical Pharmaceutics-I
        {
            "question": "Which law explains solubility?",
            "options": ["Boyles law", "Raoults law", "Ficks law", "Henrys law"],
            "answer": 3,  # Henrys law
            "subject": "Physical Pharmaceutics-I"
        },
        {
            "question": "What is the SI unit of viscosity?",
            "options": ["Newton", "Pascal", "Poise", "Pas"],
            "answer": 3,  # Pas
            "subject": "Physical Pharmaceutics-I"
        },
        {
            "question": "Which equipment is used for measuring particle size?",
            "options": ["HPLC", "Microscope", "Sieve shaker", "Manometer"],
            "answer": 2,  # Sieve shaker
            "subject": "Physical Pharmaceutics-I"
        }
    ],
    
    # Year II - Semester II
    (2, 2): [
        # Pharmaceutical Organic Chemistry-III
        {
            "question": "Which compound is a heterocycle?",
            "options": ["Benzene", "Naphthalene", "Pyridine", "Toluene"],
            "answer": 2,  # Pyridine
            "subject": "Pharmaceutical Organic Chemistry-III"
        },
        {
            "question": "Grignard reagent contains which metal?",
            "options": ["Lithium", "Sodium", "Magnesium", "Potassium"],
            "answer": 2,  # Magnesium
            "subject": "Pharmaceutical Organic Chemistry-III"
        },
        {
            "question": "Which reaction is used in the synthesis of amines?",
            "options": ["Friedel-Crafts", "Gabriel synthesis", "Diels-Alder", "Cannizzaro"],
            "answer": 1,  # Gabriel synthesis
            "subject": "Pharmaceutical Organic Chemistry-III"
        },
        # Pharmacology-I
        {
            "question": "Which organ is the main site for drug metabolism?",
            "options": ["Kidney", "Lungs", "Liver", "Heart"],
            "answer": 2,  # Liver
            "subject": "Pharmacology-I"
        },
        {
            "question": "What does ED50 represent?",
            "options": ["Lethal dose", "Half-life", "Effective dose in 50% population", "Side effect"],
            "answer": 2,  # Effective dose in 50% population
            "subject": "Pharmacology-I"
        },
        {
            "question": "Which class of drugs reduces pain?",
            "options": ["Antipyretics", "Analgesics", "Antiseptics", "Antibiotics"],
            "answer": 1,  # Analgesics
            "subject": "Pharmacology-I"
        }
    ],
    
    # Year III - Semester I
    (3, 1): [
        # Medicinal Chemistry I
        {
            "question": "Which element is present in sulfonamides?",
            "options": ["Chlorine", "Sulfur", "Nitrogen", "Bromine"],
            "answer": 1,  # Sulfur
            "subject": "Medicinal Chemistry I"
        },
        {
            "question": "Which compound is used as antimalarial?",
            "options": ["Aspirin", "Chloroquine", "Paracetamol", "Ibuprofen"],
            "answer": 1,  # Chloroquine
            "subject": "Medicinal Chemistry I"
        },
        {
            "question": "Which functional group is essential in penicillin?",
            "options": ["Carboxyl", "Amide", "Lactam", "Ester"],
            "answer": 2,  # Lactam
            "subject": "Medicinal Chemistry I"
        },
        # Pharmacology-II
        {
            "question": "Which drug class is used in hypertension?",
            "options": ["NSAIDs", "Beta-blockers", "Antibiotics", "Antacids"],
            "answer": 1,  # Beta-blockers
            "subject": "Pharmacology-II"
        },
        {
            "question": "What is the mechanism of action of omeprazole?",
            "options": ["H2 blocker", "Proton pump inhibitor", "Antacid", "Mucosal protectant"],
            "answer": 1,  # Proton pump inhibitor
            "subject": "Pharmacology-II"
        },
        {
            "question": "Which organ is affected by nephrotoxic drugs?",
            "options": ["Heart", "Liver", "Kidney", "Lungs"],
            "answer": 2,  # Kidney
            "subject": "Pharmacology-II"
        }
    ],
    
    # Year III - Semester II
    (3, 2): [
        # Medicinal Chemistry II
        {
            "question": "Which compound is a local anesthetic?",
            "options": ["Lidocaine", "Ibuprofen", "Codeine", "Aspirin"],
            "answer": 0,  # Lidocaine
            "subject": "Medicinal Chemistry II"
        },
        {
            "question": "Which class of drugs inhibits DNA synthesis?",
            "options": ["NSAIDs", "Antivirals", "Antineoplastics", "Antacids"],
            "answer": 2,  # Antineoplastics
            "subject": "Medicinal Chemistry II"
        },
        {
            "question": "Which ring is present in benzodiazepines?",
            "options": ["Imidazole", "Pyridine", "Diazepine", "Piperidine"],
            "answer": 2,  # Diazepine
            "subject": "Medicinal Chemistry II"
        },
        # Herbal Drug Technology
        {
            "question": "Which plant is used as a source of digitalis?",
            "options": ["Foxglove", "Neem", "Tulsi", "Amla"],
            "answer": 0,  # Foxglove
            "subject": "Herbal Drug Technology"
        },
        {
            "question": "Alkaloids are classified under which group?",
            "options": ["Proteins", "Lipids", "Nitrogenous compounds", "Carbohydrates"],
            "answer": 2,  # Nitrogenous compounds
            "subject": "Herbal Drug Technology"
        },
        {
            "question": "Which method is used for extraction of volatile oils?",
            "options": ["Decoction", "Infusion", "Steam distillation", "Percolation"],
            "answer": 2,  # Steam distillation
            "subject": "Herbal Drug Technology"
        }
    ],
    
    # Year IV - Semester I
    (4, 1): [
        # Instrumental Methods of Analysis
        {
            "question": "Which technique is used for structural elucidation?",
            "options": ["NMR", "TLC", "HPLC", "AAS"],
            "answer": 0,  # NMR
            "subject": "Instrumental Methods of Analysis"
        },
        {
            "question": "Which detector is used in UV spectroscopy?",
            "options": ["Flame", "Photodiode", "Mass", "X-ray"],
            "answer": 1,  # Photodiode
            "subject": "Instrumental Methods of Analysis"
        },
        {
            "question": "What is the principle of HPLC?",
            "options": ["Partition", "Adsorption", "Electrophoresis", "Chromatography"],
            "answer": 3,  # Chromatography
            "subject": "Instrumental Methods of Analysis"
        },
        # Pharmacy Practice
        {
            "question": "Which document contains drug information for healthcare professionals?",
            "options": ["Prescription", "Formulary", "Drug monograph", "Label"],
            "answer": 2,  # Drug monograph
            "subject": "Pharmacy Practice"
        },
        {
            "question": "Which is a schedule H drug?",
            "options": ["Aspirin", "Ciprofloxacin", "Paracetamol", "Ibuprofen"],
            "answer": 1,  # Ciprofloxacin
            "subject": "Pharmacy Practice"
        },
        {
            "question": "Which regulatory body oversees pharmacy education in India?",
            "options": ["AICTE", "UGC", "PCI", "MCI"],
            "answer": 2,  # PCI
            "subject": "Pharmacy Practice"
        }
    ],
    
    # Year IV - Semester II
    (4, 2): [
        # Biostatistics and Research Methodology
        {
            "question": "Which test compares means between two groups?",
            "options": ["Chi-square", "T-test", "ANOVA", "Regression"],
            "answer": 1,  # T-test
            "subject": "Biostatistics and Research Methodology"
        },
        {
            "question": "What is the dependent variable in research?",
            "options": ["Variable manipulated", "Variable measured", "Unrelated variable", "Controlled variable"],
            "answer": 1,  # Variable measured
            "subject": "Biostatistics and Research Methodology"
        },
        {
            "question": "Which type of data uses mean and SD?",
            "options": ["Nominal", "Ordinal", "Interval", "Categorical"],
            "answer": 2,  # Interval
            "subject": "Biostatistics and Research Methodology"
        },
        # Novel Drug Delivery System
        {
            "question": "Which of the following is a sustained release system?",
            "options": ["Tablet", "Capsule", "Matrix system", "Syrup"],
            "answer": 2,  # Matrix system
            "subject": "Novel Drug Delivery System"
        },
        {
            "question": "Which route bypasses first-pass metabolism?",
            "options": ["Oral", "Rectal", "Sublingual", "Topical"],
            "answer": 2,  # Sublingual
            "subject": "Novel Drug Delivery System"
        },
        {
            "question": "Which polymer is used in NDDS?",
            "options": ["PEG", "Starch", "Cellulose", "PVC"],
            "answer": 0,  # PEG
            "subject": "Novel Drug Delivery System"
        }
    ]
}

def get_random_questions(year: int, semester: int, num_questions: int = 5) -> List[Dict]:
    """
    Get random questions for a specific year and semester.
    
    Args:
        year (int): Academic year (1-4)
        semester (int): Semester (1-2)
        num_questions (int): Number of questions to return (default: 5)
    
    Returns:
        List[Dict]: List of question dictionaries with question, options, and answer
    """
    key = (year, semester)
    
    if key not in QUESTION_BANK:
        # Fallback: return questions from Year 1, Semester 1 if combination not found
        key = (1, 1)
    
    available_questions = QUESTION_BANK[key]
    
    # If we have fewer questions than requested, return all available
    if len(available_questions) <= num_questions:
        return available_questions.copy()
    
    # Randomly select questions
    selected_questions = random.sample(available_questions, num_questions)
    
    # Return questions without the subject field (to maintain compatibility)
    return [
        {
            "question": q["question"],
            "options": q["options"],
            "answer": q["answer"]
        }
        for q in selected_questions
    ]

def get_questions_by_subject(year: int, semester: int, subject: str, num_questions: int = 5) -> List[Dict]:
    """
    Get random questions for a specific subject within a year and semester.
    
    Args:
        year (int): Academic year (1-4)
        semester (int): Semester (1-2)
        subject (str): Subject name
        num_questions (int): Number of questions to return (default: 5)
    
    Returns:
        List[Dict]: List of question dictionaries
    """
    key = (year, semester)
    
    if key not in QUESTION_BANK:
        return []
    
    # Filter questions by subject
    subject_questions = [
        q for q in QUESTION_BANK[key] 
        if q["subject"].lower() == subject.lower()
    ]
    
    if not subject_questions:
        return []
    
    # If we have fewer questions than requested, return all available
    if len(subject_questions) <= num_questions:
        selected_questions = subject_questions
    else:
        # Randomly select questions
        selected_questions = random.sample(subject_questions, num_questions)
    
    # Return questions without the subject field
    return [
        {
            "question": q["question"],
            "options": q["options"],
            "answer": q["answer"]
        }
        for q in selected_questions
    ]

def get_available_subjects(year: int, semester: int) -> List[str]:
    """
    Get list of available subjects for a specific year and semester.
    
    Args:
        year (int): Academic year (1-4)
        semester (int): Semester (1-2)
    
    Returns:
        List[str]: List of subject names
    """
    key = (year, semester)
    
    if key not in QUESTION_BANK:
        return []
    
    subjects = set()
    for question in QUESTION_BANK[key]:
        subjects.add(question["subject"])
    
    return sorted(list(subjects)) 

