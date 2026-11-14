// components/ErrorBoundary.js
import React, { Component } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import i18next from 'i18next'

// Shown instead of a white screen when something crashes while rendering.
// It states what failed (message + where) so the cause is visible, not hidden.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
      showDetails: false
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.log('ErrorBoundary caught an error', error, info?.componentStack)
    this.setState({ componentStack: info?.componentStack || '' })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, componentStack: '', showDetails: false })
  }

  render() {
    if (this.state.hasError) {
      const { error, componentStack, showDetails } = this.state
      const t = (key) => i18next.t(key)
      const stack = String(error?.stack || '').split('\n').slice(0, 8).join('\n')
      const where = String(componentStack || '').trim().split('\n').slice(0, 6).join('\n')
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{t('errCrashTitle')}</Text>
          <Text style={styles.message}>
            {error?.name ? `${error.name}: ` : ''}
            {error?.message || t('err_unknown')}
          </Text>

          <TouchableOpacity onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonText}>{t('errTryAgain')}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => this.setState({ showDetails: !showDetails })}>
            <Text style={styles.link}>{showDetails ? t('errHideDetails') : t('errShowDetails')}</Text>
          </TouchableOpacity>
          {showDetails && (
            <ScrollView style={styles.details}>
              <Text selectable style={styles.mono}>
                {[stack, where].filter(Boolean).join('\n\n')}
              </Text>
            </ScrollView>
          )}
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'red',
    textAlign: 'center'
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    color: '#333'
  },
  button: {
    backgroundColor: '#E4644B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  link: {
    color: '#555',
    textDecorationLine: 'underline'
  },
  details: {
    maxHeight: 220,
    alignSelf: 'stretch',
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    padding: 10
  },
  mono: {
    fontSize: 11,
    color: '#222',
    fontFamily: 'monospace'
  }
})
