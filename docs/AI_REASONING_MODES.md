# Modos de Raciocínio da IA (1x, 3x, Auto)

## O que são os modos de raciocínio?

Os modos de raciocínio controlam a profundidade e o tempo de processamento que a IA (modelos DeepSeek) utiliza para responder suas perguntas.

## Modos Disponíveis

### ⚡ Rápido (1x)
- **Velocidade**: Mais rápido
- **Uso de tokens**: Menor consumo
- **Ideal para**: Perguntas simples, respostas diretas, consultas rápidas
- **Exemplo de uso**: "Qual NCM para parafusos de aço?" ou "Qual o status do processo IMP-2024-0123?"

### 🎯 Auto (Recomendado)
- **Velocidade**: Ajusta automaticamente
- **Uso de tokens**: Otimizado conforme necessidade
- **Ideal para**: Uso geral, permite que a IA decida
- **Exemplo de uso**: A maioria dos casos - deixe a IA escolher

### 🧠 Profundo (3x)
- **Velocidade**: Mais lento (3x mais tokens)
- **Uso de tokens**: Maior consumo (~3x mais)
- **Ideal para**: Análises complexas, problemas técnicos, raciocínio detalhado
- **Exemplo de uso**: "Analise todos os custos de importação deste processo e sugira otimizações" ou "Crie uma estratégia completa de classificação fiscal para esta linha de produtos"

## Como Usar

### No Chat Widget
1. Abra o chat clicando no ícone flutuante
2. Clique no botão com o ícone de raio (⚡) ao lado do nome do agente
3. Selecione o modo desejado (1x, Auto ou 3x)
4. Continue conversando normalmente

### Na Página de Agentes
1. Acesse a página de Agentes IA
2. Inicie uma conversa com qualquer agente
3. No cabeçalho da conversa, clique no botão de modo de raciocínio
4. Selecione o modo desejado

## Considerações Técnicas

### Custos
- **1x**: ~2.000 tokens máximo por resposta
- **3x**: ~16.000 tokens máximo por resposta (até 8x mais caro)
- **auto**: Ajusta automaticamente entre 1x e 3x

### Performance
- **1x**: Respostas em 3-5 segundos
- **3x**: Respostas em 10-30 segundos
- **auto**: Varia conforme complexidade

### Quando usar cada modo?

#### Use 1x quando:
- Precisa de respostas rápidas
- A pergunta é direta e simples
- Está fazendo consultas básicas
- Quer economizar tokens/custos

#### Use Auto quando:
- Não tem certeza da complexidade
- Quer o melhor equilíbrio custo/benefício
- Confia na IA para decidir
- **Recomendado para uso geral**

#### Use 3x quando:
- Precisa de análise profunda
- O problema é complexo ou técnico
- Quer raciocínio passo-a-passo detalhado
- A qualidade é mais importante que velocidade
- Está disposto a pagar mais por melhor resultado

## Configuração do Servidor

Os modos podem ser configurados no arquivo `.env`:

```bash
# OpenRouter (Recomendado)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=deepseek/deepseek-chat
OPENROUTER_REASONING_EFFORT=auto  # 1x, 3x ou auto

# DeepSeek Direct (Fallback)
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_REASONING_EFFORT=auto  # 1x, 3x ou auto
```

## Modelos Suportados

Os modos de raciocínio funcionam com:
- ✅ `deepseek/deepseek-chat` (OpenRouter)
- ✅ `deepseek/deepseek-r1` (OpenRouter)
- ✅ `deepseek-chat` (DeepSeek Direct API)
- ✅ Outros modelos DeepSeek

Para modelos que não suportam `reasoning_effort`, o parâmetro é ignorado automaticamente.

## FAQ

**Q: Por que minhas respostas estão demorando mais?**  
A: Você pode estar usando o modo 3x. Troque para 1x ou Auto para respostas mais rápidas.

**Q: A resposta foi muito superficial, como melhorar?**  
A: Tente usar o modo 3x (Profundo) para obter análises mais detalhadas.

**Q: Qual modo devo usar por padrão?**  
A: Recomendamos **Auto**. A IA escolhe automaticamente o melhor modo baseado na complexidade da sua pergunta.

**Q: O modo afeta o custo das chamadas?**  
A: Sim. O modo 3x pode usar até 8x mais tokens que o modo 1x, aumentando o custo proporcionalmente.

**Q: Posso mudar o modo no meio de uma conversa?**  
A: Sim! Você pode alterar o modo a qualquer momento e ele será aplicado apenas às próximas mensagens.
