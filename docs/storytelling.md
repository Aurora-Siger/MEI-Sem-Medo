# Storytelling e roteiro da apresentação

## A ideia em uma frase
**“O MEI sem Medo é o assistente que explica o seu negócio em português de gente, mostra a fonte de cada resposta e diz ‘não sei’ quando não sabe.”**

## Personagem (fictícia)
**Marta, 38 anos**, faz bolos de pote e vende pelo Instagram. É MEI há um ano. Trabalha sozinha, tem pouco tempo e já se confundiu com informação demais: um vídeo diz uma coisa, o grupo de WhatsApp diz outra, o site do governo tem termos que ela não conhece. Ela quer saber três coisas: *quanto cobrar, se está tudo certo com o imposto e se a reforma vai atrapalhar.*
> Marta é uma persona inventada para contar a história. Antes da apresentação, troque-a por um relato real das entrevistas (ver `docs/pesquisa_usuarios.md`), se o grupo fizer.

## Arco da história (5 atos)
1. **O problema (30 s).** Informação dispersa, boato (“o Pix vai ser taxado”) e juridiquês. Quem decide errado perde dinheiro: preço abaixo do custo, DAS atrasado, estouro do limite.
2. **A virada (20 s).** E se existisse alguém que responde só com base em fontes oficiais, mostra a lei e o link, e avisa quando a regra ainda pode mudar?
3. **Demonstração (2 min).** Três cenas com a Marta, ao vivo (abaixo).
4. **Como não inventa (40 s).** Agente de IA com ferramentas, mas com regras no código: só responde com registro da base ou com uma conta feita pela calculadora; fontes e leis vêm da base, não do modelo; sem dados pessoais; erro vira “não sei”.
5. **Fechamento (30 s).** Números do projeto, limites assumidos e próximos passos.

## As três cenas da demonstração
| Cena | O que a Marta pergunta | O que mostrar na tela |
|---|---|---|
| 1. Começar | “Quero abrir um MEI, por onde começo?” | Resposta curta do assistente, fonte (gov.br), base legal (LC 123/2006) e “Veja também”. |
| 2. Quanto cobrar | “Quanto devo cobrar pelo meu bolo de pote?” | O agente pergunta custo, gastos fixos e vendas; abre a calculadora de preço: preço sugerido, **preço mínimo**, ponto de equilíbrio e o aviso de que o preço de hoje dá prejuízo. |
| 3. E a reforma? | “O que muda com a reforma tributária?” | Resposta com selo **“confirmar na fonte oficial”** (honestidade sobre o que ainda não está definido) e, para quem quiser, a simulação Puro x Híbrido. |
Cena-bônus (limite da IA): pergunta fora do tema (“como tirar passaporte?”) → “não sei, confirme em…”.

## Roteiro do vídeo (≈ 4 min, não listado no YouTube)
| Tempo | Cena | Fala (sugestão) | Tela |
|---|---|---|---|
| 0:00 | Abertura | “Esta é a Marta. Ela faz bolos, é MEI e já perdeu noites tentando entender imposto e preço.” | Foto/ilustração + título |
| 0:20 | Problema | “Informação espalhada, boatos e termos difíceis. Errar aqui custa dinheiro.” | Print de boato + site com juridiquês |
| 0:45 | Solução | “O MEI sem Medo responde em linguagem simples e sempre mostra a fonte.” | Tela inicial do site |
| 1:05 | Cena 1 | Pergunta sobre abrir MEI | Chat, fonte e base legal |
| 1:40 | Cena 2 | Pergunta sobre preço; mostrar a calculadora | Preço, composição, preço mínimo |
| 2:30 | Cena 3 | Reforma e selo “confirmar” | Resposta + aviso |
| 2:55 | Limites | “Fora do tema, ele diz que não sabe.” | Passaporte → “não sei” |
| 3:10 | Por baixo | Agente com ferramentas + regras no código, Claude ou Gemini | Diagrama (pergunta → ferramentas → verificação → resposta) |
| 3:35 | Resultados | “44 perguntas de teste, 100% de acerto na busca; o agente ainda será medido com a API real” (diga só o que mediram) | Tabela de testes |
| 3:50 | Fecho | “Informação clara e honesta para quem empreende.” Link do repositório | Logo + QR |

## Pitch de 30 segundos
“Pequenos empreendedores decidem preço, imposto e contratação com informação dispersa e boato. O MEI sem Medo é um assistente de IA que responde em linguagem simples, mostra a lei e a fonte de cada resposta, calcula o preço certo e diz ‘não sei’ quando a base não cobre. A IA conversa; as regras de verdade, a fonte e as contas ficam no nosso código, não no palpite do modelo.”

## Perguntas que a banca pode fazer
- **“Por que não usar direto um chatbot?”** Chatbots genéricos inventam valores e prazos. Aqui o agente só responde com registros verificados ou com contas feitas pelo código, e as fontes vêm da base.
- **“E se a lei mudar?”** Cada registro tem data de verificação e nível de confiança; os que dependem de regulamentação aparecem como “confirmar”. A base é um JSON que o grupo corrige sem mexer no código.
- **“Quanto o agente acerta?”** Ainda não foi medido com a API real; medimos a busca por palavras-chave (44 perguntas). Próximo passo: rodar as mesmas perguntas no agente e comparar.
- **“Dados pessoais?”** Não pedimos; CPF, CNPJ, e-mail e telefone são removidos antes de ir para o modelo, e não gravamos as perguntas.
- **“O preço calculado serve para tudo?”** É um ponto de partida (método do Sebrae). Não considera concorrência nem demanda.
