import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card, PrimaryButton } from '../index';

describe('ui exports', () => {
  it('renders Card title and children', () => {
    render(
      <Card title="Dashboard">
        <span>Content</span>
      </Card>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('invokes handler when PrimaryButton is pressed', () => {
    const onPress = vi.fn();
    render(<PrimaryButton label="Sign in" onPress={onPress} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
