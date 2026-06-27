# Unsupported Answer Repairability Audit

Scope: direct mini + citation repair unsupported answered predictions on 321-389.

This audit makes no LLM calls and launches no GPU jobs. It reuses existing `gpt-4o` support judgments to identify unsupported direct answers, then inspects the compact evidence pack to estimate whether simple citation repair/reranking appears plausible or whether the answer content itself needs repair/regeneration/abstention.

## Aggregate

| Unsupported answers | Reference answerable | Should abstain | Citation repair candidates | Mixed repair | Answer repair/regeneration |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 19 | 13 | 6 | 1 | 0 | 12 |

## Buckets

| Bucket | Rows | Share |
| --- | ---: | ---: |
| answer_repair_or_regeneration_needed | 12 | 63.2% |
| should_abstain_counterfactual_or_insufficient | 6 | 31.6% |
| citation_repair_candidate | 1 | 5.3% |

## Metrics

| Mean answer/reference F1 | Mean cited-claim overlap | Mean best non-cited gain |
| ---: | ---: | ---: |
| 17.4% | 58.8% | 3.1% |

## Examples

| Example | Bucket | Answer/ref F1 | Cited claim overlap | Best non-cited gain | Best hits reference citation | Unsupported claim | Best evidence preview |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` | should_abstain_counterfactual_or_insufficient | 0.0% | 11.1% | 0.0% | no | The paper mentions other works proposing methods to detect anglicisms in Spanish. | The scope and nature of lexical borrowing is, however, somewhat different to that of code-switching. In fact, applying code-switching models to lexical borrowing detection has previously proved to be unsuccessful, as they tend to overest... |
| `2004.03034:6cdd61ebf84aa742155f4554456cc3233b6ae2bf` | answer_repair_or_regeneration_needed | 28.6% | 37.5% | 0.0% | yes | Models that rely only on claim-specific linguistic features are used as baselines. | Similar to BIBREF9, we experiment with SVM with RBF kernel, with features that represent (1) the simple characteristics of the argument tree and (2) the linguistic characteristics of the claim. |
| `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26` | answer_repair_or_regeneration_needed | 34.0% | 100.0% | 0.0% | yes | SVM model with parent quality feature achieves higher F1 score than majority baseline. | We see that parent quality is a simple yet effective feature and SVM model with this feature can achieve significantly higher ($p<0.001$) F1 score ($46.61\%$) than distance from the thesis and linguistic features. Claims with higher impa... |
| `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` | should_abstain_counterfactual_or_insufficient | 0.0% | 68.2% | 0.0% | no | The results of the BERT model with larger context representations significantly outperform the baseline models, particularly for claims with context lengths of 3 and 4, achievin... | To understand for what kinds of claims the best performing contextual model is more effective, we evaluate the BERT model with flat context representation for claims with context length values 1, 2, 3 and 4 separately. Table TABREF26 sho... |
| `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` | answer_repair_or_regeneration_needed | 0.0% | 66.7% | 0.0% | yes | Interviews can be classified as natural open-domain dialog. | While models fine-tuned on the training set performed best on each dataset as expected, we observe that 1) models trained on other datasets obtain relatively poor zero-shot performance on Interview; and 2) the model trained on Interview ... |
| `2004.03685:d4b9cdb4b2dfda1e0d96ab6c3b5e2157fd52685e` | citation_repair_candidate | 60.0% | 50.0% | 37.9% | yes | The Prediction Assumption indicates that on similar inputs, the model makes similar decisions if and only if its reasoning is similar. | On similar inputs, the model makes similar decisions if and only if its reasoning is similar. |
| `2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd` | answer_repair_or_regeneration_needed | 0.0% | 85.7% | 0.0% | no | The dataset e-SNLI-VE-2.0 includes human-written explanations from e-SNLI. | In this work, we also introduce e-SNLI-VE-2.0, a dataset combining SNLI-VE-2.0 with human-written explanations from e-SNLI BIBREF6, which were originally collected to support textual entailment. We replace the explanations for the neutra... |
| `2004.03744:66bf0d61ffc321f15e7347aaed191223f4ce4b4a` | answer_repair_or_regeneration_needed | 50.0% | 33.3% | 0.0% | yes | Number of annotators used for SNLI-VE-2.0 | We used Amazon Mechanical Turk (MTurk) to collect new labels and explanations for SNLI-VE. 2,060 workers participated in the annotation effort, with an average of 1.98 assignments per worker and a standard deviation of 5.54. We required ... |
| `2004.03744:a08b5018943d4428f067c08077bfff1af3de9703` | answer_repair_or_regeneration_needed | 30.8% | 50.0% | 13.1% | no | The neutral class in SNLI-VE has the highest error rate. | After collecting new labels for the neutral instances in the validation and testing sets, we randomly select and annotate 150 instances from the validation set that were neutral in SNLI-VE. Based on this sample, the error rate went down ... |
| `2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a` | answer_repair_or_regeneration_needed | 10.3% | 90.0% | 3.6% | no | Neural models with language models achieved state-of-the-art results on CoNLL-03 and OntoNotes 5. | Named-entity recognition (NER) is the task of tagging relevant entities such as person, location and organization in unstructured text. Modern NER has been dominated by neural models BIBREF0, BIBREF1 combined with contextual embeddings f... |
| `2004.04228:dfd9302615b27abf8cbef1a2f880a73dd5f0c753:counterfactual-insufficient` | should_abstain_counterfactual_or_insufficient | 0.0% | 71.4% | 0.0% | no | QAGS evaluates the factual consistency of summaries using NLU models. | There has been a recent resurgence of work leveraging NLU models for evaluating the factuality of generated text. BIBREF35 use information extraction models to measure factual overlap, but facts are restricted to pre-defined schemas. BIB... |
| `2004.04435:d353a6bbdc66be9298494d0c853e0d8d752dec4b` | answer_repair_or_regeneration_needed | 15.1% | 71.8% | 0.0% | no | The correctness of automatic derivation is proved through empirical comparisons and the implementation of reverse mode differentiation, which computes the derivative of a functi... | Reverse mode operates in a bottom-up approach and computes the derivative of a function's output with respect to every intermediate result. Once every input variable of the function is reached, the whole gradient of an output is availabl... |
| `2004.04435:e2cfaa2ec89b944bbc46e5edf7753b3018dbdc8f` | should_abstain_counterfactual_or_insufficient | 0.0% | 72.2% | 0.0% | no | AD techniques have been implemented in a variety of programming languages and paradigms, including tools specific to machine-learning applications, which suggests their use in d... | AD techniques have been implemented in a variety of programming languages and paradigms, ranging from classical tools for Fortran BIBREF6 and C BIBREF7, to recent active work on tools specific to machine-learning applications BIBREF8, BI... |
| `2004.04478:7dca806426058d59f4a9a4873e9219d65aea0987` | answer_repair_or_regeneration_needed | 92.5% | 50.0% | 0.0% | yes | The domain 'Shoes' is listed twice as D15 and is not supported as a separate domain. | FLOAT SELECTED: Table 1: Accuracy percentage for all train-test pairs. Domains on rows are source domains and columns are target domains. Domain labels are D1: Amazon Instant Video, D2: Automotive, D3: Baby, D4: Beauty, D5: Books, D6: Cl... |
| `2004.04721:0737954caf66f2b4c898b356d2a3c43748b9706b` | answer_repair_or_regeneration_needed | 0.0% | 63.2% | 0.0% | yes | They do not recommend translating the premise and hypothesis together, as translating them independently is likely to reduce lexical overlap between them, which can affect model... | As shown in Table TABREF23, Orig outperforms BT-FI and MT-FI on the competence test by a large margin, but the opposite is true on the distraction test. In particular, our results show that BT-FI and MT-FI are less reliant on lexical ove... |
| `2004.04721:0737954caf66f2b4c898b356d2a3c43748b9706b:counterfactual-insufficient` | should_abstain_counterfactual_or_insufficient | 0.0% | 0.0% | 4.6% | no | They do not recommend translating the premise and hypothesis together | We experiment with two models that are representative of the state-of-the-art in monolingual and cross-lingual pre-training: (i) Roberta BIBREF28, which is an improved version of BERT that uses masked language modeling to pre-train an En... |
| `2004.04721:664b3eadc12c8dde309e8bbd59e9af961a433cde` | answer_repair_or_regeneration_needed | 9.1% | 33.3% | 0.0% | yes | The improvement over state-of-the-art is statistically significant. | In this paper, we have shown that both human and machine translation can alter superficial patterns in data, which requires reconsidering previous findings in cross-lingual transfer learning. Based on the gained insights, we have improve... |
| `2004.04721:73906462bd3415f23d6378590a5ba28709b17605` | answer_repair_or_regeneration_needed | 0.0% | 75.0% | 0.0% | yes | Examples of artifacts in cross-lingual transfer learning include subtle artifacts arising from the translation process itself, which can impact the performance of models trained... | Despite overlooked to date, we show that such mismatch has a notable impact in the performance of existing cross-lingual models. By using back-translation BIBREF3 to paraphrase each training instance, we obtain another English version of... |
| `2004.04721:bfc1de5fa4da2f0e301fd22aea19cf01e2bb5b31:counterfactual-insufficient` | should_abstain_counterfactual_or_insufficient | 0.0% | 88.2% | 0.0% | no | The experiments use both human and machine translation, translating the training set into other languages and generating English paraphrases through back-translation. | Our goal is to analyze the effect of both human and machine translation in cross-lingual models. For that purpose, the core idea of our work is to (i) use machine translation to either translate the training set into other languages, or ... |

## Training Implication

Keep the Qwen joint-action packet focused on answer repair/regeneration plus abstention; citation repair alone explains only a minority of unsupported final-window direct answers.
