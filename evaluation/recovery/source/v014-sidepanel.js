  function gapFromAgent(rawFields, gap) {
    const members = (rawFields || []).filter((field) =>
      field.fieldKey === gap.fieldKey || field.groupKey === gap.fieldKey);
    const field = members[0] || {};
    const groupOptions = members.length > 1
      ? members.map((member) => ({
        value: member.optionValue ?? member.value ?? member.optionLabel ?? member.label,
        label: member.optionLabel ?? member.label ?? member.optionValue ?? member.value,
      }))
      : (field.options || []).map((option) => ({
        value: option.value ?? option.optionValue ?? option.label,
        label: option.label ?? option.optionLabel ?? option.value,
      }));
    const choice = groupOptions.length > 0 || ['radio', 'checkbox', 'select-one'].includes(field.type);
    const label = field.question || field.label || 'Required form question';
    return {
      fieldKey: gap.fieldKey,
      label,
      purpose: '',
      question: gap.question || (String(label).endsWith('?') ? label : `What should I enter for ${String(label).toLowerCase()}?`),
      kind: choice ? 'decision' : 'required',
      required: Boolean(field.required),
      inputType: choice ? 'choice' : 'text',
      options: groupOptions,
      sensitive: Boolean(field.sensitive),
      agentReason: gap.reason || '',
    };
  }

  function analysisFromAgentPlan(response, participant, plan) {
    const analysis = engine.buildAnalysis(response.fields || [], participant, {
      purposeOverrides: plan.purposeOverrides,
      requirePurposeOverrides: true,
    });
    const suggestedGaps = new Map((plan.gaps || []).map((gap) => [gap.fieldKey, gap]));
    const gaps = analysis.gaps.map((gap) => {
      const coveredKeys = [gap.fieldKey, ...(gap.members || []).map((member) => member.fieldKey)];
      const suggestion = coveredKeys.map((fieldKey) => suggestedGaps.get(fieldKey)).find(Boolean);
      if (!suggestion) return gap;
      coveredKeys.forEach((fieldKey) => suggestedGaps.delete(fieldKey));
      return {
        ...gap,
        question: gap.inputType === 'multi_choice' ? gap.question : (suggestion.question || gap.question),
        agentReason: suggestion.reason || '',
      };
    });
    suggestedGaps.forEach((gap) => gaps.push(gapFromAgent(response.fields || [], gap)));
    return {
      ...analysis,
      gaps,
      counts: { ...analysis.counts, missing: gaps.length },
    };
  }

