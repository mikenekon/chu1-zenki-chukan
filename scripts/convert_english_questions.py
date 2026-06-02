import json
from pathlib import Path

src = Path('data/english_questions.json')
dst = Path('data/english.json')
with src.open('r', encoding='utf-8') as f:
    src_data = json.load(f)

output = {
    'subject': 'English',
    'version': '1.0',
    'units': []
}

for section in src_data.get('sections', []):
    unit_name = section.get('unit') or section.get('section') or 'English'
    questions = []

    for q in section.get('questions', []):
        qid = q.get('id') or f"{unit_name}-{len(questions)+1}"
        qtype = q.get('type') or 'simple'
        instruction = q.get('instruction', '')

        if qtype == 'matching':
            question = {
                'id': qid,
                'type': 'matching',
                'q': instruction,
                'items': q.get('items', []),
                'a': '\n'.join(f"{item.get('left')} → {item.get('right')}" for item in q.get('items', [])),
                'explanation': ''
            }
            questions.append(question)
            continue

        if qtype == 'fill_in_blank':
            items = q.get('items', [])
            q_text = instruction
            if items:
                q_lines = [instruction, '']
                for item in items:
                    if 'sentence' in item:
                        q_lines.append(f"{item.get('number', '')} {item['sentence']}")
                    else:
                        prefix = item.get('prefix', '')
                        suffix = item.get('suffix', '')
                        number = item.get('number', '')
                        blank = '____'
                        q_lines.append(f"{number} {prefix}{blank}{suffix}".strip())
                q_text = '\n'.join(q_lines)
            expected = [item.get('answer', '') for item in items] or q.get('expectedAnswers', [])
            question = {
                'id': qid,
                'type': 'fill_in_blank',
                'q': q_text,
                'items': items,
                'expectedAnswers': expected,
                'a': '\n'.join(expected),
                'explanation': ''
            }
            questions.append(question)
            continue

        if qtype == 'circle_correct':
            items = q.get('items')
            if items:
                question = {
                    'id': qid,
                    'type': 'circle_correct',
                    'q': instruction,
                    'items': items,
                    'a': '\n'.join(f"{idx+1}. {item.get('answer')}" for idx, item in enumerate(items)),
                    'explanation': ''
                }
            else:
                question = {
                    'id': qid,
                    'type': 'circle_correct',
                    'q': instruction,
                    'choices': q.get('choices', []),
                    'correctIndex': q.get('correctIndex', 0),
                    'a': q.get('a', ''),
                    'explanation': ''
                }
            questions.append(question)
            continue

        if qtype in {'select_fill', 'select_word', 'select_question'}:
            items = q.get('items', [])
            q_lines = [instruction, '']
            for item in items:
                sentence = item.get('sentence') or item.get('japanese') or ''
                q_lines.append(f"{item.get('number', '')} {sentence}")
            expected = [item.get('answer', '') for item in items]
            question = {
                'id': qid,
                'type': 'fill_in_blank',
                'q': '\n'.join(q_lines),
                'items': items,
                'expectedAnswers': expected,
                'a': '\n'.join(expected),
                'explanation': ''
            }
            questions.append(question)
            continue

        if qtype in {'rearrange', 'rearrange_with_extra'}:
            items = q.get('items', [])
            question = {
                'id': qid,
                'type': 'rearrange',
                'q': instruction,
                'items': items,
                'a': '\n'.join(f"{item.get('number', '')} {item.get('answer')}" for item in items),
                'explanation': ''
            }
            questions.append(question)
            continue

        if qtype == 'dictation':
            q_text = instruction
            if q.get('sentence_template'):
                q_text = f"{instruction}\n{q['sentence_template']}"
            question = {
                'id': qid,
                'type': 'simple',
                'q': q_text,
                'a': q.get('answer', ''),
                'explanation': ''
            }
            questions.append(question)
            continue

        if qtype == 'complete_dialogue':
            dialogue = q.get('dialogue', [])
            lines = [instruction, '']
            for row in dialogue:
                lines.append(f"{row.get('speaker', '')}: {row.get('text', '')}")
            answers = [row.get('answer') for row in dialogue if row.get('answer')]
            question = {
                'id': qid,
                'type': 'simple',
                'q': '\n'.join(lines),
                'a': '\n'.join(answers),
                'explanation': ''
            }
            questions.append(question)
            continue

        if qtype == 'reading_comprehension':
            q_text = '\n'.join([instruction, '', q.get('passage', ''), '', q.get('question', '')])
            question = {
                'id': qid,
                'type': 'simple',
                'q': q_text,
                'a': q.get('answer', ''),
                'explanation': ''
            }
            questions.append(question)
            continue

        if qtype in {'write_word', 'write_romaji', 'write_sentence'}:
            for item in q.get('items', []):
                item_q = f"{instruction}\n{item.get('number', '')}. {item.get('japanese', item.get('instruction', ''))}"
                question = {
                    'id': f"{qid}-{item.get('number', '')}",
                    'type': 'simple',
                    'q': item_q,
                    'a': item.get('answer', ''),
                    'explanation': ''
                }
                questions.append(question)
            continue

        # Fallback for other types or unknown formats
        answer = q.get('answer') or q.get('a') or q.get('expectedAnswers')
        if isinstance(answer, list):
            answer = '\n'.join(answer)
        question = {
            'id': qid,
            'type': 'simple',
            'q': instruction or q.get('question', '') or q.get('sentence', ''),
            'a': answer or '',
            'explanation': ''
        }
        questions.append(question)

    output['units'].append({'unit': unit_name, 'questions': questions})

with dst.open('w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)
print(f'Wrote {dst} with {sum(len(u["questions"]) for u in output["units"])} questions in {len(output["units"])} units.')
