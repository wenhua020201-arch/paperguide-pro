import type { Project, OutlineNode, GuideArticle, Slide, PaperMeta, Template } from '@/types';

export const TEMPLATES: Template[] = [
  {
    id: 'seminar',
    name: '组会汇报版',
    description: '强调研究问题、方法、实验设计和批判性评价，适合实验室组会讨论',
    tags: ['组会', '实验室', '批判性讨论'],
  },
  {
    id: 'course',
    name: '课程 Presentation 版',
    description: '结构清晰、讲解友好，背景知识解释更充分，适合课堂汇报',
    tags: ['课堂', '教学', '背景丰富'],
  },
  {
    id: 'proposal',
    name: '开题/综述版',
    description: '强调研究脉络、相关工作梳理和研究启发，适合开题报告或文献综述',
    tags: ['开题', '综述', '研究脉络'],
  },
  {
    id: 'crossfield',
    name: '跨方向交流版',
    description: '降低术语密度，增加直觉解释，适合向非本领域听众介绍研究',
    tags: ['跨领域', '通俗', '低术语'],
  },
];

export const MOCK_PAPER: PaperMeta = {
  title: 'Attention Is All You Need',
  authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit', 'Llion Jones', 'Aidan N. Gomez', 'Łukasz Kaiser', 'Illia Polosukhin'],
  year: 2017,
  keywords: ['Transformer', 'Self-Attention', 'Sequence-to-Sequence', 'Machine Translation', 'Neural Network'],
  topic: '基于纯注意力机制的序列转换模型',
  abstract: '本文提出了一种全新的简单网络架构——Transformer，完全基于注意力机制，摒弃了传统的循环和卷积结构。实验表明，该模型在机器翻译任务上取得了优异的性能，同时具有更高的并行化能力和更短的训练时间。',
};

export const MOCK_OUTLINE: OutlineNode = {
  id: 'root',
  parentId: null,
  level: 0,
  title: 'Attention Is All You Need',
  description: '基于纯注意力机制的 Transformer 架构',
  order: 0,
  children: [
    {
      id: 'n1',
      parentId: 'root',
      level: 1,
      title: '研究背景',
      description: '序列建模与传统方法的局限性',
      order: 0,
      children: [
        { id: 'n1-1', parentId: 'n1', level: 2, title: 'RNN/LSTM 的局限', description: '顺序计算限制了并行化能力，长距离依赖建模困难', order: 0, children: [] },
        { id: 'n1-2', parentId: 'n1', level: 2, title: '注意力机制的发展', description: '注意力已在编码器-解码器架构中广泛使用，但仍依赖 RNN', order: 1, children: [] },
      ],
    },
    {
      id: 'n2',
      parentId: 'root',
      level: 1,
      title: '研究问题',
      description: '能否仅用注意力机制构建高效的序列转换模型？',
      order: 1,
      children: [
        { id: 'n2-1', parentId: 'n2', level: 2, title: '核心假设', description: '自注意力机制可以完全替代循环和卷积', order: 0, children: [] },
      ],
    },
    {
      id: 'n3',
      parentId: 'root',
      level: 1,
      title: '方法：Transformer 架构',
      description: '编码器-解码器结构，核心为多头自注意力',
      order: 2,
      children: [
        { id: 'n3-1', parentId: 'n3', level: 2, title: '自注意力机制', description: 'Scaled Dot-Product Attention，计算 Query、Key、Value 的加权和', order: 0, children: [
          { id: 'n3-1-1', parentId: 'n3-1', level: 3, title: '缩放点积注意力', description: 'Q·K^T / √d_k 后 Softmax 加权 V', order: 0, children: [] },
          { id: 'n3-1-2', parentId: 'n3-1', level: 3, title: '多头注意力', description: '将 Q/K/V 投影到多个子空间并行计算', order: 1, children: [] },
        ] },
        { id: 'n3-2', parentId: 'n3', level: 2, title: '位置编码', description: '使用正弦/余弦函数编码位置信息', order: 1, children: [] },
        { id: 'n3-3', parentId: 'n3', level: 2, title: '前馈网络与残差连接', description: '每层包含 FFN 和 LayerNorm + 残差连接', order: 2, children: [] },
      ],
    },
    {
      id: 'n4',
      parentId: 'root',
      level: 1,
      title: '实验设计',
      description: '在 WMT 2014 英德、英法翻译任务上验证',
      order: 3,
      children: [
        { id: 'n4-1', parentId: 'n4', level: 2, title: '数据集与训练', description: 'WMT 2014 EN-DE (450万句对)，EN-FR (3600万句对)', order: 0, children: [] },
        { id: 'n4-2', parentId: 'n4', level: 2, title: '模型变体', description: 'Base 模型和 Big 模型，不同超参数配置', order: 1, children: [] },
      ],
    },
    {
      id: 'n5',
      parentId: 'root',
      level: 1,
      title: '主要结果',
      description: '在翻译质量和训练效率上都优于先前方法',
      order: 4,
      children: [
        { id: 'n5-1', parentId: 'n5', level: 2, title: 'BLEU 分数', description: 'EN-DE 28.4 BLEU，EN-FR 41.0 BLEU，均为当时 SOTA', order: 0, children: [] },
        { id: 'n5-2', parentId: 'n5', level: 2, title: '训练效率', description: '训练时间仅为先前最佳模型的一小部分', order: 1, children: [] },
      ],
    },
    {
      id: 'n6',
      parentId: 'root',
      level: 1,
      title: '讨论与评价',
      description: '优势、局限性与影响',
      order: 5,
      children: [
        { id: 'n6-1', parentId: 'n6', level: 2, title: '优势', description: '全并行化、全局依赖建模、可解释性', order: 0, children: [] },
        { id: 'n6-2', parentId: 'n6', level: 2, title: '局限', description: '对长序列的二次复杂度，位置编码的表达力', order: 1, children: [] },
      ],
    },
    {
      id: 'n7',
      parentId: 'root',
      level: 1,
      title: '启示与展望',
      description: '对后续研究的影响和启发',
      order: 6,
      children: [
        { id: 'n7-1', parentId: 'n7', level: 2, title: '对 NLP 的影响', description: '催生了 BERT、GPT 等预训练模型', order: 0, children: [] },
        { id: 'n7-2', parentId: 'n7', level: 2, title: '跨领域应用', description: '在计算机视觉 (ViT)、语音等领域的成功迁移', order: 1, children: [] },
      ],
    },
  ],
};

export const MOCK_ARTICLE: GuideArticle = {
  sections: [
    {
      id: 'sec-bg',
      title: '研究背景',
      paragraphs: [
        { id: 'p1', content: '在 Transformer 提出之前，序列建模任务主要依赖循环神经网络（RNN）及其变体 LSTM 和 GRU。这些模型的核心思想是按照时间步逐一处理输入序列中的元素，通过隐藏状态将历史信息向后传递。这种设计虽然在理论上能够建模任意长度的序列依赖关系，但在实际应用中面临着两个根本性的限制。', linkedSlideId: 's1' },
        { id: 'p1-2', content: '第一个限制是并行计算的困难。由于 RNN 的每一步计算都依赖于前一步的隐藏状态输出，这使得模型必须严格按照序列顺序进行前向传播，无法像卷积网络那样在空间维度上并行计算。当序列长度增大时，训练时间几乎成线性增长，严重制约了模型在大规模数据集上的可扩展性。在 2017 年前后，GPU 的并行计算能力已经非常强大，但 RNN 的这一结构性缺陷使其无法充分发挥硬件优势。', linkedSlideId: 's1' },
        { id: 'p2', content: '第二个限制是长距离依赖建模的困难。虽然 LSTM 和 GRU 通过门控机制缓解了传统 RNN 的梯度消失问题，但信息仍然需要经过多个时间步才能从序列的一端传递到另一端。路径长度随序列长度线性增长，导致在处理长文档或长句子时，早期的上下文信息往往被逐渐"遗忘"。注意力机制作为一种补充手段，已经在编码器-解码器架构中被广泛使用。它允许模型在生成每个输出时直接关注输入序列的任意位置，有效缓解了长距离依赖问题。然而，此前的注意力机制始终是作为 RNN 的附属组件存在的，模型的骨干仍然是循环结构。', linkedSlideId: 's1' },
      ],
    },
    {
      id: 'sec-prob',
      title: '研究问题',
      paragraphs: [
        { id: 'p3', content: '基于上述背景，Vaswani 等人提出了一个在当时看来相当大胆的研究问题：是否可以完全抛弃循环和卷积结构，仅依赖注意力机制来构建一个高效且高性能的序列转换模型？这一问题的提出直接挑战了当时序列建模的主流范式——几乎所有顶级模型都以 RNN 或 CNN 作为核心组件。', linkedSlideId: 's2' },
        { id: 'p3-2', content: '作者的核心假设是：自注意力机制不仅可以替代循环结构在序列建模中的功能，还能在并行化能力和长距离依赖建模两个方面实现根本性的提升。具体来说，他们期望新模型能够同时满足以下目标：（1）完全消除顺序计算的依赖，实现全并行训练；（2）使任意两个位置之间的信息传递路径缩短到常数级别；（3）在标准翻译基准上达到或超越当时最好的模型性能。', linkedSlideId: 's2' },
      ],
    },
    {
      id: 'sec-method',
      title: '方法：Transformer 架构',
      paragraphs: [
        { id: 'p4', content: 'Transformer 采用经典的编码器-解码器框架，但内部完全基于注意力机制，不包含任何循环或卷积操作。编码器由 N=6 个完全相同的层堆叠而成。每一层包含两个子层：第一个是多头自注意力子层，第二个是逐位置的全连接前馈网络。每个子层都使用残差连接，即子层的输出为 LayerNorm(x + Sublayer(x))。这种设计确保了梯度能够顺畅地流过深层网络。', linkedSlideId: 's3' },
        { id: 'p5', content: '模型的核心创新在于缩放点积注意力（Scaled Dot-Product Attention）。给定一组查询（Query）、键（Key）和值（Value），注意力的计算过程如下：首先计算 Q 和 K 的点积，得到注意力分数矩阵；然后除以缩放因子 √d_k（其中 d_k 是键向量的维度），防止点积值过大导致 softmax 函数进入梯度极小的饱和区域；最后通过 softmax 将分数归一化为权重，并用这些权重对 V 进行加权求和。公式为 Attention(Q,K,V) = softmax(QK^T/√d_k)V。', linkedSlideId: 's3' },
        { id: 'p5-2', content: '在此基础上，作者提出了多头注意力（Multi-Head Attention）机制。与其使用单一的注意力函数处理 d_model 维的键值查询，不如将 Q、K、V 分别线性投影到 h 个不同的低维子空间中（每个子空间维度为 d_k = d_model/h），然后在每个子空间中独立执行注意力计算，最后将所有头的输出拼接并再次投影。这使得模型能够同时关注来自不同位置和不同表示子空间的信息，类似于 CNN 中多个特征图的概念。', linkedSlideId: 's3' },
        { id: 'p6', content: '由于模型不包含任何循环结构，它本身没有感知序列中元素位置的能力。为了解决这个问题，Transformer 在输入嵌入中加入了位置编码（Positional Encoding）。作者使用了基于正弦和余弦函数的固定位置编码方案：PE(pos,2i) = sin(pos/10000^(2i/d_model))，PE(pos,2i+1) = cos(pos/10000^(2i/d_model))。选择这种编码方式有两个原因：一是它可以为任意位置生成唯一的编码向量；二是对于任意固定偏移 k，PE(pos+k) 可以表示为 PE(pos) 的线性函数，这使得模型可以学习到相对位置关系，并且能推广到训练时未见过的序列长度。', linkedSlideId: 's4' },
      ],
    },
    {
      id: 'sec-exp',
      title: '实验设计',
      paragraphs: [
        { id: 'p7', content: '研究者在两个标准的机器翻译基准任务上评估了 Transformer 的性能。第一个是 WMT 2014 英语-德语翻译任务，训练集包含约 450 万个句子对，使用 BPE 编码产生约 37000 个共享词汇。第二个是 WMT 2014 英语-法语翻译任务，规模更大，包含约 3600 万个句子对，词汇量为 32000 个 word-piece。', linkedSlideId: 's5' },
        { id: 'p7-2', content: '作者设计了两种规模的模型配置：Base 模型（d_model=512, h=8, d_ff=2048, 6层, 约 6500 万参数）和 Big 模型（d_model=1024, h=16, d_ff=4096, 6层, 约 2.13 亿参数）。训练在 8 块 NVIDIA P100 GPU 上进行，Base 模型训练约 12 小时（10 万步，每步 0.4 秒），Big 模型训练约 3.5 天（30 万步，每步 1.0 秒）。作者还进行了详尽的消融实验来验证各个组件的贡献。', linkedSlideId: 's5' },
      ],
    },
    {
      id: 'sec-results',
      title: '主要结果',
      paragraphs: [
        { id: 'p8', content: '实验结果令人印象深刻。在英语-德语翻译任务上，Transformer Big 模型达到了 28.4 BLEU 分数，比之前的最佳结果（包括集成模型）高出超过 2.0 BLEU。在英语-法语翻译任务上，Transformer Big 模型达到了 41.0 BLEU，创造了新的单模型最高纪录，而训练成本仅为之前最佳模型的约四分之一。', linkedSlideId: 's6' },
        { id: 'p8-2', content: '消融实验进一步揭示了模型各组件的重要性。减少注意力头的数量或减小键/值的维度都会导致性能下降，证明了多头注意力的必要性。增大模型规模（d_model 和 d_ff）带来了一致的性能提升。使用学习的位置编码代替正弦位置编码产生了几乎相同的结果，说明位置编码的具体形式并不关键。此外，作者还在英语成分句法分析任务上进行了实验，表明 Transformer 的泛化能力不限于机器翻译。', linkedSlideId: 's6' },
      ],
    },
    {
      id: 'sec-discuss',
      title: '讨论与评价',
      paragraphs: [
        { id: 'p9', content: '从方法论的角度来看，Transformer 具有三个显著优势。第一，全并行化计算。由于自注意力操作对序列中所有位置同时进行计算，模型可以充分利用 GPU 的并行能力，训练效率大幅提升。第二，常数级别的路径长度。自注意力使得任意两个位置之间的信息传递只需一步操作，路径长度为 O(1)，远优于 RNN 的 O(n) 和 CNN 的 O(log_k(n))。第三，一定程度的可解释性。注意力权重矩阵可以可视化，展示模型在生成每个输出时关注了输入的哪些部分。', linkedSlideId: 's7' },
        { id: 'p9-2', content: '然而，Transformer 也存在一些值得注意的局限性。最突出的是自注意力的计算复杂度为 O(n²)，其中 n 是序列长度。这意味着当处理非常长的序列（如整篇文档或高分辨率图像）时，计算成本和显存占用会急剧增加。此外，固定的位置编码方案虽然简洁，但其表达能力可能不如可学习的方案灵活。模型也缺乏对局部结构的归纳偏置——不像 CNN 天然具有平移不变性，也不像 RNN 天然建模序列的递推关系。', linkedSlideId: 's7' },
      ],
    },
    {
      id: 'sec-impact',
      title: '启示与展望',
      paragraphs: [
        { id: 'p10', content: 'Transformer 的影响可以说是深度学习历史上最深远的之一。在自然语言处理领域，它直接催生了两条主要的技术路线：以 BERT 为代表的编码器系列模型，通过掩码语言模型预训练获得强大的文本理解能力；以 GPT 为代表的解码器系列模型，通过自回归预训练展现出惊人的文本生成能力。这两条路线推动了 NLP 从针对每个任务单独训练模型的范式，转向"大规模预训练 + 下游微调"的新范式。', linkedSlideId: 's8' },
        { id: 'p10-2', content: 'Transformer 的成功也迅速扩展到其他领域。Dosovitskiy 等人提出的 Vision Transformer (ViT) 证明了纯 Transformer 架构在图像分类任务上也能达到与 CNN 相当甚至更好的性能，颠覆了计算机视觉领域长期以来对卷积网络的依赖。在语音处理领域，Transformer 被用于语音识别和合成。在科学计算领域，AlphaFold2 利用 Transformer 的注意力机制实现了蛋白质结构的精确预测。可以说，Transformer 已经成为深度学习的"通用骨干架构"，其影响仍在持续扩展中。', linkedSlideId: 's8' },
      ],
    },
  ],
};

export const MOCK_SLIDES: Slide[] = [
  {
    id: 's0',
    order: 0,
    title: 'Attention Is All You Need',
    contentBlocks: [
      { id: 'b0-1', type: 'text', content: 'Vaswani et al., NeurIPS 2017' },
      { id: 'b0-2', type: 'text', content: '导读人：张三 | 2025.03' },
    ],
    layout: 'cover',
    notes: { mainTalk: '开场介绍论文基本信息，说明这是一篇关于 Transformer 架构的经典论文。', extraExplanation: '可以提及这篇论文的引用量和影响力。', transitionSentence: '接下来我们先看一下这篇论文的研究背景。', tone: 'natural' },
  },
  {
    id: 's1',
    order: 1,
    title: '研究背景',
    contentBlocks: [
      { id: 'b1-1', type: 'point', content: 'RNN/LSTM 是序列建模的主流方法，但存在顺序计算瓶颈' },
      { id: 'b1-2', type: 'point', content: '长距离依赖建模困难，信息传递路径随序列长度线性增长' },
      { id: 'b1-3', type: 'point', content: '注意力机制已在 Seq2Seq 中使用，但仍依赖 RNN 作为骨干' },
    ],
    layout: 'title-points',
    linkedArticleSection: 'sec-bg',
    notes: { mainTalk: '先介绍当时的主流方法 RNN 和 LSTM，重点说明它们在并行计算和长距离依赖上的两个核心限制。', extraExplanation: '可以画一个简单的 RNN 展开图来说明顺序计算的问题。', transitionSentence: '基于这些限制，作者提出了一个大胆的假设。', tone: 'classroom' },
  },
  {
    id: 's2',
    order: 2,
    title: '研究问题',
    contentBlocks: [
      { id: 'b2-1', type: 'finding', content: '核心问题：能否仅用注意力机制构建高效的序列转换模型？' },
      { id: 'b2-2', type: 'point', content: '完全抛弃循环和卷积结构' },
      { id: 'b2-3', type: 'point', content: '目标：更高的并行化能力 + 更好的长距离依赖建模' },
    ],
    layout: 'title-findings',
    linkedArticleSection: 'sec-prob',
    notes: { mainTalk: '强调这个研究问题的大胆之处——在当时完全去掉 RNN 是非常激进的想法。', extraExplanation: '可以提到当时社区对这一方向的质疑。', transitionSentence: '为了回答这个问题，作者设计了 Transformer 架构。', tone: 'natural' },
  },
  {
    id: 's3',
    order: 3,
    title: 'Transformer 核心架构',
    contentBlocks: [
      { id: 'b3-1', type: 'point', content: '编码器-解码器架构，各 6 层' },
      { id: 'b3-2', type: 'point', content: '多头自注意力（Multi-Head Self-Attention）' },
      { id: 'b3-3', type: 'subpoint', content: 'Attention(Q,K,V) = softmax(QK^T/√d_k)V' },
      { id: 'b3-4', type: 'subpoint', content: '多头：投影到 h 个子空间并行计算' },
      { id: 'b3-5', type: 'point', content: '残差连接 + 层归一化' },
      { id: 'b3-6', type: 'point', content: '前馈网络（Position-wise FFN）' },
    ],
    layout: 'title-subpoints',
    linkedArticleSection: 'sec-method',
    notes: { mainTalk: '这是全文最核心的部分，重点讲解自注意力的计算过程。建议在白板上写出注意力公式。', extraExplanation: '多头注意力的直觉：不同的头可以关注不同类型的关系，比如语法关系、语义关系等。', transitionSentence: '除了注意力之外，还有一个重要的设计是位置编码。', tone: 'classroom' },
  },
  {
    id: 's4',
    order: 4,
    title: '位置编码与模型细节',
    contentBlocks: [
      { id: 'b4-1', type: 'point', content: '正弦/余弦位置编码：PE(pos,2i) = sin(pos/10000^(2i/d))' },
      { id: 'b4-2', type: 'point', content: '可推广到训练时未见过的序列长度' },
      { id: 'b4-3', type: 'point', content: '解码器使用掩码自注意力防止信息泄露' },
    ],
    layout: 'title-points',
    linkedArticleSection: 'sec-method',
    notes: { mainTalk: '讲解位置编码的设计动机——因为没有 RNN，需要显式注入位置信息。', extraExplanation: '正弦函数的选择有数学上的优雅性：可以通过线性变换表示相对位置。', transitionSentence: '架构介绍完了，接下来看实验设置。', tone: 'natural' },
  },
  {
    id: 's5',
    order: 5,
    title: '实验设计',
    contentBlocks: [
      { id: 'b5-1', type: 'point', content: 'WMT 2014 EN-DE：约 450 万句对' },
      { id: 'b5-2', type: 'point', content: 'WMT 2014 EN-FR：约 3600 万句对' },
      { id: 'b5-3', type: 'point', content: 'Base 模型：8 GPU × 12 小时' },
      { id: 'b5-4', type: 'point', content: 'Big 模型：8 GPU × 3.5 天' },
    ],
    layout: 'title-points',
    linkedArticleSection: 'sec-exp',
    notes: { mainTalk: '简要介绍数据规模和训练配置，重点突出训练效率。', extraExplanation: '对比当时其他模型的训练时间来凸显 Transformer 的高效。', transitionSentence: '那么这样的模型表现如何呢？', tone: 'concise' },
  },
  {
    id: 's6',
    order: 6,
    title: '主要结果',
    contentBlocks: [
      { id: 'b6-1', type: 'finding', content: 'EN-DE：28.4 BLEU（+2.0 超越前 SOTA）' },
      { id: 'b6-2', type: 'finding', content: 'EN-FR：41.0 BLEU（新 SOTA，训练成本仅为前最佳的 1/4）' },
      { id: 'b6-3', type: 'summary', content: '在翻译质量和训练效率上实现了双重突破' },
    ],
    layout: 'title-results',
    linkedArticleSection: 'sec-results',
    notes: { mainTalk: '用数字说话，强调两个维度的提升：翻译质量更好，训练速度更快。', extraExplanation: 'BLEU 是机器翻译的标准评价指标，28.4 在当时是非常高的分数。', transitionSentence: '下面我们来讨论一下这篇工作的优缺点。', tone: 'formal' },
  },
  {
    id: 's7',
    order: 7,
    title: '讨论与评价',
    contentBlocks: [
      { id: 'b7-1', type: 'point', content: '✅ 全并行化，训练效率大幅提升' },
      { id: 'b7-2', type: 'point', content: '✅ O(1) 路径长度，长距离依赖建模能力强' },
      { id: 'b7-3', type: 'point', content: '✅ 注意力权重提供可解释性' },
      { id: 'b7-4', type: 'point', content: '⚠️ 自注意力 O(n²) 复杂度，长序列处理受限' },
      { id: 'b7-5', type: 'point', content: '⚠️ 固定位置编码的表达力有限' },
    ],
    layout: 'title-two-column',
    linkedArticleSection: 'sec-discuss',
    notes: { mainTalk: '客观评价这篇工作，先讲优势再讲局限。优势是三个，局限主要是两个。', extraExplanation: 'O(n²) 的问题后来催生了一系列高效 Transformer 的研究，如 Longformer、Linear Transformer 等。', transitionSentence: '最后来看看这篇论文对后续研究的深远影响。', tone: 'classroom' },
  },
  {
    id: 's8',
    order: 8,
    title: '启示与展望',
    contentBlocks: [
      { id: 'b8-1', type: 'point', content: '催生 BERT、GPT 等预训练语言模型' },
      { id: 'b8-2', type: 'point', content: '推动 NLP 从 task-specific 到 pre-train + fine-tune 范式转变' },
      { id: 'b8-3', type: 'point', content: '跨领域迁移：Vision Transformer、语音、蛋白质结构预测' },
      { id: 'b8-4', type: 'summary', content: '一篇真正改变了整个深度学习研究方向的奠基性工作' },
    ],
    layout: 'title-points',
    linkedArticleSection: 'sec-impact',
    notes: { mainTalk: '总结这篇论文的深远影响，从 NLP 扩展到整个 AI 领域。', extraExplanation: '可以提到 Transformer 现在在几乎所有 AI 子领域都是默认架构。', transitionSentence: '以上就是这篇论文的全部导读内容，谢谢大家。', tone: 'natural' },
  },
];

export const MOCK_PROJECT: Project = {
  id: 'demo-project',
  paper: MOCK_PAPER,
  outline: MOCK_OUTLINE,
  article: MOCK_ARTICLE,
  slides: MOCK_SLIDES,
  template: 'seminar',
  density: 'standard',
  updatedAt: '2025-03-08T14:30:00Z',
};
