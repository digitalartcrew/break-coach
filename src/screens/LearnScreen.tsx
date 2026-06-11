import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SKILLS } from '@/data/skills';
import { Skill, SkillCategory } from '@/types/motion';
import { Button, Card, H1, H2, P, Pill, Row, Screen } from '@/components/ui';
import { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_LABEL: Record<SkillCategory, string> = {
  toprock: 'Toprock',
  footwork: 'Footwork',
  freeze: 'Freezes',
  power: 'Power',
  striking: 'Striking',
  grappling: 'Grappling',
  ballhandling: 'Ball handling',
  conditioning: 'Conditioning',
};

export function LearnScreen() {
  const nav = useNavigation<Nav>();

  const byCategory = SKILLS.reduce<Record<string, Skill[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Screen>
      <H1>Learn</H1>
      <P dim>Pick a move, record a short clip, and get instant coaching.</P>
      {Object.entries(byCategory).map(([cat, skills]) => (
        <React.Fragment key={cat}>
          <H2>{CATEGORY_LABEL[cat as SkillCategory] ?? cat}</H2>
          {skills.map((skill) => (
            <Card key={skill.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <P>{skill.name}</P>
                <Pill label={skill.difficulty} color={colors.accent} />
              </Row>
              <P dim>{skill.description}</P>
              <Button title="Practice this" onPress={() => nav.navigate('Record', { skillId: skill.id })} />
            </Card>
          ))}
        </React.Fragment>
      ))}
    </Screen>
  );
}
